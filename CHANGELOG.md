# Changelog

## 0.4.27

- The Session health chip in the collapsed chips view drops the grade letter to save width: `Excellent 93` (was `Excellent (S) 93`). The wide bar still shows the letter.

## 0.4.26

- The collapsed chips and rings views of the Session health row show the grade word too: the chip reads `Excellent 93` (was `opt S 93`) and the ring is labelled `Excellent` (was `optimizer`).

## 0.4.25

- The Session and Weekly bars read `N% used` instead of repeating `5h` or `7d`, which the row title already says.
- The Optimizer row is now titled "Session health", and its bar spells the grade in words: `Excellent (S) · 93/100 · cache hit 97%` (S Excellent, A Great, B Good, C Fair, D Poor, F Critical).

## 0.4.24

- The Model route row no longer runs over its right-hand cell. When the row was too narrow, the trailing items (`not applied`, the `unsure` pill, `⚠ risky`, the confidence bar) were drawn past the track and printed on top of the `held` / `↻` / `warm` mark. An item that does not fit is now left out, and `not applied` is dropped when the `unsure` pill or the mark already says why.

## 0.4.23

- The Model route row now says whether a model switch re-sent the conversation: `↑ ↻108k` (the new model's cache was cold and the API wrote 108k tokens to it), `↓ warm` (it read from a warm cache), `= held 184k` (the router kept the current model rather than re-send 184k). The figure is what the API reported for the first request after the switch; until it arrives, the router's own estimate shows with a `~` (`↻~108k`, `~warm`). `/deck status` spells it out.
- Needs jev-model-router 0.9.7, which records the figures. With an older router, or with no switch this turn, the row reads `cheaper`, `deeper` or `kept` as before.

## 0.4.22

- The Jev model switches row now counts only this session. It used to show the router's whole saved log (its newest 100 judged switches across every session), so it never changed between sessions. It now starts at `0 switched · 0 kept` and counts entries stamped since the session began; the right-hand text reads `this session` until the first one.
- The row is shown whenever jev-model-router is installed, including when it has logged nothing yet. The router's log has no session id, so two sessions running at once share it.

## 0.4.21

- The Optimizer row is now titled "Token optimizer score" and the Switches row "Jev model switches", so the left column says what each one is. Longer than about 22 characters would be cut off and squeeze the bars, so these two are the longest that fit.
- Their right-hand text is shorter so it no longer runs over the bar label: the Switches age reads `40m ago` (was `newest 40m ago`), a stale score reads `stale 12m`, and the optimizer's reason for a grade below A is cut to 12 characters.
- The command names are unchanged: `/deck optimizer` and `/deck switches`.

## 0.4.20

- New Switches row: how many times the Jev router switched your main chat's model versus kept it (`61 switched · 39 kept`), with how long ago the newest one was. It reads the router's own switch log (its newest 100 judged switches, across sessions). Toggle with `/deck switches on|off`.
- Soft dependency: shown only when jev-model-router is installed and has logged a switch. With `routeMainModel` off the router logs nothing new, so the numbers go stale and the age grows.

## 0.4.19

- `/deck collapsed rings` now ends with an optimizer ring: the grade letter in a ring filled to the score, in the grade's colour, with the score beside it (`S 91 optimizer`). Chips and text already showed the Optimizer row through each row's short form, so the README and `assets/styles.svg` now show it there too.
- Like the row, it appears only when the token-optimizer plugin has written its file for the session.

## 0.4.18

- New Optimizer row: the session's quality grade and score from the [token-optimizer](https://github.com/alexgreensh/token-optimizer) plugin, with the cache hit rate, and what is dragging the score down when the grade is below A. Grades: S and A green, B green with a watch, C amber, D and F red. Toggle with `/deck optimizer on|off`.
- It is a soft dependency: Deck only reads the file token-optimizer writes (`~/.claude/token-optimizer/quality-cache-<session>.json`). Without the plugin, or before it has written the file, the row is simply not shown. Nothing is run or installed.

## 0.4.17

- `/deck collapsed rings` now shows the token total as `1.2M tokens`, shorter than before so the row fits. The in/out split stays in the expanded Tokens row.
- The README and `assets/styles.svg` show the Tokens row.

## 0.4.16

- New Tokens row: input and output tokens this session has used, summed across every response including subagents. Toggle with `/deck tokens on|off`.
- The `/deck collapsed rings` view shows the token total next to the spend ring (`T 1.2M tokens`).

## 0.4.15

- `/deck panel` now stays on. It reopens the panel each session and whenever it goes missing, until you run `/deck panel off`.

## 0.4.14

- The last-minute cache warning is shorter so the re-write cost is no longer clipped in the bar: `⚠ 45s · rewrite ~$0.80` instead of `⚠ expires in 45s · rewrite ~$0.80`. Nothing else about the warning changed.

## 0.4.13

- The Cache row warns in the last minute: it turns red and reads `⚠ expires in 45s · rewrite ~$0.80`, and the collapsed chip shows `cache ⚠45s`. The bar keeps draining, and nothing changes before the last minute.
- The 5h and 7d limit rows say when you will hit the limit at your current pace, if that comes before the reset: `hits ~4:12pm` (or `hits ~Thu 4pm` on a later day). The bar turns amber, and red inside two hours. In the expanded rows the right-hand column shows `⚠4:12pm` in place of the reset countdown; the collapsed chips and rings keep the reset and add the hit time. It needs at least five minutes of rising usage, like the burn rate, and shows nothing when the limit resets first.

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
