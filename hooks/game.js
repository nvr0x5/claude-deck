// Pet Runner: the Deck pet jumps over bugs while Claude works. Pure state and drawing, no $.
import { petSvgBody, petFrame, PET_CSS, PET_RASTER } from './pet.js'

export const GAME_W = 320
export const GAME_H = 80
const GROUND = 70
const PET_X = 18
const PET_W = 24
const GRAVITY = 1.6
const JUMP = 9.4

// mode: 'run' | 'over' | 'ask' (Claude needs you) | 'done' (task finished)
export function newGame(best = 0) {
  return { y: 0, vy: 0, obs: [], ticks: 0, score: 0, best, speed: 5.5, next: 18, mode: 'run', paused: false, seed: 1 }
}

function rand(g) {
  g.seed = (g.seed * 16807) % 2147483647
  return g.seed / 2147483647
}

export function jump(g) {
  if (g.mode === 'ask') return false
  if (g.mode === 'over' || g.mode === 'done') {
    Object.assign(g, newGame(g.best), { seed: g.seed })
    return true
  }
  if (g.paused) g.paused = false
  if (g.y <= 0) g.vy = JUMP
  return true
}

// one 50 ms tick; scoring only while Claude is working
export function step(g, working) {
  if (g.paused || g.mode !== 'run') return false
  g.ticks++
  g.y += g.vy
  g.vy -= GRAVITY
  if (g.y < 0) {
    g.y = 0
    g.vy = 0
  }
  if (--g.next <= 0) {
    const big = rand(g) < 0.35
    g.obs.push({ x: GAME_W + 6, w: big ? 11 : 8, h: big ? 15 : 10, bug: rand(g) < 0.55 })
    g.next = 20 + Math.floor(rand(g) * 26)
  }
  for (const o of g.obs) o.x -= g.speed
  g.obs = g.obs.filter((o) => o.x > -20)
  g.speed = Math.min(10, g.speed + 0.004)
  if (working) g.score += 1
  for (const o of g.obs) {
    if (o.x < PET_X + PET_W - 4 && o.x + o.w > PET_X + 5 && g.y < o.h - 2) {
      g.mode = 'over'
      g.best = Math.max(g.best, g.score)
      return true
    }
  }
  return true
}

const pad = (n) => String(n).padStart(5, '0')

export function gameSvg(g, width, nowMs) {
  const h = Math.round((width * GAME_H) / GAME_W)
  const running = g.mode === 'run' && !g.paused
  let s = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}" viewBox="0 0 ${GAME_W} ${GAME_H}">`
  s += `<style>${PET_CSS}</style><rect width="${GAME_W}" height="${GAME_H}" rx="4" fill="#262626"/>`
  for (let i = 0; i < 12; i++) s += `<rect x="${(((i * 97 - g.ticks * 0.6) % GAME_W) + GAME_W) % GAME_W}" y="${(i * 23) % 40 + 4}" width="1" height="1" fill="#fff" opacity=".15"/>`
  const off = (g.ticks * g.speed) % 10
  for (let x = -off; x < GAME_W; x += 10) s += `<rect x="${x.toFixed(1)}" y="${GROUND + 1}" width="5" height="1" fill="#fff" opacity=".1"/>`
  for (const o of g.obs) {
    s += `<rect x="${o.x.toFixed(1)}" y="${GROUND - o.h}" width="${o.w}" height="${o.h}" rx="2" fill="${o.bug ? '#E2706F' : '#5f5e5a'}"/>`
    if (o.bug) s += `<rect x="${(o.x + 2).toFixed(1)}" y="${GROUND - o.h + 3}" width="1.4" height="1.4" fill="#501313"/><rect x="${(o.x + o.w - 3.4).toFixed(1)}" y="${GROUND - o.h + 3}" width="1.4" height="1.4" fill="#501313"/>`
  }
  const act = g.mode === 'ask' ? 'alert' : g.mode === 'done' ? 'celebrate' : g.y > 0 ? 'jump' : running ? 'run' : 'idle'
  s += `<svg x="${PET_X}" y="${(GROUND - 19 - g.y).toFixed(1)}" width="${PET_W}" height="19" viewBox="-4 -6 48 38" overflow="visible">${petSvgBody(act === 'jump' ? 'idle' : act)}</svg>`
  s += `<text x="${GAME_W - 6}" y="11" text-anchor="end" style="font:500 7px ui-monospace,Menlo,monospace;fill:#e8e6e1">${pad(g.score)}</text>`
  s += `<text x="${GAME_W - 6}" y="20" text-anchor="end" style="font:400 6px ui-monospace,Menlo,monospace;fill:#77756f">best ${pad(g.best)}</text>`
  const overlay = (title, color, sub) =>
    `<rect width="${GAME_W}" height="${GAME_H}" fill="#1e1e1e" fill-opacity=".62"/><text x="${GAME_W / 2}" y="${GAME_H / 2 - 2}" text-anchor="middle" style="font:500 9px ui-sans-serif,system-ui,sans-serif;fill:${color}">${title}</text>` +
    (sub ? `<text x="${GAME_W / 2}" y="${GAME_H / 2 + 10}" text-anchor="middle" style="font:400 6px ui-sans-serif,system-ui,sans-serif;fill:#9a9893">${sub}</text>` : '')
  if (g.mode === 'ask') s += overlay('Claude needs you', '#EBA83A', 'Esc returns to the prompt · the game waits')
  else if (g.mode === 'done') s += overlay('✓ Task done · score ' + g.score, '#5DCAA5', 'j to run again')
  else if (g.mode === 'over') s += overlay('Bonk! Press j to run again', '#E2706F', '')
  else if (g.paused) s += overlay('Paused', '#9a9893', 'j or p to go on')
  void nowMs
  return s + '</svg>'
}

