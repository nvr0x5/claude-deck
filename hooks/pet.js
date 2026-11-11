// The pet: one drawing, described once as shapes and animations, then written out two ways:
// an animated SVG for the desktop, and RGBA frames (an Image) for terminals that show
// pictures. A pose drawn here shows the same on both. Pure functions, no $.

export const PET_ACTS = ['idle', 'walk', 'run', 'think', 'read', 'search', 'type', 'terminal', 'browse', 'delegate', 'alert', 'celebrate', 'worried', 'error', 'sleep']

// the pose for each kind of work: what Claude is doing right now
export const WORK_ACTS = ['think', 'read', 'search', 'type', 'terminal', 'browse', 'delegate']

const SPEED = { walk: 0.035, run: 0.11 } // lane fractions per second
const TURN_S = 0.22

// ---------- behaviour: one scene at a time, the same on every surface ----------

export function createPet(now) {
  return { act: 'idle', dir: 1, x0: 0.3, x1: 0.3, start: now, dur: 3000, mood: 'calm', id: 1, turnAt: 0, minis: [] }
}

export function petX(pet, now) {
  const p = pet.dur > 0 ? Math.min(1, Math.max(0, (now - pet.start) / pet.dur)) : 1
  return pet.x0 + (pet.x1 - pet.x0) * p
}

function pick(list, r) {
  return list[Math.floor(r * list.length) % list.length]
}

const restful = (m) => m === 'calm' || m === 'sleepy'

// mood: 'alert' | 'celebrate' | 'error' | 'worried' | 'work:<act>' | 'sleepy' | 'calm'
export function stepPet(pet, mood, now, rand = Math.random) {
  const changed = mood !== pet.mood
  // a new mood cuts the scene short, except drifting between calm and sleepy
  const interrupt = changed && !(restful(mood) && restful(pet.mood))
  if (!interrupt && now < pet.start + pet.dur) return false
  const x = petX(pet, now)
  const dir0 = pet.dir
  pet.mood = mood
  pet.start = now
  pet.x0 = x
  pet.x1 = x
  pet.id++
  const work = mood.startsWith('work:') ? mood.slice(5) : null
  let act
  if (mood === 'alert' || mood === 'celebrate' || mood === 'error') act = mood
  else if (work) act = changed || rand() > 0.25 ? work : 'walk' // now and then it shifts over, then gets back to it
  else if (mood === 'worried') act = pick(['worried', 'worried', 'idle'], rand())
  else if (mood === 'sleepy') act = pick(['sleep', 'sleep', 'idle'], rand())
  else act = pick(['idle', 'idle', 'walk', 'walk', 'run'], rand())
  pet.act = act
  if (act === 'walk' || act === 'run') {
    let target = work ? x + (rand() < 0.5 ? -1 : 1) * (0.1 + rand() * 0.15) : rand()
    if (target < 0 || target > 1) target = x - (target - x)
    target = Math.min(1, Math.max(0, target))
    if (Math.abs(target - x) < 0.15 && !work) target = x < 0.5 ? Math.min(1, x + 0.4) : Math.max(0, x - 0.4)
    pet.x1 = target
    pet.dir = target >= x ? 1 : -1
    pet.dur = Math.max(400, (Math.abs(target - x) / SPEED[act]) * 1000)
  } else {
    if (mood === 'calm' && rand() < 0.3) pet.dir *= -1
    pet.dur = act === 'sleep' ? 14000 : act === 'alert' || act === 'error' ? 2500 : act === 'celebrate' ? 3200 : work ? 4000 + rand() * 3000 : 3000 + rand() * 4000
  }
  if (pet.dir !== dir0) pet.turnAt = now
  return true
}

// ---------- the drawing: shapes in pet units, the box below, facing right ----------

export const PET_VIEW = { x: -8, y: -10, w: 64, h: 42 }

const C = {
  body: '#D97757', shade: '#C4623F', dark: '#2a1c17', cream: '#f2f0ea', paper: '#e8e4da', grey: '#55534e', ink: '#1b1b1a',
  green: '#5DCAA5', blue: '#378ADD', spine: '#2b6cb0', sky: '#8fd3ff', lens: '#cfeeff', amber: '#E09A1E', amberInk: '#412402',
  violet: '#9C95EC', red: '#E2706F', smoke: '#6b6a66', white: '#ffffff', black: '#000000', lid: '#3b3a38', base: '#2a2a28',
  haiku: '#30A46C', sonnet: '#8B7CF6', opus: '#E09A1E',
}

