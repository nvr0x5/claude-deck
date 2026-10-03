// Desktop bar styles as SVG markup (22px tall), plus agent strips. Pure, no $.
// The pixel style and the strips adapt plan-progress (zycck/claude-mods, MIT, Kirill Serditov).
import { STYLE, hash, seedOf, esc, textWidth, hex, mix, rgb } from './theme.js'

export const DESKTOP_STYLES = ['pixel', 'segments', 'line', 'solid', 'dots', 'spark']
export const DESKTOP_STYLE_NAMES = { pixel: 'Pixel', segments: 'Segments', line: 'Line', solid: 'Solid', dots: 'Dots', spark: 'Spark' }

const H = 22
const FONT = "'Anthropic Sans',ui-sans-serif,system-ui,-apple-system,sans-serif"
const NARROW = 360

const ICON_PATH = {
  ask: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
  hot: 'M18 6 6 18M6 6l12 12',
  done: 'M20 6 9 17l-5-5',
}

// twinkle classes keep their phase across redraws
export function twinkleCss(nowMs, done) {
  const t = nowMs / 1000
  const durs = done ? [3.2, 3.8, 4.4, 3.5] : [2.2, 2.8, 1.9, 3.3]
  const base = [0, 0.7, 1.3, 0.4]
  let css = ''
  durs.forEach((d, i) => {
    css += `.t${i}{animation:tw ${d}s ease-in-out infinite;animation-delay:-${((t + base[i]) % d).toFixed(2)}s}`
  })
  return css + `@keyframes tw{0%,100%{opacity:1}50%{opacity:${done ? 0.8 : 0.45}}}@media (prefers-reduced-motion:reduce){.t0,.t1,.t2,.t3{animation:none}}`
}

function glideFrom(lastHead, id, fx) {
  const from = lastHead.get(id) ?? fx
  lastHead.set(id, fx)
  return from
}

const EASE = 'calcMode="spline" keyTimes="0;1" keySplines=".2 .8 .2 1"'

function pillMarkup(row, W, fx, from, color, maxShare = 0.55) {
  const icon = ICON_PATH[row.style]
  let knob
  let kw
  if (W < NARROW) {
    kw = H
    knob = `<circle cx="0" cy="${H / 2}" r="${H / 2}" fill="${color}"/>`
  } else {
    const iconW = icon ? 16 : 0
    const countW = row.count ? textWidth(row.count, 6.5) + 6 : 0
    const maxW = Math.max(80, W * maxShare)
    let shown = row.name
    while (shown.length > 3 && 20 + iconW + textWidth(shown) + countW > maxW) shown = shown.slice(0, -1)
    if (shown !== row.name) shown = shown.trimEnd() + '…'
    kw = Math.round(20 + iconW + textWidth(shown) + countW)
    const left = -kw / 2 + 10
    knob = `<rect x="${-kw / 2}" y="0" width="${kw}" height="${H}" rx="${H / 2}" fill="${color}"/>`
    if (icon) knob += `<path d="${icon}" transform="translate(${left} 5) scale(.5)" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round"/>`
    knob += `<text x="${left + iconW}" y="${H / 2 + 4.2}" style="font:500 12px ${FONT};fill:#fff">${esc(shown)}${row.count ? `<tspan dx="6" style="font-weight:400;fill-opacity:.75">${esc(row.count)}</tspan>` : ''}</text>`
  }
  const at = (x) => Math.max(kw / 2, Math.min(W - kw / 2, x >= kw ? x - kw / 2 : x + kw / 2))
  const kx = at(fx)
  const kFrom = at(from)
  const glide = Math.abs(kFrom - kx) > 0.5 ? `<animateTransform attributeName="transform" type="translate" from="${kFrom.toFixed(1)} 0" to="${kx.toFixed(1)} 0" dur=".45s" ${EASE} fill="freeze"/>` : ''
  return `<g transform="translate(${kx.toFixed(1)} 0)">${glide}${knob}</g>`
}

