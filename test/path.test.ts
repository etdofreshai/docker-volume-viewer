import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDockerPath, parentPath } from '../src/path.ts';

test('sanitizeDockerPath keeps requests inside virtual root', () => {
  assert.equal(sanitizeDockerPath('../../etc/passwd'), '/etc/passwd');
  assert.equal(sanitizeDockerPath('/app//./data/../config.json'), '/app/config.json');
  assert.equal(sanitizeDockerPath('C:\\tmp\\file.txt'), '/C:/tmp/file.txt');
  assert.equal(sanitizeDockerPath('\0/var/log'), '/var/log');
});

test('parentPath returns virtual parent path', () => {
  assert.equal(parentPath('/app/config.json'), '/app');
  assert.equal(parentPath('/app'), '/');
  assert.equal(parentPath('/'), null);
});
