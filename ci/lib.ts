// ci/lib.ts
// Pure helpers for the PR reviewer: language guessing, diff parsing, and
// extracting style violations from the model's review text. No GitHub, no
// filesystem, no model calls — so each piece is unit-testable in isolation.

const LANGUAGE_BY_EXTENSION: Record<string, string> = {
  py: 'python',
  ts: 'typescript',
  tsx: 'typescriptreact',
  js: 'javascript',
  jsx: 'javascriptreact',
  java: 'java',
  go: 'go',
  rb: 'ruby',
  rs: 'rust',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cs: 'csharp',
};

/** Best-effort language id from a file extension; 'plaintext' when unknown. */
export function guessLanguage(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() ?? '';
  return LANGUAGE_BY_EXTENSION[ext] ?? 'plaintext';
}

/**
 * Extract the assistant text from an OpenAI-compatible Chat Completions
 * response. Kept pure (no fetch) so the gateway contract is unit-testable.
 * Throws on a shape we don't recognise rather than yielding silent garbage.
 */
export function parseChatCompletion(payload: unknown): string {
  const content = (payload as { choices?: Array<{ message?: { content?: unknown } }> })
    ?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || content.length === 0) {
    throw new Error(
      'Model gateway response had no choices[0].message.content; check that the endpoint speaks the OpenAI Chat Completions contract.',
    );
  }
  return content;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * New-file (RIGHT-side) line numbers added in a unified diff patch. These are
 * the only valid anchors for an inline pull-request comment.
 */
export function addedLines(patch: string | undefined): Set<number> {
  const result = new Set<number>();
  if (!patch) {
    return result;
  }
  let lineNumber = 0;
  for (const line of patch.split('\n')) {
    const hunk = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/.exec(line);
    if (hunk) {
      lineNumber = parseInt(hunk[1], 10);
      continue;
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      result.add(lineNumber);
      lineNumber += 1;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      // Removed line: exists on the old side only, no new line number.
    } else {
      lineNumber += 1;
    }
  }
  return result;
}

/**
 * Pull `<path>:<line> — <detail>` rows out of a style review. The format is
 * dictated by stylePrompt(); lines that don't match are ignored, so prose
 * around the list is harmless.
 */
export function parseStyleViolations(
  review: string,
  path: string,
): Array<{ line: number; body: string }> {
  const pattern = new RegExp(`${escapeRegExp(path)}:(\\d+)\\s*[—:-]\\s*(.+)`);
  const violations: Array<{ line: number; body: string }> = [];
  for (const line of review.split('\n')) {
    const match = pattern.exec(line);
    if (match) {
      violations.push({ line: parseInt(match[1], 10), body: match[2].trim() });
    }
  }
  return violations;
}
