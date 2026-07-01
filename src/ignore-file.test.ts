import { describe, expect, test } from 'bun:test';

import { parseIgnoreFile } from './ignore-file';

describe('parseIgnoreFile', () => {
  test('skips blank lines and comments', () => {
    expect(
      parseIgnoreFile(`
# lockfiles
bun.lock

package-lock.json
# yarn.lock
`),
    ).toEqual(['bun.lock', 'package-lock.json']);
  });

  test('trims whitespace on each line', () => {
    expect(parseIgnoreFile('  bun.lock  \n  dist/**  ')).toEqual(['bun.lock', 'dist/**']);
  });

  test('returns empty array for comment-only file', () => {
    expect(parseIgnoreFile('# nothing here\n\n')).toEqual([]);
  });
});
