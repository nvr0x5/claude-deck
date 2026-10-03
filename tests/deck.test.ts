import { expect, mock, test } from 'claude-code/testing'

const BAND = {
  plugin: 'deck',
  component: 'AbovePrompt',
  requestId: 'above-prompt',
  viewport: { columns: 120, rows: 40 },
  props: { hasSurvey: false, isWorking: true, maxRows: 20, bodyColumns: 110, scroll: { offset: 0, bodyRows: 20 }, view: {} },
} as const

const FOOTER = {
  plugin: 'deck',
  component: 'SessionMode',
  requestId: 'session-mode',
  viewport: { columns: 120, rows: 40 },
  props: { modes: [] },
} as const

const PICKER = {
  plugin: 'deck',
  component: 'Pane',
  requestId: 'deck-style',
  viewport: { columns: 120, rows: 40 },
  props: { title: 'Deck style', isFocused: true, bodyColumns: 100, placement: 'inline', scroll: { offset: 0, bodyRows: 12 }, view: {} },
} as const

const inAnHour = () => new Date(Date.now() + 3600_000 + 14 * 60_000).toISOString()

// Everything Claude Code would answer for this mod
function stubs(on, saved = new Map<string, unknown>(), toolCall: any = () => ({ result: 'ok' })) {
  const clock = mock.clock(on)
  on('store.get', ($, e) => ({ value: saved.get(e.key) }))
  on('store.set', ($, e) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('command.register', () => ({ value: undefined }))
  on('audio.play', () => ({ value: undefined }))
  on('agent.list', () => ({ value: [] }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('http.fetch', () => ({ deny: 'no network in tests' }))
  on('session.usage', () => ({
    value: {
      startedAt: 0,
      context: { tokens: 124_000, window: 1_000_000, percent: 12 },
      rateLimits: [
        { kind: 'five_hour', percentUsed: 31, resetsAt: inAnHour() },
        { kind: 'seven_day', percentUsed: 64, resetsAt: inAnHour() },
      ],
    },
  }))
  on('session.start', () => ({ cwd: '/work' }))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('tool.call', toolCall)
  on('tool.check', () => ({ decision: 'ask' }))
  on('turn.complete', () => ({ text: '' }))
  on('ui.status', () => ({ value: undefined }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('ui.log', () => ({ value: undefined }))
  on('ui.render', () => ({ type: 'Text', props: {}, children: ['engine'] }))
  return { saved, clock }
}

async function start($) {
  await $.session.start({ surface: 'terminal', isInteractive: true, cwd: '/work' })
}

const TODOS = [
  { content: 'Map routes', activeForm: 'Mapping routes', status: 'completed' },
  { content: 'Write tests', activeForm: 'Writing tests', status: 'completed' },
  { content: 'Fix auth', activeForm: 'Fixing auth', status: 'in_progress' },
  { content: 'Run suite', activeForm: 'Running suite', status: 'pending' },
  { content: 'Report', activeForm: 'Reporting', status: 'pending' },
]

const spawn = (id: string, description: string) => ({
  tool_use_id: 't-' + id,
  prompt: 'go',
  description,
  subagentType: 'Explore',
  provider: { plugin: 'engine', tier: 'core' },
})

test('expanded HUD draws plan, context, limits and the pet on both surfaces', async ($, on) => {
  const { saved } = stubs(on)
  saved.set('prefs', { open: true, style: { terminal: 'segments', desktop: 'pixel' } })
  await start($)
  await $.prompt.submit({ text: 'Refactor the auth module' })
  await $.tool.call({ tool: 'TodoWrite', todos: TODOS })

  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /^Refactor the auth/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /124k \/ 1M/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /Session · 5h/ })).toBeDefined()
  expect(await term.find({ type: 'Text', text: /↻ 1:1\d:\d\d/ })).toBeDefined()
  expect(await term.find({ type: 'Image' })).toBeDefined()
  await term.unmount()

  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const lane = await desk.find({ type: 'Svg' })
  expect(lane.props.source).toMatch(/@keyframes mv\d+/)
  expect(await desk.find({ type: 'Text', text: /Weekly · 7d/ })).toBeDefined()
  await desk.unmount()
})

test('every CLI and Desktop style draws a valid bar', async ($, on) => {
  stubs(on)
  await start($)
  await $.tool.call({ tool: 'TodoWrite', todos: TODOS })
  for (const style of ['segments', 'line', 'solid', 'dots', 'pixel']) {
    await $.command.run({ command: 'deck', args: 'style ' + style })
    await $.command.run({ command: 'deck', args: 'expand' })
    const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
    expect(await term.find({ type: 'Text', text: /Fixing auth/ })).toBeDefined()
    await term.unmount()
    const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
    const svgs = []
    for (let i = 0; i < 1; i++) svgs.push(await desk.find({ key: 'row-bar:todo' }))
    expect(svgs[0]).toBeDefined()
    await desk.unmount()
  }
})

test('the style picker lists every style and a key press picks one per surface', async ($, on) => {
  const { saved } = stubs(on)
  await start($)
  await $.command.run({ command: 'deck', args: 'style' })
  const term = await $.ui.mount({ ...PICKER, surface: 'terminal' })
  for (const k of ['segments', 'line', 'solid', 'dots', 'pixel']) expect(await term.find({ key: 'style-' + k })).toBeDefined()
  await term.press({ key: 'style-dots' })
  await term.unmount()
  const desk = await $.ui.mount({ ...PICKER, surface: 'desktop' })
  expect(await desk.find({ type: 'Svg' })).toBeDefined()
  await desk.press({ key: 'style-line' })
  expect((saved.get('prefs') as any).style).toEqual({ terminal: 'dots', desktop: 'line' })
})

test('collapsed line puts the usage limits first', async ($, on) => {
  stubs(on)
  await start($)
  await $.tool.call({ tool: 'TodoWrite', todos: TODOS })
  const ui = await $.ui.mount({ ...BAND, surface: 'terminal' })
  const five = await ui.find({ type: 'Text', text: /^5h 31% ↻/ })
  const task = await ui.find({ type: 'Text', text: /^Fixing auth 3\/5/ })
  expect(five).toBeDefined()
  expect(task).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Session · 5h/ })).toBeUndefined()
})

