import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

export const POST: APIRoute = async ({ request }) => {
  try {
    const { price_id, user_id, email, mode } = await request.json()
    if (!price_id || !user_id || !email) {
      return new Response(JSON.stringify({ error: 'Missing params' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
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
      'metadata[site_id]': 'add6d12c-ecd8-4517-b2e5-0f4977603744',
    })

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${(env as any).STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString()
    })

    const session = await res.json() as any
    if (session.error) return new Response(JSON.stringify({ error: session.error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })

    return new Response(JSON.stringify({ url: session.url }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }
}
