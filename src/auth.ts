import type { Context, Next } from 'hono';
import * as crypto from 'node:crypto';

export const API_KEY_ENV = 'DOCKER_VOLUME_VIEWER_API_KEY';

export function configuredApiKey(): string | undefined {
  const value = process.env[API_KEY_ENV] || process.env.VIEWER_TOKEN;
  return value && value.trim() ? value.trim() : undefined;
}

export function isAuthorized(provided: string | undefined, expected = configuredApiKey()): boolean {
  if (!expected) return true;
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export async function authMiddleware(c: Context, next: Next) {
  if (c.req.path === '/api/health' || c.req.path === '/api/openapi.json') return next();
  const auth = c.req.header('authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7) : undefined;
  const queryKey = c.req.query('api_key') || c.req.query('key') || undefined;
  const headerKey = c.req.header('x-api-key') || undefined;
  if (!isAuthorized(bearer || headerKey || queryKey)) return c.json({ error: 'Unauthorized' }, 401);
  return next();
}
