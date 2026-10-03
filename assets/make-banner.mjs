// Builds assets/banner.svg from the mod's own pet and bar drawings.
import { petSvgBody, PET_CSS } from '../hooks/pet.js'
import { desktopTrack } from '../hooks/styles-desktop.js'
import { writeFileSync } from 'fs'
const W = 1280, H = 320
const rows = [
  { id: 'b1', style: 'run', pct: 62, marks: [.2,.4,.6,.8].map((f,i)=>({f,stage:i===1})), name: 'Fixing auth', count: '3/5', animating: true, label: 'Refactor auth' },
  { id: 'b2', style: 'ok', pct: 31, marks: [{f:.25},{f:.5},{f:.75}], name: '5h · 31% used', count: '', label: 'Session · 5h', right: '↻ 2:14:09' },
  { id: 'b3', style: 'warn', pct: 64, marks: [{f:.25},{f:.5},{f:.75}], name: '7d · 64% used', count: '', label: 'Weekly · 7d', right: '↻ 3d 5h' },
]
let bars = ''
rows.forEach((r, i) => {
  const y = 150 + i * 38
  bars += `<text x="700" y="${y + 15}" class="lbl">${r.label}</text><g transform="translate(800 ${y})">${desktopTrack('pixel', r, 370, 0, new Map())}</g><text x="1245" y="${y + 15}" text-anchor="end" class="rt">${r.right ?? Math.round(r.pct) + '%'}</text>`
})
let stars = ''
for (let i = 0; i < 70; i++) { const x = (i * 197) % W, y = (i * 83) % H; stars += `<rect x="${x}" y="${y}" width="2" height="2" fill="#fff" opacity="${(0.1 + (i % 5) * 0.06).toFixed(2)}"/>` }
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="t d">
<title id="t">Deck</title><desc id="d">A small Claude pet walks across a heads-up display of plan progress, usage limits and countdowns for Claude Code.</desc>
<style>${PET_CSS}
.lbl{font:400 13px ui-sans-serif,system-ui,-apple-system,sans-serif;fill:#c9c7c1}.rt{font:400 13px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#9a9893}
.far{animation:drift 70s linear infinite}@keyframes drift{to{transform:translateX(-${W}px)}}
.walk{animation:walk 18s linear infinite}@keyframes walk{0%{transform:translateX(0)}14%,36%{transform:translateX(470px)}50%,100%{transform:translateX(0)}}
.face{animation:face 18s steps(1) infinite}@keyframes face{0%{transform:scaleX(1)}36%{transform:scaleX(-1)}50%{transform:scaleX(1)}}.pw,.pc,.pa,.pk,.pi{opacity:0;animation:18s steps(1) infinite}.pw{animation-name:sw}@keyframes sw{0%{opacity:1}14%{opacity:0}36%{opacity:1}50%{opacity:0}}.pc{animation-name:sc}@keyframes sc{14%{opacity:1}36%{opacity:0}}.pa{animation-name:sa}@keyframes sa{50%{opacity:1}64%{opacity:0}}.pk{animation-name:sk}@keyframes sk{64%{opacity:1}80%{opacity:0}}.pi{animation-name:si}@keyframes si{0%,79.9%{opacity:0}80%{opacity:1}}
.cur{animation:cur 1s steps(1) infinite}@keyframes cur{50%{opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#14121a"/><stop offset="1" stop-color="#1f1a24"/></linearGradient>
<clipPath id="c"><rect width="${W}" height="${H}" rx="24"/></clipPath></defs>
<g clip-path="url(#c)"><rect width="${W}" height="${H}" fill="url(#bg)"/>
<g class="far">${stars}<g transform="translate(${W} 0)">${stars}</g></g>
<text x="80" y="140" style="font:700 96px ui-sans-serif,system-ui,-apple-system,sans-serif;letter-spacing:-3px;fill:#f2f0ea">deck<tspan fill="#D97757">.</tspan></text>
<text x="84" y="186" style="font:500 26px ui-sans-serif,system-ui,sans-serif;fill:#e8e6e1">A cockpit for Claude Code.</text>
<text x="84" y="220" style="font:400 17px ui-sans-serif,system-ui,sans-serif;fill:#9a9893">Plan bars, usage limits, model routing and a tiny pet, above your prompt.</text>
<text x="84" y="266" style="font:400 16px ui-monospace,SFMono-Regular,Menlo,monospace;fill:#9C95EC">/deck<tspan fill="#9a9893"> ▸ 5h 31% ↻2:14:09 │ 7d 64% │ Fixing auth 3/5</tspan><tspan class="cur" fill="#f2f0ea"> ▋</tspan></text>
${bars}
<rect x="700" y="128" width="1" height="130" fill="#fff" opacity=".06"/>
<g transform="translate(720 52)"><g class="walk"><g class="face" style="transform-box:fill-box;transform-origin:center"><g class="pw"><svg width="76" height="60" viewBox="-4 -6 48 38" overflow="visible">${petSvgBody('walk')}</svg></g><g class="pc"><svg width="76" height="60" viewBox="-4 -6 48 38" overflow="visible">${petSvgBody('console')}</svg></g><g class="pa"><svg width="76" height="60" viewBox="-4 -6 48 38" overflow="visible">${petSvgBody('alert')}</svg></g><g class="pk"><svg width="76" height="60" viewBox="-4 -6 48 38" overflow="visible">${petSvgBody('celebrate')}</svg></g><g class="pi"><svg width="76" height="60" viewBox="-4 -6 48 38" overflow="visible">${petSvgBody('idle')}</svg></g></g></g></g>
</g></svg>`
writeFileSync(new URL('./banner.svg', import.meta.url), svg)
