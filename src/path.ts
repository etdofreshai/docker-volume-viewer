export function sanitizeDockerPath(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') return '/';
  let p = input.replace(/\0/g, '').replace(/\\/g, '/').replace(/\/+/g, '/');
  if (!p.startsWith('/')) p = '/' + p;
  const out: string[] = [];
  for (const part of p.split('/')) {
    if (!part || part === '.') continue;
    if (part === '..') { if (out.length) out.pop(); continue; }
    out.push(part);
  }
  return out.length ? '/' + out.join('/') : '/';
}

export function parentPath(p: string): string | null {
  const safe = sanitizeDockerPath(p);
  if (safe === '/') return null;
  const parts = safe.split('/').filter(Boolean);
  parts.pop();
  return parts.length ? '/' + parts.join('/') : '/';
}
