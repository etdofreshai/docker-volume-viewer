import test from 'node:test';
import assert from 'node:assert/strict';
import { stripDockerLogHeaders } from '../src/server.ts';

test('stripDockerLogHeaders decodes multiplexed docker log stream', () => {
  const msg = Buffer.from('hello\n');
  const frame = Buffer.alloc(8 + msg.length);
  frame[0] = 1;
  frame.writeUInt32BE(msg.length, 4);
  msg.copy(frame, 8);
  assert.equal(stripDockerLogHeaders(frame), 'hello\n');
});
