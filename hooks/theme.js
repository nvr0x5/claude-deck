// Colors and small helpers shared by the drawings. Pure, no $.

// fill and pill-text colors for the terminal, glyph, and the desktop color (white text on it)
export const STYLE = {
  run: { fill: '#9C95EC', on: '#26215C', glyph: '●', desk: '#8B7CF6' },
  ask: { fill: '#EBA83A', on: '#412402', glyph: '?', desk: '#E09A1E' },
  hot: { fill: '#E2706F', on: '#501313', glyph: '!', desk: '#E5484D' },
  done: { fill: '#5DCAA5', on: '#04342C', glyph: '✓', desk: '#30A46C' },
  ok: { fill: '#5DCAA5', on: '#04342C', glyph: '◔', desk: '#30A46C' },
  warn: { fill: '#EBA83A', on: '#412402', glyph: '◑', desk: '#E09A1E' },
}

export const TIER = {
  haiku: { term: '#5DCAA5', desk: '#30A46C' },
  sonnet: { term: '#9C95EC', desk: '#8B7CF6' },
  opus: { term: '#EBA83A', desk: '#E09A1E' },
}

export const TRACK = '#3a3936'
export const TRACK_BG = '#2b2a28'
export const TICK_ON = '#f2f0ea'
export const TICK_OFF = '#55534e'
export const DIM = '#77756f'
export const MUTED = '#9a9893'
export const TEXT = '#e8e6e1'

export function hash(a, b, k) {
  const x = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453
  return x - Math.floor(x)
}

export function seedOf(id) {
  let h = 0
  for (const ch of String(id)) h = (Math.imul(h, 31) + ch.codePointAt(0)) | 0
  return h
}

export function trunc(s, n) {
  s = String(s ?? '').replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, Math.max(1, n - 1)) + '…' : s
}

export function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
}

export function textWidth(s, px = 6.7) {
  let w = 0
  for (const ch of String(s)) w += /[ilI.,:;'|!]/.test(ch) ? 3.4 : /[mwMW]/.test(ch) ? 9.5 : /[　-鿿]/.test(ch) ? 12 : px
  return w
}

export const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
export const mix = (a, b, m) => a.map((v, i) => Math.round(v + (b[i] - v) * m))
export const rgb = (c) => 'rgb(' + c.join(',') + ')'

// one Text per run of same-styled cells
export function runs(Text, cells) {
  const out = []
  let cur = null
  for (const c of cells) {
    if (cur && cur.color === c.color && cur.bg === c.bg && cur.bold === c.bold) cur.text += c.ch
    else {
      if (cur) out.push(cur)
      cur = { text: c.ch, color: c.color, bg: c.bg, bold: c.bold }
    }
  }
  if (cur) out.push(cur)
  return out.map((r) => {
    const props = { color: r.color, children: [r.text] }
    if (r.bg) props.backgroundColor = r.bg
    if (r.bold) props.bold = true
    return Text(props)
  })
}

export function textCells(s, color, bg, bold) {
  return [...String(s)].map((ch) => ({ ch, color, bg, bold }))
}
