import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { createClient } from '@supabase/supabase-js'
import type { CloudflareEnv } from '../../../lib/constants'

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

export const POST: APIRoute = async ({ request }) => {
  try {
    const { user_id, site_id } = await request.json()
    if (!user_id || !site_id) return json({ error: 'Missing params' }, 400)

    const e = env as unknown as CloudflareEnv
    const supabase = createClient(e.PUBLIC_SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY)

    // Get the active subscription
    const { data: userPlan, error: planErr } = await supabase
      .from('user_plans')
      .select('stripe_subscription_id, status')
      .eq('user_id', user_id)
      .eq('site_id', site_id)
      .eq('status', 'active')
      .single()

    if (planErr || !userPlan?.stripe_subscription_id) {
      return json({ error: 'No active subscription found' }, 404)
    }

    // Cancel at period end via Stripe
    const stripeRes = await fetch(`https://api.stripe.com/v1/subscriptions/${userPlan.stripe_subscription_id}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${e.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ 'cancel_at_period_end': 'true' }).toString(),
    })

    const stripeData = await stripeRes.json() as { id?: string; cancel_at_period_end?: boolean; current_period_end?: number; error?: { message: string } }
    if (stripeData.error) return json({ error: stripeData.error.message }, 500)

    // Update user_plans status
    await supabase
      .from('user_plans')
      .update({
        status: 'cancelling',
        current_period_end: stripeData.current_period_end
          ? new Date(stripeData.current_period_end * 1000).toISOString()
          : null,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user_id)
      .eq('site_id', site_id)

    return json({ ok: true, period_end: stripeData.current_period_end })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
}