// the terminal: the same scene as RGBA pixels, 4 per column and 8 per row
export function gameRgba(g, columns, rows, nowMs) {
  const W = columns * 4
  const H = rows * 8
  const px = new Uint8Array(W * H * 4)
  const sx = W / GAME_W
  const sy = H / GAME_H
  const fill = (x, y, w, h, [r, gg, b], a = 1) => {
    const x0 = Math.max(0, Math.floor(x * sx))
    const y0 = Math.max(0, Math.floor(y * sy))
    const x1 = Math.min(W, Math.ceil((x + w) * sx))
    const y1 = Math.min(H, Math.ceil((y + h) * sy))
    for (let yy = y0; yy < y1; yy++) {
      for (let xx = x0; xx < x1; xx++) {
        const i = (yy * W + xx) * 4
        px[i] = Math.round(px[i] * (1 - a) + r * a)
        px[i + 1] = Math.round(px[i + 1] * (1 - a) + gg * a)
        px[i + 2] = Math.round(px[i + 2] * (1 - a) + b * a)
        px[i + 3] = 255
      }
    }
  }
  fill(0, 0, GAME_W, GAME_H, [38, 38, 38])
  const off = (g.ticks * g.speed) % 10
  for (let x = -off; x < GAME_W; x += 10) fill(x, GROUND + 1, 5, 1, [70, 70, 68])
  for (const o of g.obs) fill(o.x, GROUND - o.h, o.w, o.h, o.bug ? [226, 112, 111] : [95, 94, 90])
  const act = g.mode === 'ask' ? 'alert' : g.mode === 'done' ? 'celebrate' : g.mode === 'run' && !g.paused && g.y <= 0 ? 'run' : 'idle'
  const frame = petFrame(act, nowMs, 1)
  // paste the pet frame, scaled to PET_W x 19 world units
  const pw = Math.round(PET_W * sx)
  const ph = Math.round(19 * sy)
  const ox = Math.round(PET_X * sx)
  const oy = Math.round((GROUND - 19 - g.y) * sy)
  for (let yy = 0; yy < ph; yy++) {
    for (let xx = 0; xx < pw; xx++) {
      const fx = Math.floor((xx / pw) * PET_RASTER.width)
      const fy = Math.floor((yy / ph) * PET_RASTER.height)
      const fi = (fy * PET_RASTER.width + fx) * 4
      const a = frame[fi + 3] / 255
      if (a < 0.05) continue
      const X = ox + xx
      const Y = oy + yy
      if (X < 0 || Y < 0 || X >= W || Y >= H) continue
      const i = (Y * W + X) * 4
      for (let k = 0; k < 3; k++) px[i + k] = Math.round(px[i + k] * (1 - a) + frame[fi + k] * a)
    }
  }
  if (g.mode !== 'run' || g.paused) fill(0, 0, GAME_W, GAME_H, [30, 30, 30], 0.55)
  return px
}

export function gameStatus(g, working) {
  if (g.mode === 'ask') return { text: 'Claude needs you · the game waits', tone: 'ask' }
  if (g.mode === 'done') return { text: '✓ Task done · score ' + g.score, tone: 'done' }
  if (g.mode === 'over') return { text: 'Bonk! Press j to run again · best ' + g.best, tone: 'hot' }
  if (g.paused) return { text: 'Paused · j or p to go on', tone: 'mute' }
  return { text: working ? 'Claude is working · score counts' : 'Claude is idle · score paused until it works', tone: 'mute' }
}
