# Changelog

## 0.5.1

- Fixed: a bar label wider than the bar's fill drew from the end of the fill onward, so a 34% weekly limit looked about 85% full. The label now sits outlined just past the fill.
- A limit on pace to run out turns amber only once it's past 40%, like its alert. Early in a week, one busy day no longer paints the weekly row amber.
- Long run-out times read in days (`out in ~4d 1h`), and limit labels are shorter (`5h · 60% · out in ~1h`).

## 0.5.0

- **A new pet.** Redrawn, with 15 poses that follow what Claude is really doing instead of a random pick: a thought bubble while it thinks, a book for Read, a magnifier for Grep and Glob, a laptop for Edit and Write, a terminal for Bash, a globe for the web, little helpers in their model's color for subagents, X eyes when a tool fails, a sweat drop near a usage limit, and a nightcap when idle.
- Fixed: running leaned backward, seated poses floated over a bar, legs swung from the hip, the book faced the wrong way, and turning around snapped instead of turning.
- The pet is drawn once and rendered two ways, so Desktop and the terminal always match. Animations stay in step across redraws instead of restarting.
- README images use the new pet.

## 0.4.13

- Limit rows show where you'll land at reset at your current pace, `5h · 31% used · ~45% at reset`, or `out in ~50m` when the window fills up first. A limit on pace to run out turns amber.
- Alerts: a toast, a sound and the panel opening by itself when a limit is on pace to run out before it resets, passes 80% or 90%, or the context passes 60% or 85%. Each limit alert fires once per window across sessions; the context alerts come back after a compact. `/deck alerts off`, `/deck alerts 80,90`, `/deck alerts context 60,85`.
- The context row's marks and colors follow your context thresholds, and say `/compact` once you're past the first one.
- Tests: tools the plan and task tests call are now allowed, since newer Claude Code test kits deny a tool left at "ask".

## 0.4.12

