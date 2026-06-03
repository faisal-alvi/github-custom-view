# GitHub PR Power View

A Tampermonkey userscript that transforms GitHub PR pages into a split-view layout with a sticky quick-nav sidebar, inline CI status, commits list, and file diffs — all without leaving the conversation tab.

## Features

- **50/50 split layout** — conversation on the left, PR overview on the right
- **Sticky quick-nav sidebar** — jump to description, commits, reviews, force pushes, and more
- **CI checks with annotations** — failing checks expanded inline with error details and a direct link to job logs
- **Commits list** — all commits with SHA links and author, ticker prefix stripped
- **File diffs** — inline unified diffs with filter, expand/collapse
- **PR Details** — reviewers, assignees, labels, milestone from the original sidebar (click to open popup)
- **Toggle** — switch between Power View and original GitHub layout; state persists across page reloads
- **Scoped** — only activates on the PR conversation tab, not on `/files`, `/commits`, or `/checks`

## Installation

1. Install [Tampermonkey](https://www.tampermonkey.net/) for Chrome/Firefox/Safari
2. Open Tampermonkey dashboard → **Create a new script**
3. Replace all content with the contents of [`github-pr-power-view.user.js`](./github-pr-power-view.user.js)
4. Save (`Cmd+S`)
5. Navigate to any GitHub PR — the layout activates automatically

## Usage

| Action | How |
|---|---|
| Toggle Power View on/off | **⊡ Original view** button (top-right corner) |
| Jump to a section | Click any item in the left quick-nav |
| View PR details (reviewers etc.) | Click any item in the **PR Details** nav section |
| Filter files in diff | Type in the filter box in the right column |
| Expand / collapse all diffs | **⊞ expand** / **⊟ collapse** buttons |
| View failing CI details | Annotations shown inline under each failing check |
| Open full job logs | **📋 View full job logs ↗** button under failing check |
| Scroll left nav independently | Hover over nav, scroll — stays in nav |

## Layout

```
┌─────────────────────────────────────────────────────────────────────┐
│  [PR title / tabs]                         [⊡ Original view]        │
├──────────────────────────────────┬──────────────────────────────────┤
│ 🧭 Quick Nav (sticky, scrollable)│ 🔍 PR Overview           [↑ top] │
│  ── PR Details ──                │  🔬 CI Checks (8) [1 failing]    │
│  👥 Reviewers   alice            │    ❌ E2E tests — 1 error · 1 warn│
│  🙋 Assignees   bob              │       [📋 View full job logs ↗]  │
│  🏷 Labels      bug              │    ▶ 7 passing                   │
│  🚀 Milestone   v5.4             │  ──────────────────────────────  │
│  👤 Participants 2               │  🔖 Commits (7)                  │
│  ❌ CI Checks   1 failing        │    a1b2c3d  add settings hub      │
│  ── Overview ──                  │    e4f5g6h  fix gateway redirect  │
│  ⬆ Top                           │  ──────────────────────────────  │
│  📋 Description                  │  📂 Files Changed (4)  [filter…] │
│  ── Timeline ──                  │    ▼ includes/Admin.php  +13 −10 │
│  🔖 Commits pushed  added 4      │    ▼ includes/Plugin.php  +5 −2  │
│  ⚡ Force push                   ├──────────────────────────────────┤
│  🔴 alice — changes requested   │       [conversation / timeline]   │
│  💬 Copilot AI reviewed          │                                  │
│  ✅ bob — approved               │                                  │
│  ⬇ Bottom                        │                                  │
└──────────────────────────────────┴──────────────────────────────────┘
```

## Notes

- Uses the **GitHub REST API** (no auth required for public repos; cookies handle auth for private repos)
- No external library dependencies — diff rendering is custom, no CDN calls
- CSP-safe — all event handlers use `addEventListener`, no inline `onclick`
- Toggle state saved in `localStorage` — persists across reloads until manually toggled back
