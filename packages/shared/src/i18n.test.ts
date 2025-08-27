import assert from 'node:assert';
import { test } from 'vitest';
import { l } from './i18n.js';

test('l returns translation for existing key', () => {
  assert.strictEqual(l('welcome'), 'Welcome');
});

test('l falls back to provided default', () => {
  assert.strictEqual(l('missing', 'fallback'), 'fallback');
});
