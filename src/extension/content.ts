import catLogo from '../../public/brand/tabby/tabby-mark-task.svg';
// Runs in Chrome's isolated world. No page-defined callbacks, HTML or code are evaluated.
(() => {
  const global = globalThis as typeof globalThis & { __tabbyLoaded?: boolean };
  if (global.__tabbyLoaded) return; global.__tabbyLoaded = true;
  let observer: MutationObserver | undefined; let debounce: ReturnType<typeof setTimeout> | undefined;
  let host: HTMLElement | undefined; let leaseTimer: ReturnType<typeof setInterval> | undefined;
  let expiry = 0; let signature = ''; let readText = false; let observing = false; let lastHref = location.href;
  const ignored = 'input,textarea,select,option,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"],script,style,noscript,form,[hidden],[aria-hidden="true"],[data-private],[data-sensitive],#tabby-reminder';
  function visibleText(): string {
    const result: string[] = []; let length = 0;
    // Only rendered prose in the viewport. Never read input values, forms, hidden or editable nodes.
    const root = document.querySelector('main,article,[role="main"]') || document.body;
    if (!root) return '';
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let visited = 0; let node: Node | null;
    while ((node = walker.nextNode()) && visited++ < 8000 && length < 4000) {
      const el = node.parentElement;
      if (!el || el.closest(ignored) || !el.closest('p,h1,h2,h3,h4,li,article,main,[role="main"]')) continue;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height || rect.bottom < 0 || rect.top > innerHeight) continue;
      if (!el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) continue;
      const text = node.textContent?.trim(); if (text) { result.push(text); length += text.length; }
    }
    return result.join(' ').replace(/\s+/g, ' ').slice(0, 4000);
  }
  function fingerprint() {
    const value = location.href + document.title + (readText ? visibleText().slice(0, 1600) : ''); let hash = 0;
    for (let i = 0; i < value.length; i++) hash = (Math.imul(hash, 31) + value.charCodeAt(i)) | 0;
    return String(hash);
  }
  function changed() {
    if (!observing || document.visibilityState !== 'visible') return;
    // Navigation always releases an old restriction immediately, including SPA navigation.
    if (lastHref !== location.href) { lastHref = location.href; unblock(); }
    clearTimeout(debounce);
    debounce = setTimeout(() => { const next = fingerprint(); if (next !== signature) { signature = next; unblock(); void chrome.runtime.sendMessage({ type: 'PAGE_CHANGED' }).catch(stop); } }, 1800);
  }
  function unblock() { host?.remove(); host = undefined; clearInterval(leaseTimer); leaseTimer = undefined; }
  function stop() { observing = false; observer?.disconnect(); observer = undefined; clearTimeout(debounce); document.removeEventListener('visibilitychange', changed); window.removeEventListener('popstate', changed); unblock(); }
  function start(text: boolean) {
    observer?.disconnect(); observing = true; readText = text; signature = fingerprint(); lastHref = location.href;
    observer = new MutationObserver(changed); observer.observe(document.documentElement, { subtree: true, childList: true, characterData: true });
    document.addEventListener('visibilitychange', changed); window.addEventListener('popstate', changed);
  }
  function remind(message: any) {
    unblock(); expiry = message.expiresAt;
    host = document.createElement('div'); host.id = 'tabby-reminder';
    host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
    const shadow = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style'); style.textContent = `*{box-sizing:border-box}.wrap{font:15px/1.55 system-ui,sans-serif;color:#272923;position:fixed;right:24px;bottom:24px;width:min(370px,calc(100vw - 40px));pointer-events:auto;background:#fff8f2;border:1px solid #f3cdb8;box-shadow:0 16px 70px #50301b26;border-radius:22px;padding:24px}.strict{inset:0;width:100%;height:100%;border:0;border-radius:0;display:grid;place-content:center;background:#f6f5f0f2;backdrop-filter:blur(7px);padding:max(24px,10vw)}.body{max-width:520px;margin:auto}h2{font-size:26px;line-height:1.15;margin:14px 0}p{color:#77796f;margin:12px 0}.brand{display:flex;align-items:center;gap:7px;font-size:19px;letter-spacing:-.7px;color:#a54a28;font-weight:800}button{font:inherit;background:#ff7745;color:#272923;border:0;border-radius:10px;padding:10px 14px;cursor:pointer;margin:5px 5px 0 0}.light{background:#ffe2d3;color:#7c3b24}.stop{display:block;background:transparent;color:#654d41;text-decoration:underline;padding-left:0}.note{font-size:12px;color:#77796f}`;
    shadow.append(style);
    const wrap = document.createElement('div'); wrap.className = message.strict ? 'wrap strict' : 'wrap'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Tabby');
    const body = document.createElement('div'); body.className = 'body';
    const brand = document.createElement('div'); brand.className = 'brand'; brand.textContent = 'tabby'; const mark = document.createElement('img'); mark.src = catLogo; mark.alt = ''; mark.width = 26; mark.height = 26; brand.prepend(mark);
    const title = document.createElement('h2'); title.textContent = 'Back to what matters?';
    const goal = document.createElement('strong'); goal.textContent = String(message.goal || '').slice(0, 1000);
    const reason = document.createElement('p'); reason.textContent = String(message.reason || '').slice(0, 600);
    body.append(brand, title, goal, reason);
    const add = (label: string, type: string, className = '') => { const button = document.createElement('button'); button.textContent = label; button.className = className; button.onclick = () => { unblock(); void chrome.runtime.sendMessage({ type, minutes: 5 }).catch(stop); }; body.append(button); };
    add('This is relevant', 'CORRECT'); add('5-minute break', 'BREAK', 'light'); add('Stop session', 'STOP', 'stop');
    const note = document.createElement('p'); note.className = 'note'; note.textContent = 'Your page and inputs are preserved. Escape dismisses this reminder.'; body.append(note);
    wrap.append(body); shadow.append(wrap); document.documentElement.append(host);
    leaseTimer = setInterval(async () => {
      if (Date.now() >= expiry || location.href !== lastHref) { unblock(); return; }
      if (!message.strict) return;
      try { const result = await chrome.runtime.sendMessage({ type: 'LEASE' }); if (!result?.allowed) unblock(); } catch { unblock(); }
    }, 3000);
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') unblock(); });
  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (sender.id !== chrome.runtime.id) return;
    switch (message.type) {
      case 'READ_PAGE': reply({ text: visibleText() }); break;
      case 'OBSERVE': start(!!message.readText); reply({ ok: true }); break;
      case 'STOP_OBSERVING': stop(); reply({ ok: true }); break;
      case 'UNBLOCK': unblock(); reply({ ok: true }); break;
      case 'REMIND': remind(message); reply({ ok: true }); break;
      case 'RENEW': expiry = message.expiresAt; reply({ ok: true }); break;
    }
  });
})();
