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

test('directArchiveChildren strips Docker archive root directory prefix', () => {
  const entries: TarEntry[] = [
    { name: 'node', type: 'directory' },
    { name: 'node/.ccrc', type: 'directory' },
    { name: 'node/.ccrc/agents.json', type: 'file', size: 10 },
    { name: 'node/.claude', type: 'directory' },
  ];
  assert.deepEqual(directArchiveChildren(entries).map(e => [e.name, e.type]), [['.ccrc','directory'], ['.claude','directory']]);
});
