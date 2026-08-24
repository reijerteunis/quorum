import { expect, test } from 'vitest';

import { name } from './index.js';

test('@quorum/web is scaffolded', () => {
  expect(name).toBe('@quorum/web');
});
