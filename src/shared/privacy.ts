// Keep only public content identifiers. Remove credentials, tracking, fragments and search terms.
export function cleanUrl(raw: string): string {
  try {
    const u = new URL(raw);
    if (!['http:', 'https:'].includes(u.protocol)) return '';
    u.username = ''; u.password = ''; u.hash = '';
    const video = /(^|\.)youtube\.com$/.test(u.hostname) && u.pathname === '/watch' ? u.searchParams.get('v') : null;
    u.search = '';
    if (video && /^[\w-]{6,20}$/.test(video)) u.searchParams.set('v', video);
    u.pathname = u.pathname.split('/').map(s => s.includes('@') || /%40/i.test(s) || /^(?:eyJ|sk-|ghp_)/.test(s) || s.length > 100 ? '[redacted]' : s).join('/');
    return u.toString().slice(0, 1600);
  } catch { return ''; }
}
export function redact(text: string, limit = 4000): string {
  return text.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, '[email]')
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, '[number]')
    .replace(/\b(?:Bearer\s+|sk-|ghp_|eyJ)[\w.\-/+=]{12,}/gi, '[secret]')
    .replace(/\b(password|passwd|api[_ -]?key|token|secret|пароль)\s*[:=]\s*\S+/gi, '$1=[redacted]')
    .replace(/https?:\/\/[^\s<>"']+/g, cleanUrl).replace(/\s+/g, ' ').trim().slice(0, limit);
}
export function excluded(url: string, sites: string[]): boolean {
  try { const host = new URL(url).hostname.toLowerCase(); return sites.some(s => host === s || host.endsWith('.' + s)); } catch { return true; }
}
export function normalizeSites(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map(s => s.trim().toLowerCase()).filter(Boolean).map(s => { try { return new URL(s.includes('://') ? s : 'https://' + s).hostname; } catch { return ''; } }).filter(Boolean))].slice(0, 100);
}
export function contextKey(url: string, title: string, text = ''): string {
  // Local fingerprint includes full URL (never transmitted) to avoid allowing different query-based pages.
  const value = url + '\n' + title + '\n' + text;
  let a = 2166136261, b = 5381;
  for (let i = 0; i < value.length; i++) { a = Math.imul(a ^ value.charCodeAt(i), 16777619); b = Math.imul(b, 33) ^ value.charCodeAt(i); }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}
