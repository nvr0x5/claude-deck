// The pet: one design, drawn as animated SVG on the desktop and as RGBA frames
// (an Image) in terminals that show pictures. Pure functions, no $.

export const PET_ACTS = ['idle', 'walk', 'run', 'jump', 'console', 'read', 'sleep', 'celebrate', 'alert']

const SPEED = { walk: 0.035, run: 0.11 } // lane fractions per second

// ---------- behaviour: one scene at a time, the same on every surface ----------

export function createPet(now) {
  return { act: 'idle', dir: 1, x0: 0.3, x1: 0.3, start: now, dur: 3000, mood: 'calm', id: 1 }
}

export function petX(pet, now) {
  const p = pet.dur > 0 ? Math.min(1, Math.max(0, (now - pet.start) / pet.dur)) : 1
  return pet.x0 + (pet.x1 - pet.x0) * p
}

function pick(list, r) {
  return list[Math.floor(r * list.length) % list.length]
}

// mood: 'alert' | 'celebrate' | 'working' | 'sleepy' | 'calm'
export function stepPet(pet, mood, now, rand = Math.random) {
  const moodChanged = mood !== pet.mood && (mood === 'alert' || mood === 'celebrate' || pet.mood === 'alert')
  if (!moodChanged && now < pet.start + pet.dur) return false
  const x = petX(pet, now)
  pet.mood = mood
  pet.start = now
  pet.x0 = x
  pet.x1 = x
  pet.id++
  let act
  if (mood === 'alert') act = 'alert'
  else if (mood === 'celebrate') act = 'celebrate'
  else if (mood === 'working') act = pick(['console', 'console', 'read', 'walk', 'idle'], rand())
  else if (mood === 'sleepy') act = pick(['sleep', 'sleep', 'idle'], rand())
  else act = pick(['idle', 'walk', 'walk', 'run', 'jump', 'read'], rand())
  pet.act = act
  if (act === 'walk' || act === 'run') {
    let target = rand()
    if (Math.abs(target - x) < 0.15) target = x < 0.5 ? Math.min(1, x + 0.4) : Math.max(0, x - 0.4)
    pet.x1 = target
    pet.dir = target >= x ? 1 : -1
    pet.dur = (Math.abs(target - x) / SPEED[act]) * 1000
  } else {
    if (rand() < 0.3) pet.dir *= -1
    pet.dur = act === 'sleep' ? 14000 : act === 'alert' ? 2500 : act === 'celebrate' ? 3200 : act === 'jump' ? 2000 : 3000 + rand() * 4000
  }
  return true
}

// ---------- desktop: animated SVG ----------

export const PET_CSS =
  '.pb{fill:#D97757}.pd{fill:#2a1c17}.ps{fill:#C4623F}' +
  '.fb{transform-box:fill-box;transform-origin:center}.ft{transform-box:fill-box;transform-origin:top center}.fbot{transform-box:fill-box;transform-origin:bottom center}' +
  '@keyframes blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}' +
  '@keyframes breathe{0%,100%{transform:scaleY(1)}50%{transform:scaleY(.965)}}' +
  '@keyframes legA{0%,100%{transform:rotate(18deg)}50%{transform:rotate(-18deg)}}' +
  '@keyframes legB{0%,100%{transform:rotate(-18deg)}50%{transform:rotate(18deg)}}' +
  '@keyframes bob{0%,100%{transform:translateY(0)}50%{transform:translateY(-1.2px)}}' +
  '@keyframes jump{0%,100%{transform:translateY(0) scaleY(.92)}12%{transform:translateY(0) scaleY(1.04)}45%{transform:translateY(-12px)}80%{transform:translateY(0)}}' +
  '@keyframes tap{0%,100%{transform:translateY(0)}50%{transform:translateY(1.5px)}}' +
  '@keyframes glow{0%,100%{opacity:1}50%{opacity:.55}}' +
  '@keyframes zz{0%{transform:translate(0,0);opacity:0}20%{opacity:1}100%{transform:translate(6px,-14px);opacity:0}}' +
  '@keyframes wave{0%,100%{transform:rotate(-20deg)}50%{transform:rotate(25deg)}}' +
  '@keyframes shake{0%,100%{transform:translateX(0)}25%{transform:translateX(-1px)}75%{transform:translateX(1px)}}' +
  '@keyframes conf{0%{transform:translateY(0);opacity:1}100%{transform:translateY(16px);opacity:0}}' +
  '@keyframes look{0%,40%{transform:translateX(-1px)}50%,90%{transform:translateX(1.2px)}}' +
  '@keyframes puff{0%{transform:translateX(0) scale(.6);opacity:.7}100%{transform:translateX(-8px) scale(1.3);opacity:0}}' +
  '@media (prefers-reduced-motion:reduce){*{animation:none!important}}'

