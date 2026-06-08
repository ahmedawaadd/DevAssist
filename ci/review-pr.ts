// ci/review-pr.ts
/*
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │ DECISION REQUIRED — CI MODEL ACCESS                                        │
 * │                                                                            │
 * │ vscode.lm does NOT exist in a GitHub Actions runner, so this script cannot │
 * │ use Copilot models. It reaches a model through CiModelProvider, which is a │
 * │ STUB with NO default endpoint. Before this workflow does anything useful   │
 * │ you must: (1) set DEVASSIST_MODEL_ENDPOINT and DEVASSIST_MODEL_TOKEN as    │
 * │ repo secrets, and (2) implement the request body in ci/CiModelProvider.ts  │
 * │ for your approved gateway. Until then the script posts nothing and emits a │
 * │ non-blocking warning. This is deliberate: we will not invent an endpoint.  │
 * └──────────────────────────────────────────────────────────────────────────┘
 */

import { readFileSync } from 'node:fs';
import { Octokit } from '@octokit/rest';
import { coveragePrompt, stylePrompt, testsPrompt, type SourceFile } from '../src/core/prompts';
import type { ModelProvider } from '../src/core/modelProvider';
import { CiModelProvider, ModelNotConfiguredError } from './CiModelProvider';
import { addedLines, guessLanguage, parseStyleViolations } from './lib';

function getRepoSlug(): { owner: string; repo: string } {
  const slug = process.env.GITHUB_REPOSITORY;
  if (!slug || !slug.includes('/')) {
    throw new Error('GITHUB_REPOSITORY is not set; this script must run inside GitHub Actions.');
  }
  const [owner, repo] = slug.split('/');
  return { owner, repo };
}

function getPullNumber(): number {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (eventPath) {
    const event = JSON.parse(readFileSync(eventPath, 'utf8')) as {
      pull_request?: { number: number };
      number?: number;
    };
    const number = event.pull_request?.number ?? event.number;
    if (typeof number === 'number') {
      return number;
    }
  }
  throw new Error('Could not determine the pull request number from the event payload.');
}

function loadStyleGuide(): string {
  try {
    return readFileSync('style-guide.md', 'utf8');
  } catch {
    return 'No style-guide.md found at the repository root; review against widely accepted clean-code conventions.';
  }
}

interface InlineComment {
  path: string;
  line: number;
  side: 'RIGHT';
  body: string;
}

async function collect(provider: ModelProvider, prompt: string): Promise<string> {
  let text = '';
  for await (const fragment of provider.sendRequest(prompt)) {
    text += fragment;
  }
  return text;
}

async function run(): Promise<void> {
  const provider = new CiModelProvider();
  if (!provider.configured) {
    console.log(
      '::warning::DevAssist CI model gateway is not configured; skipping review. See the banner in ci/review-pr.ts.',
    );
    return;
  }

  const { owner, repo } = getRepoSlug();
  const pullNumber = getPullNumber();
  const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  const styleGuide = loadStyleGuide();

  const files = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  const sections: string[] = [];
  const comments: InlineComment[] = [];

  for (const change of files.data) {
    if (change.status === 'removed') {
      continue;
    }

    let file: SourceFile;
    try {
      file = {
        path: change.filename,
        language: guessLanguage(change.filename),
        content: readFileSync(change.filename, 'utf8'),
      };
    } catch {
      continue; // Binary or unreadable file.
    }

    // Style applies to every text file; tests/coverage are Python-only.
    const styleReview = await collect(provider, stylePrompt({ file, styleGuide }));
    sections.push(`## \`${change.filename}\`\n\n### Style\n\n${styleReview}`);

    const anchors = addedLines(change.patch);
    for (const violation of parseStyleViolations(styleReview, change.filename)) {
      if (anchors.has(violation.line)) {
        comments.push({
          path: change.filename,
          line: violation.line,
          side: 'RIGHT',
          body: violation.body,
        });
      }
    }

    if (change.filename.endsWith('.py')) {
      // CI assesses coverage from the source alone; the editor command also feeds related tests + coverage.xml.
      const coverage = await collect(
        provider,
        coveragePrompt({ file, relatedTests: [], coverageReport: undefined }),
      );
      sections.push(`### Coverage & testability\n\n${coverage}`);

      const tests = await collect(provider, testsPrompt(file));
      sections.push(`### Suggested Pytest tests\n\n${tests}`);
    }
  }

  if (sections.length === 0) {
    console.log('DevAssist: no reviewable files in this pull request.');
    return;
  }

  const body = ['🤖 **DevAssist review**', '', ...sections].join('\n\n');
  await octokit.rest.pulls.createReview({
    owner,
    repo,
    pull_number: pullNumber,
    event: 'COMMENT',
    body,
    comments,
  });

  console.log(`DevAssist: posted a review with ${comments.length} inline comment(s).`);
}

// Only run when invoked directly (e.g. `node out/ci/review-pr.js`), so the
// module can be imported by tests without firing a real review.
if (require.main === module) {
  run().catch((error: unknown) => {
    if (error instanceof ModelNotConfiguredError) {
      console.log(`::warning::${error.message}`);
      return;
    }
    console.error(error);
    console.log(
      `::error::DevAssist review failed: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  });
}