// stands in for jev-model-router: the same status and log lines, on a prompt
const fakeRouter = {
  name: 'jev-model-router',
  register(on) {
    on('prompt.submit', async ($, e, next) => {
      $.ui.log('[jev-model-router] jev: tier fast (0.87) · effort 0.4 → low (0.71) · risky 0.02 · 249ms')
      $.ui.status('jev · fast 0.87 → low')
      return next(e)
    })
  },
}

test("the router's status and log become the route row", { plugins: [fakeRouter] }, async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'deck', args: 'expand' })
  await $.prompt.submit({ text: 'rename a variable' })
  const out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/⇄ Model route — opus (=|→) opus · effort low · jev fast 0\.87/)
  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: /conf 0\.87/ })).toBeDefined()
  await term.unmount()
  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect((await desk.find({ key: 'row-route' }))).toBeDefined()
})

test('the footer HUD button counts bars and toggles the HUD', async ($, on) => {
  const { saved } = stubs(on)
  await start($)
  await $.tool.call({ tool: 'TodoWrite', todos: TODOS })
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...FOOTER, surface })
    const button = await ui.find({ key: 'deck-footer' })
    expect(button.props.label).toBe('Deck 1')
    await ui.unmount()
  }
  const ui = await $.ui.mount({ ...FOOTER, surface: 'terminal' })
  await ui.press({ key: 'deck-footer' })
  expect((saved.get('prefs') as any).open).toBe(true)
})

test('/deck pet off removes the lane', async ($, on) => {
  stubs(on)
  await start($)
  await $.command.run({ command: 'deck', args: 'pet off' })
  await $.command.run({ command: 'deck', args: 'expand' })
  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  const first = await desk.find({ type: 'Svg' })
  expect(first === undefined || !/@keyframes mv/.test(first.props.source)).toBe(true)
  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Image' })).toBeUndefined()
})

