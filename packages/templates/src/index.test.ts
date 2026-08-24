import { expect, test } from 'vitest';

import { name } from './index.js';

test('@quorum/templates is scaffolded', () => {
  expect(name).toBe('@quorum/templates');
});
