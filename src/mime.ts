import * as path from 'node:path';
import * as mime from 'mime-types';
const overrides: Record<string,string>={'.ts':'text/plain','.tsx':'text/plain','.mjs':'text/javascript','.cjs':'text/javascript','.go':'text/plain','.rs':'text/plain','.cs':'text/plain','.cpp':'text/plain','.cxx':'text/plain','.cc':'text/plain','.c':'text/plain','.h':'text/plain','.hpp':'text/plain','.kt':'text/plain','.swift':'text/plain','.toml':'text/plain','.ini':'text/plain','.cfg':'text/plain','.conf':'text/plain','.env':'text/plain','.sql':'text/plain','.log':'text/plain','.lock':'text/plain'};
export function getMime(name:string): string { return overrides[path.extname(name).toLowerCase()] || mime.lookup(name) || 'application/octet-stream'; }
export function isPreviewable(m:string): boolean { return m.startsWith('text/') || ['application/json','application/xml','application/javascript','image/svg+xml'].includes(m); }