function pixel(row, W, nowMs, lastHead) {
  const done = row.style === 'done'
  const fx = (Math.max(0, Math.min(100, row.pct)) / 100) * W
  const from = glideFrom(lastHead, row.id, fx)
  const color = STYLE[row.style].desk
  const acc = hex(color)
  const light = mix(acc, [255, 255, 255], 0.32)
  const grey = [132, 130, 138]
  const seed = Math.abs(seedOf(row.id) % 997)
  const buckets = [0, 1, 2, 3, 4].map((b) => {
    const m = b / 4
    const dense = done ? 0.8 : 0.22 + 0.78 * Math.pow(m, 1.5)
    return { color: rgb(done ? light : mix(grey, light, m)), opacity: (0.35 + 0.65 * dense).toFixed(2) }
  })
  let px = ''
  for (let col = 0; col * 3 < fx; col++) {
    const x = col * 3
    const u = Math.min(1, (x + 1.5) / fx)
    const dense = done ? 0.8 : 0.22 + 0.78 * Math.pow(u, 1.5)
    const bucket = done ? 4 : Math.min(4, Math.floor(Math.min(1, Math.pow(u, 0.9) * 1.1) * 4.99))
    for (let r = 0; r < 7; r++) {
      if (hash(col + seed, r, 1) > dense + 0.1) continue
      px += `<rect x="${x}" y="${1 + r * 3}" class="pxd b${bucket} t${Math.floor(hash(col + seed, r, 2) * 4)}"/>`
    }
  }
  let marks = ''
  for (const m of row.marks) {
    const x = m.f * W
    const passed = x < fx - 1
    const h = m.stage ? H : 8
    marks += `<rect x="${(x - (m.stage ? 1 : 0.75)).toFixed(1)}" y="${(H - h) / 2}" width="${m.stage ? 2 : 1.5}" height="${h}" rx=".75" fill="${passed ? rgb(mix(light, [255, 255, 255], 0.45)) : '#8A8984'}" opacity="${passed ? (m.stage ? 0.95 : 0.6) : m.stage ? 0.7 : 0.45}"/>`
  }
  const id = 'p' + seed
  const glideFill = Math.abs(from - fx) > 0.5 ? `<animate attributeName="width" from="${from.toFixed(1)}" to="${fx.toFixed(1)}" dur=".45s" ${EASE} fill="freeze"/>` : ''
  const css = buckets.map((b, i) => `.b${i}{fill:${b.color};fill-opacity:${b.opacity}}`).join('') + '.pxd{width:2px;height:2px}' + twinkleCss(nowMs, done)
  return (
    `<style>${css}</style>` +
    `<defs><clipPath id="${id}a"><rect width="${W}" height="${H}" rx="${H / 2}"/></clipPath><clipPath id="${id}b"><rect width="${fx.toFixed(1)}" height="${H}">${glideFill}</rect></clipPath>` +
    `<linearGradient id="${id}g" x1="0" x2="${Math.max(1, fx).toFixed(1)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${rgb(acc)}" stop-opacity="${done ? 0.3 : 0.05}"/><stop offset="1" stop-color="${rgb(acc)}" stop-opacity=".33"/></linearGradient></defs>` +
    `<g clip-path="url(#${id}a)"><rect width="${W}" height="${H}" fill="#808080" fill-opacity=".16"/>` +
    `<g clip-path="url(#${id}b)"><rect width="${fx.toFixed(1)}" height="${H}" fill="url(#${id}g)"/>${px}</g>${marks}</g>` +
    pillMarkup(row, W, fx, from, color)
  )
}

function label(row, x, color) {
  return `<text x="${x}" y="15" style="font:500 12px ${FONT};fill:${color}">${esc(row.name)}${row.count ? `<tspan dx="6" style="font-weight:400;fill:#9a9893">${esc(row.count)}</tspan>` : ''}</text>`
}

function barShare(W) {
  return Math.max(80, Math.round(W * 0.62))
}

function segments(row, W, nowMs, lastHead) {
  const color = STYLE[row.style].desk
  const bw = barShare(W)
  const n = Math.max(8, Math.min(40, Math.round(bw / 9)))
  const gap = 2
  const sw = (bw - gap * (n - 1)) / n
  const filled = (row.pct / 100) * n
  const stages = new Set(row.marks.filter((m) => m.stage).map((m) => Math.round(m.f * n)))
  let out = ''
  for (let i = 0; i < n; i++) {
    const x = i * (sw + gap) + (stages.has(i) ? 2 : 0)
    const on = i < Math.floor(filled)
    const head = !on && i === Math.floor(filled) && row.animating
    out += `<rect x="${x.toFixed(1)}" y="5" width="${(sw - (stages.has(i) ? 2 : 0)).toFixed(1)}" height="12" rx="2" fill="${on || head ? color : '#808080'}" fill-opacity="${on ? 1 : head ? 0.5 : 0.18}"${head ? ' class="t1"' : ''}/>`
  }
  glideFrom(lastHead, row.id, 0)
  return `<style>${twinkleCss(nowMs, false)}</style>${out}${label(row, bw + 12, color)}`
}