// leaves
const R = (x, y, w, h, r, fill, op = 1) => ({ k: 'rect', x, y, w, h, r, fill, op })
const E = (cx, cy, rx, ry, fill, op = 1) => ({ k: 'ell', cx, cy, rx, ry, fill, op })
const L = (pts, w, fill, op = 1) => ({ k: 'line', pts, w, fill, op })
const P = (pts, fill, op = 1) => ({ k: 'poly', pts, fill, op })
const O = (cx, cy, r, w, fill, op = 1) => ({ k: 'ring', cx, cy, r, w, fill, op })
// a group: static transforms (outer first), then animations (outer first)
const G = (g, tf = [], anim = []) => ({ g: g.filter(Boolean), tf, anim: [].concat(anim).filter(Boolean) })
const T = (x, y) => ['t', x, y]
const S = (sx, sy, ox = 0, oy = 0) => ['s', sx, sy, ox, oy]
const Rot = (deg, ox = 0, oy = 0) => ['r', deg, ox, oy]
// an animation of one property: ty, tx, sy, sx (scale), r (degrees) or o (opacity), keyframes [[at, value]...]
const A = (p, k, d, ease = 'io', delay = 0, o = [0, 0]) => ({ p, k, d, ease, delay, o })

const quad = (x0, y0, cx, cy, x1, y1, n = 6) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n
  return [(1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1]
})
const arc = (cx, cy, r, a0, a1, n = 5) => Array.from({ length: n + 1 }, (_, i) => {
  const a = a0 + ((a1 - a0) * i) / n
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
})

const STEP_A = [[0, 0], [0.25, -2.4], [0.5, 0], [1, 0]]
const STEP_B = [[0, 0], [0.5, 0], [0.75, -2.4], [1, 0]]
const BOB = [[0, 0], [0.25, -1], [0.5, 0], [0.75, -1], [1, 0]]

function eyes(kind) {
  const d = C.dark
  if (kind === 'closed') return [R(13.5, 13.6, 4, 1.3, 0.65, d), R(22.5, 13.6, 4, 1.3, 0.65, d)]
  if (kind === 'happy') return [L([[13.6, 14.4], [15.5, 12.3], [17.4, 14.4]], 1.4, d), L([[22.6, 14.4], [24.5, 12.3], [26.4, 14.4]], 1.4, d)]
  if (kind === 'x') return [[14, 11.4, 17, 14.4], [17, 11.4, 14, 14.4], [23, 11.4, 26, 14.4], [26, 11.4, 23, 14.4]].map(([a, b, c, e]) => L([[a, b], [c, e]], 1.25, d))
  const wide = kind === 'wide'
  const h = wide ? 6.8 : 5.6
  const y = wide ? 9.6 : 10.4
  const w = wide ? 3.4 : 3
  const one = (x) => [R(x, y, w, h, 1.5, d), E(x + 1.05, y + 1.25, 0.62, 0.62, C.white, 0.85)]
  const shift = kind === 'down' ? [T(-0.8, 1.3)] : kind === 'up' ? [T(1, -1.4)] : kind === 'side' ? [T(1.3, 0)] : kind === 'scan' ? [T(0, 0.7)] : []
  const move =
    kind === 'scan' ? A('tx', [[0, -1.2], [0.5, 1.2], [1, -1.2]], 1.6)
    : kind === 'look' ? A('tx', [[0, 0], [0.3, 0], [0.4, 1.4], [0.62, 1.4], [0.72, -1.3], [0.88, -1.3], [1, 0]], 5)
    : null
  const blink = A('sy', [[0, 1], [0.93, 1], [0.96, 0.1], [1, 1]], 4.2, 'lin', 0, [20, y + h / 2])
  return [G([...one(wide ? 13.8 : 14), ...one(wide ? 22.8 : 23)], shift, [move, blink])]
}

function mouth(kind) {
  const d = C.dark
  if (kind === 'happy') return [L(quad(18.2, 17.3, 20, 19.2, 21.8, 17.3), 1.15, d)]
  if (kind === 'o') return [E(20, 18.3, 1.05, 1.3, d)]
  if (kind === 'wavy') return [L(Array.from({ length: 9 }, (_, i) => [17.2 + i * 0.7, 18.3 + (i % 2 ? -0.45 : 0)]), 0.95, d)]
  if (kind === 'flat') return [L([[18.7, 18.2], [21.3, 18.2]], 1, d)]
  return []
}

// a little Claude in its model's color, for a subagent
function mini(x, color, delay) {
  const legs = [11, 15.5, 21.5, 26].map((lx, i) => G([R(lx, 21, 3, 7.5, 1.5, C.body)], [], A('ty', i % 2 ? STEP_B : STEP_A, 0.5, 'lin', delay)))
  return G(
    [
      E(20, 29.3, 11, 1.6, C.black, 0.28),
      G([...legs, R(3, 12, 6, 5, 2.5, C.body), R(31, 12, 6, 5, 2.5, C.body), R(8, 6, 24, 16, 4.5, C.body), R(8, 16.6, 24, 3, 0, color), R(14.8, 10.4, 3, 5.2, 1.5, C.dark), R(23.8, 10.4, 3, 5.2, 1.5, C.dark)], [], A('ty', [[0, 0], [0.5, -2.5], [1, 0]], 0.5, 'io', delay)),
    ],
    [T(x, 17.1), S(0.4, 0.4)],
  )
}

