import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'
import { ANTIQUES_SITE_ID } from '../../../lib/constants'
import type { CloudflareEnv } from '../../../lib/constants'

type StripeSession = {
  url?: string
  error?: { message: string }
}


const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

export const POST: APIRoute = async ({ request }) => {
  try {
    const { price_id, user_id, email, mode } = await request.json()
    if (!price_id || !user_id || !email) {
      return json({ error: 'Missing params' }, 400)
    }

    const origin = new URL(request.url).origin
    const body = new URLSearchParams({
      'payment_method_types[]': 'card',
      'line_items[0][price]': price_id,
      'line_items[0][quantity]': '1',
      'mode': mode || 'payment',
      'success_url': `${origin}/account?payment=success`,
      'cancel_url': `${origin}/pricing?payment=cancelled`,
      'customer_email': email,
      'metadata[user_id]': user_id,
      'metadata[site_id]': ANTIQUES_SITE_ID,
    })

    const stripeKey = (env as unknown as CloudflareEnv).STRIPE_SECRET_KEY
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${stripeKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    })

    const session = await res.json() as StripeSession
    if (session.error) return json({ error: session.error.message }, 500)

    return json({ url: session.url })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return json({ error: message }, 500)
  }
}
