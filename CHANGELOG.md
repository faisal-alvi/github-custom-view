# Changelog

All notable changes to GitHub PR Power View are documented here.

---

## [2.4.0] — 2026-06-03

### Fixed
- **Original view width** — toggling off now explicitly restores `.container-xl` to `max-width: 1280px`. GitHub PR pages are natively full-width in their own CSS, so disabling `gpv-style-main` alone was not enough to restore the narrow layout.
- **Boot off-state** — `restoreOriginalLayout()` now also runs when the script boots with power view disabled, so the width is correct on first load without needing a toggle.
- **404 = Not Found prompt** — API returning "Not Found" now triggers the token prompt, not just rate-limit errors. Private org repos return 404 for all unauthenticated requests.
- **Token prompt guidance** — prompt now explicitly says to use a **classic PAT** (`ghp_…`) with `repo` scope. Fine-grained PATs require org admin approval for org repos and will not work for private repositories.

### Notes
- `woocommerce/woocommerce-eu-vat-number` is a **private repo**. Both anonymous and fine-grained PAT requests return 404. Only a classic PAT (`ghp_…`) with `repo` scope works.

---

## [2.3.0] — 2026-06-03

### Added
- **GitHub PAT authentication** — all API calls now send `Authorization: Bearer <token>` if a PAT is stored in `localStorage` under key `gpv-github-token`.
- **Auto-prompt on rate limit** — when the anonymous 60 req/hr limit is hit, the script shows a prompt explaining the issue and asking for a PAT, then retries the boot automatically.
- **`🔑 API Token` nav item** — bottom of Quick Nav shows token status (green = set, amber = not set). Click to update or clear at any time.
- **Error banner** — when data load fails after retry, a red banner appears at the top of the right column with the error message and guidance.

### Removed
- `credentials: 'include'` approach (added in 2.2.0, removed here) — GitHub's `api.github.com` returns `Access-Control-Allow-Origin: *` which is incompatible with credentialed cross-origin requests; browser blocks these with "Failed to fetch".

---

## [2.2.0] — 2026-06-03

### Added
- `apiFetch()` helper wrapping all `api.github.com` calls.
- Error banner in right column when boot fails — shows actual error message instead of silently rendering empty sections.

### Fixed
- Attempted `credentials: 'include'` on all fetch calls to send session cookies to GitHub API. **Reverted in 2.3.0** — GitHub's CORS policy blocks this.

---

## [2.1.0] — pre-2026-06-03

### Fixed
- **Toggle fully restores original layout** — `gpv-style-main` correctly disabled on toggle-off; `restoreOriginalLayout()` resets all inline styles on `content`, `convo`, `pane`, `inner`, `root`, `socket`.
- **Toggle button survives toggle-off** — button CSS moved to a separate permanent `<style>` tag (`_gpvToggleStyle`) that is never disabled. Previously, disabling `gpv-style-main` also removed button styles.
- **Boot with power-off disables CSS** — script no longer leaves `max-width: 100%` active when booting into original-view state.

---

## [2.0.0] — pre-2026-06-03

### Added
- `localStorage` toggle persistence — `gpv-power-view` key, value `'on'`/`'off'`. Survives page reloads.
- PR conversation tab scoping — `isPRConvo()` regex `/^\/[^/]+\/[^/]+\/pull\/\d+\/?$/`; script skips `/files`, `/commits`, `/checks`.
- Full original layout restore on toggle-off.
- `turbo:render` + `pjax:end` listeners for GitHub SPA navigation.

### Fixed
- Syntax error from stale `GM_addStyle` closing backtick-paren (switched to manual `document.createElement('style')`).
- `position:sticky` on flex child caused right column to visually overlap conversation; fixed with fixed-height flex container.
- GitHub Copilot iframe caused 8px horizontal scroll; fixed with `overflowX: hidden` on `<html>` and `<body>`.

---

## [1.0.0] — initial

### Added
- 50/50 split layout: sticky quick-nav left, conversation center, CI+commits+diff right.
- Sticky quick-nav with PR Details / CI / Overview / Timeline / Reviews sections.
- CI check runs with annotations inline + job log link.
- Commits list with SHA links and author.
- File diffs with filter / expand / collapse.
- Sidebar popup for reviewers / assignees / labels.
- Toggle button (bottom-right, persists).
- Custom diff renderer — no external libraries, no CDN (GitHub CSP blocks `cdn.jsdelivr.net`).
- GitHub REST API via `fetch()` from page context with cookie auth.

---

## Architecture decisions (permanent record)

| Decision | Reason |
|---|---|
| No CDN/external libs | GitHub CSP blocks `cdn.jsdelivr.net` scripts injected via `<script>` tags |
| GitHub REST API via `fetch()` | Works from page context; `.diff` URL is blocked by GitHub CSP/CSRF |
| No `iframe` approach | GitHub doesn't boot React inside iframes — `/files` in an iframe yields empty content |
| Fixed-height flex container | `position:sticky` on a flex child causes visual stacking over conversation column |
| Two `<style>` tags | `gpv-style-main` is disabled on toggle-off; toggle button CSS must be in a separate permanent tag |
| `credentials:'include'` rejected | GitHub `api.github.com` uses `Access-Control-Allow-Origin: *`; browser blocks credentialed cross-origin requests |
| Classic PAT required | Fine-grained PATs require org admin approval for org repos; anonymous = 60 req/hr cap |
| `localStorage` for toggle + token | Persists state across page reloads; key `gpv-power-view`, token key `gpv-github-token` |
| Nav wheel event interception | Without `stopPropagation`, scrolling over nav bubbles to parent convo column |
| `prc-PageLayout-*` selectors | GitHub React component class names used for layout manipulation |