// a glyph of floating code, drawn with strokes
function glyph(ch, x, y, s) {
  const g = C.green
  const pts = {
    '{': [[1, 0], [0.4, 0.3], [0.5, 0.9], [0, 1.1], [0.5, 1.3], [0.4, 1.9], [1, 2.2]],
    '}': [[0, 0], [0.6, 0.3], [0.5, 0.9], [1, 1.1], [0.5, 1.3], [0.6, 1.9], [0, 2.2]],
    '<': [[1, 0.2], [0, 1.1], [1, 2]],
    '>': [[0, 0.2], [1, 1.1], [0, 2]],
    '/': [[1, 0], [0, 2.2]],
  }[ch]
  return L(pts.map(([u, v]) => [x + u * s, y + v * s]), 0.55, g)
}

const FACE = {
  idle: ['look', ''], walk: ['side', ''], run: ['side', ''], think: ['up', ''], read: ['scan', ''], search: ['side', ''], type: ['down', ''], terminal: ['side', ''],
  browse: ['side', ''], delegate: ['side', 'happy'], alert: ['wide', 'o'], celebrate: ['happy', 'happy'], sleep: ['closed', ''], worried: ['down', 'wavy'], error: ['x', 'flat'],
}

export function petScene(act, opts = {}) {
  const B = C.body
  const sit = act === 'think' || act === 'read' || act === 'type'
  const walk = act === 'walk'
  const run = act === 'run'
  const sleep = act === 'sleep'
  const drop = sit ? 3 : sleep ? 5.5 : 0
  const step = run ? 0.34 : 0.68

  const legs = sit
    ? [R(8.6, 24.9, 7.4, 3.4, 1.7, B), R(24, 24.9, 7.4, 3.4, 1.7, B)]
    : sleep
      ? []
      : [11, 15.5, 21.5, 26].map((x, i) => G([R(x, 21, 3, 7.5, 1.5, B)], [], walk || run ? A('ty', i % 2 ? STEP_B : STEP_A, step, 'lin') : null))

  const leftArm = R(3, 12, 6, 5, 2.5, B)
  const reach = R(30, 12.4, 6.6, 4.6, 2.3, B)
  let armsBack = [leftArm, R(31, 12, 6, 5, 2.5, B)]
  let armsFront = []
  let front = []
  let held = []
  let free = []

  if (act === 'think') {
    armsBack = [leftArm]
    armsFront = [R(26.4, 15.4, 5.2, 4.6, 2.3, B)]
    free = [E(32.5, 5, 1.1, 1.1, C.cream, 0.9), E(36, 1.4, 1.8, 1.8, C.cream, 0.95), E(44, -4.6, 8.4, 5, C.cream), ...[40.6, 44, 47.4].map((x, i) => G([E(x, -4.6, 1.05, 1.05, C.dark)], [], A('o', [[0, 0.25], [0.5, 1], [1, 0.25]], 1.2, 'io', i * 0.2)))]
  }
  if (act === 'read') {
    // we see the outside of the book, covers and spine; the pages face the pet, and peek out the top
    armsBack = []
    front = [
      R(10.4, 15.6, 19.2, 1.4, 0.5, C.cream),
      G([R(19.6, 15.2, 5.6, 1.6, 0.5, '#fbfaf6')], [], A('sy', [[0, 1], [0.62, 1], [0.72, 2.6], [0.84, 1], [1, 1]], 3.2, 'io', 0, [22.4, 16.8])),
      R(9.5, 16.4, 21, 9.4, 1.4, C.blue),
      R(19.4, 16.4, 1.2, 9.4, 0, C.spine),
      R(11.6, 18.4, 6, 3.6, 0.6, C.cream, 0.9),
      L([[12.6, 19.6], [16.6, 19.6]], 0.55, C.blue),
      L([[12.6, 20.9], [15.2, 20.9]], 0.55, C.blue),
      O(25.2, 21, 1.4, 0.5, C.cream, 0.55),
    ]
    armsFront = [R(7.4, 18.4, 5, 4.5, 2.25, B), R(27.6, 18.4, 5, 4.5, 2.25, B)]
  }
  if (act === 'search') {
    armsBack = [leftArm]
    held = [G([L([[35, 16.2], [38.7, 12.4]], 1.9, C.grey), E(41.4, 9.6, 3.9, 3.9, C.lens, 0.75), O(41.4, 9.6, 3.9, 1.5, C.cream), L(arc(41.4, 9.6, 2.3, Math.PI * 1.05, Math.PI * 1.45, 3), 0.7, C.white, 0.9)], [], A('r', [[0, -16], [0.5, 14], [1, -16]], 1.9, 'io', 0, [35, 16.2]))]
    armsFront = [reach]
  }
  if (act === 'type') {
    armsBack = []
    front = [E(20, 17, 9, 2.6, C.green, 0.22), R(11, 17.2, 18, 7, 1.2, C.lid), E(20, 20.7, 1.1, 1.1, C.cream, 0.35), R(8, 24, 24, 1.8, 0.9, C.base)]
    armsFront = [G([R(9.6, 15.6, 4.6, 3.4, 1.7, B)], [], A('ty', [[0, 0], [0.5, 1.3], [1, 0]], 0.22)), G([R(25.8, 15.6, 4.6, 3.4, 1.7, B)], [], A('ty', [[0, 0], [0.5, 1.3], [1, 0]], 0.22, 'io', 0.11))]
    const rise = (els, delay) => G([G([G(els, [], A('o', [[0, 0], [0.15, 1], [1, 0]], 2.4, 'lin', delay))], [], A('tx', [[0, 0], [1, 3]], 2.4, 'lin', delay))], [], A('ty', [[0, 0], [1, -13]], 2.4, 'lin', delay))
    free = [rise([glyph('{', 30.6, 7.4, 1.2), glyph('}', 32.6, 7.4, 1.2)], 0), rise([glyph('<', 34, 2.6, 1.1), glyph('/', 35.4, 2.6, 1.1), glyph('>', 36.8, 2.6, 1.1)], 0.8), rise([E(30, 0.6, 0.45, 0.45, C.green), L([[30, 1.6], [29.6, 2.6]], 0.55, C.green)], 1.6)]
  }
  if (act === 'terminal') {
    armsBack = [leftArm]
    held = [G([
      R(-0.3, -0.3, 17.1, 13, 2, '#4a4a48'), R(0, 0, 16.5, 12.4, 1.8, C.ink),
      E(2, 1.7, 0.55, 0.55, C.red), E(3.7, 1.7, 0.55, 0.55, C.amber), E(5.4, 1.7, 0.55, 0.55, C.green),
      L([[1.9, 5], [3.4, 6.2], [1.9, 7.4]], 0.75, C.green), R(4.5, 5.6, 5, 1.2, 0.5, C.cream, 0.75),
      G([R(10.2, 5.3, 1.4, 1.9, 0, C.green)], [], A('o', [[0, 1], [0.5, 0], [1, 0]], 1, 'step')),
      R(1.9, 9, 8, 1, 0.5, C.cream, 0.35),
    ], [T(35.5, 3.2)])]
    armsFront = [reach]
  }
  if (act === 'browse') {
    armsBack = [leftArm]
    held = [G([
      E(0, 0, 5.3, 5.3, C.blue),
      P([[-4.6, -1.6], [-2.8, -3.6], [-0.6, -3], [-0.2, -1], [-1.8, 0.6], [-3.6, 0.2]], C.green),
      P([[0.8, 1.2], [3, 0.6], [4.2, 2], [2.8, 4], [1, 3.4]], C.green),
      P([[1.8, -4.4], [3.6, -3.6], [2.6, -2.4]], C.green),
      G([O(0, 0, 5.3, 0.5, C.white, 0.35)], [], A('sx', [[0, 1], [0.5, 0.12], [1, 1]], 1.6, 'lin')),
      L([[-5.2, 0], [5.2, 0]], 0.45, C.white, 0.22),
      E(-1.8, -2.2, 1.6, 0.9, C.white, 0.35),
    ], [T(42, 9.6)])]
    armsFront = [reach]
  }
  if (act === 'delegate') {
    armsBack = [leftArm]
    armsFront = [reach]
    const minis = (opts.minis && opts.minis.length ? opts.minis : ['sonnet']).slice(0, 2)
    free = minis.map((m, i) => mini(32.5 + i * 9.5, C[m] ?? C.sonnet, i * 0.25))
  }
  if (act === 'alert') {
    free = [G([G([R(0, 0, 10, 10, 5, C.amber), P([[2.3, 8.2], [0.6, 11.8], [5.2, 9.4]], C.amber), R(4.3, 1.9, 1.5, 4.4, 0.75, C.amberInk), E(5.05, 7.7, 0.9, 0.9, C.amberInk)], [], A('ty', [[0, 0], [0.5, -2], [1, 0]], 0.55))], [T(30.5, -7.6)])]
  }
  if (act === 'celebrate') {
    armsBack = [G([R(3, 2.5, 4, 10, 2, B)], [], A('r', [[0, -20], [0.5, 24], [1, -20]], 0.45, 'io', 0, [5, 12.5])), G([R(33, 2.5, 4, 10, 2, B)], [], A('r', [[0, 24], [0.5, -20], [1, 24]], 0.45, 'io', 0, [35, 12.5]))]
    const cols = [C.amber, C.violet, C.green, C.red, C.sky, C.amber, C.violet, C.green]
    free = [
      ...cols.map((c, i) => G([G([G([R(12 + i * 2.2, -7, 1.9, 1.9, 0.4, c)], [], A('o', [[0, 1], [1, 0]], 1.25, 'lin', i * 0.11))], [], A('tx', [[0, 0], [1, (i - 3.5) * 3.2]], 1.25, 'lin', i * 0.11))], [], A('ty', [[0, 0], [1, 20]], 1.25, 'lin', i * 0.11))),
      G([P(star(38, -2.5, 2.1), C.amber)], [], A('o', [[0, 0], [0.5, 1], [1, 0]], 1)),
      G([P(star(3.5, 0, 1.6), C.violet)], [], A('o', [[0, 0], [0.5, 1], [1, 0]], 1, 'io', 0.5)),
    ]
  }
  if (sleep) {
    armsBack = [R(4.6, 16.4, 5.4, 4.4, 2.2, B), R(30, 16.4, 5.4, 4.4, 2.2, B)]
    front = [P([[10.5, 7.6], ...quad(10.5, 7.6, 19, -1.6, 30.6, 1.4).slice(1), [28.6, 7.1], ...quad(28.6, 7.1, 20, 5.6, 10.5, 7.6).slice(1)], C.violet), R(9.4, 6.2, 21.2, 2.5, 1.25, C.cream, 0.92), E(31.3, 1.5, 1.8, 1.8, C.cream)]
    const zed = (x, y, s, delay) => G([G([G([L([[x, y], [x + 3 * s, y], [x, y + 3 * s], [x + 3 * s, y + 3 * s]], 0.8, '#9a9893')], [], A('o', [[0, 0], [0.2, 1], [1, 0]], 2.6, 'lin', delay))], [], A('tx', [[0, 0], [1, 7]], 2.6, 'lin', delay))], [], A('ty', [[0, 0], [1, -12]], 2.6, 'lin', delay))
    free = [zed(32, 3, 1.1, 0), zed(36.5, 0, 0.85, 1.1)]
  }
  if (act === 'worried') {
    const drop1 = [[33.6, 6.2], ...quad(33.6, 6.2, 35.3, 8.9, 33.6, 10), ...quad(33.6, 10, 31.9, 8.9, 33.6, 6.2).slice(1)]
    held = [G([G([P(drop1, C.sky)], [], A('o', [[0, 0], [0.2, 1], [1, 0]], 1.6, 'lin'))], [], A('ty', [[0, 0], [1, 5]], 1.6, 'lin'))]
  }
  if (act === 'error') {
    free = [[15, 1, 0], [21, -1, 0.5], [26.5, 2, 1]].map(([x, y, d]) => G([G([E(x, y, 2.2, 2.2, C.smoke)], [], A('o', [[0, 0], [0.25, 0.7], [1, 0]], 1.5, 'lin', d))], [], A('ty', [[0, 0], [1, -9]], 1.5, 'lin', d)))
  }
  if (run) free = [0, 0.25].map((d, i) => G([G([E(i ? 2.5 : 5, i ? 25.4 : 27.4, i ? 1.4 : 2, i ? 1.4 : 2, C.smoke)], [], A('o', [[0, 0.6], [1, 0]], 0.5, 'lin', d))], [], A('tx', [[0, 0], [1, -7]], 0.5, 'lin', d)))

  const [ek, mk] = FACE[act] ?? FACE.idle
  const bodyAnim =
    run || walk ? A('ty', BOB, step, 'lin')
    : act === 'celebrate' ? [A('ty', [[0, 0], [0.1, 0], [0.42, -11], [0.72, 0], [1, 0]], 0.9), A('sy', [[0, 1], [0.1, 0.88], [0.42, 1.05], [0.72, 1], [1, 1]], 0.9, 'io', 0, [20, 28.5])]
    : act === 'alert' ? A('ty', [[0, 0], [0.5, -2.2], [1, 0]], 0.55)
    : act === 'worried' ? A('tx', [[0, 0], [0.25, -0.5], [0.75, 0.5], [1, 0]], 0.22, 'lin')
    : A('sy', [[0, 1], [0.5, 0.955], [1, 1]], sleep ? 3.6 : 2.6, 'io', 0, [20, 28.5])
  const lean = run ? 8 : walk ? 2.5 : 0
  const shade = P([[8, 17], [32, 17], ...arc(27.5, 17.5, 4.5, 0, Math.PI / 2), ...arc(12.5, 17.5, 4.5, Math.PI / 2, Math.PI)], C.shade, 0.6)
  const body = [R(8, 6, 24, 16, 4.5, B), shade, R(11, 7.6, 12, 1.6, 0.8, C.white, 0.17)]
  const torso = G([...armsBack, ...body, ...eyes(ek), ...mouth(mk), ...front, ...held, ...armsFront], sleep ? [S(1, 0.88, 20, 22)] : [])
  return G([
    E(20, 29.2, act === 'celebrate' ? 9 : sleep ? 13 : 12, 1.6, C.black, 0.3),
    G([G([...legs, G([torso], [T(0, drop)])], [], bodyAnim)], lean ? [Rot(lean, 20, 28.5)] : []),
    ...free,
  ])
}

