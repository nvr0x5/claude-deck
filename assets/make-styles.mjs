// Builds assets/styles.svg: every bar style and every collapsed look, on Desktop and in the
// terminal, drawn with Deck's own style code.
import { DESKTOP_STYLES, DESKTOP_STYLE_NAMES, desktopTrack } from '../hooks/styles-desktop.js'
import { TERMINAL_STYLES, TERMINAL_STYLE_NAMES, terminalBar, terminalMini } from '../hooks/styles-terminal.js'
import { STYLE } from '../hooks/theme.js'
import { writeFileSync } from 'fs'

const SANS = 'ui-sans-serif,system-ui,-apple-system,sans-serif'
const MONO = 'ui-monospace,SFMono-Regular,Menlo,monospace'
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
const W = 940
const CW = 6.6 // terminal cell width at 11px
const LH = 16

const marks = [0.2, 0.4, 0.6, 0.8].map((f, i) => ({ f, stage: i === 1 }))
const plan = { id: 'plan', style: 'run', pct: 52, marks, steps: 5, finished: 2, name: 'Fixing auth', count: '3/5', animating: true }
const limit = { id: 'lim', style: 'ok', pct: 31, marks: [{ f: 0.25 }, { f: 0.5 }, { f: 0.75 }], name: '5h · 31% used', count: '', rate: '+12%/h', hist: [2, 3, 4, 5, 6, 8, 9, 11, 13, 15, 17, 20, 22, 25, 28, 31] }

function cellsSvg(cells, x, y) {
  let out = ''
  let i = 0
  while (i < cells.length) {
    const c = cells[i]
    let j = i
    let text = ''
    while (j < cells.length && cells[j].color === c.color && cells[j].bg === c.bg && cells[j].bold === c.bold) text += cells[j++].ch
    if (c.bg) out += `<rect x="${(x + i * CW).toFixed(1)}" y="${y - 11.5}" width="${(text.length * CW + 0.3).toFixed(1)}" height="${LH - 1}" fill="${c.bg}"/>`
    if (text.trim()) out += `<text x="${(x + i * CW).toFixed(1)}" y="${y}" style="font:${c.bold ? 600 : 400} 11px ${MONO};fill:${c.color}" textLength="${(text.length * CW).toFixed(1)}" lengthAdjust="spacingAndGlyphs" xml:space="preserve">${esc(text)}</text>`
    i = j
  }
  return out
}

const label = (x, y, t, size = 13, color = '#e8e6e1', weight = 500) => `<text x="${x}" y="${y}" style="font:${weight} ${size}px ${SANS};fill:${color}">${esc(t)}</text>`
const mono = (x, y, t, color, size = 11) => `<text x="${x}" y="${y}" style="font:400 ${size}px ${MONO};fill:${color}" xml:space="preserve">${esc(t)}</text>`

function ring(x, y, pct, color, icon) {
  const r = 8.5
  const C = 2 * Math.PI * r
  const glyph =
    icon === 'usd'
      ? `<text x="11" y="15" text-anchor="middle" style="font:600 10px ${SANS};fill:${color}">$</text>`
      : icon === 'week'
        ? `<rect x="7.2" y="7.6" width="7.6" height="7" rx="1.2" fill="none" stroke="${color}" stroke-width="1.3"/><rect x="7.2" y="7.6" width="7.6" height="2" fill="${color}"/>`
        : `<path d="M11 7.2V11l2.4 1.6" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round"/>`
  return `<g transform="translate(${x} ${y})"><circle cx="11" cy="11" r="${r}" fill="none" stroke="#808080" stroke-opacity=".3" stroke-width="2.2"/><circle cx="11" cy="11" r="${r}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linecap="round" stroke-dasharray="${((C * pct) / 100).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 11 11)"/>${glyph}</g>`
}

let body = ''
let y = 54
body += label(28, 34, 'Bar styles', 18, '#f2f0ea', 600) + label(28 + 120, 34, '/deck style <name>  ·  or /deck style for the picker', 12, '#77756f', 400)
body += label(190, y, 'Desktop', 11, '#9a9893', 500) + label(590, y, 'Terminal', 11, '#9a9893', 500)
y += 14
const all = [...new Set([...DESKTOP_STYLES, ...TERMINAL_STYLES])]
for (const name of all) {
  const title = DESKTOP_STYLE_NAMES[name] ?? TERMINAL_STYLE_NAMES[name]
  body += `<rect x="20" y="${y}" width="${W - 40}" height="64" rx="10" fill="#262626"/>`
  body += label(36, y + 26, title, 14) + mono(36, y + 44, name, '#77756f')
  if (DESKTOP_STYLES.includes(name)) {
    body += `<g transform="translate(190 ${y + 8})">${desktopTrack(name, { ...plan, id: 'p' + name }, 370, 0, new Map())}</g>`
    body += `<g transform="translate(190 ${y + 36})">${desktopTrack(name, { ...limit, id: 'l' + name }, 370, 0, new Map())}</g>`
  }
  if (TERMINAL_STYLES.includes(name)) {
    body += cellsSvg(terminalBar(name, { ...plan, id: 'tp' + name }, 46, 0), 590, y + 26)
    body += cellsSvg(terminalBar(name, { ...limit, id: 'tl' + name }, 46, 0), 590, y + 46)
  }
  y += 72
}

y += 26
body += label(28, y, 'Collapsed looks', 18, '#f2f0ea', 600) + label(28 + 160, y, '/deck collapsed chips | text | rings', 12, '#77756f', 400)
y += 16