function line(row, W, nowMs, lastHead) {
  const color = STYLE[row.style].desk
  const bw = barShare(W)
  const fx = (row.pct / 100) * bw
  const from = glideFrom(lastHead, row.id, fx)
  const glide = Math.abs(from - fx) > 0.5 ? `<animate attributeName="width" from="${from.toFixed(1)}" to="${fx.toFixed(1)}" dur=".45s" ${EASE} fill="freeze"/>` : ''
  const glideDot = Math.abs(from - fx) > 0.5 ? `<animate attributeName="cx" from="${from.toFixed(1)}" to="${fx.toFixed(1)}" dur=".45s" ${EASE} fill="freeze"/>` : ''
  let marks = ''
  for (const m of row.marks) marks += `<rect x="${(m.f * bw).toFixed(1)}" y="${m.stage ? 6 : 8}" width="1.5" height="${m.stage ? 10 : 6}" rx=".75" fill="${m.f * bw < fx ? color : '#8A8984'}" opacity=".7"/>`
  const pulse = row.animating ? '<animate attributeName="r" values="4;5.5;4" dur="1.2s" repeatCount="indefinite"/>' : ''
  return (
    `<rect x="0" y="10" width="${bw}" height="2" rx="1" fill="#808080" fill-opacity=".25"/>` +
    `<rect x="0" y="9.5" width="${fx.toFixed(1)}" height="3" rx="1.5" fill="${color}">${glide}</rect>${marks}` +
    `<circle cx="${fx.toFixed(1)}" cy="11" r="4" fill="${color}">${glideDot}${pulse}</circle>` +
    label(row, bw + 14, color)
  )
}

function solid(row, W, nowMs, lastHead) {
  const st = STYLE[row.style]
  const fx = (row.pct / 100) * W
  const from = glideFrom(lastHead, row.id, fx)
  const id = 's' + Math.abs(seedOf(row.id) % 997)
  const glide = Math.abs(from - fx) > 0.5 ? `<animate attributeName="width" from="${from.toFixed(1)}" to="${fx.toFixed(1)}" dur=".45s" ${EASE} fill="freeze"/>` : ''
  const t = (nowMs / 1000) % 2.4
  const sweep = row.animating
    ? `<rect x="-60" y="0" width="60" height="${H}" fill="#fff" fill-opacity=".18"><animate attributeName="x" from="-60" to="${W}" dur="2.4s" begin="-${t.toFixed(2)}s" repeatCount="indefinite"/></rect>`
    : ''
  const text = esc(row.name) + (row.count ? ' · ' + esc(row.count) : '')
  return (
    `<defs><clipPath id="${id}a"><rect width="${W}" height="${H}" rx="6"/></clipPath><clipPath id="${id}b"><rect width="${fx.toFixed(1)}" height="${H}">${glide}</rect></clipPath></defs>` +
    `<g clip-path="url(#${id}a)"><rect width="${W}" height="${H}" fill="#808080" fill-opacity=".16"/>` +
    `<text x="10" y="15" style="font:500 12px ${FONT};fill:#9a9893">${text}</text>` +
    `<g clip-path="url(#${id}b)"><rect width="${W}" height="${H}" fill="${st.desk}"/>${sweep}<text x="10" y="15" style="font:500 12px ${FONT};fill:#fff">${text}</text></g></g>`
  )
}

