import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import Docker from 'dockerode';
import * as fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import * as path from 'node:path';
import * as tar from 'tar-stream';
import { Readable } from 'node:stream';
import { authMiddleware, API_KEY_ENV, configuredApiKey } from './auth.js';
import { sanitizeDockerPath, parentPath } from './path.js';
import { getMime, isPreviewable } from './mime.js';

const docker = new Docker({ socketPath: process.env.DOCKER_SOCKET || '/var/run/docker.sock' });
const app = new Hono();
const PORT = Number(process.env.PORT || 3000);
const PUBLIC_DIR = path.resolve(process.env.PUBLIC_DIR || path.join(process.cwd(), 'public'));
const MAX_FILE_BYTES = Number(process.env.MAX_FILE_BYTES || 10 * 1024 * 1024);

app.use('/api/*', authMiddleware);

app.get('/api/health', c => c.json({ status: 'ok', readOnly: true, authConfigured: Boolean(configuredApiKey()), keyEnv: API_KEY_ENV }));

app.get('/api/openapi.json', c => c.json(openapi()));

app.get('/api/docker/info', async c => c.json(await docker.info()));
app.get('/api/docker/version', async c => c.json(await docker.version()));
app.get('/api/images', async c => c.json({ images: await docker.listImages({ all: true }) }));
app.get('/api/containers', async c => {
  const all = c.req.query('all') !== 'false';
  const containers = await docker.listContainers({ all });
  return c.json({ containers: containers.map(ct => ({ id: ct.Id, shortId: ct.Id.slice(0,12), names: ct.Names.map(n=>n.replace(/^\//,'')), image: ct.Image, imageId: ct.ImageID, command: ct.Command, created: new Date(ct.Created*1000).toISOString(), state: ct.State, status: ct.Status, ports: ct.Ports, labels: ct.Labels, mounts: ct.Mounts })) });
});
app.get('/api/containers/:id', async c => c.json(await docker.getContainer(c.req.param('id')).inspect()));
app.get('/api/containers/:id/logs', async c => {
  const tail = Number(c.req.query('tail') || 200);
  const buf = await docker.getContainer(c.req.param('id')).logs({ stdout:true, stderr:true, timestamps:true, tail });
  return c.json({ lines: stripDockerLogHeaders(buf).split('\n').filter(Boolean) });
});
app.get('/api/containers/:id/stats', async c => c.json(await docker.getContainer(c.req.param('id')).stats({ stream:false })));

app.get('/api/containers/:id/files', async c => {
  const requested = sanitizeDockerPath(c.req.query('path') || '/');
  const entries = await getContainerPathEntries(c.req.param('id'), requested);
  const items = entries.map(e => ({ name:e.name, path: requested === '/' ? '/' + e.name : requested + '/' + e.name, type: e.type, size: e.size ?? null, mode: e.mode, modified: e.mtime || null, mimeType: e.type === 'file' ? getMime(e.name) : null, isPreviewable: e.type === 'file' ? isPreviewable(getMime(e.name)) : false })).sort(sortEntries);
  return c.json({ containerId:c.req.param('id'), path: requested, parent: parentPath(requested), items });
});

app.get('/api/containers/:id/files/content', async c => {
  const requested = sanitizeDockerPath(c.req.query('path'));
  if (!c.req.query('path')) return c.json({ error:'path query parameter required' }, 400);
  const file = await getSingleContainerFile(c.req.param('id'), requested);
  if (!file) return c.json({ error:'file not found' }, 404);
  if (file.type !== 'file') return c.json({ error:'path is not a file' }, 400);
  const content = file.content ?? Buffer.alloc(0);
  if (content.length > MAX_FILE_BYTES) return c.json({ error:'file too large', maxBytes: MAX_FILE_BYTES, size: content.length }, 413);
  const mime = getMime(file.name);
  if (c.req.query('encoding') === 'base64' || !isLikelyText(content, mime)) return c.json({ path: requested, name:file.name, size:content.length, mimeType:mime, encoding:'base64', content:content.toString('base64') });
  return c.json({ path: requested, name:file.name, size:content.length, mimeType:mime, encoding:'utf8', content:content.toString('utf8') });
});

app.get('/api/containers/:id/files/raw', async c => {
  const requested = sanitizeDockerPath(c.req.query('path'));
  if (!c.req.query('path')) return c.json({ error:'path query parameter required' }, 400);
  const file = await getSingleContainerFile(c.req.param('id'), requested);
  if (!file || file.type !== 'file') return c.json({ error:'file not found' }, 404);
  return new Response(new Uint8Array(file.content ?? Buffer.alloc(0)), { headers: { 'content-type': getMime(file.name), 'content-disposition': `inline; filename="${file.name.replace(/"/g,'')}"` }});
});

app.get('/api/volumes', async c => c.json({ volumes: (await docker.listVolumes()).Volumes || [] }));
app.get('/api/volumes/:name', async c => c.json(await docker.getVolume(c.req.param('name')).inspect()));

app.get('/', async c => c.html(await fs.readFile(path.join(PUBLIC_DIR, 'index.html'), 'utf8')));
app.get('/app.js', async c => new Response(await fs.readFile(path.join(PUBLIC_DIR, 'app.js'), 'utf8'), { headers:{'content-type':'text/javascript'} }));
app.get('/styles.css', async c => new Response(await fs.readFile(path.join(PUBLIC_DIR, 'styles.css'), 'utf8'), { headers:{'content-type':'text/css'} }));

app.onError((err,c) => c.json({ error: err.message || 'internal error' }, 500));

export function stripDockerLogHeaders(input: Buffer | string): string { const raw = Buffer.isBuffer(input) ? input : Buffer.from(input); let out=''; for(let i=0;i<raw.length;){ if(i+8<=raw.length && [0,1,2].includes(raw[i])) { const len=raw.readUInt32BE(i+4); if(len>=0 && i+8+len<=raw.length){ out += raw.subarray(i+8,i+8+len).toString('utf8'); i += 8+len; continue; } } out += raw.subarray(i).toString('utf8'); break;} return out; }
type TarEntry={name:string; type:'file'|'directory'|'symlink'|'other'; size?:number; mode?:number; mtime?:Date; content?:Buffer};
function normalizeTarName(n:string){ return n.replace(/^\.\/?/,'').replace(/\/$/,''); }
function entryType(t:string): TarEntry['type'] { return t==='directory'?'directory':t==='file'?'file':t==='symlink'?'symlink':'other'; }
async function extractArchive(stream: NodeJS.ReadableStream, includeContent=false): Promise<TarEntry[]> { const extract=tar.extract(); const entries:TarEntry[]=[]; return await new Promise((resolve,reject)=>{ extract.on('entry',(header,s,next)=>{ const chunks:Buffer[]=[]; s.on('data',d=> includeContent && chunks.push(Buffer.from(d))); s.on('end',()=>{ entries.push({ name:path.basename(normalizeTarName(header.name || '')), type:entryType(header.type || 'file'), size:header.size, mode:header.mode, mtime:header.mtime, content: includeContent?Buffer.concat(chunks):undefined }); next(); }); s.resume(); }); extract.on('finish',()=>resolve(entries)); extract.on('error',reject); Readable.from(stream as any).pipe(extract).on('error',reject); }); }
async function getContainerPathEntries(id:string, p:string): Promise<TarEntry[]> { const stream = await docker.getContainer(id).getArchive({ path:p }); return extractArchive(stream, false); }
async function getSingleContainerFile(id:string, p:string): Promise<TarEntry | undefined> { const stream = await docker.getContainer(id).getArchive({ path:p }); return (await extractArchive(stream, true))[0]; }
function sortEntries(a:any,b:any){ if(a.type!==b.type) return a.type==='directory'?-1:1; return a.name.localeCompare(b.name); }
function isLikelyText(buf:Buffer,mime:string){ if(mime.startsWith('text/') || ['application/json','application/xml','application/javascript'].includes(mime)) return true; return !buf.subarray(0,2048).includes(0); }
function openapi(){ return { openapi:'3.1.0', info:{ title:'Docker Volume Viewer API', version:'0.1.0', description:'Read-only API for Docker containers, volumes, logs, metadata, and container filesystem content. Authenticate with Authorization: Bearer <DOCKER_VOLUME_VIEWER_API_KEY> or X-API-Key.'}, paths:{ '/api/containers':{get:{summary:'List containers'}}, '/api/containers/{id}/files':{get:{summary:'Browse files inside a container', parameters:[{name:'id',in:'path',required:true},{name:'path',in:'query',schema:{type:'string',default:'/'}}]}}, '/api/containers/{id}/files/content':{get:{summary:'Read a file inside a container as JSON text/base64'}}, '/api/containers/{id}/files/raw':{get:{summary:'Stream raw file bytes from inside a container'}}, '/api/volumes':{get:{summary:'List Docker volumes'}}, '/api/docker/info':{get:{summary:'Docker host info'}}}, components:{ securitySchemes:{ ApiKey:{ type:'http', scheme:'bearer'}}}, security:[{ApiKey:[]}]}; }

if (process.env.NODE_ENV !== 'test') serve({ fetch: app.fetch, port: PORT }, () => console.log(`docker-volume-viewer listening on :${PORT}`));
export default app;
