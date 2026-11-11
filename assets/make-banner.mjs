// Builds assets/banner.svg from the mod's own pet and bar drawings.
import { petSvgBody, PET_CSS, PET_VIEWBOX } from '../hooks/pet.js'
import { desktopTrack } from '../hooks/styles-desktop.js'
import { writeFileSync } from 'fs'
const W = 1280, H = 320
const rows = [
  { id: 'b1', style: 'run', pct: 62, marks: [.2,.4,.6,.8].map((f,i)=>({f,stage:i===1})), name: 'Fixing auth', count: '3/5', animating: true, label: 'Refactor auth' },
  { id: 'b2', style: 'ok', pct: 31, marks: [{f:.25},{f:.5},{f:.75}], name: '5h · 31% · ~45% at reset', count: '', label: 'Session · 5h', right: '↻ 2:14:09' },
  { id: 'b3', style: 'warn', pct: 64, marks: [{f:.25},{f:.5},{f:.75}], name: '7d · 64% · ~88% at reset', count: '', label: 'Weekly · 7d', right: '↻ 3d 5h' },
]
let bars = ''
rows.forEach((r, i) => {
  const y = 150 + i * 38
  bars += `<text x="700" y="${y + 15}" class="lbl">${r.label}</text><g transform="translate(800 ${y})">${desktopTrack('pixel', r, 370, 0, new Map())}</g><text x="1245" y="${y + 15}" text-anchor="end" class="rt">${r.right ?? Math.round(r.pct) + '%'}</text>`
})
// the pet's loop: it walks between spots and acts out a session, a chip over it says what Claude is doing
const LANE = 430
const tour = [
  ['read', 0, 2.6, 'Reading auth.ts'],
  ['search', 0, 2.4, 'Searching "token"'],
  ['type', 170, 2.8, 'Editing auth.ts'],
  ['terminal', 170, 2.6, 'Running npm test'],
  ['delegate', 300, 2.8, 'Two agents on it', ['haiku', 'sonnet']],
  ['alert', LANE, 2.6, 'Allow rm -rf build?'],
  ['celebrate', LANE, 2.8, 'Done · 5/5'],
  ['idle', 0, 2.4, ''],
]
const segs = [] // [act, x0, x1, start, dur, chip, minis]
let at = 0
let x = 0
for (const [act, to, dur, chip, minis] of tour) {
  if (to !== x) {
    const d = Math.abs(to - x) / 150
    segs.push(['walk', x, to, at, d, '', null])
    at += d
    x = to
  }
  segs.push([act, x, x, at, dur, chip, minis])
  at += dur
}
const TOTAL = at
const pc = (t) => ((t / TOTAL) * 100).toFixed(2) + '%'
let moveK = ''
let faceK = ''
let petCss = ''
let pets = ''
segs.forEach(([act, x0, x1, start, dur, chip, minis], i) => {
  moveK += `${pc(start)}{transform:translateX(${x0}px)}${pc(start + dur - 0.001)}{transform:translateX(${x1}px)}`
  faceK += `${pc(start)}{transform:scaleX(${x1 < x0 ? -1 : 1})}`
  petCss += `@keyframes s${i}{0%{opacity:0}${pc(start)}{opacity:1}${pc(start + dur)}{opacity:0}}.s${i}{opacity:0;animation:s${i} ${TOTAL.toFixed(2)}s steps(1) infinite}`
  pets += `<g class="s${i}"><g class="face"><svg x="-6.3" y="-6.3" width="101" height="66.5" viewBox="${PET_VIEWBOX}" overflow="visible">${petSvgBody(act, 0, { minis: minis ?? [] })}</svg></g>`
  if (chip) {
    const w = Math.round(chip.length * 7.1 + 18)
    pets += `<g transform="translate(${44 - w / 2} -30)"><rect width="${w}" height="22" rx="11" fill="#f2f0ea"/><path d="M${w / 2 - 5} 22l5 5 5-5z" fill="#f2f0ea"/><text x="${w / 2}" y="15" text-anchor="middle" style="font:600 12px ui-sans-serif,system-ui,-apple-system,sans-serif;fill:#26241f">${chip}</text></g>`
  }
  pets += '</g>'
})
let stars = ''
for (let i = 0; i < 70; i++) { const x = (i * 197) % W, y = (i * 83) % H; stars += `<rect x="${x}" y="${y}" width="2" height="2" fill="#fff" opacity="${(0.1 + (i % 5) * 0.06).toFixed(2)}"/>` }
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">Deck</title><desc id="d">A small Claude pet walks across a heads-up display of plan progress, usage limits and countdowns for Claude Code, acting out what Claude is doing: reading, searching, editing, running tests, delegating to subagents, asking for permission and celebrating.</desc>
<style>${PET_CSS}
.lbl{font:400 13px ui-sans-serif,system-ui,-apple-system,sans-serif;fill:#c9c7c1}.rt{font:400 13px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#9a9893}
.far{animation:drift 70s linear infinite}@keyframes drift{to{transform:translateX(-${W}px)}}
.walk{animation:walk ${TOTAL.toFixed(2)}s linear infinite}@keyframes walk{${moveK}100%{transform:translateX(0)}}
.face{transform-box:fill-box;transform-origin:center;animation:face ${TOTAL.toFixed(2)}s steps(1) infinite}@keyframes face{${faceK}}${petCss}
.cur{animation:cur 1s steps(1) infinite}@keyframes cur{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14121a"/><stop offset="1" stop-color="#1f1a24"/></linearGradient>
<clipPath id="c"><rect width="${W}" height="${H}" rx="24"/></clipPath></defs>
<g clip-path="url(#c)"><rect width="${W}" height="${H}" fill="url(#bg)"/>
<g class="far">${stars}<g transform="translate(${W} 0)">${stars}</g></g>
<text x="80" y="140" style="font:700 96px ui-sans-serif,system-ui,-apple-system,sans-serif;letter-spacing:-3px;fill:#f2f0ea">deck<tspan fill="#D97757">.</tspan></text>
<text x="84" y="186" style="font:500 26px ui-sans-serif,system-ui,sans-serif;fill:#e8e6e1">A cockpit for Claude Code.</text>
<text x="84" y="220" style="font:400 17px ui-sans-serif,system-ui,sans-serif;fill:#9a9893">Plans, usage limits with alerts, model routing, and a pet that</text>
<text x="84" y="242" style="font:400 17px ui-sans-serif,system-ui,sans-serif;fill:#9a9893">acts out what Claude is doing. Above your prompt.</text>
<text x="84" y="282" style="font:400 16px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#9C95EC">/deck<tspan fill="#9a9893"> ▸ 5h 31% ↻2:14 │ 7d 64% │ ctx 42% │ Fixing auth 3/5</tspan><tspan class="cur" fill="#f2f0ea"> ▋</tspan></text>
${bars}
<rect x="700" y="128" width="1" height="130" fill="#fff" opacity=".06"/>
<g transform="translate(720 58)"><g class="walk">${pets}</g></g>
</g></svg>`
writeFileSync(new URL('./banner.svg', import.meta.url), svg)