test('a permission prompt held past the delay turns the bar amber and alarms the pet', async ($, on) => {
  const { clock } = stubs(on)
  await start($)
  await $.tool.call({ tool: 'TodoWrite', todos: TODOS })
  await $.tool.check({ tool: 'Bash', input: { command: 'rm -rf build' } })
  let out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/^● Tasks — Fixing auth 3\/5/m)
  await clock.advance(800)
  out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/^\? Tasks — Fixing auth 3\/5/m)
  expect(out.text).toMatch(/pet alert/)
})

test('subagents become strips with their model, then finish', async ($, on) => {
  stubs(on)
  on('agent.spawn', ($, e) => ({ model: e.description === 'explore routes' ? 'claude-haiku-4-5' : 'sonnet', agentId: e.description === 'explore routes' ? 'a1' : 'a2' }))
  await start($)
  await $.tool.call({ tool: 'TodoWrite', todos: TODOS })
  await $.agent.spawn(spawn('a1', 'explore routes'))
  await $.agent.spawn(spawn('a2', 'write fixtures'))
  await $.tool.call({ tool: 'Grep', pattern: 'auth', agentId: 'a1' })
  await $.tool.call({ tool: 'TodoWrite', agentId: 'a2', todos: TODOS.slice(0, 4) })
  let out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/Fixing auth 3\/5 · 0\/2 agents/)
  expect(out.text).toMatch(/↳ explore routes: Grep \[running\] \{haiku\}/)
  expect(out.text).toMatch(/↳ write fixtures: Fixing auth 3\/4 \[running\] \{sonnet\}/)
  await $.turn.complete({ turnId: 'x', agentId: 'a1', answer: 'ok', durationMs: 5, isAborted: false, reason: 'answer', usage: null })
  out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/1\/2 agents/)
  await $.command.run({ command: 'deck', args: 'expand' })
  const desk = await $.ui.mount({ ...BAND, surface: 'desktop' })
  expect(await desk.find({ key: 'row-bar:todo' })).toBeDefined()
  await desk.unmount()
  const term = await $.ui.mount({ ...BAND, surface: 'terminal' })
  expect(await term.find({ type: 'Text', text: / haiku / })).toBeDefined()
})

test('agents with no live bar get their own Agents bar', async ($, on) => {
  stubs(on)
  on('agent.spawn', () => ({ model: 'claude-test', agentId: 'solo' }))
  await start($)
  await $.agent.spawn(spawn('solo', 'scan the repo'))
  await $.tool.call({ tool: 'Read', file_path: 'a.ts', agentId: 'solo' })
  const out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/^● Agents — Agents 0\/1/m)
  expect(out.text).toMatch(/↳ scan the repo: Read \[running\]/)
})

test('an approved plan becomes a bar with stages', async ($, on) => {
  stubs(on)
  await start($)
  const plan = '# Checkout rework\n\n## Backend\n1. Add cart table\n2. Write API\n\n## Frontend\n- Cart page\n- Pay button\n'
  await $.tool.call({ tool: 'ExitPlanMode', plan })
  const out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/Checkout rework — Backend 1\/2/)
})

test('task tools: ids and statuses come from the results, and a new batch starts a fresh bar', async ($, on) => {
  let next = 1
  stubs(on, undefined, ($, e) => {
    if (e.tool === 'TaskCreate') return { result: { task: { id: String(next++), subject: e.subject } } }
    if (e.tool === 'TaskUpdate') return { result: { success: true, taskId: e.taskId, updatedFields: ['status'] } }
    return { result: 'ok' }
  })
  await start($)
  await $.tool.call({ tool: 'TaskCreate', subject: 'Old one', description: '' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '1', status: 'completed' })
  for (const subject of ['Core', 'JSON', 'CLI', 'Tests', 'Run tests', 'README']) {
    await $.tool.call({ tool: 'TaskCreate', subject, description: '', activeForm: subject + 'ing' })
  }
  for (const id of ['2', '3', '4', '5']) await $.tool.call({ tool: 'TaskUpdate', taskId: id, status: 'completed' })
  await $.tool.call({ tool: 'TaskUpdate', taskId: '6', status: 'in_progress' })
  const out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/— Run testsing 5\/6 \(73%\)/)
})

