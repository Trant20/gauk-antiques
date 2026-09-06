import type { APIRoute } from 'astro'

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

    // Send via Resend (or fallback to console log if not configured)
    const resendKey = import.meta.env.RESEND_API_KEY
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from:    'feedback@gaukmedia.com',
          to:      ['support@gaukmedia.com'],
          subject,
          text:    body,
        }),
      })
    } else {
      // Fallback — log to console (Vercel will capture it)
      console.log('[FEEDBACK]', subject, '\n', body)
    }

    return new Response(JSON.stringify({ ok: true }), { status: 200 })
  } catch (e) {
    console.error('[feedback] error:', e)
    return new Response(JSON.stringify({ error: 'Failed' }), { status: 500 })
  }
}
