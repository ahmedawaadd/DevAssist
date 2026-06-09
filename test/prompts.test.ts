// test/prompts.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coveragePrompt,
  readmePrompt,
  stylePrompt,
  testsPrompt,
  type SourceFile,
} from '../src/core/prompts';

const sample: SourceFile = {
  path: 'app/billing/invoice.py',
  language: 'python',
  content: 'def total(items):\n    return sum(items)\n',
};

test('testsPrompt embeds the file in a fenced block with its language', () => {
  const prompt = testsPrompt(sample);
  assert.match(prompt, /senior Python test engineer/);
  assert.match(prompt, /File: app\/billing\/invoice\.py \(language: python\)/);
  assert.match(prompt, /```python\ndef total/);
  assert.match(prompt, /pytest\.raises/);
});

test('testsPrompt targets the right framework for TypeScript (incl. tsx)', () => {
  for (const language of ['typescript', 'typescriptreact']) {
    const prompt = testsPrompt({ path: 'src/app.ts', language, content: 'export const x = 1;' });
    assert.match(prompt, /senior TypeScript test engineer/);
    assert.match(prompt, /Vitest/);
    // The requested output block is TypeScript regardless of the tsx language id.
    assert.match(prompt, /single ```typescript code block/);
    assert.doesNotMatch(prompt, /Pytest/);
  }
});

test('testsPrompt picks per-language frameworks and falls back to Python', () => {
  assert.match(testsPrompt({ path: 'm.go', language: 'go', content: '' }), /table-driven/);
  assert.match(testsPrompt({ path: 'M.java', language: 'java', content: '' }), /JUnit 5/);
  // Unknown language falls back to the Python persona rather than crashing.
  assert.match(testsPrompt({ path: 'x', language: 'cobol', content: '' }), /Pytest/);
});

test('readmePrompt lists the file tree and includes the focused module', () => {
  const prompt = readmePrompt({
    repoName: 'devassist',
    fileTree: 'a.py\nb.py',
    primaryFile: sample,
  });
  assert.match(prompt, /project "devassist"/);
  assert.match(prompt, /a\.py\nb\.py/);
  assert.match(prompt, /Module currently in focus:/);
});

test('readmePrompt omits the focus section when no primary file is given', () => {
  const prompt = readmePrompt({ repoName: 'devassist', fileTree: '' });
  assert.match(prompt, /\(no files listed\)/);
  assert.doesNotMatch(prompt, /Module currently in focus:/);
});

test('coveragePrompt includes the coverage report and existing tests when present', () => {
  const prompt = coveragePrompt({
    file: sample,
    relatedTests: [{ path: 'test_invoice.py', language: 'python', content: 'def test_x(): pass' }],
    coverageReport: '80% line coverage',
  });
  assert.match(prompt, /Coverage report:\n80% line coverage/);
  assert.match(prompt, /Existing tests:/);
  assert.match(prompt, /test_invoice\.py/);
});

test('coveragePrompt states when no related tests were found', () => {
  const prompt = coveragePrompt({ file: sample, relatedTests: [] });
  assert.match(prompt, /No related test files were found\./);
  assert.doesNotMatch(prompt, /Coverage report:/);
});

test('stylePrompt embeds the style guide between delimiters', () => {
  const prompt = stylePrompt({ file: sample, styleGuide: 'RULE: snake_case' });
  assert.match(prompt, /----- STYLE GUIDE -----\nRULE: snake_case\n----- END STYLE GUIDE -----/);
  assert.match(prompt, /No style violations found/);
});