function star(cx, cy, r) {
  return Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4 - Math.PI / 2
    const rr = i % 2 ? r * 0.38 : r
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]
  })
}

// ---------- the animation clock: a property's value at time t ----------

const smooth = (u) => u * u * (3 - 2 * u)

function valueAt(a, t) {
  const k = a.k
  const ph = ((((t - a.delay) % a.d) + a.d) % a.d) / a.d
  for (let i = 1; i < k.length; i++) {
    if (ph <= k[i][0]) {
      const [t0, v0] = k[i - 1]
      const [t1, v1] = k[i]
      if (a.ease === 'step') return v0
      const u = t1 > t0 ? (ph - t0) / (t1 - t0) : 1
      return v0 + (v1 - v0) * (a.ease === 'lin' ? u : smooth(u))
    }
  }
  return k[k.length - 1][1]
}

// ---------- desktop: animated SVG ----------

const num = (v) => String(Math.round(v * 100) / 100)
const pts = (list) => list.map(([x, y]) => num(x) + ',' + num(y)).join(' ')

const CSS_PROP = { ty: (v) => `transform:translateY(${num(v)}px)`, tx: (v) => `transform:translateX(${num(v)}px)`, sy: (v) => `transform:scaleY(${num(v)})`, sx: (v) => `transform:scaleX(${num(v)})`, r: (v) => `transform:rotate(${num(v)}deg)`, o: (v) => `opacity:${num(v)}` }
const EASE = { io: 'ease-in-out', lin: 'linear', step: 'step-end' }

