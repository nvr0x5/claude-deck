// Builds assets/demo-desktop.svg and assets/demo-terminal.svg: a self-playing session, drawn with
// Deck's own track, strip and pet code so the demos match what Deck really shows.
import { petSvgBody, PET_CSS } from '../hooks/pet.js'
import { desktopTrack, stripsSvg } from '../hooks/styles-desktop.js'
import { terminalBar } from '../hooks/styles-terminal.js'
import { STYLE, TIER } from '../hooks/theme.js'
import { writeFileSync } from 'fs'

const T = 22 // seconds per loop
const SANS = "ui-sans-serif,system-ui,-apple-system,sans-serif"
const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace"
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const marks = [0.2, 0.4, 0.6, 0.8].map((f, i) => ({ f, stage: i === 1 }))

// one session, scene by scene: [start%, end%]
const SCENES = [
  { t: [0, 15], pct: 8, name: 'Read routes', count: '1/5', style: 'run', pet: 'console', line: 'Reading the routes and mapping the auth flow.', agents: [['Map the routes', 'Grep', 'running', 'haiku', 6]] },
  { t: [15, 32], pct: 40, name: 'Fixing auth', count: '3/5', style: 'run', pet: 'console', line: 'Two agents on it. Fixing the token check now.', agents: [['Map the routes', 'Done', 'done', 'haiku', 12], ['Write fixtures', 'Write', 'running', 'sonnet', 9]] },
  { t: [32, 50], pct: 60, name: 'Run suite', count: '4/5', style: 'ask', pet: 'alert', line: 'Run the test suite? (Bash: npm test)', agents: [['Write fixtures', 'Needs approval', 'waiting', 'sonnet', 19]] },
  { t: [50, 66], pct: 80, name: 'Report', count: '5/5', style: 'run', pet: 'read', line: '24 tests pass. Writing the summary.', agents: [] },
  { t: [66, 84], pct: 100, name: 'Done', count: '5/5', style: 'done', pet: 'celebrate', line: 'Done: auth fixed, 24 tests passing.', agents: [] },
  { t: [84, 100], collapsed: true, pet: 'idle', line: 'Done: auth fixed, 24 tests passing.' },
]
const LIMITS = [
  { title: 'Session · 5h', tag: '5h', pct: 31, style: 'ok', right: '↻ 2:14:09', short: '5h 31% ↻2:14:09' },
  { title: 'Weekly · 7d', tag: '7d', pct: 64, style: 'warn', right: '↻ 3d 5h 12m', short: '7d 64% ↻3d 5h' },
]
const CTX = { title: 'Context', pct: 12, style: 'run', name: '124k / 1M', right: '12%', short: 'ctx 12%' }

function show(cls, [a, b]) {
  const on = a === 0 ? `0%{opacity:1}` : `0%{opacity:0}${a}%{opacity:1}`
  return `.${cls}{opacity:0;animation:${cls} ${T}s steps(1) infinite}@keyframes ${cls}{${on}${b}%{opacity:0}}`
}
const reduced = (last) => `@media (prefers-reduced-motion:reduce){*{animation:none!important}.${last}{opacity:1}}`

function petPoses(size) {
  let css = ''
  let svg = ''
  SCENES.forEach((s, i) => {
    css += show('pp' + i, s.t)
    svg += `<g class="pp${i}"><svg width="${size * 1.26}" height="${size}" viewBox="-4 -6 48 38" overflow="visible">${petSvgBody(s.pet)}</svg></g>`
  })
  return { css, svg }
}

function collapsedText(x, y, font, size, colors) {
  const parts = [
    [STYLE.ok.glyph, colors(STYLE.ok)], [' ' + LIMITS[0].short + '  ', '#9a9893'],
    [STYLE.warn.glyph, colors(STYLE.warn)], [' ' + LIMITS[1].short + '  ', '#9a9893'],
    [STYLE.run.glyph, colors(STYLE.run)], [' ' + CTX.short + '  ', '#9a9893'],
    [STYLE.done.glyph, colors(STYLE.done)], [' Fix the auth b…  ', '#9a9893'],
    ['⇄', colors(STYLE.run)], [' opus · medium  ⛅ 31° Tangerang  10:16:44', '#9a9893'],
  ]
  return `<text x="${x}" y="${y}" style="font:400 ${size}px ${font}" xml:space="preserve">${parts.map(([t, c]) => `<tspan fill="${c}">${esc(t)}</tspan>`).join('')}</text>`
}