// the pet in its own 48x38 box (viewBox -4 -6 48 38), facing right
export function petSvgBody(state) {
  const run = state === 'run'
  const walk = state === 'walk' || run
  const sit = state === 'console' || state === 'read'
  const sleep = state === 'sleep'
  const legDur = run ? '.28s' : '.6s'
  const legs = sit
    ? '<rect x="12" y="25" width="16" height="3" rx="1.5" class="ps"/>'
    : [11, 15.5, 21.5, 26]
        .map((x, i) => `<rect x="${x}" y="21" width="3" height="7" rx="1.5" class="pb ft"${walk ? ` style="animation:${i % 2 ? 'legB' : 'legA'} ${legDur} ease-in-out infinite"` : ''}/>`)
        .join('')
  const eyes = sleep
    ? '<rect x="13.5" y="13.5" width="4" height="1.4" rx=".7" class="pd"/><rect x="22.5" y="13.5" width="4" height="1.4" rx=".7" class="pd"/>'
    : `<g${state === 'read' ? ' style="animation:look 2.4s ease-in-out infinite"' : ''}><rect x="14" y="11" width="3" height="5" rx="1.5" class="pd fb" style="animation:blink 3.6s infinite"/><rect x="23" y="11" width="3" height="5" rx="1.5" class="pd fb" style="animation:blink 3.6s infinite"/></g>`
  const arms =
    state === 'celebrate'
      ? '<rect x="3" y="4" width="4" height="9" rx="2" class="pb fbot" style="animation:wave .5s ease-in-out infinite"/><rect x="33" y="4" width="4" height="9" rx="2" class="pb fbot" style="animation:wave .5s ease-in-out infinite reverse"/>'
      : `<rect x="3" y="12" width="6" height="5" rx="2.5" class="pb"${state === 'console' ? ' style="animation:tap .25s infinite"' : ''}/><rect x="31" y="12" width="6" height="5" rx="2.5" class="pb"${state === 'console' ? ' style="animation:tap .25s infinite .12s"' : ''}/>`
  let props = ''
  if (state === 'console')
    props = '<rect x="11" y="17" width="18" height="9" rx="2" fill="#4a4a48"/><rect x="13" y="18.5" width="9" height="6" rx="1" fill="#5DCAA5" style="animation:glow .4s infinite"/><circle cx="25" cy="20" r="1" fill="#E5484D"/><circle cx="26.5" cy="23" r="1" fill="#378ADD"/>'
  if (state === 'read')
    props = '<rect x="10" y="15" width="20" height="10" rx="1.5" fill="#378ADD"/><rect x="11.5" y="16" width="8" height="8" rx=".8" fill="#f2f0ea"/><rect x="20.5" y="16" width="8" height="8" rx=".8" fill="#e8e4da"/><path d="M13 18.5h5M13 20.5h5M13 22.5h4M22 18.5h5M22 20.5h5" stroke="#9a9893" stroke-width=".6"/>'
  if (sleep)
    props = '<text x="31" y="6" font-size="6" fill="#9a9893" font-family="system-ui" style="animation:zz 2s infinite">z</text><text x="34" y="3" font-size="4.5" fill="#9a9893" font-family="system-ui" style="animation:zz 2s infinite .9s">z</text>'
  if (state === 'alert')
    props = '<g style="animation:shake .3s infinite"><rect x="29" y="-3" width="9" height="9" rx="4.5" fill="#E09A1E"/><text x="33.5" y="4.3" font-size="7" font-weight="600" text-anchor="middle" fill="#412402" font-family="system-ui">!</text></g>'
  if (state === 'celebrate')
    props = ['#EBA83A', '#9C95EC', '#5DCAA5', '#E2706F'].map((c, i) => `<rect x="${6 + i * 9}" y="-2" width="2" height="2" rx=".5" fill="${c}" style="animation:conf 1s infinite ${i * 0.22}s"/>`).join('')
  if (run) props = '<circle cx="6" cy="27" r="2" fill="#4a4a48" class="fb" style="animation:puff .5s infinite"/><circle cx="4" cy="25" r="1.5" fill="#4a4a48" class="fb" style="animation:puff .5s infinite .25s"/>'
  const bodyAnim =
    state === 'jump' || state === 'celebrate'
      ? 'animation:jump 1s cubic-bezier(.3,.6,.4,1) infinite'
      : walk
        ? `animation:bob ${legDur} ease-in-out infinite`
        : `animation:breathe ${sleep ? '3s' : '2.4s'} ease-in-out infinite`
  const lean = run ? ' style="transform:rotate(-7deg);transform-origin:20px 28px"' : ''
  return (
    `<ellipse cx="20" cy="29.5" rx="${state === 'jump' ? 8 : 12}" ry="1.6" fill="#000" opacity=".35"/>` +
    `<g${lean}><g class="fbot" style="${bodyAnim}"><g transform="translate(0 ${sit ? 3 : 0})">${legs}${arms}` +
    '<rect x="8" y="5" width="24" height="17" rx="4" class="pb"/><rect x="8" y="18" width="24" height="4" rx="2" class="ps" opacity=".55"/>' +
    `${eyes}</g></g></g>${props}`
  )
}

