// ==UserScript==
// @name         GitHub PR Power View
// @namespace    local.faisal
// @version      2.1.0
// @description  Split-view PR: sticky quick-nav + conversation left, CI+commits+diff right. Toggle persists across reloads.
// @match        https://github.com/*/*/pull/*
// @grant        none
// @run-at       document-end
// ==/UserScript==

(function () {
  'use strict';

  // Only run on PR conversation tab — not /files, /commits, /checks, etc.
  const isPRConvo = () => /^\/[^/]+\/[^/]+\/pull\/\d+\/?$/.test(location.pathname);

  function prInfo() {
    const m = location.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
    return m ? { owner: m[1], repo: m[2], pr: m[3] } : null;
  }

  function esc(s) {
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ── Toggle button CSS — permanent, never disabled ────────────────────────────
  const _gpvToggleStyle = document.createElement('style');
  _gpvToggleStyle.textContent = `
    #gpv-toggle-btn {
      position: fixed; bottom: 16px; right: 16px; z-index: 99999;
      padding: 5px 12px; border-radius: 6px; font-size: 12px;
      cursor: pointer; font-weight: 600;
      border: 1px solid var(--borderColor-default,#d0d7de);
      background: var(--bgColor-default,#fff);
      color: var(--fgColor-default,#24292f);
      box-shadow: 0 2px 8px rgba(0,0,0,.12);
    }
    #gpv-toggle-btn.original { background: #0969da; color: #fff; border-color: #0969da; }
  `;
  document.head.appendChild(_gpvToggleStyle);

  // ── CSS — injected manually so we can disable it on toggle-off ──────────────
  const _gpvStyle = document.createElement('style');
  _gpvStyle.id = 'gpv-style-main';
  document.head.appendChild(_gpvStyle);
  _gpvStyle.textContent = `
    .container-xl { max-width: 100% !important; padding: 0 8px !important; }
    html, body { overflow-x: hidden !important; }

    /* nav */
    #gpv-nav {
      flex: 0 0 176px; width: 176px; min-width: 176px;
      height: auto;
      overflow-y: scroll; overflow-x: hidden;
      position: sticky; top: 0; align-self: flex-start; z-index: 2;
      border-right: 1px solid var(--borderColor-default,#d0d7de);
      padding: 12px 0 500px;
      font-size: 12px;
      background: var(--bgColor-default,#fff);
      scrollbar-width: thin;
    }
    #gpv-nav::-webkit-scrollbar { width: 4px; }
    #gpv-nav::-webkit-scrollbar-thumb { background: var(--borderColor-muted,#d8dee4); border-radius: 4px; }
    .gpv-nav-head {
      padding: 0 12px 8px;
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: var(--fgColor-muted,#57606a);
      border-bottom: 1px solid var(--borderColor-muted,#d8dee4);
      margin-bottom: 4px;
    }
    .gpv-nav-group { margin-top: 10px; }
    .gpv-nav-group-label {
      padding: 0 12px 3px;
      font-size: 10px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .08em; color: var(--fgColor-muted,#57606a); opacity: .6;
    }
    .gpv-nav-item {
      display: flex; align-items: flex-start; gap: 7px;
      padding: 5px 12px; cursor: pointer;
      border-left: 2px solid transparent;
      color: var(--fgColor-default,#24292f);
    }
    .gpv-nav-item:hover {
      background: var(--bgColor-muted,#f6f8fa);
      border-left-color: var(--color-accent-emphasis,#0969da);
    }
    .gpv-nav-item .ni { font-size: 13px; flex-shrink: 0; margin-top: 1px; }
    .gpv-nav-item .nl { font-size: 11px; line-height: 1.4; overflow: hidden;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .gpv-nav-item .nb { font-size: 10px; opacity: .5; display: block; }
    .gpv-nav-item.green { color: #2da44e; }
    .gpv-nav-item.red   { color: #cf222e; }
    .gpv-nav-item.amber { color: #9a6700; }
    .gpv-nav-sep { height: 1px; background: var(--borderColor-muted,#d8dee4); margin: 8px 12px; }

    /* right column */
    #gpv-diff-col {
      overflow-y: auto; overflow-x: hidden;
      border-left: 2px solid var(--borderColor-default,#d0d7de);
      box-sizing: border-box;
    }
    #gpv-diff-toolbar {
      position: sticky; top: 0; z-index: 10;
      background: var(--bgColor-default,#fff);
      border-bottom: 1px solid var(--borderColor-muted,#d8dee4);
      padding: 7px 12px; display: flex; align-items: center; gap: 6px;
    }

    /* CI section */
    #gpv-ci { padding: 12px; border-bottom: 2px solid var(--borderColor-default,#d0d7de); }
    #gpv-ci h3, #gpv-commits h3, #gpv-files-section h3 {
      font-size: 11px; font-weight: 700; text-transform: uppercase;
      letter-spacing: .06em; color: var(--fgColor-muted,#57606a);
      margin: 0 0 8px; display: flex; align-items: center; gap: 6px;
    }
    .gpv-ci-badge { font-size: 10px; padding: 1px 6px; border-radius: 10px; font-weight: 700; }
    .gpv-ci-badge.fail { background: #ffebe9; color: #cf222e; }
    .gpv-ci-badge.pass { background: #dafbe1; color: #1a7f37; }
    .gpv-check-row {
      display: flex; align-items: center; gap: 7px;
      padding: 4px 6px; border-radius: 5px; font-size: 12px; margin-bottom: 2px;
    }
    .gpv-check-row.fail { background: #ffebe9; }
    .gpv-check-row .gpv-check-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gpv-check-row a { font-size: 11px; color: var(--color-accent-fg,#0969da); text-decoration: none; flex-shrink: 0; }
    .gpv-check-row a:hover { text-decoration: underline; }
    #gpv-ci details summary { cursor: pointer; font-size: 11px; color: var(--fgColor-muted,#57606a); padding: 4px 0; }

    /* commits section */
    #gpv-commits { padding: 12px; border-bottom: 2px solid var(--borderColor-default,#d0d7de); }
    .gpv-commit { display: flex; align-items: flex-start; gap: 8px; padding: 5px 0; border-bottom: 1px solid var(--borderColor-muted,#d8dee4); }
    .gpv-commit:last-child { border-bottom: none; }
    .gpv-commit-sha { font-family: monospace; font-size: 11px; color: var(--color-accent-fg,#0969da); flex-shrink: 0; text-decoration: none; }
    .gpv-commit-sha:hover { text-decoration: underline; }
    .gpv-commit-msg { font-size: 12px; line-height: 1.4; flex: 1; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
    .gpv-commit-author { font-size: 11px; color: var(--fgColor-muted,#57606a); flex-shrink: 0; }

    /* files section */
    #gpv-files-section { padding: 8px; }
    .gpv-file-toolbar { display: flex; gap: 5px; margin-bottom: 8px; }
    .gpv-file-toolbar input {
      flex: 1; min-width: 0; padding: 4px 8px; border-radius: 5px;
      font-size: 11px; border: 1px solid var(--borderColor-default,#d0d7de);
      background: var(--bgColor-default,#fff); color: inherit;
    }
    .gpv-file-toolbar button {
      padding: 3px 8px; border-radius: 5px; font-size: 11px; cursor: pointer;
      border: 1px solid var(--borderColor-default,#d0d7de);
      background: var(--bgColor-default,#fff); color: inherit; white-space: nowrap;
    }
    .gpv-file-toolbar button:hover { background: var(--bgColor-muted,#f6f8fa); }
    .gpv-file { margin-bottom: 10px; border: 1px solid var(--borderColor-default,#d0d7de); border-radius: 6px; overflow: hidden; }
    .gpv-file-hdr {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 10px; background: var(--bgColor-muted,#f6f8fa);
      cursor: pointer; font-size: 11px; font-family: monospace;
      border-bottom: 1px solid var(--borderColor-default,#d0d7de); list-style: none;
    }
    .gpv-file-hdr::-webkit-details-marker { display: none; }
    .gpv-st { font-weight: 700; font-size: 10px; padding: 1px 5px; border-radius: 3px; color: #fff; flex-shrink: 0; }
    .gpv-fname { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .gpv-fstats { margin-left: auto; display: flex; gap: 5px; font-family: monospace; font-size: 11px; flex-shrink: 0; }
    .gpv-a { color: #2da44e; } .gpv-d { color: #cf222e; }
    .gpv-dl { display: flex; }
    .gpv-ds { width: 16px; min-width: 16px; padding: 1px 3px; font-family: monospace; font-size: 11px; text-align: center; border-right: 1px solid var(--borderColor-muted,#d8dee4); user-select: none; flex-shrink: 0; }
    .gpv-dc { padding: 1px 6px; font-family: ui-monospace, monospace; font-size: 11px; white-space: pre; tab-size: 2; flex: 1; min-width: 0; overflow-x: hidden; }
    .gpv-dl.add { background: #e6ffec; } .gpv-dl.add .gpv-ds { background: #ccffd8; color: #2da44e; }
    .gpv-dl.del { background: #ffebe9; } .gpv-dl.del .gpv-ds { background: #ffd7d5; color: #cf222e; }
    .gpv-dl.hunk { background: #f6f8fa; }
    .gpv-dl.hunk .gpv-ds { background: #f6f8fa; color: #aaa; }
    .gpv-dl.hunk .gpv-dc { color: #57606a; font-style: italic; }
    .gpv-msg { padding: 20px; text-align: center; opacity: .5; font-size: 13px; }

    /* sidebar popup */
    #gpv-sidebar-popup {
      display: none; position: fixed; right: 16px; top: 72px; z-index: 9999;
      background: var(--bgColor-default,#fff);
      border: 1px solid var(--borderColor-default,#d0d7de);
      border-radius: 8px; width: 260px; max-height: 80vh; overflow-y: auto;
      box-shadow: 0 8px 24px rgba(0,0,0,.18);
    }
    .gpv-popup-head {
      display: flex; align-items: center; justify-content: space-between;
      padding: 8px 12px; border-bottom: 1px solid var(--borderColor-muted,#d8dee4);
      font-weight: 700; font-size: 12px; position: sticky; top: 0;
      background: var(--bgColor-default,#fff);
    }
    .gpv-popup-close { border: none; background: none; cursor: pointer; font-size: 14px; opacity: .6; padding: 0; }

  `;

  // ── helpers ──────────────────────────────────────────────────────────────────
  function scrollToEl(el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.style.outline = '2px solid #0969da'; el.style.outlineOffset = '3px';
    setTimeout(() => { el.style.outline = ''; el.style.outlineOffset = ''; }, 1200);
  }

  function navItem(icon, label, sub, colorCls, onClick) {
    const el = document.createElement('div');
    el.className = 'gpv-nav-item' + (colorCls ? ' ' + colorCls : '');
    el.innerHTML = `<span class="ni">${icon}</span><span class="nl">${label}${sub ? `<span class="nb">${sub}</span>` : ''}`;
    el.addEventListener('click', onClick);
    return el;
  }

  function navGroup(label) {
    const g = document.createElement('div');
    g.className = 'gpv-nav-group';
    if (label) g.innerHTML = `<div class="gpv-nav-group-label">${label}</div>`;
    return g;
  }

  function navSep() {
    const d = document.createElement('div'); d.className = 'gpv-nav-sep'; return d;
  }

  function getSidebarVal(heading) {
    const item = [...document.querySelectorAll('.discussion-sidebar-item')]
      .find(el => el.querySelector('.discussion-sidebar-heading,.text-bold')?.innerText?.trim().startsWith(heading));
    if (!item) return 'None';
    const links = [...item.querySelectorAll('a[data-hovercard-type]')]
      .map(a => a.innerText?.trim() || a.querySelector('img')?.alt?.replace(/^@/, ''))
      .filter(Boolean);
    if (links.length) return links.slice(0, 3).join(', ');
    const imgs = [...item.querySelectorAll('img[alt]')]
      .map(i => i.alt?.replace(/^@/, '').trim())
      .filter(v => v && v !== 'avatar' && !v.includes(' ') && v.length > 1);
    if (imgs.length) return [...new Set(imgs)].slice(0, 3).join(', ');
    const labels = [...item.querySelectorAll('.IssueLabel,.Label')].map(l => l.innerText?.trim()).filter(Boolean);
    if (labels.length) return labels.slice(0, 3).join(', ');
    return 'None';
  }

  // ── restore original GitHub layout (used by toggle-off and tryBoot) ─────────
  function restoreOriginalLayout() {
    const content = document.querySelector('[class*="prc-PageLayout-PageLayoutContent"]');
    const convo   = document.querySelector('[class*="Conversations-module__layout"]');
    const pane    = document.querySelector('[class*="prc-PageLayout-PaneWrapper"]');
    const inner   = document.querySelector('[class*="prc-PageLayout-ContentWrapper"]');
    const root    = convo?.querySelector('[class*="prc-PageLayout-PageLayoutRoot"]');
    const socket  = convo?.querySelector('.js-socket-channel');
    if (content) content.style.cssText = '';
    if (convo)   convo.style.cssText   = '';
    if (pane)    pane.style.cssText    = '';
    if (inner)   inner.style.cssText   = '';
    if (root)    root.style.cssText    = '';
    if (socket)  { socket.style.overflow = ''; socket.style.height = ''; }
    document.documentElement.style.overflowX = '';
    document.body.style.overflowX = '';
  }

  // ── apply layout ─────────────────────────────────────────────────────────────
  function applyLayout() {
    const colH = window.innerHeight - 64 - 8;
    const content = document.querySelector('[class*="prc-PageLayout-PageLayoutContent"]');
    const convo   = document.querySelector('[class*="Conversations-module__layout"]');
    const col     = document.getElementById('gpv-diff-col');
    const nav     = document.getElementById('gpv-nav');
    if (!content || !convo || !col || !nav) return;

    // Outer container: sticky, fixed height, flex row
    content.style.cssText = `display:flex!important;flex-direction:row!important;align-items:flex-start!important;height:${colH}px!important;overflow:hidden!important;position:sticky!important;top:64px!important;`;

    // Left: convo scrolls as one unit, nav sticks inside it
    convo.style.cssText = `flex:0 0 50%!important;width:50%!important;max-width:50%!important;min-width:0!important;height:${colH}px!important;overflow-y:auto!important;overflow-x:hidden!important;box-sizing:border-box!important;display:flex!important;flex-direction:row!important;`;

    // Nav: sticky at top of convo scroll, always-visible scrollbar
    nav.style.cssText = `flex:0 0 176px!important;width:176px!important;min-width:176px!important;height:auto!important;max-height:${colH}px!important;overflow-y:scroll!important;overflow-x:hidden!important;position:sticky!important;top:0!important;align-self:flex-start!important;z-index:2!important;border-right:1px solid var(--borderColor-default,#d0d7de)!important;padding:12px 0 500px!important;font-size:12px!important;background:var(--bgColor-default,#fff)!important;`;

    // Fix inner wrappers that may have overflow:hidden blocking convo scroll
    const socketWrapper = convo.querySelector('.js-socket-channel:not(#gpv-nav)');
    if (socketWrapper) { socketWrapper.style.overflow = 'visible'; socketWrapper.style.height = 'auto'; }
    const innerRoot = convo.querySelector('[class*="prc-PageLayout-PageLayoutRoot"]');
    if (innerRoot) { innerRoot.style.overflow = 'visible'; innerRoot.style.height = 'auto'; innerRoot.style.maxHeight = 'none'; }

    // Right col: 50%, fixed height, independent scroll
    col.style.cssText = `flex:0 0 50%!important;width:50%!important;max-width:50%!important;min-width:0!important;height:${colH}px!important;overflow-y:auto!important;overflow-x:hidden!important;border-left:2px solid var(--borderColor-default,#d0d7de)!important;box-sizing:border-box!important;`;

    // Nav wheel events: stay in nav, don't bubble to convo
    nav.addEventListener('wheel', (e) => {
      e.stopPropagation();
      nav.scrollTop += e.deltaY;
      e.preventDefault();
    }, { passive: false });

    // Hide original sidebar pane
    const pane = document.querySelector('[class*="prc-PageLayout-PaneWrapper"]');
    if (pane) pane.style.cssText = 'display:none!important;';

    // Suppress horizontal scroll from any GitHub-injected iframes
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
  }

  // ── render diff file ─────────────────────────────────────────────────────────
  function renderFileDiff(f) {
    const stMap = { added: 'add', removed: 'del', renamed: 'ren', modified: 'mod', changed: 'mod' };
    const st = stMap[f.status] || 'mod';
    const stColors = { add: '#2da44e', del: '#cf222e', ren: '#9a6700', mod: '#0969da' };
    const body = f.patch
      ? f.patch.split('\n').map(line => {
          const t = line.startsWith('@@') ? 'hunk' : line.startsWith('+') ? 'add' : line.startsWith('-') ? 'del' : 'ctx';
          const s = t === 'add' ? '+' : t === 'del' ? '−' : t === 'hunk' ? '⋯' : ' ';
          return `<div class="gpv-dl ${t}"><span class="gpv-ds">${s}</span><span class="gpv-dc">${esc(t === 'hunk' ? line : line.slice(1))}</span></div>`;
        }).join('')
      : `<div style="padding:8px 10px;opacity:.55;font-style:italic;font-size:11px">binary or empty file</div>`;
    return `<details class="gpv-file" open>
      <summary class="gpv-file-hdr">
        <span class="gpv-st" style="background:${stColors[st]}">${st.toUpperCase()}</span>
        <span class="gpv-fname" title="${esc(f.filename)}">${esc(f.filename)}</span>
        <span class="gpv-fstats"><span class="gpv-a">+${f.additions}</span><span class="gpv-d">−${f.deletions}</span></span>
      </summary>
      <div style="overflow-x:auto">${body}</div>
    </details>`;
  }

  // ── API fetchers ─────────────────────────────────────────────────────────────
  async function fetchAll(url) {
    let items = [], page = 1;
    while (true) {
      const r = await fetch(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      if (!r.ok) throw new Error(`API ${r.status}`);
      const d = await r.json();
      if (!Array.isArray(d) || !d.length) break;
      items = items.concat(d);
      if (d.length < 100) break;
      page++;
    }
    return items;
  }

  // ── build nav ────────────────────────────────────────────────────────────────
  function buildNav(checkRuns) {
    document.getElementById('gpv-nav')?.remove();
    document.getElementById('gpv-sidebar-popup')?.remove();

    const nav = document.createElement('div');
    nav.id = 'gpv-nav';
    nav.innerHTML = `<div class="gpv-nav-head">🧭 Quick Nav</div>`;

    // Sidebar popup
    const popup = document.createElement('div');
    popup.id = 'gpv-sidebar-popup';
    const pane = document.querySelector('[class*="prc-PageLayout-PaneWrapper"]');
    if (pane) {
      const head = document.createElement('div');
      head.className = 'gpv-popup-head';
      head.innerHTML = '<span>PR Details</span>';
      const closeBtn = document.createElement('button');
      closeBtn.className = 'gpv-popup-close'; closeBtn.textContent = '✕';
      closeBtn.addEventListener('click', () => popup.style.display = 'none');
      head.appendChild(closeBtn);
      const inner = document.createElement('div');
      inner.style.padding = '8px 0';
      const clone = pane.cloneNode(true);
      clone.style.cssText = 'display:block!important;position:static!important;width:auto!important;max-height:none!important;';
      inner.appendChild(clone);
      popup.appendChild(head);
      popup.appendChild(inner);
    }
    document.body.appendChild(popup);
    document.addEventListener('click', e => {
      if (!popup.contains(e.target) && !e.target.closest('#gpv-nav')) popup.style.display = 'none';
    });

    // PR Details
    const infoGroup = navGroup('PR Details');
    [{ label: 'Reviewers', icon: '👥' }, { label: 'Assignees', icon: '🙋' },
     { label: 'Labels', icon: '🏷' }, { label: 'Milestone', icon: '🚀' }].forEach(s => {
      const val = getSidebarVal(s.label);
      infoGroup.appendChild(navItem(s.icon, s.label, val, '', () => {
        popup.style.display = popup.style.display === 'none' ? 'block' : 'none';
      }));
    });
    const participantEl = [...document.querySelectorAll('.discussion-sidebar-item')]
      .find(el => el.innerText?.includes('participant'));
    if (participantEl) {
      const pText = participantEl.innerText?.trim().split('\n')[0]?.trim();
      infoGroup.appendChild(navItem('👤', 'Participants', pText, '', () => {}));
    }
    nav.appendChild(infoGroup);

    // CI status
    if (checkRuns?.length) {
      const failed = checkRuns.filter(r => r.conclusion === 'failure' || r.conclusion === 'timed_out');
      nav.appendChild(navSep());
      const ciGroup = navGroup('');
      ciGroup.appendChild(navItem(failed.length ? '❌' : '✅', 'CI Checks',
        failed.length ? `${failed.length} failing` : `${checkRuns.length} passing`,
        failed.length ? 'red' : 'green',
        () => document.getElementById('gpv-ci')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      ));
      nav.appendChild(ciGroup);
    }

    nav.appendChild(navSep());

    // Overview
    const ovGroup = navGroup('Overview');
    ovGroup.appendChild(navItem('⬆', 'Top', '', '', () => {
      const convo = document.querySelector('[class*="Conversations-module__layout"]');
      if (convo) convo.scrollTop = 0; else window.scrollTo({ top: 0, behavior: 'smooth' });
    }));
    const descEl = document.querySelector('.js-comment-body,[class*="comment-body"]');
    if (descEl) ovGroup.appendChild(navItem('📋', 'Description', '', '', () => scrollToEl(descEl)));
    nav.appendChild(ovGroup);
    nav.appendChild(navSep());

    // Timeline
    const tlGroup = navGroup('Timeline');
    let tlCount = 0;
    document.querySelectorAll('.TimelineItem').forEach(item => {
      if (item.querySelector('textarea,[class*="CommentBox"]')) return;
      const body = item.querySelector('.TimelineItem-body');
      if (!body) return;
      const txt = body.innerText?.trim().replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ');
      if (!txt || txt.length < 5 || txt.includes('Nothing to preview') || txt.includes('Write\nPreview')) return;

      const author = item.querySelector('a.author, strong')?.textContent?.trim() || txt.split(' ')[0];
      let icon = '•', label = txt.slice(0, 34), sub = '', cls = '';

      if (txt.includes('requested changes')) {
        icon = '🔴'; label = `${author} — changes requested`; cls = 'red';
      } else if (txt.match(/\bapproved\b/i) && !txt.includes('force-push') && !txt.includes('commit')) {
        icon = '✅'; label = `${author} — approved`; cls = 'green';
      } else if (txt.includes('reviewed') || txt.includes('left a comment')) {
        icon = '💬'; label = txt.slice(0, 34);
      } else if (item.id?.startsWith('commits-pushed')) {
        icon = '🔖'; const m = txt.match(/added (\d+) commit/);
        sub = m?.[0] || ''; label = 'Commits pushed';
      } else if (txt.includes('force-pushed')) {
        icon = '⚡'; label = 'Force push';
        sub = txt.match(/from .{0,10} to .{0,10}/)?.[0]?.slice(0, 28) || '';
      } else if (txt.includes('self-assigned') || txt.match(/^[^ ]+ assigned/)) {
        icon = '🙋'; label = txt.slice(0, 32);
      } else if (txt.match(/SQUARE-\d+:|^[a-f0-9]{7,}/i) && item.classList.contains('TimelineItem--condensed')) {
        icon = '·'; label = txt.replace(/[a-f0-9]{7,}$/, '').trim().slice(0, 34);
        sub = txt.match(/[a-f0-9]{7}$/)?.[0] || '';
      } else { return; }

      tlGroup.appendChild(navItem(icon, label, sub, cls, () => scrollToEl(item)));
      tlCount++;
    });
    if (tlCount) { nav.appendChild(tlGroup); nav.appendChild(navSep()); }

    // Bottom
    const btGroup = navGroup('');
    btGroup.appendChild(navItem('⬇', 'Bottom', '', '', () => {
      const convo = document.querySelector('[class*="Conversations-module__layout"]');
      if (convo) convo.scrollTop = convo.scrollHeight; else window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    }));
    nav.appendChild(btGroup);

    // Prepend nav into convo layout
    const convo = document.querySelector('[class*="Conversations-module__layout"]');
    if (convo) convo.prepend(nav);
  }

  // ── build right column ───────────────────────────────────────────────────────
  function buildRightCol(commits, files, checkRuns) {
    document.getElementById('gpv-diff-col')?.remove();
    const content = document.querySelector('[class*="prc-PageLayout-PageLayoutContent"]');
    if (!content) return;

    const { owner, repo } = prInfo();
    const baseURL = `https://github.com/${owner}/${repo}/commit/`;

    const failed  = checkRuns.filter(r => r.conclusion === 'failure' || r.conclusion === 'timed_out');
    const passing = checkRuns.filter(r => r.conclusion === 'success');
    const other   = checkRuns.filter(r => !['failure', 'timed_out', 'success'].includes(r.conclusion));
    const iconFor = c => ({ success: '✅', failure: '❌', timed_out: '⏱', skipped: '⏭', neutral: '⚪' }[c] || '🔄');
    const colorFor= c => ({ failure: '#cf222e', timed_out: '#cf222e', success: '#2da44e', skipped: '#57606a' }[c] || '#24292f');
    const levelIcon=l => ({ failure: '❌', warning: '⚠️', notice: 'ℹ️' }[l] || '•');

    const col = document.createElement('div');
    col.id = 'gpv-diff-col';

    // Toolbar
    const toolbar = document.createElement('div');
    toolbar.id = 'gpv-diff-toolbar';
    toolbar.innerHTML = `<strong style="font-size:12px;white-space:nowrap">🔍 PR Overview</strong><span style="flex:1"></span>`;
    const topBtn = document.createElement('button');
    topBtn.textContent = '↑ top';
    topBtn.style.cssText = 'padding:2px 7px;border-radius:5px;font-size:11px;cursor:pointer;border:1px solid var(--borderColor-default,#d0d7de);background:var(--bgColor-default,#fff)';
    topBtn.addEventListener('click', () => col.scrollTo({ top: 0, behavior: 'smooth' }));
    toolbar.appendChild(topBtn);
    col.appendChild(toolbar);

    // CI section
    const ciDiv = document.createElement('div');
    ciDiv.id = 'gpv-ci';
    const badgeCls  = failed.length ? 'fail' : 'pass';
    const badgeText = failed.length ? `${failed.length} failing` : `${checkRuns.length} passing`;

    function renderCheckRow(r, annotationsMap) {
      const isFail = r.conclusion === 'failure' || r.conclusion === 'timed_out';
      const anns   = (annotationsMap || {})[r.id] || [];
      const errs   = anns.filter(a => a.annotation_level === 'failure');
      const warns  = anns.filter(a => a.annotation_level === 'warning');
      let annHTML  = '';
      if (isFail) {
        const annRows = anns.map(a => `
          <div style="display:flex;gap:6px;padding:5px 8px;border-radius:4px;margin-bottom:4px;background:${a.annotation_level === 'failure' ? '#ffebe9' : a.annotation_level === 'warning' ? '#fff8c5' : '#f6f8fa'}">
            <span style="flex-shrink:0">${levelIcon(a.annotation_level)}</span>
            <div style="min-width:0">
              ${a.title ? `<div style="font-size:11px;font-weight:600;color:${a.annotation_level === 'failure' ? '#cf222e' : '#9a6700'};margin-bottom:2px">${esc(a.title)}</div>` : ''}
              <div style="font-size:11px;line-height:1.4;word-break:break-word;overflow-wrap:break-word">${esc((a.message || '').slice(0, 300))}${(a.message || '').length > 300 ? '…' : ''}</div>
              ${a.path && a.start_line ? `<div style="font-size:10px;opacity:.6;margin-top:2px;font-family:monospace">${esc(a.path)}:${a.start_line}</div>` : ''}
            </div>
          </div>`).join('');
        annHTML = `<div style="padding:6px 6px 4px">
          ${anns.length ? `<div style="font-size:11px;font-weight:600;margin-bottom:5px;color:#cf222e">${errs.length} error${errs.length !== 1 ? 's' : ''} · ${warns.length} warning${warns.length !== 1 ? 's' : ''}</div>${annRows}` : '<div style="font-size:11px;opacity:.6;padding:4px 0">No annotation details available</div>'}
          <a href="${esc(r.html_url || '#')}" target="_blank" style="display:inline-flex;align-items:center;gap:4px;margin-top:6px;font-size:11px;padding:4px 10px;border-radius:5px;background:#0969da;color:#fff;text-decoration:none;font-weight:600">📋 View full job logs ↗</a>
        </div>`;
      }
      return `<div style="margin-bottom:${isFail ? 8 : 2}px">
        <div class="gpv-check-row ${isFail ? 'fail' : ''}">
          <span>${iconFor(r.conclusion || r.status)}</span>
          <span class="gpv-check-name" style="color:${colorFor(r.conclusion)}">${esc(r.name)}</span>
          ${!isFail ? `<a href="${esc(r.html_url || '#')}" target="_blank">↗</a>` : ''}
        </div>
        ${annHTML}
      </div>`;
    }

    ciDiv.innerHTML = `<h3>🔬 CI Checks (${checkRuns.length}) <span class="gpv-ci-badge ${badgeCls}">${badgeText}</span></h3>
      <div id="gpv-ci-rows"><div class="gpv-msg">loading annotations…</div></div>
      ${passing.length + other.length > 0 ? `<details style="margin-top:4px"><summary>${passing.length} passing${other.length ? ` · ${other.length} other` : ''}</summary><div id="gpv-ci-passing"></div></details>` : ''}`;
    col.appendChild(ciDiv);

    // Commits section
    const commitsDiv = document.createElement('div');
    commitsDiv.id = 'gpv-commits';
    commitsDiv.innerHTML = `<h3>🔖 Commits (${commits.length})</h3>` +
      commits.map(c => {
        const sha = c.sha?.slice(0, 7);
        const msg = (c.commit?.message?.split('\n')[0] || '').replace(/^[A-Z]+-\d+:\s*/i, '').slice(0, 60);
        const author = c.author?.login || c.commit?.author?.name?.split(' ')[0] || '';
        return `<div class="gpv-commit">
          <a class="gpv-commit-sha" href="${baseURL}${c.sha}" target="_blank" title="${esc(c.commit?.message?.split('\n')[0] || '')}">${sha}</a>
          <span class="gpv-commit-msg" title="${esc(c.commit?.message?.split('\n')[0] || '')}">${esc(msg)}</span>
          <span class="gpv-commit-author">@${esc(author)}</span>
        </div>`;
      }).join('');
    col.appendChild(commitsDiv);

    // Files section
    const filesSection = document.createElement('div');
    filesSection.id = 'gpv-files-section';
    filesSection.innerHTML = `<h3>📂 Files Changed (${files.length})</h3>`;
    const fileToolbar = document.createElement('div');
    fileToolbar.className = 'gpv-file-toolbar';
    const searchInput = document.createElement('input');
    searchInput.type = 'text'; searchInput.placeholder = 'filter files…'; searchInput.autocomplete = 'off';
    const expandBtn  = document.createElement('button'); expandBtn.textContent = '⊞ expand';
    const collapseBtn= document.createElement('button'); collapseBtn.textContent = '⊟ collapse';
    const diffBody   = document.createElement('div');
    diffBody.id = 'gpv-diff-body';
    diffBody.innerHTML = files.map(renderFileDiff).join('');
    searchInput.addEventListener('input', function () {
      const q = this.value.toLowerCase();
      diffBody.querySelectorAll('.gpv-file').forEach(f => {
        f.style.display = f.querySelector('.gpv-fname')?.textContent?.toLowerCase().includes(q) ? '' : 'none';
      });
    });
    expandBtn.addEventListener('click',   () => diffBody.querySelectorAll('.gpv-file').forEach(f => f.open = true));
    collapseBtn.addEventListener('click', () => diffBody.querySelectorAll('.gpv-file').forEach(f => f.open = false));
    fileToolbar.appendChild(searchInput);
    fileToolbar.appendChild(expandBtn);
    fileToolbar.appendChild(collapseBtn);
    filesSection.appendChild(fileToolbar);
    filesSection.appendChild(diffBody);
    col.appendChild(filesSection);

    content.appendChild(col);

    // Fetch annotations async after col is in DOM
    const { owner: o, repo: rp } = prInfo();
    (async () => {
      const annotationsMap = {};
      await Promise.all(failed.map(async r => {
        try {
          const d = await fetch(`https://api.github.com/repos/${o}/${rp}/check-runs/${r.id}/annotations`).then(x => x.json());
          annotationsMap[r.id] = Array.isArray(d) ? d : [];
        } catch { annotationsMap[r.id] = []; }
      }));
      const ciRows = document.getElementById('gpv-ci-rows');
      if (ciRows) ciRows.innerHTML = failed.map(r => renderCheckRow(r, annotationsMap)).join('') || '<div class="gpv-msg">All checks passing</div>';
      const ciPassing = document.getElementById('gpv-ci-passing');
      if (ciPassing) ciPassing.innerHTML = [...passing, ...other].map(r => renderCheckRow(r, {})).join('');
    })();
  }

  // ── toggle + persistence ─────────────────────────────────────────────────────
  const STORAGE_KEY = 'gpv-power-view';

  function buildToggle() {
    document.getElementById('gpv-toggle-btn')?.remove();
    const btn = document.createElement('button');
    btn.id = 'gpv-toggle-btn';
    let powerOn = localStorage.getItem(STORAGE_KEY) !== 'off';
    btn.textContent = powerOn ? '⊡ Original view' : '⚡ Power view';
    if (!powerOn) btn.classList.add('original');

    btn.addEventListener('click', () => {
      powerOn = !powerOn;
      localStorage.setItem(STORAGE_KEY, powerOn ? 'on' : 'off');
      if (powerOn) {
        // Re-run full boot — elements may not exist if page loaded in off state
        document.getElementById('gpv-style-main').disabled = false;
        ['gpv-nav', 'gpv-diff-col', 'gpv-sidebar-popup'].forEach(id => document.getElementById(id)?.remove());
        restoreOriginalLayout();
        btn.textContent = '⊡ Original view';
        btn.classList.remove('original');
        bootPowerView(); // full rebuild
      } else {
        ['gpv-nav', 'gpv-diff-col', 'gpv-sidebar-popup'].forEach(id => document.getElementById(id)?.remove());
        document.getElementById('gpv-style-main').disabled = true;
        restoreOriginalLayout();
        btn.textContent = '⚡ Power view';
        btn.classList.add('original');
      }
    });
    document.body.appendChild(btn);
    return powerOn;
  }

  // ── core power view builder (called by boot and toggle-on) ──────────────────
  async function bootPowerView() {
    const info = prInfo();
    if (!info) return;
    try {
      const [prData, commits, files] = await Promise.all([
        fetch(`https://api.github.com/repos/${info.owner}/${info.repo}/pulls/${info.pr}`).then(r => r.json()),
        fetchAll(`https://api.github.com/repos/${info.owner}/${info.repo}/pulls/${info.pr}/commits`),
        fetchAll(`https://api.github.com/repos/${info.owner}/${info.repo}/pulls/${info.pr}/files`),
      ]);
      let checkRuns = [];
      if (prData?.head?.sha) {
        const d = await fetch(`https://api.github.com/repos/${info.owner}/${info.repo}/commits/${prData.head.sha}/check-runs?per_page=100`).then(r => r.json());
        checkRuns = d.check_runs || [];
      }
      buildNav(checkRuns.length ? checkRuns : null);
      buildRightCol(commits, files, checkRuns);
      applyLayout();
    } catch (e) {
      console.warn('[GPV] boot error:', e.message);
      buildNav(null);
      buildRightCol([], [], []);
      applyLayout();
    }
  }

  // ── boot ─────────────────────────────────────────────────────────────────────
  async function boot() {
    if (!isPRConvo()) return;
    if (document.getElementById('gpv-diff-col')) return; // already booted
    const powerOn = buildToggle();
    if (!powerOn) return; // user toggled off — show button only, don't build
    await bootPowerView();
  }

  // Boot + re-boot on Turbo navigation
  function tryBoot() {
    if (!isPRConvo()) return;
    ['gpv-nav','gpv-diff-col','gpv-sidebar-popup','gpv-toggle-btn'].forEach(id => document.getElementById(id)?.remove());
    restoreOriginalLayout();
    setTimeout(boot, 700);
  }

  if (document.readyState === 'complete') setTimeout(boot, 700);
  else window.addEventListener('load', () => setTimeout(boot, 700));
  document.addEventListener('turbo:render', tryBoot);
  document.addEventListener('pjax:end',     tryBoot);
})();