// ---------- desktop ----------

function desktop() {
  const W = 900
  const H = 650
  const L = 48 // band left
  const trackX = 230
  const trackW = 520
  const rightX = W - 70
  let css = ''
  let body = ''

  const route = (y) => {
    const F = `font:400 12.5px ${SANS}`
    let out = `<text x="${L}" y="${y + 15}" style="font:400 14px ${SANS};fill:#9C95EC">⇄</text><text x="${L + 22}" y="${y + 15}" style="font:400 14px ${SANS};fill:#e8e6e1">Model route</text>`
    let x = trackX
    out += `<text x="${x}" y="${y + 15}" style="${F};fill:#77756f">opus</text>`
    x += 36
    out += `<text x="${x}" y="${y + 15}" style="${F};fill:#9a9893">=</text>`
    x += 16
    for (const [t, on, want] of [['haiku', false, true], ['sonnet', false, false], ['opus', true, false]]) {
      const w = t.length * 7 + 16
      out += `<rect x="${x}" y="${y + 3}" width="${w}" height="17" rx="4" fill="${on ? TIER[t].desk : '#808080'}" fill-opacity="${on ? 1 : 0.16}"${want ? ` stroke="${TIER[t].desk}" stroke-dasharray="2 2"` : ''}/><text x="${x + 8}" y="${y + 15.5}" style="font:${on ? 500 : 400} 12px ${SANS};fill:${on ? '#fff' : '#9a9893'}">${t}</text>`
      x += w + 5
    }
    x += 10
    for (let i = 1; i <= 4; i++) out += `<rect x="${x + (i - 1) * 7}" y="${y + 18 - (3 + i * 3)}" width="5" height="${3 + i * 3}" rx="1.5" fill="${i <= 2 ? STYLE.run.desk : '#808080'}" fill-opacity="${i <= 2 ? 1 : 0.25}"/>`
    x += 34
    out += `<text x="${x}" y="${y + 15}" style="${F};fill:#c9c7c1">medium</text>`
    x += 62
    out += `<text x="${x}" y="${y + 15}" style="${F};fill:#77756f">conf</text><rect x="${x + 32}" y="${y + 8}" width="44" height="6" rx="3" fill="#808080" fill-opacity=".25"/><rect x="${x + 32}" y="${y + 8}" width="39" height="6" rx="3" fill="${STYLE.ok.desk}"/><text x="${x + 84}" y="${y + 15}" style="${F};fill:#9a9893">0.89</text>`
    out += `<text x="${rightX}" y="${y + 15}" text-anchor="end" style="${F};fill:#9a9893">= kept</text><text x="${W - 50}" y="${y + 15}" style="${F};fill:#77756f">✕</text>`
    return out
  }

  const row = (y, glyph, color, title, track, right) =>
    `<text x="${L}" y="${y + 16}" style="font:400 14px ${SANS};fill:${color}">${glyph}</text>` +
    `<text x="${L + 22}" y="${y + 16}" style="font:400 14px ${SANS};fill:#e8e6e1">${esc(title)}</text>` +
    `<g transform="translate(${trackX} ${y})">${track}</g>` +
    `<text x="${rightX}" y="${y + 16}" text-anchor="end" style="font:400 13px ${MONO};fill:#9a9893">${esc(right)}</text>` +
    `<text x="${W - 50}" y="${y + 16}" style="font:400 13px ${SANS};fill:#77756f">✕</text>`

  const meters = (y0) => {
    let out = row(y0, STYLE.run.glyph, STYLE.run.desk, CTX.title, desktopTrack('pixel', { id: 'ctx', style: CTX.style, pct: CTX.pct, marks: [{ f: 0.5 }, { f: 0.8 }], name: CTX.name, count: '' }, trackW, 0, new Map()), CTX.right)
    LIMITS.forEach((m, i) => {
      out += row(y0 + 36 * (i + 1), STYLE[m.style].glyph, STYLE[m.style].desk, m.title, desktopTrack('pixel', { id: m.tag, style: m.style, pct: m.pct, marks: [{ f: 0.25 }, { f: 0.5 }, { f: 0.75 }], name: m.tag + ' · ' + m.pct + '% used', count: '' }, trackW, 0, new Map()), m.right)
    })
    return out
  }

  const bandTop = 200
  const headerY = bandTop + 64
  SCENES.forEach((s, i) => {
    const cls = 'sd' + i
    css += show(cls, s.t)
    let g = `<text x="40" y="160" style="font:400 15px ${SANS};fill:#e8e6e1">${esc(s.line)}</text>`
    if (s.collapsed) {
      g += `<text x="${L}" y="${headerY + 18}" style="font:400 13px ${SANS};fill:#77756f">deck ▸</text>` + collapsedText(L + 64, headerY + 18, MONO, 13, (st) => st.desk)
    } else {
      g += `<text x="${L}" y="${headerY + 18}" style="font:400 13px ${SANS};fill:#77756f">deck ▾  · 5 rows</text><text x="${W - 50}" y="${headerY + 18}" text-anchor="end" style="font:400 13px ${MONO};fill:#9a9893">⛅ 31° Tangerang  ·  ◷ 10:16:44</text>`
      let y = headerY + 34
      g += route(y)
      y += 38
      const plan = { id: 'plan' + i, style: s.style, pct: s.pct, marks, name: s.name, count: s.count + (s.agents.length ? ' · ' + s.agents.filter((a) => a[2] === 'done').length + '/' + s.agents.length + ' agents' : ''), animating: s.style !== 'done' }
      g += row(y, STYLE[s.style].glyph, STYLE[s.style].desk, 'Fix the auth bug', desktopTrack('pixel', plan, trackW, 0, new Map()), s.pct + '%')
      y += 30
      if (s.agents.length) {
        const shown = s.agents.map(([title, tool, state, model, secs], k) => ({ id: 'a' + i + k, title, tool, state, model, depth: 0, startedAt: 0, endedAt: secs * 1000 }))
        g += `<g transform="translate(${trackX} ${y})">${stripsSvg({ shown, hidden: [] }, trackW, 0, (a) => a.tool, (m) => TIER[m].desk, new Map())}</g>`
        y += shown.length * 21 + 6
      }
      g += meters(y + 6)
    }
    body += `<g class="${cls}">${g}</g>`
  })
  const pet = petPoses(46)
  css += pet.css
  css += `.pm{animation:pm ${T}s ease-in-out infinite}@keyframes pm{0%,28%{transform:translateX(250px)}34%,62%{transform:translateX(520px)}70%,100%{transform:translateX(720px)}}`
  const prompt = 'Fix the auth bug and add tests'
  css += `.typ{animation:typ ${T}s steps(${prompt.length}) infinite}@keyframes typ{0%{width:0}7%,100%{width:${prompt.length * 8.4}px}}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="dt dd">
<title id="dt">Deck in the Claude Code desktop app</title>
<desc id="dd">An illustrative session in the desktop app. Claude fixes an auth bug. Deck shows the model route, a plan bar that fills stage by stage with two agents as strips under it, then turns amber when a command needs approval and green when done, while the pet plays, alerts, reads and celebrates. Context and the 5h and 7d limits with reset countdowns sit below. At the end Deck collapses to one status line.</desc>
<style>${PET_CSS}${css}${reduced('sd4')}</style>
<defs><clipPath id="win"><rect width="${W}" height="${H}" rx="14"/></clipPath><clipPath id="tp"><rect class="typ" x="0" y="0" width="${prompt.length * 8.4}" height="30"/></clipPath></defs>
<g clip-path="url(#win)"><rect width="${W}" height="${H}" fill="#1a1a1a"/>
<rect width="${W}" height="38" fill="#232323"/><circle cx="22" cy="19" r="6" fill="#ff5f57"/><circle cx="42" cy="19" r="6" fill="#febc2e"/><circle cx="62" cy="19" r="6" fill="#28c840"/>
<text x="${W / 2}" y="24" text-anchor="middle" style="font:500 13px ${SANS};fill:#9a9893">Claude Code</text>
<g transform="translate(${W - 300} 64)"><rect width="260" height="34" rx="12" fill="#2a2a2a"/><g clip-path="url(#tp)" transform="translate(14 0)"><text x="0" y="22" style="font:400 14px ${SANS};fill:#e8e6e1">${prompt}</text></g></g>
<text x="40" y="134" style="font:500 13px ${MONO};fill:#D97757">●</text>
<rect x="24" y="${bandTop}" width="${W - 48}" height="${H - bandTop - 90}" rx="12" fill="#262626"/>
<g transform="translate(${L} ${bandTop + 8})"><g class="pm">${pet.svg}</g></g>
<rect x="${L}" y="${bandTop + 58}" width="${W - 2 * L}" height="1" fill="#fff" opacity=".05"/>
${body}
<rect x="24" y="${H - 78}" width="${W - 48}" height="44" rx="12" fill="none" stroke="#3a3a3a"/><text x="44" y="${H - 50}" style="font:400 14px ${SANS};fill:#6b6964">Reply to Claude…</text>
<text x="${W - 40}" y="${H - 12}" text-anchor="end" style="font:400 12px ${SANS};fill:#77756f">Deck 1 · Opus 5.5 · Medium</text>
</g></svg>`
}

