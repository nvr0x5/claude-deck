// deck: a collapsible HUD in the band above the prompt.
// Bars: todo lists, task tools, approved plans, and subagents as strips.
// Meters: context and usage limits with reset countdowns. A model-route row shows what a
// router (jev-model-router) decided. A pet walks above it all. Header: clock and weather.
//
// Desktop drawing techniques adapt plan-progress (zycck/claude-mods, MIT, Kirill Serditov).

import { STYLE, TIER, TRACK, DIM, MUTED, TEXT, trunc, textWidth, esc, runs, textCells } from './theme.js'
import { TERMINAL_STYLES, TERMINAL_STYLE_NAMES, terminalBar, terminalMini } from './styles-terminal.js'
import { DESKTOP_STYLES, DESKTOP_STYLE_NAMES, desktopTrack, stripsSvg, stripsHeight } from './styles-desktop.js'
import { createPet, stepPet, petX, petLaneSvg, petFrame, PET_RASTER } from './pet.js'

const SECTIONS = ['plans', 'agents', 'context', 'limits', 'route', 'pet', 'clock', 'weather']

const DEFAULT_PREFS = {
  show: { plans: true, agents: true, context: true, limits: true, route: true, pet: true, clock: true, weather: false },
  style: { terminal: 'solid', desktop: 'pixel' },
  open: false,
  auto: true,
  sound: true,
  quiet: true,
  city: null, // { name, lat, lon }
}

const STATE_STYLE = { running: 'run', needs_input: 'ask', error: 'hot', done: 'done' }
const AGENT_STYLE = { running: 'run', waiting: 'ask', error: 'hot', done: 'done' }
const MAX_BARS = 4
const BAR_LINGER_MS = 120_000
const AGENTS_LINGER_MS = 30_000
const FOLD_MS = 5000
const MAX_STRIPS = 4
const ASK_DELAY_MS = 600
const TRACK_H = 22
const RIGHT_W = 92
const PET_COLS = 12
const PET_ROWS = 4
const SLEEPY_MS = 180_000
const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max']
const TIER_MODEL = { fast: 'haiku', balanced: 'sonnet', deep: 'opus' }
const MODEL_RANK = { haiku: 0, sonnet: 1, opus: 2 }

const clone = (v) => JSON.parse(JSON.stringify(v))
let prefs = clone(DEFAULT_PREFS)
let frame = 0
let lastPrompt = ''
let weather = null
let usage = { context: null, rateLimits: [] }
let sawTerminal = false
let demoTimer = null
let lastSecond = 0

// id -> { id, title, source, stages:[{name, steps:[{title, active, status}]}], explicit, startedAt, doneAt, agentsDoneAt, dismissed }
const bars = new Map()
// agentId -> { id, title, state, tool, model, startedAt, endedAt, depth, home, todo }
const agents = new Map()
// task tools: id -> { subject, active, status }
const tasks = new Map()
const inFlight = new Map()
const waiting = new Set()
let askedUser = false
const lastSeen = new Map()
const lastHead = new Map()
const lastStrip = new Map()

// model routing, as a router reports it, and what the turn actually ran with
let route = null // { tier, conf, model, effort, unchanged, effortScore, risky, ms, at }
const routeHist = []
let sessionModel = ''
let seen = { model: '', effort: '' }

// a turn with no todo list still gets a bar: what Claude is doing right now
let activity = null // { title, start, tools, action, done, doneAt }
const ACTIVITY_LINGER_MS = 20_000

function actionOf(e) {
  const base = (p) => String(p ?? '').split('/').pop()
  switch (e.tool) {
    case 'Read':
      return 'Reading ' + base(e.file_path)
    case 'Grep':
    case 'Glob':
      return 'Searching'
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return 'Editing ' + base(e.file_path ?? e.notebook_path)
    case 'Bash':
      return 'Running ' + trunc(String(e.command ?? '').trim().split(/\s+/).slice(0, 2).join(' '), 22)
    case 'WebFetch':
    case 'WebSearch':
      return 'Browsing'
    case 'Agent':
    case 'Task':
      return 'Delegating'
    case 'TodoWrite':
      return 'Planning'
    default:
      return String(e.tool).replace(/^mcp__[^_]+__/, '')
  }
}

function activityRow(now) {
  if (!activity || !prefs.show.plans) return null
  if (activity.done && now - activity.doneAt > ACTIVITY_LINGER_MS) return null
  const planned = [...bars.values()].some((b) => b.id !== 'agents' && !b.dismissed && b.startedAt >= activity.start - 1000)
  if (planned) return null
  const asking = !activity.done && (waiting.has('main') || [...agents.values()].some((a) => a.home === 'activity' && a.state === 'waiting'))
  const style = activity.done ? 'done' : asking ? 'ask' : 'run'
  const pct = activity.done ? 100 : 95 * (1 - Math.exp(-activity.tools / 18))
  const time = elapsed((activity.done ? activity.doneAt : now) - activity.start)
  const name = activity.done ? 'Done' : asking ? 'Needs you' : trunc(activity.action, 28)
  const mine = [...agents.values()].filter((a) => a.home === 'activity')
  const agentNote = mine.length ? ' · ' + mine.filter((a) => a.state === 'done').length + '/' + mine.length + ' agents' : ''
  return {
    id: 'activity',
    kind: 'activity',
    style,
    state: activity.done ? 'done' : asking ? 'needs_input' : 'running',
    title: activity.title,
    pct,
    marks: [],
    steps: 0,
    finished: 0,
    name,
    count: activity.tools + (activity.tools === 1 ? ' tool' : ' tools') + agentNote,
    strips: visibleStrips({ id: 'activity', agentsDoneAt: activity.agentsDoneAt }, now),
    right: time,
    short: name + ' · ' + activity.tools,
    stage: 0,
    animating: !activity.done,
  }
}

// the pet and what it reacts to
const pet = createPet(Date.now())
let turnActive = false
let lastActivity = Date.now()
let celebrateUntil = 0

// ---------- small helpers ----------

