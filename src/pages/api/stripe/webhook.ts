import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'

type CloudflareEnv = {
  STRIPE_WEBHOOK_SECRET: string
  STRIPE_SECRET_KEY: string
  PUBLIC_SUPABASE_URL: string
  SUPABASE_SERVICE_ROLE_KEY: string
}

function getEnv() {
  return env as unknown as CloudflareEnv
}

function getSupabase() {
  const e = getEnv()
  return createClient(e.PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY)
}

async function verifySignature(payload: string, sig: string, secret: string): Promise<boolean> {
  const parts = sig.split(',').reduce((acc: Record<string, string>, part) => {
    const [k, v] = part.split('=')
    acc[k] = v
    return acc
  }, {})
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(`${parts.t}.${payload}`))
  const computed = Array.from(new Uint8Array(mac)).map(b => b.toString(16).padStart(2, '0')).join('')
  return computed === parts.v1
}

async function upsertCredits(supabase: ReturnType<typeof getSupabase>, user_id: string, site_id: string, credits: number) {
  const { data: existing } = await supabase
    .from('credits').select('balance')
    .eq('user_id', user_id).eq('site_id', site_id).single() as { data: { balance: number } | null, error: unknown }

  if (existing) {
    await supabase.from('credits')
      .update({ balance: existing.balance + credits, updated_at: new Date().toISOString() })
      .eq('user_id', user_id).eq('site_id', site_id)
  } else {
    await supabase.from('credits').insert({ user_id, site_id, balance: credits })
  }
}

async function handleCheckoutCompleted(session: Record<string, unknown>) {
  const user_id = (session.metadata as Record<string, string>)?.user_id
  const site_id = (session.metadata as Record<string, string>)?.site_id
  if (!user_id || !site_id) return

  const e = getEnv()
  const lineItems = await fetch(`https://api.stripe.com/v1/checkout/sessions/${session.id}/line_items`, {
    headers: { Authorization: `Bearer ${e.STRIPE_SECRET_KEY}` }
  }).then(r => r.json()) as { data: { price: { id: string } }[] }

  const priceId = lineItems.data?.[0]?.price?.id
  if (!priceId) return

  const supabase = getSupabase()
  const { data: plan } = await supabase
    .from('plans').select('id, credits, plan_type, name')
    .eq('stripe_price_id', priceId).single()
  if (!plan) return

  await upsertCredits(supabase, user_id, site_id, plan.credits)

  await supabase.from('credit_transactions').insert({
    user_id, site_id,
    delta: plan.credits,
    reason: plan.plan_type === 'subscription' ? 'subscription_grant' : 'topup_purchase',
    plan_id: plan.id,
    stripe_payment_id: session.payment_intent || session.id,
  })

  if (plan.plan_type === 'subscription') {
    await supabase.from('user_plans').upsert({
      user_id, site_id, plan_id: plan.id,
      stripe_customer_id: session.customer,
      stripe_subscription_id: session.subscription,
      status: 'active', updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,site_id' })
  }
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const payload = await request.text()
    const sig = request.headers.get('stripe-signature') || ''
    const secret = getEnv().STRIPE_WEBHOOK_SECRET

    if (secret) {
      const valid = await verifySignature(payload, sig, secret)
      if (!valid) return new Response('Invalid signature', { status: 400 })
    }

    const event = JSON.parse(payload)
    if (event.type === 'checkout.session.completed') {
      await handleCheckoutCompleted(event.data.object)
    }

    return new Response('OK', { status: 200 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), { status: 500 })
  }
}