// ---------- terminal ----------

const CW = 7.8 // monospace cell width at 13px
const LH = 19

function cellsSvg(cells, x, y) {
  let out = ''
  let i = 0
  while (i < cells.length) {
    const c = cells[i]
    let j = i
    let text = ''
    while (j < cells.length && cells[j].color === c.color && cells[j].bg === c.bg && cells[j].bold === c.bold) text += cells[j++].ch
    if (c.bg) out += `<rect x="${(x + i * CW).toFixed(1)}" y="${y - 13.5}" width="${(text.length * CW + 0.4).toFixed(1)}" height="${LH - 1}" fill="${c.bg}"/>`
    if (text.trim()) out += `<text x="${(x + i * CW).toFixed(1)}" y="${y}" style="font:${c.bold ? 600 : 400} 13px ${MONO};fill:${c.color}" textLength="${(text.length * CW).toFixed(1)}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${esc(text)}</text>`
    i = j
  }
  return out
}

const tt = (x, y, s, color, extra = '') => `<text x="${x}" y="${y}" style="font:400 13px ${MONO};fill:${color}"${extra} xml:space="preserve">${esc(s)}</text>`

function terminal() {
  const COLS = 108
  const W = Math.round(COLS * CW + 32)
  const H = 520
  const X = 16
  const labelW = 22
  const barW = 54
  const barX = X + (2 + labelW + 1) * CW
  const rightX = X + (2 + labelW + 1 + barW + 13) * CW
  let css = ''
  let body = ''
  const row = (y, glyph, color, title, cells, right) =>
    tt(X, y, glyph, color) + tt(X + 2 * CW, y, title, '#e8e6e1') + cellsSvg(cells, barX, y) + tt(rightX, y, right, '#9a9893', ' text-anchor="end"') + tt(rightX + 2 * CW, y, '✕', '#55534e')

  const top = 230
  SCENES.forEach((s, i) => {
    const cls = 'st' + i
    css += show(cls, s.t)
    let g = tt(X, 96, '⏺ ', '#D97757') + tt(X + 2 * CW, 96, s.line, '#d8d6d0')
    if (s.collapsed) {
      g += tt(X, top + LH * 3, '0: deck ▸', '#77756f') + collapsedText(X + 11 * CW, top + LH * 3, MONO, 13, (st) => st.fill)
    } else {
      let y = top
      g += tt(X, y, '0: deck ▾ · 5 rows', '#77756f') + tt(X + COLS * CW, y, '10:16:44  ·  31° cloudy · Tangerang', '#9a9893', ' text-anchor="end"')
      y += LH
      const route = [['⇄ ', STYLE.run.fill], ['Model route'.padEnd(labelW + 1), '#e8e6e1'], ['opus ', '#77756f'], ['= ', '#9a9893'], [' opus ', '#1e1e1e', TIER.opus.term], ['  jev: haiku', '#77756f'], ['  effort ', '#9a9893'], ['▁▃', STYLE.run.fill], ['·· medium', '#77756f'], ['  conf 0.89', STYLE.ok.fill]]
      let x = X
      for (const [t, c, bg] of route) {
        if (bg) g += `<rect x="${x.toFixed(1)}" y="${y - 13.5}" width="${(t.length * CW).toFixed(1)}" height="${LH - 1}" fill="${bg}"/>`
        g += tt(x, y, t, c)
        x += t.length * CW
      }
      g += tt(rightX, y, '= kept', '#9a9893', ' text-anchor="end"')
      y += LH
      const plan = { id: 'p' + i, style: s.style, pct: s.pct, marks, name: s.name, count: s.count + (s.agents.length ? ' · ' + s.agents.filter((a) => a[2] === 'done').length + '/' + s.agents.length + ' agents' : ''), animating: s.style !== 'done' }
      g += row(y, STYLE[s.style].glyph, STYLE[s.style].fill, 'Fix the auth bug', terminalBar('solid', plan, barW, 0), s.pct + '%')
      y += LH
      for (const [title, tool, state, model, secs] of s.agents) {
        const st = STYLE[{ running: 'run', waiting: 'ask', done: 'done' }[state]]
        g += tt(X + 2 * CW, y, '●', st.fill) + tt(X + 4 * CW, y, title, '#c9c7c1') + tt(X + (4 + labelW) * CW, y, tool, st.fill)
        g += `<rect x="${(X + (4 + labelW + 17) * CW).toFixed(1)}" y="${y - 13.5}" width="${((model.length + 2) * CW).toFixed(1)}" height="${LH - 1}" fill="${TIER[model].term}"/>` + tt(X + (4 + labelW + 18) * CW, y, model, '#1e1e1e')
        g += tt(rightX, y, secs + 's', '#77756f', ' text-anchor="end"')
        y += LH
      }
      g += row(y, STYLE.run.glyph, STYLE.run.fill, CTX.title, terminalBar('solid', { id: 'c', style: CTX.style, pct: CTX.pct, marks: [], name: CTX.name, count: '' }, barW, 0), CTX.right)
      y += LH
      for (const m of LIMITS) {
        g += row(y, STYLE[m.style].glyph, STYLE[m.style].fill, m.title, terminalBar('solid', { id: m.tag, style: m.style, pct: m.pct, marks: [], name: m.tag + ' · ' + m.pct + '% used', count: '' }, barW, 0), m.right)
        y += LH
      }
    }
    body += `<g class="${cls}">${g}</g>`
  })
  const pet = petPoses(40)
  css += pet.css
  css += `.pm{animation:pm ${T}s ease-in-out infinite}@keyframes pm{0%,28%{transform:translateX(160px)}34%,62%{transform:translateX(430px)}70%,100%{transform:translateX(640px)}}`
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="tt td">
<title id="tt">Deck in the Claude Code terminal</title>
<desc id="td">An illustrative terminal session in Ghostty. Deck draws solid bars above the prompt: the model route, a plan that fills with agent rows under it, turns amber when a command needs approval and green when done, then context and the 5h and 7d limits with reset countdowns. The pet walks above and reacts. At the end Deck collapses to one status line.</desc>
<style>${PET_CSS}${css}${reduced('st4')}</style>
<defs><clipPath id="tw"><rect width="${W}" height="${H}" rx="12"/></clipPath></defs>
<g clip-path="url(#tw)"><rect width="${W}" height="${H}" fill="#161616"/>
<rect width="${W}" height="34" fill="#202020"/><circle cx="20" cy="17" r="6" fill="#ff5f57"/><circle cx="40" cy="17" r="6" fill="#febc2e"/><circle cx="60" cy="17" r="6" fill="#28c840"/>
<text x="${W / 2}" y="22" text-anchor="middle" style="font:500 12px ${SANS};fill:#9a9893">claude — ~/project</text>
${tt(X, 66, '> ', '#9a9893')}${tt(X + 2 * CW, 66, 'Fix the auth bug and add tests', '#e8e6e1')}
<g transform="translate(${X} ${top - 52})"><g class="pm">${pet.svg}</g></g>
${body}
<rect x="${X - 4}" y="${H - 84}" width="${W - 2 * X + 8}" height="1" fill="#3a3936"/><rect x="${X - 4}" y="${H - 52}" width="${W - 2 * X + 8}" height="1" fill="#3a3936"/>
${tt(X, H - 63, '❯ ', '#e8e6e1')}<rect x="${X + 2 * CW}" y="${H - 76}" width="${CW}" height="17" fill="#e8e6e1"/>
${tt(X, H - 30, 'Opus 5.5 · medium', '#77756f')}${tt(W - X, H - 30, '[ Deck 1 ]', '#9a9893', ' text-anchor="end"')}
${tt(X, H - 12, '⏵⏵ auto mode on (shift+tab to cycle)', '#EBA83A')}
</g></svg>`
}

writeFileSync(new URL('./demo-desktop.svg', import.meta.url), desktop())
writeFileSync(new URL('./demo-terminal.svg', import.meta.url), terminal())