function slug(s) {
  return String(s ?? '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 40) || 'plan'
}

// the words the person typed: tagged blocks (system reminders, pasted content, attachments) removed
function cleanPrompt(text) {
  return String(text)
    .replace(/<([a-z][\w-]*)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function fmtK(n) {
  if (n == null) return '?'
  if (n >= 1_000_000) return +(n / 1_000_000).toFixed(1) + 'M'
  return n >= 1000 ? Math.round(n / 1000) + 'k' : String(n)
}

function countdown(iso) {
  if (!iso) return ''
  let s = Math.max(0, Math.floor((Date.parse(iso) - Date.now()) / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  s = s % 60
  if (d > 0) return d + 'd ' + h + 'h ' + String(m).padStart(2, '0') + 'm'
  return h + ':' + String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0')
}

function shortCountdown(iso) {
  const c = countdown(iso)
  return c.includes('d ') ? c.split(' ').slice(0, 2).join(' ') : c
}

function elapsed(ms) {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's'
}

function clockText() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

const WMO = [
  [0, '☀', 'clear'], [3, '⛅', 'cloudy'], [48, '🌫', 'fog'], [57, '☂', 'drizzle'],
  [67, '☂', 'rain'], [77, '❄', 'snow'], [82, '☂', 'showers'], [86, '❄', 'snow'], [99, '⛈', 'storm'],
]
function weatherText(desktop) {
  if (!weather) return prefs.city ? '… ' + prefs.city.name : ''
  const [, icon, word] = WMO.find(([max]) => weather.code <= max) ?? WMO[WMO.length - 1]
  const t = Math.round(weather.temp) + '°'
  return desktop ? icon + ' ' + t + ' ' + weather.name : t + ' ' + word + ' · ' + weather.name
}

function limitName(kind) {
  if (kind === 'five_hour') return ['Session · 5h', '5h']
  if (kind === 'seven_day') return ['Weekly · 7d', '7d']
  if (kind === 'seven_day_opus') return ['Weekly · Opus', '7d-opus']
  if (kind === 'spend_limit') return ['Spend limit', '$']
  return [kind, kind]
}

function shortModel(id) {
  const s = String(id ?? '').toLowerCase()
  if (s.includes('haiku')) return 'haiku'
  if (s.includes('sonnet')) return 'sonnet'
  if (s.includes('opus')) return 'opus'
  if (s.includes('fable')) return 'fable'
  return trunc(id, 14)
}

function tierColor(model, desktop = true) {
  const t = TIER[shortModel(model)]
  return t ? (desktop ? t.desk : t.term) : MUTED
}

function toBase64(bytes) {
  if (typeof bytes.toBase64 === 'function') return bytes.toBase64()
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

// ---------- plans ----------

const isFinished = (s) => s === 'done' || s === 'skipped'
const todoStatus = (s) => (s === 'completed' ? 'done' : s === 'in_progress' ? 'active' : 'pending')
const allSteps = (bar) => bar.stages.flatMap((s) => s.steps)

function where(bar) {
  const flat = bar.stages.flatMap((s, i) => s.steps.map((step, j) => ({ i, j, step })))
  const at = flat.findIndex((x) => !isFinished(x.step.status))
  const pos = at < 0 ? flat.length : at
  const cur = flat[Math.min(pos, flat.length - 1)]
  const stage = cur?.i ?? 0
  return {
    pos,
    total: flat.length,
    finished: flat.filter((x) => isFinished(x.step.status)).length,
    active: flat.find((x) => x.step.status === 'active')?.step ?? null,
    stage,
    step: pos >= flat.length ? (bar.stages[stage]?.steps.length ?? 0) : (cur?.j ?? 0) + 1,
    stageSize: bar.stages[stage]?.steps.length ?? 0,
  }
}

function newBar(id, title, source, stages) {
  return { id, title, source, stages, explicit: null, startedAt: Date.now(), doneAt: null, agentsDoneAt: null, dismissed: false }
}

function agentsOf(bar) {
  return [...agents.values()].filter((a) => a.home === bar.id)
}

function barState(bar) {
  if (bar.explicit === 'error') return 'error'
  if (bar.id === 'agents') {
    const list = agentsOf(bar)
    if (list.some((a) => a.state === 'waiting')) return 'needs_input'
    if (list.length && list.every((a) => a.state === 'done' || a.state === 'error')) return list.some((a) => a.state === 'error') ? 'error' : 'done'
    return 'running'
  }
  const steps = allSteps(bar)
  if (steps.length && steps.every((s) => isFinished(s.status))) return 'done'
  if (bar.explicit === 'needs_input') return 'needs_input'
  if (agentsOf(bar).some((a) => a.state === 'waiting')) return 'needs_input'
  return 'running'
}

function liveBar() {
  return [...bars.values()].reverse().find((b) => b.id !== 'agents' && !b.dismissed && barState(b) !== 'done')
}

function placeBar(bar) {
  bars.delete(bar.id)
  bars.set(bar.id, bar)
  while (bars.size > MAX_BARS) {
    const done = [...bars.values()].find((b) => barState(b) === 'done')
    bars.delete((done ?? bars.values().next().value).id)
  }
}

function syncAgentsBar() {
  const bar = bars.get('agents')
  if (!bar) return
  const rank = (a) => (a.state === 'done' ? 0 : a.state === 'error' ? 1 : 2)
  const list = agentsOf(bar).sort((a, b) => rank(a) - rank(b))
  bar.stages = [{ name: 'Agents', steps: list.map((a) => ({ title: a.title, status: a.state === 'done' ? 'done' : a.state === 'error' ? 'error' : 'active' })) }]
}

// moves the demo bar one step
function stepOn(stages) {
  const next = stages.map((s) => ({ ...s, steps: s.steps.map((st) => ({ ...st })) }))
  const steps = next.flatMap((s) => s.steps)
  let at = steps.findIndex((st) => st.status === 'active')
  if (at < 0) at = steps.findIndex((st) => !isFinished(st.status))
  if (steps[at]) steps[at].status = 'done'
  const following = steps.slice(at + 1).find((st) => st.status === 'pending')
  if (following) following.status = 'active'
  return next
}

// an approved plan's markdown: headings become stages, top-level list items steps
function parsePlan(markdown) {
  const clean = (s) => s.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`]/g, '').replace(/^(\d+[.)]|[-*+]|\[[ xX]\])\s+/, '').trim()
  let title = ''
  const headed = []
  const items = []
  for (const line of String(markdown).split(/\r?\n/)) {
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const text = clean(h[2] ?? '')
      if (h[1] === '#' && !title) title = text
      else headed.push({ name: trunc(text, 60), steps: [] })
      continue
    }
    const li = line.match(/^(\s*)(\d+[.)]|[-*+])\s+(.*)$/)
    if (!li) continue
    const depth = Math.floor(li[1].replace(/\t/g, '  ').length / 2)
    const text = trunc(clean(li[3] ?? ''), 80)
    if (!text) continue
    items.push({ depth, text })
    const stage = headed[headed.length - 1]
    if (stage && depth === 0) stage.steps.push({ title: text, status: 'pending' })
  }
  let stages = headed.filter((s) => s.steps.length > 0)
  if (!stages.length && items.length) stages = [{ name: 'Plan', steps: items.filter((i) => i.depth === 0).map((i) => ({ title: i.text, status: 'pending' })) }]
  stages = stages.filter((s) => s.steps.length > 0)
  if (!stages.length) return null
  stages[0].steps[0].status = 'active'
  return { title: trunc(title, 60) || 'Plan', stages }
}

function upsertTodos(key, todos) {
  const steps = todos.map((t) => ({ title: trunc(t.content, 80), active: trunc(t.activeForm, 80), status: todoStatus(t.status) }))
  if (key !== 'main') {
    const a = agents.get(key)
    if (a) {
      const cur = steps.find((s) => s.status === 'active')
      a.todo = { done: steps.filter((s) => s.status === 'done').length, total: steps.length, active: cur ? cur.active || cur.title : '' }
    }
    return
  }
  const prev = bars.get('todo')
  const fresh = !prev || barState(prev) === 'done' || prev.dismissed
  const bar = fresh ? newBar('todo', lastPrompt || 'Tasks', 'todo', []) : prev
  bar.stages = [{ name: 'Tasks', steps }]
  bar.explicit = null
  placeBar(bar)
}

function applyTaskResult(input, result) {
  if (input.tool === 'TaskCreate') {
    const id = result?.task?.id
    if (id == null) return
    const list = [...tasks.values()].filter((t) => t.status !== 'deleted')
    if (list.length && list.every((t) => t.status === 'completed')) tasks.clear()
    tasks.set(String(id), { subject: trunc(input.subject ?? result.task.subject, 80), active: trunc(input.activeForm, 80), status: 'pending' })
  } else if (input.tool === 'TaskUpdate') {
    if (result && result.success === false) return
    const t = tasks.get(String(input.taskId))
    if (!t) return
    if (input.status) t.status = input.status
    if (input.subject) t.subject = trunc(input.subject, 80)
    if (input.activeForm) t.active = trunc(input.activeForm, 80)
  } else if (Array.isArray(result?.tasks)) {
    const ids = new Set()
    for (const r of result.tasks) {
      const id = String(r.id)
      ids.add(id)
      const t = tasks.get(id)
      if (t) t.status = r.status
    }
    for (const id of [...tasks.keys()]) if (!ids.has(id)) tasks.delete(id)
  }
  syncTasksBar()
}

function syncTasksBar() {
  const list = [...tasks.values()].filter((t) => t.status !== 'deleted')
  if (!list.length) return
  const steps = list.map((t) => ({ title: t.subject, active: t.active || t.subject, status: todoStatus(t.status) }))
  const prev = bars.get('tasks')
  const bar = prev && !prev.dismissed && barState(prev) !== 'done' ? prev : newBar('tasks', lastPrompt || 'Tasks', 'tasks', [])
  bar.stages = [{ name: 'Tasks', steps }]
  placeBar(bar)
}

// ---------- routing: read what a router says ----------

// "jev · fast 0.87 → haiku/low", "jev · fast 0.41 · unchanged", "jev · no answer"
function readRouteStatus(text) {
  const m = String(text).match(/^jev · (\w+) ([\d.]+|n\/d)(?: → (\S+)| · unchanged)?/)
  if (!m) return false
  const r = { tier: m[1], conf: m[2] === 'n/d' ? null : Number(m[2]), model: '', effort: '', unchanged: !m[3], at: Date.now() }
  for (const part of String(m[3] ?? '').split('/').filter(Boolean)) {
    if (EFFORTS.includes(part)) r.effort = part
    else r.model = shortModel(part)
  }
  const prev = route
  route = { ...(prev && Date.now() - prev.at < 5000 ? prev : {}), ...r }
  routeHist.push(TIER_MODEL[r.tier] ?? r.tier)
  if (routeHist.length > 8) routeHist.shift()
  return true
}

// "[jev-model-router] jev: tier fast (0.87) · effort 0.4 → low (0.71) · risky 0.02 · 249ms"
function readRouteLog(text) {
  const m = String(text).match(/jev: tier (\w+) \(([\d.]+|n\/d)\)(?: · effort ([\d.]+) → (\w+) \([^)]*\))?(?: · risky ([\d.]+|n\/d))?(?: · (\d+)ms)?/)
  if (!m) return false
  route = {
    ...(route ?? {}),
    tier: m[1],
    conf: m[2] === 'n/d' ? null : Number(m[2]),
    effortScore: m[3] ? Number(m[3]) : null,
    risky: m[5] && m[5] !== 'n/d' ? Number(m[5]) : null,
    ms: m[6] ? Number(m[6]) : null,
    at: Date.now(),
  }
  return true
}

function routeRow() {
  if (!prefs.show.route || !route || !route.tier) return null
  const from = shortModel(seen.model || sessionModel) || 'session'
  const want = TIER_MODEL[route.tier] ?? route.tier
  const to = route.model || from
  const effort = route.effort || seen.effort || ''
  const wantRank = MODEL_RANK[want]
  const fromRank = MODEL_RANK[from]
  const dir = route.unchanged ? '=' : wantRank != null && fromRank != null ? (wantRank < fromRank ? '↓' : wantRank > fromRank ? '↑' : '=') : '='
  return {
    id: 'route',
    kind: 'route',
    style: 'run',
    title: 'Model route',
    from,
    want,
    to,
    effort,
    conf: route.conf ?? null,
    risky: route.risky ?? null,
    ms: route.ms ?? null,
    tier: route.tier,
    dir,
    right: dir === '↓' ? '↓ cheaper' : dir === '↑' ? '↑ deeper' : '= kept',
    short: '⇄ ' + to + (effort ? '·' + effort : ''),
    pct: 0,
    marks: [],
  }
}

// ---------- rows ----------

function visibleStrips(bar, now) {
  if (!prefs.show.agents) return null
  const list = agentsOf(bar)
  if (!list.length) return null
  const hasError = list.some((a) => a.state === 'error')
  if (bar.agentsDoneAt && now - bar.agentsDoneAt > FOLD_MS && !hasError) return null
  if (list.length <= MAX_STRIPS) return { shown: list, hidden: [] }
  const keep = new Set(list.filter((a) => a.state !== 'done').slice(0, MAX_STRIPS - 1).map((a) => a.id))
  for (const a of [...list].reverse()) {
    if (keep.size >= MAX_STRIPS - 1) break
    keep.add(a.id)
  }
  return { shown: list.filter((a) => keep.has(a.id)), hidden: list.filter((a) => !keep.has(a.id)) }
}

function stripTool(a) {
  if (a.state === 'waiting') return 'Needs approval'
  if (a.todo && a.todo.total && a.state === 'running') return trunc(a.todo.active || 'Tasks', 24) + ' ' + Math.min(a.todo.total, a.todo.done + 1) + '/' + a.todo.total
  return a.tool
}

function barRow(bar, now) {
  const state = barState(bar)
  const w = where(bar)
  const done = state === 'done'
  const single = bar.stages.length === 1
  const list = agentsOf(bar)
  const agentNote = list.length && bar.id !== 'agents' ? ' · ' + list.filter((a) => a.state === 'done').length + '/' + list.length + ' agents' : ''
  let name
  let count
  if (bar.id === 'agents') {
    name = done ? 'Done' : 'Agents'
    count = w.finished + '/' + w.total
  } else if (done) {
    name = 'Done'
    count = w.total + '/' + w.total
  } else if (single) {
    name = w.active ? w.active.active || w.active.title : bar.stages[0].name
    count = Math.min(w.total, w.pos + 1) + '/' + w.total
  } else {
    name = bar.stages[w.stage]?.name ?? ''
    count = w.step + '/' + w.stageSize
  }
  const marks = []
  let k = 0
  for (const s of bar.stages) {
    s.steps.forEach((_, j) => {
      if (k > 0) marks.push({ f: k / w.total, stage: !single && j === 0 })
      k++
    })
  }
  const pct = done ? 100 : ((w.finished + (w.active ? 0.4 : 0)) / Math.max(1, w.total)) * 100
  return {
    id: 'bar:' + bar.id,
    kind: 'bar',
    bar,
    style: STATE_STYLE[state],
    state,
    title: bar.title || 'Plan',
    pct,
    marks,
    steps: w.total,
    finished: w.finished,
    name: trunc(name, 30),
    count: count + agentNote,
    right: Math.round(pct) + '%',
    short: done ? '✓ ' + trunc(bar.title, 14) : trunc(name, 16) + ' ' + count,
    stage: w.finished,
    animating: !done,
    strips: visibleStrips(bar, now),
  }
}

function collectRows(now) {
  const rows = []
  const rr = routeRow()
  if (rr) rows.push(rr)
  for (const bar of bars.values()) {
    if (bar.dismissed) continue
    if (bar.id === 'agents' ? !prefs.show.agents : !prefs.show.plans) continue
    if (bar.id === 'agents' && !agentsOf(bar).length) continue
    if (!allSteps(bar).length) continue
    const linger = bar.id === 'agents' ? AGENTS_LINGER_MS : BAR_LINGER_MS
    if (barState(bar) === 'done' && bar.doneAt && now - bar.doneAt > linger) continue
    rows.push(barRow(bar, now))
  }
  const act = activityRow(now)
  if (act) rows.push(act)
  const ctx = usage.context
  if (prefs.show.context && ctx && ctx.percent != null) {
    const p = ctx.percent
    rows.push({
      id: 'context',
      kind: 'meter',
      style: p >= 80 ? 'hot' : p >= 60 ? 'warn' : 'run',
      title: 'Context',
      pct: p,
      marks: [{ f: 0.5 }, { f: 0.8 }],
      name: fmtK(ctx.tokens) + ' / ' + fmtK(ctx.window),
      count: '',
      right: Math.round(p) + '%',
      short: 'ctx ' + Math.round(p) + '%',
      section: 'context',
    })
  }
  if (prefs.show.limits) {
    for (const rl of usage.rateLimits ?? []) {
      const [title, tag] = limitName(rl.kind)
      const p = rl.percentUsed
      rows.push({
        id: 'limit:' + rl.kind,
        kind: 'meter',
        limit: true,
        style: p >= 80 ? 'hot' : p >= 50 ? 'warn' : 'ok',
        title,
        pct: Math.min(100, p),
        marks: [{ f: 0.25 }, { f: 0.5 }, { f: 0.75 }],
        name: tag + ' · ' + Math.round(p) + '% used',
        count: '',
        right: rl.resetsAt ? '↻ ' + countdown(rl.resetsAt) : '',
        short: tag + ' ' + Math.round(p) + '%' + (rl.resetsAt ? ' ↻' + shortCountdown(rl.resetsAt) : ''),
        section: 'limits',
      })
    }
  }
  return rows
}

// collapsed: what needs you first, then limits, context, bars, the route
function collapsedOrder(rows) {
  const rank = (r) => (r.state === 'needs_input' ? 0 : r.limit ? 1 : r.id === 'context' ? 2 : r.kind === 'bar' ? 3 : 4)
  return [...rows].sort((a, b) => rank(a) - rank(b))
}

function petMood(rows, now) {
  if (rows.some((r) => r.state === 'needs_input')) return 'alert'
  if (now < celebrateUntil) return 'celebrate'
  if (turnActive) return 'working'
  if (now - lastActivity > SLEEPY_MS) return 'sleepy'
  return 'calm'
}

// ---------- drawing pieces ----------

function routeCellsTerminal(row) {
  const cells = []
  const push = (s, color, bg, bold) => cells.push(...textCells(s, color, bg, bold))
  const dirColor = row.dir === '↓' ? STYLE.ok.fill : row.dir === '↑' ? STYLE.warn.fill : MUTED
  push(row.from + ' ', DIM)
  push(row.dir === '=' ? '= ' : '→ ', dirColor)
  push(' ' + row.to + ' ', '#1e1e1e', tierColor(row.to, false), true)
  if (row.want !== row.to) push(' jev: ' + row.want, DIM)
  if (row.effort) {
    const lvl = Math.max(1, EFFORTS.indexOf(row.effort) + 1)
    push('  effort ', MUTED)
    push('▁▃▅▇█'.slice(0, Math.min(5, lvl)), STYLE.run.fill)
    push('·'.repeat(Math.max(0, 4 - lvl)) + ' ' + row.effort, DIM)
  }
  if (row.conf != null) push('  conf ' + row.conf.toFixed(2), row.conf >= 0.6 ? STYLE.ok.fill : STYLE.warn.fill)
  if (row.risky != null && row.risky > 0.7) push('  ⚠ risky', STYLE.hot.fill)
  if (row.ms != null) push('  ' + row.ms + 'ms', DIM)
  push('  ', MUTED)
  for (const t of routeHist) push('■', tierColor(t, false))
  return { cells, dirColor }
}

function routeSvg(row, W) {
  const F = "'Anthropic Sans',ui-sans-serif,system-ui,sans-serif"
  let x = 0
  let out = `<text x="0" y="15" style="font:400 12px ${F};fill:#77756f">${esc(row.from)}</text>`
  x += textWidth(row.from, 6.4) + 6
  const dirColor = row.dir === '↓' ? STYLE.ok.desk : row.dir === '↑' ? STYLE.warn.desk : '#9a9893'
  out += `<text x="${x}" y="15" style="font:500 12px ${F};fill:${dirColor}">${row.dir === '=' ? '=' : '→'}</text>`
  x += 14
  for (const t of ['haiku', 'sonnet', 'opus']) {
    const on = t === row.to
    const want = t === row.want && !on
    const w = textWidth(t, 6.4) + 14
    out += `<rect x="${x}" y="3" width="${w}" height="16" rx="4" fill="${on ? tierColor(t) : '#808080'}" fill-opacity="${on ? 1 : 0.16}"${want ? ` stroke="${tierColor(t)}" stroke-dasharray="2 2"` : ''}/>`
    out += `<text x="${x + 7}" y="15" style="font:${on ? 500 : 400} 11.5px ${F};fill:${on ? '#fff' : '#9a9893'}">${t}</text>`
    x += w + 4
  }
  x += 8
  if (row.effort) {
    const lvl = Math.max(1, EFFORTS.indexOf(row.effort) + 1)
    for (let i = 1; i <= 4; i++) out += `<rect x="${x + (i - 1) * 7}" y="${17 - (3 + i * 3)}" width="5" height="${3 + i * 3}" rx="1.5" fill="${i <= lvl ? STYLE.run.desk : '#808080'}" fill-opacity="${i <= lvl ? 1 : 0.25}"/>`
    x += 32
    out += `<text x="${x}" y="15" style="font:400 12px ${F};fill:#c9c7c1">${esc(row.effort)}</text>`
    x += textWidth(row.effort, 6.4) + 14
  }
  if (row.conf != null) {
    const c = row.conf >= 0.6 ? STYLE.ok.desk : STYLE.warn.desk
    out += `<text x="${x}" y="15" style="font:400 11.5px ${F};fill:#77756f">conf</text>`
    x += 30
    out += `<rect x="${x}" y="8" width="44" height="6" rx="3" fill="#808080" fill-opacity=".25"/><rect x="${x}" y="8" width="${(44 * row.conf).toFixed(1)}" height="6" rx="3" fill="${c}"/>`
    x += 50
    out += `<text x="${x}" y="15" style="font:400 11.5px ${F};fill:#9a9893">${row.conf.toFixed(2)}</text>`
    x += 40
  }
  if (row.risky != null && row.risky > 0.7) {
    out += `<text x="${x}" y="15" style="font:500 11.5px ${F};fill:${STYLE.hot.desk}">⚠ risky</text>`
    x += 56
  }
  const histW = routeHist.length * 10
  if (x + 12 + histW > W) return out
  let hx = Math.max(x + 12, W - histW)
  for (const t of routeHist) {
    out += `<rect x="${hx}" y="7.5" width="7" height="7" rx="2" fill="${tierColor(t)}" fill-opacity=".85"/>`
    hx += 10
  }
  return out
}

function rowSvg(row, W, nowMs) {
  const stripsH = row.strips ? 5 + stripsHeight(row.strips) : 0
  const H = TRACK_H + stripsH
  const total = W + RIGHT_W
  const track = row.kind === 'route' ? routeSvg(row, W) : desktopTrack(prefs.style.desktop, row, W, nowMs, lastHead)
  const rightColor = row.kind === 'route' ? (row.dir === '↓' ? STYLE.ok.desk : row.dir === '↑' ? STYLE.warn.desk : '#9a9893') : '#9a9893'
  return {
    height: H,
    width: total,
    source:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${H}" viewBox="0 0 ${total} ${H}">` +
      track +
      `<text x="${total - 4}" y="${TRACK_H / 2 + 4.2}" text-anchor="end" style="font:400 12px 'Anthropic Sans',ui-sans-serif,system-ui,sans-serif;fill:${rightColor};font-variant-numeric:tabular-nums">${esc(row.right)}</text>` +
      (row.strips ? `<g transform="translate(0 ${TRACK_H + 5})">${stripsSvg(row.strips, W, nowMs, stripTool, (m) => tierColor(m), lastStrip)}</g>` : '') +
      '</svg>',
  }
}

function sampleRow() {
  return {
    id: 'sample',
    kind: 'bar',
    style: 'run',
    state: 'running',
    title: 'Refactor auth',
    pct: 52,
    marks: [0.2, 0.4, 0.6, 0.8].map((f, i) => ({ f, stage: i === 1 })),
    steps: 5,
    finished: 2,
    name: 'Fixing auth',
    count: '3/5',
    right: '52%',
    animating: true,
  }
}

// ---------- side effects that need $ ----------

function play($, name) {
  if (!prefs.sound) return
  $.audio.play({ asset: 'sounds/' + name + '.wav' }, { gain: 0.6 }).catch(() => {})
}

async function savePrefs($) {
  await $.store.set('prefs', prefs)
}

// a response may report only some windows; keep the others, drop ones already reset
function mergeLimits(old, fresh) {
  const byKind = new Map((old ?? []).map((r) => [r.kind, r]))
  for (const r of fresh ?? []) byKind.set(r.kind, r)
  const now = Date.now()
  return [...byKind.values()].filter((r) => !r.resetsAt || Date.parse(r.resetsAt) > now).sort((a, b) => (a.kind < b.kind ? -1 : 1))
}

async function refreshUsage($) {
  try {
    const u = await $.session.usage()
    usage = { context: u.context ?? usage.context, rateLimits: mergeLimits(usage.rateLimits, u.rateLimits) }
  } catch {}
}

async function refreshWeather($) {
  if (!prefs.city || !prefs.show.weather) return
  try {
    const { lat, lon, name } = prefs.city
    const r = await $.http.fetch('https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lon + '&current=temperature_2m,weather_code')
    if (!r.ok) return
    const cur = JSON.parse(r.text).current
    weather = { temp: cur.temperature_2m, code: cur.weather_code, name }
  } catch {}
}

async function syncAgents($) {
  if (![...agents.values()].some((a) => a.state === 'running' || a.state === 'waiting')) return
  try {
    for (const info of await $.agent.list()) {
      const a = agents.get(info.id)
      if (!a || a.state === 'done' || a.state === 'error') continue
      if (info.status === 'completed') finishAgent(a.id, 'done', 'Done')
      else if (info.status === 'failed' || info.status === 'killed') finishAgent(a.id, 'error', info.status === 'killed' ? 'Stopped' : 'Failed')
    }
  } catch {}
}

async function readSessionModel($) {
  try {
    sessionModel = await $.session.model()
  } catch {}
}

function finishAgent(id, state, tool) {
  const a = agents.get(id)
  if (!a || a.state === 'done' || a.state === 'error') return
  a.state = state
  a.tool = tool
  a.endedAt = Date.now()
  waiting.delete(id)
  syncAgentsBar()
  const bar = a.home === 'activity' ? activity && { id: 'activity', set agentsDoneAt(v) { activity.agentsDoneAt = v } } : bars.get(a.home)
  if (bar && agentsOf(bar).every((x) => x.state === 'done' || x.state === 'error')) bar.agentsDoneAt = Date.now()
}

// compare rows with the last tick: sounds, done timestamps, the pet's cues, auto-expand
function react($, rows, now) {
  for (const bar of bars.values()) {
    const s = barState(bar)
    if (s === 'done' && !bar.doneAt) bar.doneAt = now
    if (s !== 'done') bar.doneAt = null
  }
  const live = rows.filter((r) => r.kind === 'bar' && r.animating).length
  let anyAsk = false
  for (const row of rows) {
    if (row.kind !== 'bar') continue
    const prev = lastSeen.get(row.id)
    if (row.state === 'needs_input') anyAsk = true
    if (prev) {
      if (row.state === 'needs_input' && prev.state !== 'needs_input') play($, 'alert')
      else if (row.state === 'error' && prev.state !== 'error') play($, 'error')
      else if (row.state === 'done' && prev.state !== 'done') {
        play($, live === 0 ? 'fanfare' : 'chime')
        celebrateUntil = now + 3500
      } else if (row.stage > prev.stage && row.state !== 'done') play($, 'tick')
    }
    lastSeen.set(row.id, { state: row.state, stage: row.stage })
  }
  if (anyAsk && !prefs.open && prefs.auto) {
    prefs.open = true
    savePrefs($).catch(() => {})
  }
}

function statusText() {
  const lines = []
  for (const r of collectRows(Date.now())) {
    if (r.kind === 'route') {
      lines.push('⇄ Model route — ' + r.from + ' ' + (r.dir === '=' ? '=' : '→') + ' ' + r.to + (r.effort ? ' · effort ' + r.effort : '') + ' · jev ' + r.tier + (r.conf != null ? ' ' + r.conf.toFixed(2) : '') + ' (' + r.right + ')')
      continue
    }
    lines.push(STYLE[r.style].glyph + ' ' + r.title + ' — ' + r.name + (r.count ? ' ' + r.count : '') + (r.right ? ' (' + r.right + ')' : ''))
    for (const a of r.strips?.shown ?? []) lines.push('   ↳ ' + a.title + ': ' + stripTool(a) + ' [' + a.state + ']' + (a.model ? ' {' + a.model + '}' : ''))
  }
  const on = SECTIONS.filter((s) => prefs.show[s]).join(', ') || 'nothing'
  return (
    (lines.length ? lines.join('\n') : 'No rows yet.') +
    '\nShowing: ' + on + ' · ' + (prefs.open ? 'expanded' : 'collapsed') +
    ' · style ' + prefs.style.terminal + ' (CLI) / ' + prefs.style.desktop + ' (Desktop)' +
    ' · pet ' + pet.act + ' · auto-expand ' + (prefs.auto ? 'on' : 'off') + ' · sound ' + (prefs.sound ? 'on' : 'off') +
    (prefs.city ? ' · city ' + prefs.city.name : '')
  )
}

const HELP = [
  '/deck                      toggle collapsed / expanded (also: 0 in an empty prompt, or Deck in the footer)',
  '/deck expand | collapse',
  '/deck style                pick a bar style, with live previews',
  '/deck style <name>         CLI: ' + TERMINAL_STYLES.join(', ') + ' · Desktop: ' + DESKTOP_STYLES.join(', '),
  '/deck <section> on|off     sections: ' + SECTIONS.join(', ') + ', all',
  '/deck city <name>          set the weather city (turns weather on)',
  "/deck quiet on|off         hide the router's own status and log lines while the HUD shows the route",
  '/deck auto on|off          expand when something needs you',
  '/deck sound on|off',
  '/deck demo                 play a sample plan with agents',
  '/deck clear                remove all bars',
  '/deck status               print what the HUD shows',
].join('\n')

function demoStages() {
  const st = (title, status = 'pending') => ({ title, status })
  return [
    { name: 'Analysis', steps: [st('Read modules', 'done'), st('Find dependencies', 'done'), st('List changes', 'active')] },
    { name: 'DB migration', steps: [st('Table schema'), st('Create migration'), st('Move data'), st('Indexes')] },
    { name: 'API', steps: [st('Endpoints'), st('Validation'), st('Access rules')] },
    { name: 'Verify', steps: [st('Tests'), st('Build')] },
  ]
}

// ---------- hooks ----------

export function register(on) {
  on('session.start', async ($, e, next) => {
    const saved = await $.store.get('prefs')
    if (saved && typeof saved === 'object') {
      prefs = {
        ...clone(DEFAULT_PREFS),
        ...saved,
        show: { ...DEFAULT_PREFS.show, ...(saved.show ?? {}) },
        style: { ...DEFAULT_PREFS.style, ...(saved.style ?? {}) },
      }
      delete prefs.stages
    }
    await refreshUsage($)
    await readSessionModel($)
    refreshWeather($).catch(() => {})

    $.clock.every(150, async () => {
      frame++
      const now = Date.now()
      const rows = collectRows(now)
      react($, rows, now)
      const petMoved = prefs.show.pet && stepPet(pet, petMood(rows, now), now)
      const secondTick = now - lastSecond >= 1000
      if (secondTick) lastSecond = now
      const terminalAnim = sawTerminal && frame % 2 === 0 && (rows.some((r) => r.animating) || prefs.show.pet)
      const ticking = secondTick && (prefs.show.clock || rows.some((r) => r.kind === 'meter' || r.strips))
      if (petMoved || terminalAnim || ticking) $.ui.invalidate('ui.render')
      if (frame % 14 === 0) await syncAgents($)
      if (frame % 400 === 0) await refreshUsage($)
      if (frame % 8000 === 0) await refreshWeather($)
    })

    try {
      await $.command.register({
        name: 'deck',
        description: 'deck: toggle the HUD, pick a style, sections, pet, sounds and weather',
        argumentHint: '[expand|collapse|style [name]|<section> on|off|city <name>|demo|status]',
        immediate: true,
      })
    } catch {}
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') {
      bars.clear()
      agents.clear()
      tasks.clear()
    }
    return next(e)
  })

  on('command.run', { command: 'deck' }, async ($, e) => {
    const [a, b, ...rest] = String(e.args ?? '').trim().split(/\s+/).filter(Boolean)
    let reply = null

    if (!a) {
      prefs.open = !prefs.open
      reply = prefs.open ? 'Deck expanded.' : 'Deck collapsed.'
    }
    else if (a === 'expand') {
      prefs.open = true
      reply = 'Deck expanded.'
    } else if (a === 'collapse') {
      prefs.open = false
      reply = 'Deck collapsed.'
    }
    else if (a === 'help') reply = HELP
    else if (a === 'status') reply = statusText()
    else if (a === 'style' && !b) {
      await $.ui.open({ id: 'deck-style', title: 'Deck style', focus: true, closeOnEscape: true })
      return {}
    } else if (a === 'style') {
      const ok = []
      if (TERMINAL_STYLES.includes(b)) {
        prefs.style.terminal = b
        ok.push('CLI')
      }
      if (DESKTOP_STYLES.includes(b)) {
        prefs.style.desktop = b
        ok.push('Desktop')
      }
      reply = ok.length ? 'Style ' + b + ' for ' + ok.join(' and ') + '.' : 'No style "' + b + '". CLI: ' + TERMINAL_STYLES.join(', ') + ' · Desktop: ' + DESKTOP_STYLES.join(', ')
    } else if (a === 'clear') {
      if (demoTimer) demoTimer.cancel()
      bars.clear()
      agents.clear()
      tasks.clear()
      reply = 'Bars removed.'
    } else if (a === 'demo') {
      if (demoTimer) demoTimer.cancel()
      for (const ag of [...agents.values()]) if (ag.home === 'demo') agents.delete(ag.id)
      placeBar(newBar('demo', 'Orders module', 'demo', demoStages()))
      const now = Date.now()
      agents.set('demo-a1', { id: 'demo-a1', title: 'Map the orders tables', state: 'running', tool: 'Grep', model: 'haiku', startedAt: now, endedAt: null, depth: 0, home: 'demo', todo: null })
      agents.set('demo-a2', { id: 'demo-a2', title: 'Draft the migration', state: 'running', tool: 'Read', model: 'sonnet', startedAt: now, endedAt: null, depth: 0, home: 'demo', todo: null })
      prefs.open = true
      turnActive = true
      let n = 0
      demoTimer = $.clock.every(1400, () => {
        n++
        const d = bars.get('demo')
        if (!d) return demoTimer.cancel()
        const a2 = agents.get('demo-a2')
        if (n === 2 && agents.get('demo-a1')) agents.get('demo-a1').tool = 'Read'
        if (n === 3) finishAgent('demo-a1', 'done', 'Done')
        if (n === 5 && a2) {
          a2.state = 'waiting'
          d.explicit = 'needs_input'
        }
        if (n === 8 && a2) {
          a2.state = 'running'
          a2.tool = 'Write'
          d.explicit = null
        }
        if (n === 10) finishAgent('demo-a2', 'done', 'Done')
        if (d.explicit !== 'needs_input') d.stages = stepOn(d.stages)
        if (allSteps(d).every((s) => isFinished(s.status))) {
          demoTimer.cancel()
          turnActive = false
        }
        $.ui.invalidate('ui.render')
      })
      reply = 'Sample plan running above the prompt.'
    } else if (a === 'auto' && (b === 'on' || b === 'off')) prefs.auto = b === 'on'
    else if (a === 'quiet' && (b === 'on' || b === 'off')) prefs.quiet = b === 'on'
    else if (a === 'sound' && (b === 'on' || b === 'off')) {
      prefs.sound = b === 'on'
      if (prefs.sound) play($, 'chime')
    } else if (a === 'all' && (b === 'on' || b === 'off')) for (const s of SECTIONS) prefs.show[s] = b === 'on'
    else if (SECTIONS.includes(a) && (b === 'on' || b === 'off')) prefs.show[a] = b === 'on'
    else if (a === 'city' && b) {
      const q = [b, ...rest].join(' ')
      try {
        const r = await $.http.fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&name=' + encodeURIComponent(q))
        const hit = r.ok ? JSON.parse(r.text).results?.[0] : null
        if (!hit) reply = 'No city found for "' + q + '".'
        else {
          prefs.city = { name: hit.name, lat: hit.latitude, lon: hit.longitude }
          prefs.show.weather = true
          weather = null
          await refreshWeather($)
          reply = 'Weather city set to ' + hit.name + (hit.country ? ', ' + hit.country : '') + '.'
        }
      } catch (err) {
        reply = 'Weather lookup failed: ' + String(err?.message ?? err)
      }
    } else reply = HELP

    await savePrefs($)
    $.ui.invalidate('ui.render')
    return reply ? { text: reply } : {}
  })

  on('prompt.submit', async ($, e, next) => {
    if (e.text && !e.text.startsWith('/')) {
      lastPrompt = trunc(cleanPrompt(e.text), 40) || lastPrompt
      askedUser = false
      lastActivity = Date.now()
      for (const bar of bars.values()) if (bar.explicit === 'needs_input') bar.explicit = null
    }
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    if (!String(e.text ?? '').startsWith('/')) {
      for (const a of [...agents.values()]) if (a.home === 'activity') agents.delete(a.id)
      activity = { title: lastPrompt || 'Working', start: Date.now(), tools: 0, action: 'Thinking', done: false, doneAt: 0, agentsDoneAt: null }
    }
    turnActive = true
    lastActivity = Date.now()
    return next(e)
  })

  // what the main loop's first request runs with, whoever set it
  on('turn.step', async function* ($, e, next) {
    if (!e.agentId && e.index === 0) seen = { model: e.model, effort: typeof e.effort === 'string' ? e.effort : '' }
    return yield* next(e)
  })

  // a router's one-line status: the HUD shows it as a row instead
  on('ui.status', async ($, e, next) => {
    if (typeof e.text === 'string' && readRouteStatus(e.text)) {
      $.ui.invalidate('ui.render')
      if (prefs.quiet && prefs.show.route) return { value: undefined }
    }
    return next(e)
  })

  on('ui.log', async ($, e, next) => {
    const text = String(e.text ?? '')
    if (text.startsWith('[jev-model-router]')) {
      if (readRouteLog(text)) $.ui.invalidate('ui.render')
      if (prefs.quiet && prefs.show.route) return next({ ...e, to: 'debug' })
    }
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    usage = { context: e.context ?? usage.context, rateLimits: mergeLimits(usage.rateLimits, e.rateLimits) }
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('classic.Stop', async ($, e, next) => {
    const result = await next(e)
    if (/\?\s*$/.test(e.last_assistant_message ?? '')) {
      const bar = liveBar()
      if (bar) {
        bar.explicit = 'needs_input'
        askedUser = true
        $.ui.invalidate('ui.render')
      }
    }
    return result
  })

  on('agent.spawn', async ($, e, next) => {
    const started = await next(e)
    if (!started || !started.agentId) return started
    const id = started.agentId
    const parent = e.parentAgentId ? agents.get(e.parentAgentId) : null
    let home = parent?.home ?? liveBar()?.id
    if (!home && activity && !activity.done) {
      home = 'activity'
      if (activity.agentsDoneAt) {
        for (const a of [...agents.values()]) if (a.home === 'activity' && a.state === 'done') agents.delete(a.id)
        activity.agentsDoneAt = null
      }
    }
    if (!home) {
      if (!bars.has('agents') || barState(bars.get('agents')) === 'done') {
        for (const a of [...agents.values()]) if (a.home === 'agents') agents.delete(a.id)
        placeBar(newBar('agents', 'Agents', 'agents', []))
      }
      home = 'agents'
    }
    const bar = bars.get(home)
    if (bar && bar.agentsDoneAt) {
      for (const a of [...agents.values()]) if (a.home === home && a.state === 'done') agents.delete(a.id)
      bar.agentsDoneAt = null
    }
    agents.set(id, {
      id,
      title: trunc(e.description || e.subagentType, 60),
      state: 'running',
      tool: 'Starting',
      model: started.model ? shortModel(started.model) : '',
      startedAt: Date.now(),
      endedAt: null,
      depth: parent ? 1 : 0,
      home,
      todo: null,
    })
    syncAgentsBar()
    $.ui.invalidate('ui.render')
    return started
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId && agents.has(e.agentId)) {
      const failed = e.reason !== 'answer'
      finishAgent(e.agentId, failed ? 'error' : 'done', e.reason === 'aborted' ? 'Stopped' : failed ? 'Failed' : 'Done')
      $.ui.invalidate('ui.render')
    }
    if (!e.agentId) {
      if (activity && !activity.done) {
        activity.done = true
        activity.doneAt = Date.now()
      }
      turnActive = false
      lastActivity = Date.now()
    }
    return next(e)
  })

  on('classic.SubagentStop', async ($, e, next) => {
    if (agents.has(e.agent_id)) {
      finishAgent(e.agent_id, 'done', 'Done')
      $.ui.invalidate('ui.render')
    }
    return next(e)
  })

  on('classic.TaskCreated', async ($, e, next) => {
    if (!tasks.has(String(e.task_id))) tasks.set(String(e.task_id), { subject: trunc(e.task_subject, 80), status: 'pending' })
    syncTasksBar()
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('classic.TaskCompleted', async ($, e, next) => {
    const t = tasks.get(String(e.task_id))
    if (t) t.status = 'completed'
    syncTasksBar()
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('tool.check', async ($, e, next) => {
    const verdict = await next(e)
    const useId = e.tool_use_id
    if (verdict && verdict.decision === 'ask') {
      const key = e.agentId ?? (useId ? inFlight.get(useId) : null) ?? 'main'
      $.clock.after(ASK_DELAY_MS, () => {
        if (useId && !inFlight.has(useId)) return
        waiting.add(key)
        const a = agents.get(key)
        if (a && a.state === 'running') a.state = 'waiting'
        if (key === 'main') {
          const bar = liveBar()
          if (bar) bar.explicit = 'needs_input'
        }
        $.ui.invalidate('ui.render')
      })
    }
    return verdict
  })

  on('tool.call', async ($, e, next) => {
    const key = e.agentId ?? 'main'
    const a = e.agentId ? agents.get(e.agentId) : null
    if (a) {
      if (a.state === 'waiting') a.state = 'running'
      a.tool = String(e.tool).replace(/^mcp__[^_]+__/, '')
    }
    if (!e.agentId && activity && !activity.done) {
      activity.tools++
      activity.action = actionOf(e)
    }
    if (e.tool === 'TodoWrite' && Array.isArray(e.todos)) upsertTodos(key, e.todos)
    if (e.tool === 'AskUserQuestion') {
      waiting.add(key)
      const bar = key === 'main' ? liveBar() : null
      if (bar) bar.explicit = 'needs_input'
      if (a) a.state = 'waiting'
    }
    $.ui.invalidate('ui.render')

    if (e.tool_use_id) inFlight.set(e.tool_use_id, key)
    let ran
    try {
      ran = await next(e)
    } finally {
      if (e.tool_use_id) inFlight.delete(e.tool_use_id)
      if (waiting.delete(key)) {
        if (a && a.state === 'waiting') a.state = 'running'
        if (key === 'main' && !askedUser) for (const bar of bars.values()) if (bar.explicit === 'needs_input') bar.explicit = null
        $.ui.invalidate('ui.render')
      }
    }

    const ok = ran && ran.deny === undefined && ran.isError !== true
    if (ok && !e.agentId && (e.tool === 'TaskCreate' || e.tool === 'TaskUpdate' || e.tool === 'TaskList')) {
      applyTaskResult(e, ran.result)
      $.ui.invalidate('ui.render')
    }
    if (e.tool === 'ExitPlanMode' && ok) {
      const text = typeof e.plan === 'string' ? e.plan : ran.result?.plan
      const parsed = typeof text === 'string' ? parsePlan(text) : null
      if (parsed) {
        placeBar(newBar('plan-' + slug(parsed.title), parsed.title, 'plan', parsed.stages))
        $.ui.invalidate('ui.render')
      }
    }
    return ran
  })

  // a HUD button in the footer, always there while the mod is loaded
  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const { Box, Button } = $.ui.resolve(e)
    const below = await next(e)
    const n = collectRows(Date.now()).filter((r) => r.kind === 'bar').length
    return Box({
      flexDirection: 'row',
      alignItems: 'center',
      gap: 1,
      children: [
        Button({
          key: 'deck-footer',
          label: n ? 'Deck ' + n : 'Deck',
          dimColor: !prefs.open,
          onPress: async () => {
            prefs.open = !prefs.open
            $.ui.invalidate('ui.render')
            await $.store.set('prefs', prefs)
          },
        }),
        below,
      ],
    })
  })

  // the style picker: every style, drawn with a real bar, one key each
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== 'deck-style') return next(e)
    const { Box, Text, Button, Svg } = $.ui.resolve(e)
    const desktop = e.surface === 'desktop'
    const nowMs = Date.now()
    const list = desktop ? DESKTOP_STYLES : TERMINAL_STYLES
    const names = desktop ? DESKTOP_STYLE_NAMES : TERMINAL_STYLE_NAMES
    const current = desktop ? prefs.style.desktop : prefs.style.terminal
    const row = collectRows(nowMs).find((r) => r.kind === 'bar') ?? sampleRow()
    const cols = Math.max(40, e.props.bodyColumns ?? 80)
    const pw = Math.max(200, Math.min(420, cols * 8 - 160))
    const lines = list.map((name, i) => {
      const preview = desktop
        ? Svg({
            alt: names[name] + ' style',
            width: pw,
            height: TRACK_H,
            
            source: `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${TRACK_H}">${desktopTrack(name, { ...row, id: 'pick-' + name }, pw, nowMs, new Map())}</svg>`,
          })
        : Box({ flexDirection: 'row', children: runs(Text, terminalBar(name, { ...row, id: 'pick-' + name }, Math.max(24, Math.min(48, cols - 26)), frame)) })
      return Box({
        key: 'style-row-' + name,
        flexDirection: 'row',
        columnGap: 2,
        alignItems: 'center',
        children: [
          Box({
            width: 14,
            flexShrink: 0,
            children: [
              Button({
                key: 'style-' + name,
                label: names[name],
                plain: true,
                hotkey: String(i + 1),
                onPress: async (ev) => {
                  const surface = ev?.surface ?? e.surface
                  if (surface === 'desktop') prefs.style.desktop = name
                  else prefs.style.terminal = name
                  $.ui.invalidate('ui.render')
                  await $.store.set('prefs', prefs)
                },
              }),
            ],
          }),
          preview,
          Text({ color: name === current ? STYLE.ok.fill : DIM, children: [name === current ? '← now' : ' '] }),
        ],
      })
    })
    return Box({
      flexDirection: 'column',
      gap: desktop ? 1 : 0,
      children: [...lines, Text({ color: DIM, children: ['Press ' + list.map((_, i) => i + 1).join('/') + ' to choose · Esc to close'] })],
    })
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const { Box, Text, Button, Svg, Image } = $.ui.resolve(e)
    const desktop = e.surface === 'desktop'
    if (e.surface === 'terminal') sawTerminal = true
    const nowMs = Date.now()
    const cols = Math.max(40, e.props.bodyColumns ?? e.viewport?.columns ?? 100)
    const rows = collectRows(nowMs)
    const extras = []
    if (prefs.show.clock) extras.push((desktop ? '◷ ' : '') + clockText())
    const wt = prefs.show.weather ? weatherText(desktop) : ''
    if (wt) extras.push(wt)
    if (!rows.length && !extras.length && !prefs.show.pet) return next(e)

    // the pet's lane
    const lane = []
    if (prefs.show.pet) {
      if (desktop && Svg) {
        const W = Math.max(320, cols * 8)
        lane.push(Svg({ source: petLaneSvg(pet, nowMs, W, 62), alt: 'Claude pet, ' + pet.act, width: W, height: 62 }))
      } else if (!desktop && Image) {
        const room = Math.max(0, cols - PET_COLS - 1)
        const x = Math.round(petX(pet, nowMs) * room)
        const px = petFrame(pet.act, nowMs - pet.start, pet.dir)
        lane.push(
          Box({
            flexDirection: 'row',
            children: [
              Text({ children: [' '.repeat(x)] }),
              Image({ key: 'pet', source: { rgba: toBase64(px), width: PET_RASTER.width, height: PET_RASTER.height }, columns: PET_COLS, rows: PET_ROWS, alt: ' ' }),
            ],
          }),
        )
      }
    }

    const toggle = Button({
      key: 'deck-toggle',
      label: prefs.open ? 'deck ▾' : 'deck ▸',
      plain: true,
      hotkey: '0',
      dimColor: true,
      onPress: async () => {
        prefs.open = !prefs.open
        $.ui.invalidate('ui.render')
        await $.store.set('prefs', prefs)
      },
    })
    const extrasText = Box({ flexShrink: 0, children: [Text({ color: MUTED, children: [extras.join('  ·  ')] })] })
    const spacer = Box({ flexGrow: 1, children: [] })

    // ----- collapsed: one line of chips, limits first -----
    if (!prefs.open || !rows.length) {
      const chips = []
      let budget = cols - 10 - extras.join('  ·  ').length
      let hidden = 0
      for (const row of collapsedOrder(rows)) {
        const st = STYLE[row.style]
        const w = row.short.length + 10
        if (w > budget) {
          hidden++
          continue
        }
        budget -= w
        if (chips.length) chips.push(Text({ color: TRACK, children: [' │ '] }))
        if (row.kind === 'route') {
          chips.push(Text({ color: desktop ? STYLE.run.desk : STYLE.run.fill, children: [row.short + ' '] }))
          continue
        }
        chips.push(Text({ color: desktop ? st.desk : st.fill, children: [st.glyph + ' '] }))
        const chipText = { color: row.state === 'needs_input' ? st.fill : row.limit ? TEXT : '#c9c7c1', children: [row.short + ' '] }
        if (row.limit) chipText.bold = true
        chips.push(Text(chipText))
        chips.push(
          desktop
            ? Svg({
                alt: row.title + ' ' + Math.round(row.pct) + '%',
                width: 36,
                height: 8,
                source: `<svg xmlns="http://www.w3.org/2000/svg" width="36" height="8"><rect width="36" height="8" rx="4" fill="#808080" fill-opacity=".2"/><rect width="${Math.max((36 * row.pct) / 100, row.pct > 0 ? 4 : 0)}" height="8" rx="4" fill="${st.desk}"/></svg>`,
              })
            : Box({ flexDirection: 'row', children: runs(Text, terminalMini(prefs.style.terminal, row, 5)) }),
        )
      }
      if (hidden) chips.push(Text({ color: DIM, children: ['  +' + hidden] }))
      const line = Box({
        flexDirection: 'row',
        columnGap: 1,
        alignItems: 'center',
        children: [...(rows.length ? [toggle] : []), Box({ flexDirection: 'row', alignItems: 'center', children: chips }), spacer, extrasText],
      })
      return Box({ flexDirection: 'column', children: [...lane, line] })
    }

    // ----- expanded -----
    const close = (row) =>
      Button({
        key: 'x-' + row.id,
        label: '✕',
        plain: true,
        dimColor: true,
        onPress: async () => {
          if (row.kind === 'activity') {
            for (const ag of [...agents.values()]) if (ag.home === 'activity') agents.delete(ag.id)
            activity = null
          }
          else if (row.kind === 'bar') {
            const bar = row.bar
            for (const ag of agentsOf(bar)) agents.delete(ag.id)
            if (bar.id === 'todo' || bar.id === 'tasks') bar.dismissed = true
            else bars.delete(bar.id)
            if (bar.id === 'tasks') tasks.clear()
            if (bar.id === 'demo' && demoTimer) demoTimer.cancel()
          } else {
            prefs.show[row.kind === 'route' ? 'route' : row.section] = false
            await $.store.set('prefs', prefs)
          }
          $.ui.invalidate('ui.render')
        },
      })
    const header = Box({
      flexDirection: 'row',
      columnGap: 1,
      children: [toggle, Text({ color: DIM, children: ['· ' + rows.length + (rows.length === 1 ? ' row' : ' rows')] }), spacer, extrasText],
    })

    if (desktop) {
      const total = Math.max(320, cols * 8)
      const titleW = Math.min(Math.round(total * 0.28), Math.max(...rows.map((r) => Math.round(textWidth(r.title, 6.4)))))
      const trackW = Math.max(120, Math.min(1400, total - titleW - RIGHT_W - 70))
      const lines = rows.map((row) => {
        const st = STYLE[row.style]
        const svg = rowSvg(row, trackW, nowMs)
        const alt =
          row.kind === 'route'
            ? 'Model route: ' + row.from + ' to ' + row.to + (row.effort ? ', effort ' + row.effort : '')
            : row.title + ': ' + row.name + (row.count ? ' ' + row.count : '') + ', ' + row.right + (row.strips ? '; agents: ' + row.strips.shown.map((ag) => ag.title + ' ' + ag.state).join(', ') : '')
        return Box({
          key: 'row-' + row.id,
          flexDirection: 'row',
          alignItems: row.strips ? 'flex-start' : 'center',
          gap: 1,
          children: [
            Text({ color: st.desk, children: [row.kind === 'route' ? '⇄' : st.glyph] }),
            Text({ wrap: 'truncate', children: [row.title] }),
            Box({ flexGrow: 1, children: [] }),
            Svg({ source: svg.source, alt, width: svg.width, height: svg.height }),
            close(row),
          ],
        })
      })
      return Box({ flexDirection: 'column', gap: 1, children: [...lane, header, ...lines] })
    }

    // terminal
    const maxRows = Math.max(2, (e.props.maxRows ?? 14) - 1 - (lane.length ? PET_ROWS : 0))
    const labelW = Math.min(24, Math.max(12, Math.floor(cols * 0.2)))
    const rightW = 12
    const barW = Math.max(16, cols - labelW - rightW - 8)
    const lines = []
    for (const row of rows) {
      if (lines.length >= maxRows) break
      const st = STYLE[row.style]
      if (row.kind === 'route') {
        const { cells, dirColor } = routeCellsTerminal(row)
        lines.push(
          Box({
            flexDirection: 'row',
            columnGap: 1,
            children: [
              Text({ color: STYLE.run.fill, children: ['⇄'] }),
              Box({ width: labelW, flexShrink: 0, children: [Text({ color: TEXT, children: [row.title] })] }),
              Box({ flexGrow: 1, flexDirection: 'row', children: runs(Text, cells.slice(0, barW)) }),
              Box({ width: rightW, flexShrink: 0, justifyContent: 'flex-end', children: [Text({ color: dirColor, children: [row.right] })] }),
              close(row),
            ],
          }),
        )
        continue
      }
      lines.push(
        Box({
          flexDirection: 'row',
          columnGap: 1,
          children: [
            Text({ color: st.fill, children: [st.glyph] }),
            Box({ width: labelW, flexShrink: 0, children: [Text({ color: TEXT, wrap: 'truncate', children: [trunc(row.title, labelW)] })] }),
            Box({ flexGrow: 1, flexDirection: 'row', children: runs(Text, terminalBar(prefs.style.terminal, row, barW, frame)) }),
            Box({ width: rightW, flexShrink: 0, justifyContent: 'flex-end', children: [Text({ color: MUTED, children: [row.right] })] }),
            close(row),
          ],
        }),
      )
      for (const ag of row.strips ? row.strips.shown : []) {
        if (lines.length >= maxRows) break
        const ast = STYLE[AGENT_STYLE[ag.state]]
        lines.push(
          Box({
            flexDirection: 'row',
            columnGap: 1,
            children: [
              Text({ children: [ag.depth ? '    ' : '  '] }),
              Text({ color: ast.fill, children: [ag.state === 'running' && frame % 6 < 3 ? '○' : '●'] }),
              Box({ width: labelW - 1, flexShrink: 0, children: [Text({ color: '#c9c7c1', wrap: 'truncate', children: [trunc((ag.depth ? '↳ ' : '') + ag.title, labelW - 1)] })] }),
              Text({ color: ast.fill, wrap: 'truncate', children: [stripTool(ag)] }),
              ...(ag.model ? [Text({ color: '#1e1e1e', backgroundColor: tierColor(ag.model, false), children: [' ' + ag.model + ' '] })] : []),
              Box({ flexGrow: 1, children: [] }),
              Text({ color: DIM, children: [elapsed((ag.endedAt ?? nowMs) - ag.startedAt)] }),
            ],
          }),
        )
      }
      if (row.strips?.hidden.length && lines.length < maxRows) lines.push(Text({ color: DIM, children: ['    +' + row.strips.hidden.length + ' more agents'] }))
    }
    return Box({ flexDirection: 'column', children: [...lane, header, ...lines] })
  })
}