function keyframesName(a, css) {
  const body = a.k.map(([at, v]) => `${num(at * 100)}%{${CSS_PROP[a.p](v)}}`).join('')
  let h = 0
  for (const ch of a.p + body) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0
  const name = 'pk' + (h >>> 0).toString(36)
  css.set(name, `@keyframes ${name}{${body}}`)
  return name
}

function tfAttr(tf) {
  return tf.map(([k, a, b, c, d]) => (k === 't' ? `translate(${num(a)} ${num(b)})` : k === 's' ? `translate(${num(c)} ${num(d)}) scale(${num(a)} ${num(b)}) translate(${num(-c)} ${num(-d)})` : `rotate(${num(a)} ${num(b)} ${num(c)})`)).join(' ')
}

function svgOf(n, t, css) {
  if (!n.g) {
    const op = n.op < 1 ? ` opacity="${num(n.op)}"` : ''
    if (n.k === 'rect') return `<rect x="${num(n.x)}" y="${num(n.y)}" width="${num(n.w)}" height="${num(n.h)}"${n.r ? ` rx="${num(n.r)}"` : ''} fill="${n.fill}"${op}/>`
    if (n.k === 'ell') return `<ellipse cx="${num(n.cx)}" cy="${num(n.cy)}" rx="${num(n.rx)}" ry="${num(n.ry)}" fill="${n.fill}"${op}/>`
    if (n.k === 'line') return `<polyline points="${pts(n.pts)}" fill="none" stroke="${n.fill}" stroke-width="${num(n.w)}" stroke-linecap="round" stroke-linejoin="round"${op}/>`
    if (n.k === 'poly') return `<polygon points="${pts(n.pts)}" fill="${n.fill}"${op}/>`
    return `<circle cx="${num(n.cx)}" cy="${num(n.cy)}" r="${num(n.r)}" fill="none" stroke="${n.fill}" stroke-width="${num(n.w)}"${op}/>`
  }
  let inner = n.g.map((c) => svgOf(c, t, css)).join('')
  for (let i = n.anim.length - 1; i >= 0; i--) {
    const a = n.anim[i]
    // phased by the clock, so a redraw lands where the last one was instead of restarting
    const lag = ((((t - a.delay) % a.d) + a.d) % a.d).toFixed(2)
    const [ox, oy] = a.o
    const moved = `<g style="animation:${keyframesName(a, css)} ${a.d}s ${EASE[a.ease]} -${lag}s infinite;transform-origin:0 0">`
    inner = ox || oy ? `<g transform="translate(${num(ox)} ${num(oy)})">${moved}<g transform="translate(${num(-ox)} ${num(-oy)})">${inner}</g></g></g>` : `${moved}${inner}</g>`
  }
  return n.tf.length ? `<g transform="${tfAttr(n.tf)}">${inner}</g>` : n.anim.length ? inner : `<g>${inner}</g>`
}