- The expanded header shows the folder the session works in, with your home folder as `~` (for example `~/Documents/deck`). It follows `/cd` and worktree moves, a long path is cut from the left, and a narrow header drops the weather and clock before the folder. `/deck folder off` hides it. From [#5](https://github.com/nvr0x5/claude-deck/pull/5), thanks @narjes-abs.

## 0.4.11

- Background subagents stay on Deck while they run. The activity row no longer hides them 20 seconds after the turn ends, and on your next prompt they move to the Agents bar instead of disappearing, so you still see them finish. Fixes [#3](https://github.com/nvr0x5/claude-deck/issues/3), thanks @damiansycz.
- Narrow terminals (under 40 columns, like a side-by-side pane) no longer wrap. Deck uses the real width, drops the weather and then the clock when the header doesn't fit, and keeps each row on one line, cut short. Fixes [#4](https://github.com/nvr0x5/claude-deck/issues/4), thanks @MAXxATTAXx.

## 0.4.10

- Fixed: when a mod after Deck in the hook chain wanted to draw, Deck swallowed it instead of stacking the result underneath. Now `deckView` calls `next(e)` first and stacks whatever comes back. Fixes [#2](https://github.com/nvr0x5/claude-deck/issues/2) thanks to @MAXxATTAXx.
- Fixed: the route row's `from` now shows the model you picked, not what Jev routed to. The `to` still shows Jev's pick. This makes the "not applied" badge's intent clear.
- Expanded header row count now uses the theme foreground on Desktop light themes, matching the collapsed looks. Fixes [#1](https://github.com/nvr0x5/claude-deck/pull/1) thanks to @Larvan2.

## 0.4.9

- `/deck version` shows which Deck version is running; `/deck status` ends with it too.
- README: the VS Code extension's chat panel draws neither Deck's band nor its panel yet; use its terminal mode.

## 0.4.8

- `/deck panel` opens Deck in a panel of its own, always expanded; `/deck panel off` closes it. It was meant for the VS Code extension, but as of extension 2.1.294 its chat panel draws no mod panels either.

## 0.4.7

- Claude Code for VS Code gets the Desktop look (SVG bars and the animated pet) once the extension draws mod panels. As of extension 2.1.294 its chat panel runs `/deck` but draws no panel; its terminal mode shows the full Deck.

## 0.4.6

- The Model route row now tells a suggestion from a change. "↓ cheaper" and "↑ deeper" appear only when the router really switched the model; when Jev picks a model the router doesn't apply (main-model routing is off by default), the row says `= kept` and "not applied".
- Route history: a filled square is a turn whose model the router changed, an outlined square is a suggestion only.

## 0.4.5

- Compact Desktop rows get 3px of space above and below, so the pills of neighboring rows no longer touch.

## 0.4.4

- Long prompts no longer squeeze the bars: the title column on Desktop is capped and long titles end in "…".
- Compact Desktop: when expanded, the pet walks along the header line next to the row count instead of its own strip.
- A plain chat turn (no tools, no agents) shows while Claude is thinking and disappears once it answers, instead of leaving "Done 0 tools".

## 0.4.3

- The Model route row now says when the router has no answer (out of credit, bad key, timeout) instead of showing the last good route: `kept opus · ! typesafe 402`. After three failures in a row it adds a hint to check the router's key or credit. Failed turns show as hollow squares in the route history.
- Desktop is more compact by default: tighter rows and a shorter pet lane. `/deck size roomy` brings back the old spacing.

## 0.4.2

- `/deck demo` now shows everything in a fresh session: a sample model route and sample 5h and 7d limits fill in until the real ones arrive, then real readings replace them.

## 0.4.1

- Removed Pet Runner (`/deck play`): it couldn't run smoothly enough inside Claude Code.
- Rings: labels no longer wrap onto several lines; spend reads "today · $4.30 this month".
- Chips: the Desktop app no longer hides a chip behind "+1" when there's room for it.
- Collapsed countdowns read `↻2h14m` instead of ticking seconds.
- The pet's lane is shorter, so a collapsed Deck takes less height.
- Spark in a narrow terminal keeps the label and rate whole; the sparkline shrinks instead.
- New `assets/styles.svg`: every bar style and collapsed look, on Desktop and in the terminal.

## 0.4.0

- **Rings**: a third collapsed look, `/deck collapsed rings`, with a ring per limit, its reset time, and spend.
- **Spend**: `/deck cost on` adds up what you spend today and this month across sessions (for pay-per-use API keys).
- **Spark**: a sixth bar style. Limits and context show a sparkline of recent history and a burn rate (`+12%/h`, `+5%/day`).
- **Pet Runner**: `/deck play`, a jump-over-the-bugs game that scores while Claude works and freezes when Claude needs you.
- Usage history is kept across sessions, so sparklines and rates survive a restart.

## 0.3.3

- Opening and closing Deck animate: rows unfold one after another (and fold back up on close). On Desktop each row also fades and rises in. Works from `0`, the footer button, `/deck`, and auto-expand.

## 0.3.2

- New collapsed look: `/deck collapsed text` shows one plain status line (limits, context, task, route, weather, clock). `/deck collapsed chips` keeps the mini bars.
- Two demos in the README, desktop and terminal, both drawn with Deck's own code and ending on the collapsed line.
- The test workflow asks for read-only access; added SECURITY.md.

## 0.3.1

- Agents started without a todo list now show as strips under the activity bar, with their model, like the demo.
- Both usage limits stay on screen when Claude Code reports only one window in an update.
- Bar titles show the words you typed, without system reminders or pasted blocks.
- The model route row no longer draws the confidence over the history squares.
- Agent names no longer run into their status in the strips.
- The terminal pet keeps a small margin from the band's right edge.
- The pet's lane is taller, so jumps aren't clipped.
- `/deck`, `/deck expand` and `/deck collapse` always reply.
- Tests run on every push (GitHub Actions).

## 0.3.0

First public release: plan bars, activity bar, subagent strips, context, 5h and 7d limits with reset countdowns, model route display, a pet, five bar styles, a style picker, clock and weather. CLI and Desktop.
