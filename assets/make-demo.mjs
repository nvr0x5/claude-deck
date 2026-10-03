// Builds assets/demo.svg: a self-playing Claude Code session with Deck above the prompt.
import { petSvgBody, PET_CSS } from '../hooks/pet.js'
import { desktopTrack, stripsSvg } from '../hooks/styles-desktop.js'
import { writeFileSync } from 'fs'
const W = 860, H = 520, T = 20 // seconds per loop
const F = "ui-sans-serif,system-ui,-apple-system,sans-serif", M = "ui-monospace,SFMono-Regular,Menlo,monospace"
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')
// scenes: [start%, end%]
const scenes = [
  { t: [0, 18], pct: 8, name: 'Read routes', count: '1/5', style: 'run', agents: [['Map the routes', 'Grep', 'running']], line: 'Reading the routes and mapping the auth flow.' },
  { t: [18, 36], pct: 40, name: 'Fixing auth', count: '3/5', style: 'run', agents: [['Map the routes', 'Done', 'done'], ['Write fixtures', 'Write', 'running']], line: 'Two agents on it. Fixing the token check now.' },
  { t: [36, 56], pct: 60, name: 'Run suite', count: '4/5', style: 'ask', agents: [['Write fixtures', 'Needs approval', 'waiting']], line: 'Run the test suite? (Bash: npm test)' },
  { t: [56, 74], pct: 80, name: 'Report', count: '5/5', style: 'run', agents: [], line: '24 tests pass. Writing the summary.' },
  { t: [74, 100], pct: 100, name: 'Done', count: '5/5', style: 'done', agents: [], line: 'Done: auth fixed, 24 tests passing.' },
]
const marks = [0.2, 0.4, 0.6, 0.8].map((f, i) => ({ f, stage: i === 1 }))
const vis = (cls, [a, b]) => `.${cls}{opacity:0;animation:${cls} ${T}s steps(1) infinite}@keyframes ${cls}{${a}%{opacity:1}${b}%{opacity:0}}`
let css = '', body = ''
scenes.forEach((s, i) => {
  const cls = 's' + i
  css += vis(cls, s.t)
  const row = { id: 'demo' + i, style: s.style, pct: s.pct, marks, name: s.name, count: s.count, animating: s.style !== 'done' }
  const strips = s.agents.length ? stripsSvg({ shown: s.agents.map(([title, tool, state], k) => ({ id: 'a' + i + k, title, tool, state, depth: 0, startedAt: 0, endedAt: 12000 + k * 7000, model: k ? 'sonnet' : 'haiku' })), hidden: [] }, 560, 0, (a) => a.tool, (m) => (m === 'haiku' ? '#30A46C' : '#8B7CF6'), new Map()) : ''
  body += `<g class="${cls}">
<text x="40" y="150" style="font:400 15px ${F};fill:#e8e6e1">${esc(s.line)}</text>
<g transform="translate(40 318)"><text x="0" y="15" style="font:400 13px ${F};fill:#e8e6e1">Fix the auth bug</text>
<g transform="translate(140 0)">${desktopTrack('pixel', row, 560, 0, new Map())}</g>
<text x="780" y="15" text-anchor="end" style="font:400 13px ${M};fill:#9a9893">${s.pct}%</text>
${strips ? `<g transform="translate(140 28)">${strips}</g>` : ''}</g></g>`
})
// pet pose per scene, walking along the band
const poses = [['console', [0, 36]], ['alert', [36, 56]], ['read', [56, 74]], ['celebrate', [74, 100]]]
let pet = ''
poses.forEach(([act, t], i) => { css += vis('p' + i, t); pet += `<g class="p${i}"><svg width="64" height="50" viewBox="-4 -6 48 38" overflow="visible">${petSvgBody(act)}</svg></g>` })
css += `.pm{animation:pm ${T}s ease-in-out infinite}@keyframes pm{0%,30%{transform:translateX(120px)}36%,74%{transform:translateX(420px)}80%,100%{transform:translateX(640px)}}`
// prompt typing at the start
const prompt = 'Fix the auth bug and add tests'
css += `.typ{animation:typ ${T}s steps(${prompt.length}) infinite}@keyframes typ{0%{width:0}8%,100%{width:${prompt.length * 8.4}px}}`
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="dt dd">
<title id="dt">Deck in a Claude Code session</title>
<desc id="dd">An illustrative session. Claude fixes an auth bug: the Deck bar fills stage by stage with two agents as strips under it, turns amber when a command needs approval, then goes green while the pet celebrates. Usage limits and countdowns sit below.</desc>
<style>${PET_CSS}${css}@media (prefers-reduced-motion:reduce){*{animation:none!important}.s4,.p3{opacity:1}}</style>
<defs><clipPath id="win"><rect width="${W}" height="${H}" rx="14"/></clipPath><clipPath id="tp"><rect class="typ" x="0" y="0" width="${prompt.length * 8.4}" height="30"/></clipPath></defs>
<g clip-path="url(#win)"><rect width="${W}" height="${H}" fill="#1a1a1a"/>
<rect width="${W}" height="38" fill="#232323"/><circle cx="22" cy="19" r="6" fill="#ff5f57"/><circle cx="42" cy="19" r="6" fill="#febc2e"/><circle cx="62" cy="19" r="6" fill="#28c840"/>
<text x="${W / 2}" y="24" text-anchor="middle" style="font:500 13px ${F};fill:#9a9893">Claude Code</text>
<g transform="translate(${W - 300} 66)"><rect width="260" height="34" rx="12" fill="#2a2a2a"/><g clip-path="url(#tp)" transform="translate(14 0)"><text x="0" y="22" style="font:400 14px ${F};fill:#e8e6e1">${prompt}</text></g></g>
<text x="40" y="126" style="font:500 13px ${M};fill:#D97757">●</text>
<rect x="24" y="236" width="${W - 48}" height="${H - 236 - 84}" rx="12" fill="#262626"/>
${body}
<g transform="translate(40 244)"><g class="pm">${pet}</g></g>
<rect x="40" y="306" width="${W - 80}" height="1" fill="#fff" opacity=".05"/>
<g transform="translate(40 ${H - 100})"><text x="0" y="0" style="font:400 12px ${M};fill:#9a9893"><tspan fill="#5DCAA5">◔</tspan> 5h 31% ↻2:14:09   <tspan fill="#EBA83A">◑</tspan> 7d 64% ↻3d 5h   <tspan fill="#9C95EC">●</tspan> ctx 12%   <tspan fill="#9C95EC">⇄</tspan> opus · medium   ⛅ 31° Tangerang</text></g>
<rect x="24" y="${H - 72}" width="${W - 48}" height="44" rx="12" fill="none" stroke="#3a3a3a"/><text x="44" y="${H - 44}" style="font:400 14px ${F};fill:#6b6964">Reply to Claude…</text>
<text x="${W - 40}" y="${H - 10}" text-anchor="end" style="font:400 12px ${F};fill:#77756f">Deck 1 · Opus 5.5 · Medium</text>
</g></svg>`
writeFileSync(new URL('./demo.svg', import.meta.url), svg)