export const PET_CSS = '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'

// the pet's own markup for a viewBox of PET_VIEW, with its keyframes; tMs places every loop in time
export function petSvgBody(act, tMs = 0, opts = {}) {
  const css = new Map()
  const body = svgOf(petScene(act, opts), tMs / 1000, css)
  return `<style>${[...css.values()].join('')}${PET_CSS}</style>${body}`
}

export const PET_VIEWBOX = `${PET_VIEW.x} ${PET_VIEW.y} ${PET_VIEW.w} ${PET_VIEW.h}`

// the lane: the pet walks from x0 to x1 by CSS, phased by the scene's age so a redraw does not restart it
export function petLaneSvg(pet, now, W, H = 62, scale = 1.05) {
  const PW = PET_VIEW.w * scale
  const PH = PET_VIEW.h * scale
  const room = Math.max(0, W - PW)
  const a = pet.x0 * room
  const b = pet.x1 * room
  const age = Math.max(0, now - pet.start) / 1000
  const dur = Math.max(0.001, pet.dur / 1000)
  const move = `@keyframes mv${pet.id}{from{transform:translateX(${a.toFixed(1)}px)}to{transform:translateX(${b.toFixed(1)}px)}}`
  // turning around: a quick squash through the middle instead of a snap
  const turnAge = (now - (pet.turnAt ?? 0)) / 1000
  const turn = turnAge < TURN_S ? `@keyframes tn${pet.id}{from{transform:scaleX(-1)}to{transform:scaleX(1)}}.tn{animation:tn${pet.id} ${TURN_S}s ease-in-out both;animation-delay:-${turnAge.toFixed(2)}s;transform-box:fill-box;transform-origin:center}` : ''
  const flip = pet.dir < 0 ? `translate(${num(PW)} 0) scale(-1 1)` : ''
  let dots = ''
  if (scale >= 1) for (let x = 4; x < W; x += 12) dots += `<rect x="${x}" y="${H - 4}" width="4" height="1" fill="#fff" opacity=".07"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<style>${move}${turn}.mv{animation:mv${pet.id} ${dur.toFixed(2)}s linear both;animation-delay:-${Math.min(age, dur).toFixed(2)}s}${PET_CSS}</style>` +
    dots +
    `<g class="mv"><g transform="translate(0 ${num(H - PH - 2)})"><g transform="${flip}"><g${turn ? ' class="tn"' : ''}><svg width="${num(PW)}" height="${num(PH)}" viewBox="${PET_VIEWBOX}" overflow="visible">${petSvgBody(pet.act, now, { minis: pet.minis })}</svg></g></g></g></g>` +
    '</svg>'
  )
}

