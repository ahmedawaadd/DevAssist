// test/ci-lib.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addedLines, guessLanguage, parseChatCompletion, parseStyleViolations } from '../ci/lib';

test('guessLanguage maps known extensions and defaults to plaintext', () => {
  assert.equal(guessLanguage('app/main.py'), 'python');
  assert.equal(guessLanguage('src/Component.tsx'), 'typescriptreact');
  assert.equal(guessLanguage('Main.JAVA'), 'java');
  assert.equal(guessLanguage('Dockerfile'), 'plaintext');
  assert.equal(guessLanguage('notes'), 'plaintext');
});

test('addedLines returns the new-side line numbers of added lines', () => {
  const patch = ['@@ -1,2 +1,3 @@', ' context', '+added one', '+added two', ' context'].join('\n');
  // hunk starts at new line 1: ctx=1, +2, +3, ctx=4 → added {2, 3}
  assert.deepEqual(
    [...addedLines(patch)].sort((a, b) => a - b),
    [2, 3],
  );
});

test('addedLines ignores removals and the +++ file header', () => {
  const patch = ['+++ b/file.py', '@@ -10,3 +10,2 @@', ' keep', '-removed', '+changed'].join('\n');
  // new side: keep=10, removed advances old side only, +changed=11 → {11}
  assert.deepEqual([...addedLines(patch)], [11]);
});

test('addedLines tracks line numbers across multiple hunks', () => {
  const patch = ['@@ -1 +1 @@', '+first', '@@ -20,2 +20,2 @@', ' ctx', '+second'].join('\n');
  assert.deepEqual(
    [...addedLines(patch)].sort((a, b) => a - b),
    [1, 21],
  );
});

test('addedLines returns empty set for undefined or empty patches', () => {
  assert.equal(addedLines(undefined).size, 0);
  assert.equal(addedLines('').size, 0);
});

test('parseStyleViolations extracts line and body in the prompt format', () => {
  const review = [
    'Here are the issues:',
    'app/main.py:12 — naming — uses data2 — Fix: rename to invoice_rows',
    'app/main.py:30 — functions — too long — Fix: split out parse step',
    'some unrelated prose that should be ignored',
  ].join('\n');
  const violations = parseStyleViolations(review, 'app/main.py');
  assert.equal(violations.length, 2);
  assert.equal(violations[0].line, 12);
  assert.match(violations[0].body, /^naming/);
  assert.equal(violations[1].line, 30);
});

test('parseStyleViolations does not match a different file path', () => {
  const review = 'other/file.py:5 — naming — bad — Fix: rename';
  assert.deepEqual(parseStyleViolations(review, 'app/main.py'), []);
});

test('parseStyleViolations accepts colon and hyphen separators', () => {
  const review = ['x.py:1 - rule - why - Fix: do', 'x.py:2 : rule : why : Fix: do'].join('\n');
  assert.equal(parseStyleViolations(review, 'x.py').length, 2);
});

test('parseChatCompletion extracts the assistant content from an OpenAI-shaped body', () => {
  const payload = { choices: [{ message: { role: 'assistant', content: 'hello world' } }] };
  assert.equal(parseChatCompletion(payload), 'hello world');
});

test('parseChatCompletion throws on an unrecognised or empty response', () => {
  assert.throws(() => parseChatCompletion({}), /Chat Completions contract/);
  assert.throws(() => parseChatCompletion({ choices: [] }), /Chat Completions contract/);
  assert.throws(
    () => parseChatCompletion({ choices: [{ message: { content: '' } }] }),
    /Chat Completions contract/,
  );
  assert.throws(() => parseChatCompletion(null), /Chat Completions contract/);
});
