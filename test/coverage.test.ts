// test/coverage.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { summarizeCoverage } from '../src/core/coverage';

test('summarizeCoverage reports the rounded percentage for a matching class', () => {
  const xml = `
    <coverage>
      <packages><package><classes>
        <class name="invoice" filename="app/billing/invoice.py" line-rate="0.8333">
        </class>
      </classes></package></packages>
    </coverage>`;
  const summary = summarizeCoverage(xml, 'invoice.py');
  assert.match(summary, /83% line coverage for app\/billing\/invoice\.py/);
});

test('summarizeCoverage is order-independent for filename and line-rate', () => {
  // line-rate appears BEFORE filename here — the old substring regex missed this.
  const xml = '<class line-rate="0.5" branch-rate="0.1" filename="src/foo.py" name="foo"></class>';
  const summary = summarizeCoverage(xml, 'foo.py');
  assert.match(summary, /50% line coverage/);
});

test('summarizeCoverage does not match a different file with a shared suffix', () => {
  const xml = '<class filename="src/xinvoice.py" line-rate="0.9"></class>';
  const summary = summarizeCoverage(xml, 'invoice.py');
  assert.match(summary, /no entry for invoice\.py/);
});

test('summarizeCoverage matches an exact filename with no directory', () => {
  const xml = '<class filename="invoice.py" line-rate="1.0"></class>';
  assert.match(summarizeCoverage(xml, 'invoice.py'), /100% line coverage/);
});

test('summarizeCoverage falls back when the file is absent', () => {
  const xml = '<class filename="other.py" line-rate="1.0"></class>';
  const summary = summarizeCoverage(xml, 'invoice.py');
  assert.match(summary, /treat the file as untested/);
});

test('summarizeCoverage tolerates a class tag with no line-rate', () => {
  const xml = '<class filename="invoice.py"></class>';
  assert.match(summarizeCoverage(xml, 'invoice.py'), /no entry for invoice\.py/);
});

test('summarizeCoverage handles Windows-style backslash paths', () => {
  const xml = '<class filename="src\\\\billing\\\\invoice.py" line-rate="0.25"></class>';
  assert.match(summarizeCoverage(xml, 'invoice.py'), /25% line coverage/);
});