// ---------- terminal: the same scene rasterized, frame by frame ----------

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16))

export const PET_RASTER = { scale: 2, width: PET_VIEW.w * 2, height: PET_VIEW.h * 2 }

// affine matrices [a b c d e f]: x' = a x + c y + e, y' = b x + d y + f
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]]
const mT = (x, y) => [1, 0, 0, 1, x, y]
const mS = (sx, sy) => [sx, 0, 0, sy, 0, 0]
const mR = (deg) => {
  const r = (deg * Math.PI) / 180
  return [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0]
}
const about = (m, ox, oy) => mul(mul(mT(ox, oy), m), mT(-ox, -oy))
function inv(m) {
  const det = m[0] * m[3] - m[1] * m[2] || 1e-9
  const a = m[3] / det
  const b = -m[1] / det
  const c = -m[2] / det
  const d = m[0] / det
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])]
}
const apply = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]

function segDist2(px, py, [x0, y0], [x1, y1]) {
  const dx = x1 - x0
  const dy = y1 - y0
  const l = dx * dx + dy * dy
  const u = l ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l)) : 0
  return (px - x0 - u * dx) ** 2 + (py - y0 - u * dy) ** 2
}

function leafTest(n) {
  if (n.k === 'rect') {
    const { x, y, w, h } = n
    const r = Math.min(n.r, w / 2, h / 2)
    return [[x, y, x + w, y + h], (u, v) => {
      if (u < x || v < y || u > x + w || v > y + h) return false
      const cx = Math.min(Math.max(u, x + r), x + w - r)
      const cy = Math.min(Math.max(v, y + r), y + h - r)
      return (u - cx) ** 2 + (v - cy) ** 2 <= r * r
    }]
  }
  if (n.k === 'ell') return [[n.cx - n.rx, n.cy - n.ry, n.cx + n.rx, n.cy + n.ry], (u, v) => ((u - n.cx) / n.rx) ** 2 + ((v - n.cy) / n.ry) ** 2 <= 1]
  if (n.k === 'ring') {
    const o = n.r + n.w / 2
    return [[n.cx - o, n.cy - o, n.cx + o, n.cy + o], (u, v) => Math.abs(Math.hypot(u - n.cx, v - n.cy) - n.r) <= n.w / 2]
  }
  const xs = n.pts.map((p) => p[0])
  const ys = n.pts.map((p) => p[1])
  const pad = n.k === 'line' ? n.w / 2 : 0
  const box = [Math.min(...xs) - pad, Math.min(...ys) - pad, Math.max(...xs) + pad, Math.max(...ys) + pad]
  if (n.k === 'line') {
    const r2 = (n.w / 2) ** 2
    return [box, (u, v) => {
      for (let i = 1; i < n.pts.length; i++) if (segDist2(u, v, n.pts[i - 1], n.pts[i]) <= r2) return true
      return false
    }]
  }
  return [box, (u, v) => {
    let inside = false
    for (let i = 0, j = n.pts.length - 1; i < n.pts.length; j = i++) {
      const [xi, yi] = n.pts[i]
      const [xj, yj] = n.pts[j]
      if (yi > v !== yj > v && u < ((xj - xi) * (v - yi)) / (yj - yi) + xi) inside = !inside
    }
    return inside
  }]
}