// the lane: the pet walks from x0 to x1 by CSS, phased by the scene's age so a redraw does not restart it
export function petLaneSvg(pet, now, W, H = 62) {
  const PW = 48 * 1.05
  const PH = 38 * 1.05
  const room = Math.max(0, W - PW)
  const a = pet.x0 * room
  const b = pet.x1 * room
  const age = Math.max(0, now - pet.start) / 1000
  const dur = Math.max(0.001, pet.dur / 1000)
  const move = `@keyframes mv${pet.id}{from{transform:translateX(${a.toFixed(1)}px)}to{transform:translateX(${b.toFixed(1)}px)}}`
  const flip = pet.dir < 0 ? `translate(${PW} 0) scale(-1 1)` : ''
  let dots = ''
  for (let x = 4; x < W; x += 12) dots += `<rect x="${x}" y="${H - 4}" width="4" height="1" fill="#fff" opacity=".07"/>`
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<style>${PET_CSS}${move}.mv{animation:mv${pet.id} ${dur.toFixed(2)}s linear both;animation-delay:-${Math.min(age, dur).toFixed(2)}s}</style>` +
    dots +
    `<g class="mv"><g transform="translate(0 ${H - PH - 2})"><g transform="${flip}"><svg width="${PW}" height="${PH}" viewBox="-4 -6 48 38" overflow="visible">${petSvgBody(pet.act)}</svg></g></g></g>` +
    '</svg>'
  )
}

// ---------- terminal: the same shapes rasterized, frame by frame ----------

const COL = {
  O: [217, 119, 87], C: [196, 98, 63], D: [42, 28, 23], G: [74, 74, 72], S: [93, 202, 165], R: [229, 72, 77],
  B: [55, 138, 221], W: [242, 240, 234], P: [232, 228, 218], Y: [224, 154, 30], Z: [154, 152, 147], K: [0, 0, 0],
  V: [156, 149, 236], E: [226, 112, 111],
}

function canvas(W, H) {
  return { W, H, px: new Uint8Array(W * H * 4) }
}

function blend(cv, x, y, rgb, a) {
  if (x < 0 || y < 0 || x >= cv.W || y >= cv.H || a <= 0) return
  const i = (y * cv.W + x) * 4
  const da = cv.px[i + 3] / 255
  const oa = a + da * (1 - a)
  for (let k = 0; k < 3; k++) cv.px[i + k] = Math.round((rgb[k] * a + cv.px[i + k] * da * (1 - a)) / (oa || 1))
  cv.px[i + 3] = Math.round(oa * 255)
}

// a shape in pet units, drawn at scale s with 2x2 coverage sampling
function shape(cv, s, inside, bx0, by0, bx1, by1, rgb, alpha = 1) {
  const X0 = Math.floor((bx0 + 4) * s)
  const Y0 = Math.floor((by0 + 6) * s)
  const X1 = Math.ceil((bx1 + 4) * s)
  const Y1 = Math.ceil((by1 + 6) * s)
  for (let py = Y0; py < Y1; py++) {
    for (let px = X0; px < X1; px++) {
      let hit = 0
      for (const [ox, oy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        if (inside((px + ox) / s - 4, (py + oy) / s - 6)) hit++
      }
      if (hit) blend(cv, px, py, rgb, (hit / 4) * alpha)
    }
  }
}

function rrect(cv, s, x, y, w, h, r, c, a) {
  const inside = (u, v) => {
    if (u < x || v < y || u > x + w || v > y + h) return false
    const cx = Math.min(Math.max(u, x + r), x + w - r)
    const cy = Math.min(Math.max(v, y + r), y + h - r)
    return (u - cx) ** 2 + (v - cy) ** 2 <= r * r
  }
  shape(cv, s, inside, x, y, x + w, y + h, COL[c], a)
}

function ellipse(cv, s, cx, cy, rx, ry, c, a) {
  shape(cv, s, (u, v) => ((u - cx) / rx) ** 2 + ((v - cy) / ry) ** 2 <= 1, cx - rx, cy - ry, cx + rx, cy + ry, COL[c], a)
}

export const PET_RASTER = { scale: 2, width: 96, height: 76 }

export function petFrame(act, tMs, dir) {
  const s = PET_RASTER.scale
  const cv = canvas(PET_RASTER.width, PET_RASTER.height)
  const ph = tMs / 1000
  const sin = (period, off = 0) => Math.sin(((ph + off) / period) * Math.PI * 2)
  const run = act === 'run'
  const walk = act === 'walk' || run
  const sit = act === 'console' || act === 'read'
  let dy = 0
  let squash = 0
  if (act === 'jump' || act === 'celebrate') {
    const p = ph % 1
    if (p < 0.12) squash = 1.2
    else if (p < 0.8) dy = -12 * Math.sin(((p - 0.12) / 0.68) * Math.PI)
  } else if (walk) dy = -Math.abs(sin(run ? 0.28 : 0.6)) * 1.2
  else dy = (sin(act === 'sleep' ? 3 : 2.4) * 0.5 + 0.5) * 0.6
  const lean = run ? 1.5 : 0
  const sy = sit ? 3 : 0
  ellipse(cv, s, 20, 29.5, act === 'jump' && dy < -4 ? 8 : 12, 1.6, 'K', 0.35)
  if (run) {
    const q = (ph % 0.5) / 0.5
    ellipse(cv, s, 6 - q * 8, 27, 2 * (0.6 + q * 0.7), 2 * (0.6 + q * 0.7), 'G', 0.7 * (1 - q))
  }
  const Y = (v) => v + dy + sy
  if (sit) rrect(cv, s, 12, Y(25), 16, 3, 1.5, 'C')
  else {
    ;[11, 15.5, 21.5, 26].forEach((x, i) => {
      const swing = walk ? sin(run ? 0.28 : 0.6, i % 2 ? 0 : (run ? 0.14 : 0.3)) * (run ? 2.2 : 1.4) : 0
      rrect(cv, s, x + swing, Y(21) + squash, 3, 7 - squash, 1.5, 'O')
    })
  }
  const tap = act === 'console' ? (sin(0.25) > 0 ? 1.5 : 0) : 0
  if (act === 'celebrate') {
    const w = sin(0.5) * 1.2
    rrect(cv, s, 3 + w + lean, Y(4), 4, 9, 2, 'O')
    rrect(cv, s, 33 - w + lean, Y(4), 4, 9, 2, 'O')
  } else {
    rrect(cv, s, 3 + lean, Y(12) + tap, 6, 5, 2.5, 'O')
    rrect(cv, s, 31 + lean, Y(12) + tap, 6, 5, 2.5, 'O')
  }
  rrect(cv, s, 8 + lean, Y(5) + squash, 24, 17 - squash, 4, 'O')
  rrect(cv, s, 8 + lean, Y(18), 24, 4, 2, 'C', 0.55)
  if (act === 'sleep') {
    rrect(cv, s, 13.5 + lean, Y(13.5), 4, 1.4, 0.7, 'D')
    rrect(cv, s, 22.5 + lean, Y(13.5), 4, 1.4, 0.7, 'D')
  } else {
    const blinking = ph % 3.6 > 3.42
    const look = act === 'read' ? (ph % 2.4 < 1.2 ? -1 : 1.2) : 0
    const eh = blinking ? 0.8 : 5
    const ey = blinking ? 13 : 11
    rrect(cv, s, 14 + lean + look, Y(ey), 3, eh, Math.min(1.5, eh / 2), 'D')
    rrect(cv, s, 23 + lean + look, Y(ey), 3, eh, Math.min(1.5, eh / 2), 'D')
  }
  if (act === 'console') {
    rrect(cv, s, 11, Y(17), 18, 9, 2, 'G')
    rrect(cv, s, 13, Y(18.5), 9, 6, 1, 'S', sin(0.4) > 0 ? 1 : 0.6)
    ellipse(cv, s, 25, Y(20), 1, 1, 'R')
    ellipse(cv, s, 26.5, Y(23), 1, 1, 'B')
  }
  if (act === 'read') {
    rrect(cv, s, 10, Y(15), 20, 10, 1.5, 'B')
    rrect(cv, s, 11.5, Y(16), 8, 8, 0.8, 'W')
    rrect(cv, s, 20.5, Y(16), 8, 8, 0.8, 'P')
  }
  if (act === 'sleep') {
    for (const [off, size] of [[0, 1], [0.9, 0.75]]) {
      const q = ((ph + off) % 2) / 2
      const zx = 31 + q * 6 + (off ? 3 : 0)
      const zy = 2 - q * 14 - (off ? 3 : 0)
      const a = q < 0.2 ? q * 5 : 1 - q
      rrect(cv, s, zx, zy, 3 * size, 0.8, 0.3, 'Z', a)
      rrect(cv, s, zx + 1.1 * size, zy + 0.8, 0.8, 1.6 * size, 0.3, 'Z', a)
      rrect(cv, s, zx, zy + 2.4 * size, 3 * size, 0.8, 0.3, 'Z', a)
    }
  }
  if (act === 'alert') {
    const sx = Math.sin(ph * 40) * 0.8
    rrect(cv, s, 29 + sx, -3, 9, 9, 4.5, 'Y')
    rrect(cv, s, 32.8 + sx, -1.5, 1.6, 3.6, 0.6, 'D')
    rrect(cv, s, 32.8 + sx, 2.8, 1.6, 1.5, 0.6, 'D')
  }
  if (act === 'celebrate') {
    ;['Y', 'V', 'S', 'E'].forEach((c, i) => {
      const q = ((ph + i * 0.22) % 1) / 1
      rrect(cv, s, 6 + i * 9, -2 + q * 16, 2, 2, 0.5, c, 1 - q)
    })
  }
  if (dir < 0) {
    const { W, H, px } = cv
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W / 2; x++) {
        const a = (y * W + x) * 4
        const b = (y * W + (W - 1 - x)) * 4
        for (let k = 0; k < 4; k++) {
          const t = px[a + k]
          px[a + k] = px[b + k]
          px[b + k] = t
        }
      }
    }
  }
  return cv.px
}
