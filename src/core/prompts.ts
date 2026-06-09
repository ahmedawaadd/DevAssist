// src/core/prompts.ts
// Single source of truth for every model prompt. Pure module: no `vscode`,
// no Node, no I/O — so it can be imported by both the extension and CI.

export interface SourceFile {
  /** Workspace-relative path, e.g. "app/billing/invoice.py". */
  path: string;
  /** VS Code languageId in the editor, or a best-effort guess in CI. */
  language: string;
  /** Full file contents. */
  content: string;
}

export interface ReadmeInput {
  repoName: string;
  /** Newline-separated list of repo-relative file paths. */
  fileTree: string;
  /** The file currently in focus, if any. */
  primaryFile?: SourceFile;
}

export interface CoverageInput {
  file: SourceFile;
  relatedTests: SourceFile[];
  /** Optional human-readable coverage summary (e.g. parsed from coverage.xml). */
  coverageReport?: string;
}

export interface StyleInput {
  file: SourceFile;
  /** Contents of style-guide.md. */
  styleGuide: string;
}

const FENCE = '```';

function fileBlock(file: SourceFile): string {
  return `File: ${file.path} (language: ${file.language})\n${FENCE}${file.language}\n${file.content}\n${FENCE}`;
}

export function testsPrompt(file: SourceFile): string {
  return [
    'You are a senior Python test engineer. Write a complete, runnable Pytest test module for the file below.',
    '',
    'Requirements:',
    '- Use pytest idioms — plain test functions, fixtures, and @pytest.mark.parametrize. Do not use unittest.TestCase.',
    '- Give every test an explicit Arrange / Act / Assert structure with short section comments.',
    '- Name tests test_<unit>_<scenario>; test one behaviour per function.',
    '- Cover the happy path, edge cases (empty, boundary, and invalid input), and every error branch (assert with pytest.raises).',
    '- Isolate side effects (I/O, network, time, randomness) using fixtures or unittest.mock; never touch real resources.',
    '- Include all necessary imports and a module docstring naming the unit under test.',
    `- Output ONLY the test module inside a single ${FENCE}python code block — no commentary before or after it.`,
    '',
    'If the file is not Python, say so in one sentence, then provide the closest idiomatic unit tests for the actual language inside one fenced block.',
    '',
    fileBlock(file),
  ].join('\n');
}

export function readmePrompt(input: ReadmeInput): string {
  const parts = [
    `You are a technical writer. Write a concise, accurate README.md for the project "${input.repoName}", based strictly on the code and structure provided. Do not invent features, badges, or licences the input does not support.`,
    '',
    'Include these sections, in order, only where the input supports them: a title and one-line summary; a short overview; key features; installation; usage examples; project structure; and how to run the tests if a test setup is visible. Prefer Python/pip conventions when the project is Python.',
    'Keep it tight and skimmable. Output ONLY the README.md content as Markdown.',
    '',
    `Repository file tree:\n${input.fileTree || '(no files listed)'}`,
  ];
  if (input.primaryFile) {
    parts.push('', 'Module currently in focus:', fileBlock(input.primaryFile));
  }
  return parts.join('\n');
}

export function coveragePrompt(input: CoverageInput): string {
  const parts = [
    'You are a senior engineer assessing test coverage.',
    '',
    'Return exactly this format:',
    '',
    '## Coverage assessment',
    '- Covered: <one short sentence>',
    '- Untested: <one short sentence>',
    '',
    '## Gaps',
    '- <missing concrete test case>',
    '- <missing concrete test case>',
    '- <missing concrete test case>',
    '',
    '## Testability refactors',
    '- <only if needed; otherwise say "No refactor needed.">',
    '',
  '- Hard rules:',
  '- Maximum 180 words.',
  '- Use exactly the three Markdown sections above.',
  '- Do not add extra sections.',
  '- List at most 3 bullets under Gaps.',
  '- Gaps must be concrete missing test inputs or scenarios.',
  '- If coverage is already strong, say so and keep Gaps minimal.',
  '- Only discuss behaviour visible in the provided source file, tests, or coverage report.',
  '- Do not mention side effects, I/O, persistence, logging, randomness, time, concurrency, dependency injection, or custom exceptions unless they appear in the source file.',
  '- Prefer missing test inputs over design advice.',
  '- Do not suggest refactors for simple pure functions.',
  
    fileBlock(input.file),
  ];
  if (input.coverageReport) {
    parts.push('', `Coverage report:\n${input.coverageReport}`);
  }
  if (input.relatedTests.length > 0) {
    parts.push('', 'Existing tests:');
    for (const test of input.relatedTests) {
      parts.push(fileBlock(test));
    }
  } else {
    parts.push('', 'No related test files were found.');
  }
  return parts.join('\n');
}

export function stylePrompt(input: StyleInput): string {
  return [
    'You are a code reviewer enforcing the project style guide below. Review the file strictly against the guide and nothing else.',
    '',
    'Output a Markdown list of violations. Format each line exactly as:',
    '`<path>:<line> — <rule> — <why it violates> — Fix: <concrete change>`',
    'Order violations by line number, and quote the offending snippet only when it clarifies the fix. Do not invent rules that are not in the guide. If there are no violations, reply with exactly: No style violations found.',
    '',
    '----- STYLE GUIDE -----',
    input.styleGuide,
    '----- END STYLE GUIDE -----',
    '',
    fileBlock(input.file),
  ].join('\n');
}