test('/deck demo runs a sample plan to the end and the pet celebrates', async ($, on) => {
  const { clock } = stubs(on)
  await start($)
  await $.command.run({ command: 'deck', args: 'demo' })
  let out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/Orders module — Analysis 3\/3 · 0\/2 agents/)
  await clock.advance(1400 * 30)
  out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/Orders module — Done 12\/12/)
})

test('a turn without a todo list gets an activity bar that follows the tools', async ($, on) => {
  stubs(on)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  await start($)
  await $.prompt.submit({ text: 'Fix the login bug' })
  await $.turn.start({ text: 'Fix the login bug', turnId: 't1' })
  await $.tool.call({ tool: 'Read', file_path: '/src/auth.ts' })
  await $.tool.call({ tool: 'Edit', file_path: '/src/auth.ts', old_string: 'a', new_string: 'b' })
  let out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/● Fix the login bug — Editing auth\.ts 2 tools/)
  await $.turn.complete({ turnId: 't1', answer: 'ok', durationMs: 5, isAborted: false, reason: 'answer', usage: null })
  out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/✓ Fix the login bug — Done 2 tools/)
  // a todo list in the next turn replaces it
  await $.turn.start({ text: 'Next', turnId: 't2' })
  await $.tool.call({ tool: 'TodoWrite', todos: TODOS })
  out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).not.toMatch(/Planning/)
  expect(out.text).toMatch(/Fixing auth 3\/5/)
})

test('agents started without a todo list show as strips under the activity bar, with their model', async ($, on) => {
  stubs(on)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('agent.spawn', ($, e) => ({ model: e.description === 'Map the orders tables' ? 'claude-haiku-4-5' : 'sonnet', agentId: e.description === 'Map the orders tables' ? 'a1' : 'a2' }))
  await start($)
  await $.prompt.submit({ text: 'Migrate the orders module' })
  await $.turn.start({ text: 'Migrate the orders module', turnId: 't1' })
  await $.agent.spawn(spawn('a1', 'Map the orders tables'))
  await $.agent.spawn(spawn('a2', 'Draft the migration'))
  await $.tool.call({ tool: 'Grep', pattern: 'orders', agentId: 'a1' })
  const out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/Migrate the orders module — .* · 0\/2 agents/)
  expect(out.text).toMatch(/↳ Map the orders tables: Grep \[running\] \{haiku\}/)
  expect(out.text).toMatch(/↳ Draft the migration: Starting \[running\] \{sonnet\}/)
  expect(out.text).not.toMatch(/^● Agents/m)
})

test('a usage update with one window keeps the other', async ($, on) => {
  stubs(on)
  await start($)
  await $.session.measure({ context: { tokens: 1, window: 10, percent: 10 }, rateLimits: [{ kind: 'seven_day', percentUsed: 50, resetsAt: inAnHour() }], changed: ['rateLimits'] })
  const out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/Session · 5h/)
  expect(out.text).toMatch(/7d · 50% used/)
})

test('bar titles use the typed words, not system reminders around them', async ($, on) => {
  stubs(on)
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  await start($)
  await $.prompt.submit({ text: '<system-reminder>The user started this session without a folder.</system-reminder>\nUse 2 subagents to list files' })
  await $.turn.start({ text: 'x', turnId: 't1' })
  await $.tool.call({ tool: 'Read', file_path: '/a.ts' })
  const out = await $.command.run({ command: 'deck', args: 'status' })
  expect(out.text).toMatch(/● Use 2 subagents to list files — /)
})

test('/deck collapsed text draws one plain status line with limits first', async ($, on) => {
  const { saved } = stubs(on)
  await start($)
  await $.tool.call({ tool: 'TodoWrite', todos: TODOS })
  await $.command.run({ command: 'deck', args: 'collapsed text' })
  expect((saved.get('prefs') as any).collapsed).toBe('text')
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...BAND, surface })
    expect(await ui.find({ type: 'Text', text: /^5h 31% ↻/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /^Fixing auth 3\/5/ })).toBeDefined()
    await ui.unmount()
  }
})