const LIM = [
  { st: STYLE.ok, p: 31, tag: '5h', reset: '2h14m', icon: 'clock' },
  { st: STYLE.warn, p: 64, tag: '7d', reset: '3d 5h', icon: 'week' },
]

// chips
body += `<rect x="20" y="${y}" width="${W - 40}" height="70" rx="10" fill="#262626"/>` + label(36, y + 22, 'Chips', 14) + mono(36, y + 40, 'chips', '#77756f') + label(36, y + 56, 'default', 11, '#77756f', 400)
{
  let x = 190
  const items = [[STYLE.ok, '5h 31% ↻2h14m', 31], [STYLE.warn, '7d 64% ↻3d 5h', 64], [STYLE.run, 'ctx 12%', 12], [STYLE.run, 'Fixing auth 3/5', 52]]
  for (const [st, t, p] of items) {
    body += label(x, y + 26, st.glyph, 13, st.desk, 400)
    x += 16
    body += label(x, y + 26, t, 13, '#e8e6e1', 500)
    x += t.length * 7.9 + 8
    body += `<rect x="${x}" y="${y + 17}" width="34" height="8" rx="4" fill="#808080" fill-opacity=".2"/><rect x="${x}" y="${y + 17}" width="${Math.max(4, (34 * p) / 100)}" height="8" rx="4" fill="${st.desk}"/>`
    x += 52
  }
  let tx = 190
  const tl = []
  for (const [st, t, p] of items) tl.push(...[{ ch: st.glyph + ' ', color: st.fill }], ...[...t + ' '].map((ch) => ({ ch, color: '#e8e6e1' })), ...terminalMini('solid', { style: Object.keys(STYLE).find((k) => STYLE[k] === st), pct: p }, 5), { ch: ' │ ', color: '#3a3936' })
  body += cellsSvg(tl.slice(0, -1).flatMap((c) => [...c.ch].map((ch) => ({ ...c, ch }))), tx, y + 52)
}
y += 78

// text
body += `<rect x="20" y="${y}" width="${W - 40}" height="58" rx="10" fill="#262626"/>` + label(36, y + 24, 'Text', 14) + mono(36, y + 42, 'text', '#77756f')
{
  const parts = [[STYLE.ok.desk, STYLE.ok.glyph], ['#9a9893', ' 5h 31% ↻2h14m  '], [STYLE.warn.desk, STYLE.warn.glyph], ['#9a9893', ' 7d 64% ↻3d 5h  '], [STYLE.run.desk, STYLE.run.glyph], ['#9a9893', ' ctx 12%  '], [STYLE.run.desk, STYLE.run.glyph], ['#9a9893', ' Fixing auth 3/5  '], [STYLE.run.desk, '⇄'], ['#9a9893', ' opus · medium  ⛅ 31° Tangerang  ◷ 10:16']]
  body += `<text x="190" y="${y + 24}" style="font:400 13px ${SANS}" xml:space="preserve">${parts.map(([c, t]) => `<tspan fill="${c}">${esc(t)}</tspan>`).join('')}</text>`
  body += `<text x="190" y="${y + 44}" style="font:400 11px ${MONO}" xml:space="preserve">${parts.map(([c, t]) => `<tspan fill="${c === '#9a9893' ? c : c}">${esc(t.replace('◷ ', ''))}</tspan>`).join('')}</text>`
}
y += 66

// rings
body += `<rect x="20" y="${y}" width="${W - 40}" height="70" rx="10" fill="#262626"/>` + label(36, y + 24, 'Rings', 14) + mono(36, y + 42, 'rings', '#77756f')
{
  let x = 190
  for (const l of LIM) {
    body += ring(x, y + 9, l.p, l.st.desk, l.icon)
    x += 30
    body += label(x, y + 25, l.p + '%', 14, '#f2f0ea', 600)
    x += 38
    body += label(x, y + 25, l.tag + ' · resets ' + l.reset, 13, '#9a9893', 400)
    x += 150
  }
  body += ring(x, y + 9, 100, STYLE.done.desk, 'usd')
  x += 30
  body += label(x, y + 25, '$0.42', 14, STYLE.done.fill, 600) + label(x + 50, y + 25, 'today · $4.30 this month', 13, '#9a9893', 400)
  const ringCh = (p) => '○◔◑◕●'[Math.min(4, Math.round(p / 25))]
  body += `<text x="190" y="${y + 56}" style="font:400 11px ${MONO}" xml:space="preserve"><tspan fill="${STYLE.ok.fill}">${ringCh(31)}</tspan><tspan fill="#e8e6e1"> 31%</tspan><tspan fill="#9a9893"> 5h · resets 2h14m   </tspan><tspan fill="${STYLE.warn.fill}">${ringCh(64)}</tspan><tspan fill="#e8e6e1"> 64%</tspan><tspan fill="#9a9893"> 7d · resets 3d 5h   </tspan><tspan fill="${STYLE.done.fill}">$ $0.42</tspan><tspan fill="#9a9893"> today · $4.30 this month</tspan></text>`
}
y += 78
body += label(28, y + 10, 'Top line: Desktop · bottom line: terminal. Spend shows when /deck cost on.', 11, '#77756f', 400)
const H = y + 30

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="st sd">
<title id="st">Deck styles</title>
<desc id="sd">Every Deck bar style (pixel, segments, line, solid, dots, spark) shown on Desktop and in the terminal, each with a plan bar and a usage limit, and the three collapsed looks: chips with mini bars, one plain text line, and limit rings with spend.</desc>
<rect width="${W}" height="${H}" rx="16" fill="#1a1a1a"/>${body}</svg>`
writeFileSync(new URL('./styles.svg', import.meta.url), svg)
