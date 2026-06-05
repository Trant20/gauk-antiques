/** Wire up identification result card event handlers.
 *  Call once per page after DOM is ready.
 *  @param prefix - ID prefix used in IdentificationResult.astro ('' for index, 'cat' for category pages)
 *  @param session - Supabase session or null
 */
export function wireIdentificationResult(
  prefix: string,
  session: { user: { id: string }; access_token: string } | null
): void {
  const p = prefix ? prefix + '-' : ''

  const g = (id: string) => document.getElementById(p + id)

  document.addEventListener('widget-reset-result', () => {
    const ro = g('result-outer') as HTMLElement | null
    if (ro) ro.style.display = 'none'
  })

  document.addEventListener('guest-limit-reached', () => {
    const outer = g('result-outer') as HTMLElement | null
    const idTable = document.querySelector('.result-id-table') as HTMLElement | null
    const blurContent = g('blur-content') as HTMLElement | null
    const ctaWrap = g('result-gate-cta-wrap') as HTMLElement | null
    const typedEl = g('result-gate-typed') as HTMLElement | null
    const cursorEl = g('result-gate-cursor') as HTMLElement | null
    if (!outer || !ctaWrap || !typedEl || !cursorEl) return
    if (idTable) idTable.style.display = 'none'
    if (blurContent) blurContent.style.display = 'none'
    ctaWrap.style.display = 'block'
    outer.style.display = 'block'
    outer.scrollIntoView({ behavior: 'smooth', block: 'start' })
    const msg = 'You have a good eye. I have identified two pieces for you — to keep going and unlock full valuations, all I need is a free account. Thirty seconds, no card required.'
    let i = 0
    typedEl.textContent = ''
    cursorEl.style.display = 'inline-block'
    function type() {
      if (i < msg.length) { typedEl!.textContent += msg[i]; i++; setTimeout(type, 24) }
      else { cursorEl!.style.display = 'none' }
    }
    setTimeout(type, 300)
  })

  document.addEventListener('identification-complete', (e: Event) => {
    const identifyData = (e as CustomEvent).detail
    const r = identifyData.result

    const setEl = (id: string, val: string) => {
      const el = g(id)
      if (el) el.textContent = val
    }

    setEl('result-category', r.category || '')
    setEl('result-confidence', r.confidence || '')
    setEl('result-title', r.subcategory || '')
    setEl('result-condition', r.condition || '')

    const notesEl = g('result-notes') as HTMLElement | null
    const notes = [r.condition_notes, r.confidence_notes].filter(Boolean).join(' ')
    if (notesEl && notes) notesEl.textContent = notes

    const typedText = g('typed-text') as HTMLElement | null
    const typedCursor = g('typed-cursor') as HTMLElement | null
    if (typedText && typedCursor) {
      const desc = r.description || ''
      let ti = 0
      typedText.textContent = ''
      typedCursor.style.display = 'inline-block'
      function typeChar() {
        if (ti < desc.length) {
          typedText!.textContent += desc[ti]; ti++
          setTimeout(typeChar, 22)
        } else {
          typedCursor!.style.display = 'none'
          if (!session) {
            const ctaWrap = g('result-gate-cta-wrap') as HTMLElement | null
            const typedEl = g('result-gate-typed') as HTMLElement | null
            const cursorEl = g('result-gate-cursor') as HTMLElement | null
            if (!ctaWrap || !typedEl || !cursorEl) return
            ctaWrap.style.display = 'block'
            const ctaText = identifyData.gate_cta_text || 'Your valuation is ready. Register free — it takes thirty seconds and reveals exactly what your piece is worth.'
            let gi = 0
            typedEl.textContent = ''
            cursorEl.style.display = 'inline-block'
            function typeGate() {
              if (gi < ctaText.length) { typedEl!.textContent += ctaText[gi]; gi++; setTimeout(typeGate, 28) }
              else { cursorEl!.style.display = 'none' }
            }
            typeGate()
          }
        }
      }
      setTimeout(typeChar, 400)
    }

    const lo = r.value_range_low || 0
    const hi = r.value_range_high || 0
    const valueEl = g('result-value')
    if (valueEl) {
      valueEl.textContent = '£' + lo.toLocaleString('en-GB') + ' – £' + hi.toLocaleString('en-GB') +
        ' / $' + Math.round(lo * 1.27).toLocaleString('en-US') + ' – $' + Math.round(hi * 1.27).toLocaleString('en-US')
    }

    if (r.maker) {
      setEl('result-maker', r.maker)
      const row = g('row-maker') as HTMLElement | null
      if (row) row.style.display = 'flex'
    }
    if (r.period) {
      setEl('result-period', r.period + (r.circa ? ' — ' + r.circa : ''))
      const row = g('row-period') as HTMLElement | null
      if (row) row.style.display = 'flex'
    }
    if (r.country_of_origin) {
      setEl('result-origin', r.country_of_origin)
      const row = g('row-origin') as HTMLElement | null
      if (row) row.style.display = 'flex'
    }
    if (identifyData.id) {
      localStorage.setItem('pending_identification_id', identifyData.id)
      const ref = g('result-ref') as HTMLElement | null
      if (ref) ref.textContent = 'REF ' + identifyData.id.slice(0, 8).toUpperCase()
      if (session) {
        const viewReport = g('result-view-report') as HTMLElement | null
        const viewLink = g('view-report-link') as HTMLAnchorElement | null
        if (viewReport) viewReport.style.display = 'block'
        if (viewLink) viewLink.href = '/valuation/' + identifyData.id
      }
    }

    const outer = g('result-outer') as HTMLElement | null
    if (outer) {
      outer.style.display = 'block'
      outer.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }

    if (session) {
      const bc = g('blur-content') as HTMLElement | null
      if (bc) bc.style.filter = 'none'
      const ctaWrap = g('result-gate-cta-wrap') as HTMLElement | null
      if (ctaWrap) ctaWrap.style.display = 'none'
    }

    if (session?.user?.id && identifyData.id) {
      const saveNote = g('save-note')
      if (saveNote) saveNote.classList.add('visible')
    }
  })
}
