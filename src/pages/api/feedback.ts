import type { APIRoute } from 'astro'
import { env } from 'cloudflare:workers'

export const POST: APIRoute = async ({ request }) => {
  try {
    const { type, url, message, email } = await request.json()

    if (!type || !message) {
      return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400 })
    }

    const typeLabels: Record<string, string> = {
      bug:     'Bug or error',
      feature: 'Feature request',
      content: 'Content issue',
      other:   'Other',
    }

    const subject = `[GAUK Feedback] ${typeLabels[type] || type} from ${email}`
    const body = [
      `From: ${email}`,
      `Type: ${typeLabels[type] || type}`,
      `Page: ${url || 'not provided'}`,
      '',
      'Message:',
      message,
    ].join('\n')

    const e = env as any
    const resendKey = e.RESEND_API_KEY

    if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from:    'noreply@gaukmedia.com',
          to:      ['support@gaukmedia.com'],
          subject,
          text:    body,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('[feedback] Resend error:', err)
      }
    } else {
      console.log('[FEEDBACK]', subject, '\n', body)
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    console.error('[feedback] error:', e)
    return new Response(JSON.stringify({ error: 'Failed' }), { status: 500 })
  }
}
