import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.text()
    const sig = request.headers.get('stripe-signature') || ''
    const webhookSecret = (env as any).STRIPE_WEBHOOK_SECRET

    // Verify signature
    if (webhookSecret) {
      const encoder = new TextEncoder()
      const parts = sig.split(',').reduce((acc: any, part) => {
        const [k, v] = part.split('=')
        acc[k] = v
        return acc
      }, {})
      const timestamp = parts.t
      const expectedSig = parts.v1
      const signedPayload = `${timestamp}.${payload}`
      const key = await crypto.subtle.importKey('raw', encoder.encode(webhookSecret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
      const computed = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
      if (computed !== expectedSig) {
        return new Response('Invalid signature', { status: 400 })
      }
    }

    const event = JSON.parse(payload)
    const supabase = await import('@supabase/supabase-js').then(m =>
      m.createClient((env as any).PUBLIC_SUPABASE_URL, (env as any).SUPABASE_SERVICE_ROLE_KEY)
    )

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object
      const user_id = session.metadata?.user_id
      const site_id = session.metadata?.site_id
      if (!user_id || !site_id) return new Response('OK', { status: 200 })

      // Find the plan by price ID
      const lineItems = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items`, {
        headers: { 'Authorization': `Bearer ${(env as any).STRIPE_SECRET_KEY}` }
      }).then(r => r.json()) as any

      const priceId = lineItems.data?.[0]?.price?.id
      if (!priceId) return new Response('OK', { status: 200 })

      const { data: plan } = await supabase
        .from('plans')
        .select('id, credits, plan_type, name')
        .eq('stripe_price_id', priceId)
        .single()

      if (!plan) return new Response('OK', { status: 200 })

      // Upsert credits
      const { data: existing } = await supabase
        .from('credits')
        .select('balance')
        .eq('user_id', user_id)
        .eq('site_id', site_id)
        .single()

      if (existing) {
        await supabase.from('credits').update({ balance: existing.balance + plan.credits, updated_at: new Date().toISOString() }).eq('user_id', user_id).eq('site_id', site_id)
      } else {
        await supabase.from('credits').insert({ user_id, site_id, balance: plan.credits })
      }

      // Log transaction
      await supabase.from('credit_transactions').insert({
        user_id, site_id,
        delta: plan.credits,
        reason: plan.plan_type === 'subscription' ? 'subscription_grant' : 'topup_purchase',
        plan_id: plan.id,
        stripe_payment_id: session.payment_intent || session.id
      })

      // Track subscription
      if (plan.plan_type === 'subscription') {
        await supabase.from('user_plans').upsert({
          user_id, site_id,
          plan_id: plan.id,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
          status: 'active',
          updated_at: new Date().toISOString()
        }, { onConflict: 'user_id,site_id' })
      }
    }

    return new Response('OK', { status: 200 })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
}
