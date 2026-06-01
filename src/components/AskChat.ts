/** Lightweight markdown renderer — GAUK aesthetic */
export function renderMarkdown(text: string): string {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^### (.+)$/gm, '<div class="ask-md-h3">$1</div>')
    .replace(/^## (.+)$/gm, '<div class="ask-md-h2">$1</div>')
    .replace(/^# (.+)$/gm, '<div class="ask-md-h2">$1</div>')
    .replace(/^[-*] (.+)$/gm, '<div class="ask-md-li"><span class="ask-md-dot">◆</span><span>$1</span></div>')
    .replace(/^\d+\. (.+)$/gm, '<div class="ask-md-li"><span class="ask-md-dot">◆</span><span>$1</span></div>')
    .split('\n\n').map(p => p.trim() ? `<p class="ask-md-p">${p.replace(/\n/g, '<br>')}</p>` : '').join('')
}

/** Humanise a source slug */
function humaniseSource(slug: string): string {
  return slug.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
}

/** Simple hash for guest session tracking */
export function getGuestCount(): number {
  return parseInt(sessionStorage.getItem('ask_guest_count') || '0')
}

export function incrementGuestCount(): number {
  const count = getGuestCount() + 1
  sessionStorage.setItem('ask_guest_count', count.toString())
  return count
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}

export interface SpineMark {
  name: string
  image_url: string
  source: string
  gauk_id: string
}

export interface AskResponse {
  answer: string
  sources: string[]
  marks: SpineMark[]
  cached: boolean
  error?: string
}

/** Send a message to the Ask API */
export async function sendToAsk(
  message: string,
  history: Message[],
  context: string,
  userId: string | null,
  identificationResult: any | null
): Promise<AskResponse> {
  const res = await fetch('/api/ask', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      history,
      context,
      user_id: userId,
      site_id: 'add6d12c-ecd8-4517-b2e5-0f4977603744',
      identification_result: identificationResult
    })
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error)
  return data
}

/** Build a user message bubble */
export function buildUserBubble(text: string): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'ask-msg ask-msg-user'
  const escaped = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  wrap.innerHTML = `<div class="ask-bubble ask-bubble-user">${escaped}</div>`
  return wrap
}

/** Build mark image cards from spine results */
function buildMarkCards(marks: SpineMark[]): string {
  if (!marks || marks.length === 0) return ''
  const cards = marks.map(m => `
    <div class="ask-mark-card">
      <img class="ask-mark-img" src="${m.image_url}" alt="${m.name}" loading="lazy" />
      <div class="ask-mark-name">${m.name}</div>
      <div class="ask-mark-source">Source: ${m.source}</div>
    </div>`).join('')
  return `<div class="ask-mark-grid">${cards}</div>`
}

/** Build an AI message bubble with optional sources and mark images */
export function buildAIBubble(text: string, sources: string[], marks: SpineMark[] = []): HTMLElement {
  const wrap = document.createElement('div')
  wrap.className = 'ask-msg ask-msg-ai'
  let html = `<div class="ask-bubble ask-bubble-ai">${renderMarkdown(text)}</div>`
  if (marks && marks.length > 0) {
    html += buildMarkCards(marks)
  }
  if (sources && sources.length > 0 && (!marks || marks.length === 0)) {
    html += `<div class="ask-sources">${sources.map(s => `<span class="ask-source-tag">${s}</span>`).join('')}</div>`
  }
  wrap.innerHTML = html
  return wrap
}

/** Build typing indicator */
export function buildTyping(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'ask-msg ask-msg-ai'
  el.id = 'ask-typing'
  el.innerHTML = `<div class="ask-typing"><span></span><span></span><span></span></div>`
  return el
}

/** Build guest gate message */
export function buildGuestGate(): HTMLElement {
  const el = document.createElement('div')
  el.className = 'ask-msg ask-msg-ai ask-gate-msg'
  el.innerHTML = `
    <div class="ask-bubble ask-bubble-ai ask-bubble-gate">
      <p class="ask-md-p">You are asking great questions — I can already tell you have a good eye. To give you better answers, remember your conversation history and unlock your personal library, all I need is a free account. It takes thirty seconds and there is no card required.</p>
      <a href="/auth/signup" class="ask-gate-btn">Register free →</a>
    </div>`
  return el
}