function dots(row, W, nowMs, lastHead) {
  const color = STYLE[row.style].desk
  glideFrom(lastHead, row.id, 0)
  let out = ''
  let x = 8
  if (row.steps && row.steps <= 16) {
    const gapW = Math.min(26, Math.max(12, (barShare(W) - 16) / Math.max(1, row.steps - 1)))
    for (let i = 0; i < row.steps; i++) {
      const done = i < row.finished
      const cur = i === row.finished && row.animating
      if (i > 0) out += `<rect x="${x - gapW + 5}" y="10.25" width="${gapW - 10}" height="1.5" rx=".75" fill="${done || cur ? color : '#808080'}" fill-opacity="${done || cur ? 0.8 : 0.3}"/>`
      out += done
        ? `<circle cx="${x}" cy="11" r="5" fill="${color}"/>`
        : cur
          ? `<circle cx="${x}" cy="11" r="5" fill="none" stroke="${color}" stroke-width="2"/><circle cx="${x}" cy="11" r="2.4" fill="${color}" class="t0"/>`
          : `<circle cx="${x}" cy="11" r="4.5" fill="none" stroke="#808080" stroke-opacity=".45" stroke-width="1.5"/>`
      x += gapW
    }
  } else {
    for (let i = 0; i < 10; i++) {
      const v = row.pct / 10 - i
      out += `<circle cx="${x}" cy="11" r="5" fill="#808080" fill-opacity=".2"/>`
      if (v > 0) out += `<clipPath id="d${seedOf(row.id) % 997}${i}"><rect x="${x - 5}" y="6" width="${10 * Math.min(1, v)}" height="10"/></clipPath><circle cx="${x}" cy="11" r="5" fill="${color}" clip-path="url(#d${seedOf(row.id) % 997}${i})"/>`
      x += 16
    }
  }
  return `<style>${twinkleCss(nowMs, false)}</style>${out}${label(row, x + 6, color)}`
}

