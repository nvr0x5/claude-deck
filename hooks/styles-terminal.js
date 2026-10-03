// Terminal bar styles. Each returns exactly W cells for a row. Pure, no $.
import { STYLE, TRACK, TRACK_BG, TICK_ON, TICK_OFF, MUTED, hash, seedOf, trunc, textCells } from './theme.js'

export const TERMINAL_STYLES = ['segments', 'line', 'solid', 'dots', 'pixel', 'spark']
export const TERMINAL_STYLE_NAMES = { segments: 'Segments', line: 'Line', solid: 'Solid', dots: 'Dots', pixel: 'Pixel dots', spark: 'Spark' }

const DOTS = '⠁⠂⠄⠈⠃⠅⠉⠑⠆⠊⠒⠇⠋⠓⠧⠏⠗⠯⠷⠿⡿⣟⣯⣷⣽⣾⣿'

function labelCells(row, room) {
  const st = STYLE[row.style]
  const name = trunc(row.name, Math.max(3, room - (row.count ? row.count.length + 1 : 0)))
  const cells = textCells(name, st.fill)
  if (row.count && name.length + row.count.length + 1 <= room) cells.push(...textCells(' ' + row.count, MUTED))
  return cells
}

// a bar of width bw, then two spaces and the label, padded to W
function withLabel(bar, row, W) {
  const room = W - bar.length - 2
  const out = [...bar, ...textCells('  ', MUTED), ...labelCells(row, room)]
  while (out.length < W) out.push({ ch: ' ', color: MUTED })
  return out.slice(0, W)
}

function barWidth(row, W) {
  const want = Math.min(W - 8, Math.max(10, Math.round(W * 0.58)))
  return Math.max(6, want)
}

function segments(row, W, frame) {
  const st = STYLE[row.style]
  const bw = barWidth(row, W)
  const fx = (bw * row.pct) / 100
  const gaps = new Set(row.marks.filter((m) => m.stage).map((m) => Math.round(bw * m.f)))
  const cells = []
  for (let x = 0; x < bw; x++) {
    if (gaps.has(x)) {
      cells.push({ ch: ' ', color: TRACK })
      continue
    }
    const head = row.animating && x === Math.floor(fx)
    cells.push(x < Math.floor(fx) ? { ch: '▰', color: st.fill } : head ? { ch: '▰', color: frame % 4 < 2 ? st.fill : '#6e6aa8' } : { ch: '▱', color: TRACK })
  }
  return withLabel(cells, row, W)
}

function line(row, W, frame) {
  const st = STYLE[row.style]
  const bw = barWidth(row, W)
  const full = Math.floor((bw * row.pct) / 100)
  const marks = new Set(row.marks.map((m) => Math.round(bw * m.f)))
  const cells = []
  for (let x = 0; x < bw; x++) {
    if (x < full) cells.push({ ch: '━', color: st.fill })
    else if (x === full && row.pct < 100) cells.push({ ch: '╸', color: row.animating && frame % 4 < 2 ? '#f2f0ea' : st.fill })
    else cells.push({ ch: marks.has(x) ? '┼' : '─', color: marks.has(x) ? TICK_OFF : TRACK })
  }
  return withLabel(cells, row, W)
}

function solid(row, W, frame) {
  const st = STYLE[row.style]
  const bw = W
  const f = Math.round((bw * row.pct) / 100)
  const text = (' ' + row.name + (row.count ? ' · ' + row.count : '') + ' ').slice(0, bw)
  const sweep = row.animating ? ((frame * 2) % (bw + 12)) - 6 : -99
  const cells = []
  for (let x = 0; x < bw; x++) {
    const ch = text[x] ?? ' '
    const inFill = x < f
    const shine = inFill && Math.abs(x - sweep) < 2
    cells.push(
      inFill
        ? { ch, color: st.on, bg: shine ? '#cfc9f7' : st.fill, bold: true }
        : { ch, color: MUTED, bg: TRACK_BG },
    )
  }
  return cells
}

