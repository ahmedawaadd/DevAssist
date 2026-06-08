// src/core/coverage.ts
// Pure Cobertura parsing. No `vscode`, no I/O — takes the XML text and a file
// basename, returns a human-readable coverage summary for the prompt. Kept
// dependency-free so it is unit-testable without the editor host.

/** Reads a double-quoted attribute value out of a single opening tag. */
function readAttribute(tag: string, name: string): string | undefined {
  const match = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(tag);
  return match ? match[1] : undefined;
}

/** True when a Cobertura `filename` refers to the file we're looking at. */
function filenameMatches(filename: string, basename: string): boolean {
  const normalized = filename.replace(/\\/g, '/');
  return normalized === basename || normalized.endsWith(`/${basename}`);
}

/**
 * Summarize line coverage for `basename` from a Cobertura `coverage.xml`.
 *
 * Attributes are read individually, so the result does not depend on the order
 * `filename` and `line-rate` happen to appear in the `<class>` tag.
 */
export function summarizeCoverage(xml: string, basename: string): string {
  for (const match of xml.matchAll(/<class\b[^>]*>/gi)) {
    const tag = match[0];
    const filename = readAttribute(tag, 'filename');
    if (!filename || !filenameMatches(filename, basename)) {
      continue;
    }
    const lineRate = readAttribute(tag, 'line-rate');
    if (lineRate !== undefined && lineRate !== '') {
      const percent = Math.round(parseFloat(lineRate) * 100);
      return `Cobertura coverage.xml reports ${percent}% line coverage for ${filename}.`;
    }
  }
  return `A coverage.xml was found but had no entry for ${basename}; treat the file as untested unless tests exist.`;
}