// a slim bar, a sparkline of recent history ending in a dot, then the label and its rate
function spark(row, W, nowMs, lastHead) {
  const color = STYLE[row.style].desk
  const bw = Math.max(60, Math.round(W * 0.26))
  const fx = (row.pct / 100) * bw
  const from = glideFrom(lastHead, row.id, fx)
  const glide = Math.abs(from - fx) > 0.5 ? `<animate attributeName="width" from="${from.toFixed(1)}" to="${fx.toFixed(1)}" dur=".45s" ${EASE} fill="freeze"/>` : ''
  let out = `<rect x="0" y="7" width="${bw}" height="8" rx="4" fill="#808080" fill-opacity=".2"/><rect x="0" y="7" width="${fx.toFixed(1)}" height="8" rx="4" fill="${color}">${glide}</rect>`
  const sw = Math.max(60, Math.round(W * 0.3))
  const sx = bw + 14
  const hist = (row.hist ?? []).slice(-30)
  if (hist.length > 1) {
    const lo = Math.min(...hist)
    const hi = Math.max(...hist)
    const pts = hist.map((v, i) => [sx + (i * sw) / (hist.length - 1), 18 - ((v - lo) / Math.max(1e-9, hi - lo)) * 14])
    out += `<path d="${pts.map(([x, y], i) => (i ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1)).join(' ')}" fill="none" stroke="${color}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/>`
    const [lx, ly] = pts[pts.length - 1]
    out += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="2.6" fill="${color}"><animate attributeName="r" values="2.6;3.6;2.6" dur="1.6s" repeatCount="indefinite"/></circle>`
  } else {
    out += `<rect x="${sx}" y="10.5" width="${sw}" height="1" fill="#808080" fill-opacity=".3"/>`
  }
  const lx = sx + sw + 14
  out += `<text x="${lx}" y="15" style="font:500 12px ${FONT};fill:${color}">${esc(row.name)}${row.rate ? `<tspan dx="8" style="font-weight:400;fill:#9a9893">${esc(row.rate)}</tspan>` : row.count ? `<tspan dx="6" style="font-weight:400;fill:#9a9893">${esc(row.count)}</tspan>` : ''}</text>`
  void nowMs
  return out
}

const FN = { pixel, segments, line, solid, dots, spark }

export function desktopTrack(style, row, W, nowMs, lastHead) {
  return (FN[style] ?? pixel)(row, W, nowMs, lastHead)
}

// ---------- agent strips under a bar ----------

export const STRIP_H = 18
export const STRIP_GAP = 3

const AGENT_STYLE = { running: 'run', waiting: 'ask', error: 'hot', done: 'done' }

function elapsed(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'
}

export function stripsHeight(v) {
  const n = v.shown.length + (v.hidden.length ? 1 : 0)
  return n * STRIP_H + (n - 1) * STRIP_GAP
}

export function stripsSvg(v, W, nowMs, stripTool, tierColor, lastStrip) {
  const narrow = W < NARROW
  let out = ''
  v.shown.forEach((a, i) => {
    const c = STYLE[AGENT_STYLE[a.state]].desk
    const y = i * (STRIP_H + STRIP_GAP)
    const indent = a.depth > 0 ? 12 : 0
    let px = ''
    if (a.state === 'running') {
      for (let col = 0; col * 3 < W; col++) {
        for (let r = 0; r < 4; r++) {
          if (hash(col + i * 41, r, 5) > 0.2) continue
          px += `<rect x="${col * 3}" y="${(y + 3 + r * 3.6).toFixed(1)}" width="2" height="2" class="t${Math.floor(hash(col, r, 6) * 4)}" fill="${c}" fill-opacity=".32"/>`
        }
      }
    }
    const room = narrow ? W - 30 - indent : W * 0.45
    const full = (a.depth > 0 ? '↳ ' : '') + a.title
    let name = full
    while (name.length > 4 && textWidth(name, 6.9) > room) name = name.slice(0, -1)
    if (name !== full) name = name.trimEnd() + '…'
    const nameX = 19 + indent
    const toolX = nameX + textWidth(name, 6.9) + 12
    const tool = stripTool(a)
    const was = lastStrip.get(a.id)
    lastStrip.set(a.id, { tool, color: c })
    const changed = was !== undefined && was.tool !== tool
    const flow = was && was.color !== c ? `<animate attributeName="fill" from="${was.color}" to="${c}" dur=".2s" fill="freeze"/>` : ''
    const time = elapsed((a.endedAt ?? nowMs) - a.startedAt)
    let tag = ''
    if (a.model && !narrow) {
      const tc = tierColor(a.model)
      const tw = textWidth(a.model, 6) + 12
      tag = `<rect x="${W - 52 - tw}" y="${y + 3}" width="${tw}" height="12" rx="3" fill="${tc}" fill-opacity=".25"/><text x="${W - 46 - tw}" y="${y + 12.5}" style="font:500 10.5px ${FONT};fill:${tc}">${esc(a.model)}</text>`
    }
    out +=
      `<rect x="0" y="${y}" width="${W}" height="${STRIP_H}" rx="${STRIP_H / 2}" fill="${c}" fill-opacity=".15">${flow}</rect>${px}` +
      `<circle cx="${10 + indent}" cy="${y + STRIP_H / 2}" r="3" fill="${c}"${a.state === 'running' ? ' class="sd"' : ''}>${flow}</circle>` +
      `<text x="${nameX}" y="${y + 12.5}" class="sn">${esc(name)}</text>` +
      (narrow
        ? ''
        : (changed ? `<text x="${toolX}" y="${y + 12.5}" class="sn mo" style="fill:${was.color}">${esc(was.tool)}</text>` : '') +
          `<text x="${toolX}" y="${y + 12.5}" class="sn${changed ? ' mi' : ''}" style="fill:${c}">${esc(tool)}</text>` +
          tag +
          `<text x="${W - 9}" y="${y + 12.5}" text-anchor="end" class="sn st">${time}</text>`)
  })
  if (v.hidden.length) {
    const y = v.shown.length * (STRIP_H + STRIP_GAP)
    const done = v.hidden.filter((a) => a.state === 'done').length
    out += `<rect x="0" y="${y}" width="${W}" height="${STRIP_H}" rx="${STRIP_H / 2}" fill="#808080" fill-opacity=".14"/><text x="10" y="${y + 12.5}" class="sn st">+${v.hidden.length} more · ${done} done</text>`
  }
  return (
    `<style>.sn{font:400 11.5px ${FONT};fill:#F0EEFC}.st{fill-opacity:.65}` +
    twinkleCss(nowMs, false) +
    '.sd{animation:sp 1.1s ease-in-out infinite}@keyframes sp{50%{opacity:.3}}' +
    '.mi{animation:mi .2s ease-out both}@keyframes mi{from{opacity:0;filter:blur(3px)}}' +
    '.mo{animation:mo .2s ease-in both}@keyframes mo{to{opacity:0;filter:blur(3px)}}' +
    '@media (prefers-reduced-motion:reduce){.sd,.mi,.mo{animation:none}.mo{opacity:0}}</style>' +
    out
  )
}
