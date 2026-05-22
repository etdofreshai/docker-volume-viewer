import test from 'node:test';
import assert from 'node:assert/strict';
import { directArchiveChildren, type TarEntry } from '../src/server.ts';

test('directArchiveChildren collapses recursive Docker archive entries to one directory level', () => {
  const entries: TarEntry[] = [
    { name: '.', type: 'directory' },
    { name: 'foo', type: 'directory' },
    { name: 'foo/bar.txt', type: 'file', size: 10 },
    { name: 'alpha.txt', type: 'file', size: 2 },
  ];
  assert.deepEqual(directArchiveChildren(entries).map(e => [e.name, e.type]), [['foo','directory'], ['alpha.txt','file']]);
});
