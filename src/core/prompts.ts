// src/core/prompts.ts
// Single source of truth for every model prompt. Pure module: no `vscode`,
// no Node, no I/O — so the prompts can be unit-tested without the editor host.

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

/** Per-language testing guidance so generated tests are idiomatic, not Python-only. */
interface TestFramework {
  /** The persona for the prompt, e.g. "senior Python test engineer". */
  engineer: string;
  /** The framework the model should target, e.g. "Pytest". */
  framework: string;
  /** Framework-specific idioms appended as bullet points. */
  idioms: string;
  /** Language fence to request for the output block. */
  fence: string;
}

const TEST_FRAMEWORKS: Record<string, TestFramework> = {
  python: {
    engineer: 'senior Python test engineer',
    framework: 'Pytest',
    idioms:
      'Use pytest idioms — plain test functions, fixtures, and @pytest.mark.parametrize; do not use unittest.TestCase. Assert error branches with pytest.raises. Isolate side effects with fixtures or unittest.mock.',
    fence: 'python',
  },
  typescript: {
    engineer: 'senior TypeScript test engineer',
    framework: 'Vitest (or Jest — match the project)',
    idioms:
      'Use describe/it/expect. Assert error branches with expect(() => ...).toThrow() or rejects. Isolate side effects with vi.mock / jest.mock and fake timers.',
    fence: 'typescript',
  },
  javascript: {
    engineer: 'senior JavaScript test engineer',
    framework: 'Jest (or Vitest — match the project)',
    idioms:
      'Use describe/it/expect. Assert error branches with expect(() => ...).toThrow() or rejects. Isolate side effects with jest.mock and fake timers.',
    fence: 'javascript',
  },
  go: {
    engineer: 'senior Go test engineer',
    framework: "Go's standard testing package",
    idioms:
      'Use table-driven tests with subtests (t.Run). Report failures with t.Errorf/t.Fatalf. Use testify only if the project already does.',
    fence: 'go',
  },
  java: {
    engineer: 'senior Java test engineer',
    framework: 'JUnit 5',
    idioms:
      'Use @Test, @ParameterizedTest, and assertThrows for error branches. Mock collaborators with Mockito. Follow Arrange/Act/Assert.',
    fence: 'java',
  },
  ruby: {
    engineer: 'senior Ruby test engineer',
    framework: 'RSpec',
    idioms:
      'Use describe/context/it with expect. Assert error branches with expect { ... }.to raise_error. Use let and instance_double for collaborators.',
    fence: 'ruby',
  },
  rust: {
    engineer: 'senior Rust test engineer',
    framework: "Rust's built-in test harness",
    idioms:
      'Put tests in a #[cfg(test)] mod with #[test] functions. Use assert!/assert_eq! and #[should_panic] (or Result-returning tests) for error branches.',
    fence: 'rust',
  },
  csharp: {
    engineer: 'senior C# test engineer',
    framework: 'xUnit',
    idioms:
      'Use [Fact] and [Theory]/[InlineData]. Assert error branches with Assert.Throws. Mock collaborators with Moq.',
    fence: 'csharp',
  },
};

/** Normalizes editor/CI language ids (e.g. typescriptreact) onto a framework. */
function frameworkFor(language: string): TestFramework {
  const key = language.toLowerCase();
  if (key.startsWith('typescript')) return TEST_FRAMEWORKS.typescript;
  if (key.startsWith('javascript')) return TEST_FRAMEWORKS.javascript;
  return TEST_FRAMEWORKS[key] ?? TEST_FRAMEWORKS.python;
}

export function testsPrompt(file: SourceFile): string {
  const fw = frameworkFor(file.language);
  return [
    `You are a ${fw.engineer}. Write a complete, runnable ${fw.framework} test module for the file below.`,
    '',
    'Requirements:',
    `- ${fw.idioms}`,
    '- Give every test an explicit Arrange / Act / Assert structure with short section comments.',
    '- Use descriptive test names that state the unit and the scenario; test one behaviour per test.',
    '- Cover the happy path, edge cases (empty, boundary, and invalid input), and every error branch.',
    '- Never touch real I/O, network, time, or randomness; isolate them with the framework above.',
    '- Include all necessary imports and a short header/docstring naming the unit under test.',
    `- Output ONLY the test module inside a single ${FENCE}${fw.fence} code block — no commentary before or after it.`,
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
    'Hard rules:',
    '- Maximum 180 words.',
    '- Use exactly the three Markdown sections above and add no others.',
    '- List at most 3 bullets under Gaps; each must be a concrete missing test input or scenario.',
    '- If coverage is already strong, say so and keep Gaps minimal.',
    '- Only discuss behaviour visible in the provided source file, tests, or coverage report.',
    '- Do not mention side effects, I/O, persistence, logging, randomness, time, concurrency, dependency injection, or custom exceptions unless they appear in the source file.',
    '- Prefer missing test inputs over design advice; do not suggest refactors for simple pure functions.',
    '',
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