function blend(px, W, H, x, y, rgb, a) {
  if (x < 0 || y < 0 || x >= W || y >= H || a <= 0) return
  const i = (y * W + x) * 4
  const da = px[i + 3] / 255
  const oa = a + da * (1 - a)
  for (let k = 0; k < 3; k++) px[i + k] = Math.round((rgb[k] * a + px[i + k] * da * (1 - a)) / (oa || 1))
  px[i + 3] = Math.round(oa * 255)
}

function rasterNode(n, t, m, alpha, out) {
  if (!n.g) {
    const [box, inside] = leafTest(n)
    const { px, W, H, s } = out
    const toPx = mul(mul(mS(s, s), mT(-PET_VIEW.x, -PET_VIEW.y)), m)
    const back = inv(toPx)
    const corners = [[box[0], box[1]], [box[2], box[1]], [box[0], box[3]], [box[2], box[3]]].map(([x, y]) => apply(toPx, x, y))
    const X0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[0]))))
    const X1 = Math.min(W, Math.ceil(Math.max(...corners.map((c) => c[0]))))
    const Y0 = Math.max(0, Math.floor(Math.min(...corners.map((c) => c[1]))))
    const Y1 = Math.min(H, Math.ceil(Math.max(...corners.map((c) => c[1]))))
    const rgb = rgbOf(n.fill)
    const a = alpha * n.op
    for (let y = Y0; y < Y1; y++) {
      for (let x = X0; x < X1; x++) {
        let hit = 0
        for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
          const [u, v] = apply(back, x + ox, y + oy)
          if (inside(u, v)) hit++
        }
        if (hit) blend(px, W, H, x, y, rgb, (hit / 4) * a)
      }
    }
    return
  }
  let mm = m
  for (const [k, a, b, c, d] of n.tf) mm = mul(mm, k === 't' ? mT(a, b) : k === 's' ? about(mS(a, b), c, d) : about(mR(a), b, c))
  let al = alpha
  for (const an of n.anim) {
    const v = valueAt(an, t)
    const [ox, oy] = an.o
    if (an.p === 'o') al *= v
    else mm = mul(mm, about(an.p === 'ty' ? mT(0, v) : an.p === 'tx' ? mT(v, 0) : an.p === 'sy' ? mS(1, v) : an.p === 'sx' ? mS(v, 1) : mR(v), ox, oy))
  }
  if (al <= 0.01) return
  for (const c of n.g) rasterNode(c, t, mm, al, out)
}

// one frame of the pet at time tMs, facing dir; turn (0..1) squashes it through a turnaround
export function petFrame(act, tMs, dir, opts = {}) {
  const { scale: s, width: W, height: H } = PET_RASTER
  const px = new Uint8Array(W * H * 4)
  let m = [1, 0, 0, 1, 0, 0]
  if (opts.turn != null && opts.turn < 1) m = about(mS(-1 + 2 * smooth(opts.turn), 1), 20, 0)
  rasterNode(petScene(act, opts), tMs / 1000, m, 1, { px, W, H, s })
  if (dir < 0) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W / 2; x++) {
        const a = (y * W + x) * 4
        const b = (y * W + (W - 1 - x)) * 4
        for (let k = 0; k < 4; k++) {
          const tmp = px[a + k]
          px[a + k] = px[b + k]
          px[b + k] = tmp
        }
      }
    }
  }
  return px
}

export const PET_TURN_S = TURN_S
