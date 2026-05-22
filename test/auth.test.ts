import test from 'node:test';
import assert from 'node:assert/strict';
import { isAuthorized } from '../src/auth.ts';

test('isAuthorized allows open mode when no key configured', () => {
  assert.equal(isAuthorized(undefined, undefined), true);
});

test('isAuthorized requires exact API key when configured', () => {
  assert.equal(isAuthorized('secret', 'secret'), true);
  assert.equal(isAuthorized('wrong', 'secret'), false);
  assert.equal(isAuthorized(undefined, 'secret'), false);
});