function dots(row, W, frame) {
  const st = STYLE[row.style]
  const cells = []
  if (row.steps && row.steps <= 16) {
    for (let i = 0; i < row.steps; i++) {
      const done = i < row.finished
      const cur = i === row.finished && row.animating
      cells.push(done ? { ch: '●', color: st.fill } : cur ? { ch: frame % 4 < 2 ? '◉' : '○', color: st.fill } : { ch: '○', color: TICK_OFF })
      if (i < row.steps - 1) cells.push({ ch: done ? '─' : '┄', color: done ? st.fill : TRACK })
    }
  } else {
    const n = 10
    for (let i = 0; i < n; i++) {
      const v = row.pct / 10 - i
      cells.push({ ch: v >= 1 ? '●' : v > 0.4 ? '◐' : '○', color: v > 0.4 ? st.fill : TICK_OFF })
      if (i < n - 1) cells.push({ ch: ' ', color: TRACK })
    }
  }
  return withLabel(cells.slice(0, Math.max(6, W - 8)), row, W)
}

function pixel(row, W, frame) {
  const st = STYLE[row.style]
  const fx = Math.round((W * row.pct) / 100)
  const pill = ' ' + trunc(row.name + (row.count ? ' ' + row.count : ''), Math.max(4, W - 4)) + ' '
  const L = pill.length
  const ps = Math.max(0, Math.min(W - L, fx >= L ? fx - L : fx))
  const marks = new Map(row.marks.map((m) => [Math.round(W * m.f), m.stage]))
  const seed = seedOf(row.id)
  const cells = []
  for (let x = 0; x < W; x++) {
    if (x >= ps && x < ps + L) cells.push({ ch: pill[x - ps], color: st.on, bg: st.fill, bold: true })
    else if (marks.has(x)) cells.push({ ch: marks.get(x) ? (x < fx ? '┃' : '│') : '╎', color: x < fx ? TICK_ON : TICK_OFF, bg: TRACK_BG })
    else if (x < fx) {
      const t = (x + 1) / Math.max(fx, 1)
      const d = (0.15 + 0.8 * t * t) * (0.6 + 0.4 * hash(seed, x, frame >> 1))
      cells.push({ ch: DOTS[Math.min(DOTS.length - 1, Math.floor(d * DOTS.length))], color: st.fill, bg: TRACK_BG })
    } else cells.push({ ch: ' ', color: TRACK, bg: TRACK_BG })
  }
  return cells
}

const BLOCKS = '▁▂▃▄▅▆▇█'

// a thin bar, then the recent history as a sparkline, then the label and how fast it moves
function spark(row, W, frame) {
  const st = STYLE[row.style]
  const hist = (row.hist ?? []).slice(-24)
  const bw = Math.max(6, Math.min(18, Math.round(W * 0.22)))
  const f = Math.round((bw * row.pct) / 100)
  const cells = []
  for (let x = 0; x < bw; x++) cells.push({ ch: x < f ? '━' : '─', color: x < f ? st.fill : TRACK })
  cells.push({ ch: ' ', color: TRACK })
  if (hist.length > 1) {
    const lo = Math.min(...hist)
    const hi = Math.max(...hist)
    for (const v of hist) cells.push({ ch: BLOCKS[Math.round(((v - lo) / Math.max(1e-9, hi - lo)) * 7)], color: st.fill })
  } else if (row.animating) {
    for (let i = 0; i < 8; i++) cells.push({ ch: BLOCKS[(i + frame) % 8], color: st.fill })
  }
  const out = [...cells, ...textCells('  ', MUTED), ...textCells(trunc(row.name, 24), st.fill)]
  if (row.rate) out.push(...textCells('  ' + row.rate, MUTED))
  else if (row.count) out.push(...textCells(' ' + row.count, MUTED))
  while (out.length < W) out.push({ ch: ' ', color: MUTED })
  return out.slice(0, W)
}

const FN = { segments, line, solid, dots, pixel, spark }

export function terminalBar(style, row, W, frame) {
  return (FN[style] ?? solid)(row, W, frame)
}

// a short bar for the collapsed line
export function terminalMini(style, row, W) {
  const st = STYLE[row.style]
  const f = Math.round((W * row.pct) / 100)
  const cells = []
  for (let x = 0; x < W; x++) {
    if (style === 'solid' || style === 'pixel') cells.push({ ch: ' ', color: st.fill, bg: x < f ? st.fill : TRACK_BG })
    else if (style === 'line') cells.push({ ch: x < f ? '━' : '─', color: x < f ? st.fill : TRACK })
    else if (style === 'dots') cells.push({ ch: x < f ? '●' : '○', color: x < f ? st.fill : TICK_OFF })
    else if (style === 'spark') cells.push({ ch: x < f ? '━' : '─', color: x < f ? st.fill : TRACK })
    else cells.push({ ch: x < f ? '▰' : '▱', color: x < f ? st.fill : TRACK })
  }
  return cells
}
