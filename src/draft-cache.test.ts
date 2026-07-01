import { describe, expect, test } from 'bun:test';

import { stagedDiffFingerprint } from './draft-cache';

describe('stagedDiffFingerprint', () => {
  test('changes when diff content changes but stat stays the same', () => {
    const stat = ' src/foo.ts | 2 +-\n 1 file changed, 1 insertion(+), 1 deletion(-)';
    const diffA = 'diff --git a/src/foo.ts b/src/foo.ts\n-old\n+new';
    const diffB = 'diff --git a/src/foo.ts b/src/foo.ts\n-old\n+other';

    expect(stagedDiffFingerprint(stat, diffA)).not.toBe(stagedDiffFingerprint(stat, diffB));
  });

  test('is stable for identical stat and diff', () => {
    const stat = ' README.md | 1 +\n 1 file changed, 1 insertion(+)';
    const diff = 'diff --git a/README.md b/README.md\n+# Title';

    expect(stagedDiffFingerprint(stat, diff)).toBe(stagedDiffFingerprint(stat, diff));
  });

  test('normalizes CRLF before hashing', () => {
    const stat = 'a.ts | 1 +\r\n';
    const diff = 'line one\r\nline two\r\n';

    expect(stagedDiffFingerprint(stat, diff)).toBe(stagedDiffFingerprint('a.ts | 1 +', 'line one\nline two'));
  });
});
