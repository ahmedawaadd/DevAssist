"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = require("node:fs");
const rest_1 = require("@octokit/rest");
const prompts_1 = require("../src/core/prompts");
const CiModelProvider_1 = require("./CiModelProvider");
const LANGUAGE_BY_EXTENSION = {
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
function guessLanguage(path) {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    return LANGUAGE_BY_EXTENSION[ext] ?? 'plaintext';
}
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function getRepoSlug() {
    const slug = process.env.GITHUB_REPOSITORY;
    if (!slug || !slug.includes('/')) {
        throw new Error('GITHUB_REPOSITORY is not set; this script must run inside GitHub Actions.');
    }
    const [owner, repo] = slug.split('/');
    return { owner, repo };
}
function getPullNumber() {
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (eventPath) {
        const event = JSON.parse((0, node_fs_1.readFileSync)(eventPath, 'utf8'));
        const number = event.pull_request?.number ?? event.number;
        if (typeof number === 'number') {
            return number;
        }
    }
    throw new Error('Could not determine the pull request number from the event payload.');
}
function loadStyleGuide() {
    try {
        return (0, node_fs_1.readFileSync)('style-guide.md', 'utf8');
    }
    catch {
        return 'No style-guide.md found at the repository root; review against widely accepted clean-code conventions.';
    }
}
/** New-file line numbers added in this patch (valid RIGHT-side comment anchors). */
function addedLines(patch) {
    const result = new Set();
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
        }
        else if (line.startsWith('-') && !line.startsWith('---')) {
            // Removed line: old side only, no new line number.
        }
        else {
            lineNumber += 1;
        }
    }
    return result;
}
function parseStyleViolations(review, path) {
    const pattern = new RegExp(`${escapeRegExp(path)}:(\\d+)\\s*[—:-]\\s*(.+)`);
    const violations = [];
    for (const line of review.split('\n')) {
        const match = pattern.exec(line);
        if (match) {
            violations.push({ line: parseInt(match[1], 10), body: match[2].trim() });
        }
    }
    return violations;
}
async function collect(provider, prompt) {
    let text = '';
    for await (const fragment of provider.sendRequest(prompt)) {
        text += fragment;
    }
    return text;
}
async function run() {
    const provider = new CiModelProvider_1.CiModelProvider();
    if (!provider.configured) {
        console.log('::warning::DevAssist CI model gateway is not configured; skipping review. See the banner in ci/review-pr.ts.');
        return;
    }
    const { owner, repo } = getRepoSlug();
    const pullNumber = getPullNumber();
    const octokit = new rest_1.Octokit({ auth: process.env.GITHUB_TOKEN });
    const styleGuide = loadStyleGuide();
    const files = await octokit.rest.pulls.listFiles({ owner, repo, pull_number: pullNumber, per_page: 100 });
    const sections = [];
    const comments = [];
    for (const change of files.data) {
        if (change.status === 'removed') {
            continue;
        }
        let file;
        try {
            file = {
                path: change.filename,
                language: guessLanguage(change.filename),
                content: (0, node_fs_1.readFileSync)(change.filename, 'utf8'),
            };
        }
        catch {
            continue; // Binary or unreadable file.
        }
        // Style applies to every text file; tests/coverage are Python-only.
        const styleReview = await collect(provider, (0, prompts_1.stylePrompt)({ file, styleGuide }));
        sections.push(`## \`${change.filename}\`\n\n### Style\n\n${styleReview}`);
        const anchors = addedLines(change.patch);
        for (const violation of parseStyleViolations(styleReview, change.filename)) {
            if (anchors.has(violation.line)) {
                comments.push({ path: change.filename, line: violation.line, side: 'RIGHT', body: violation.body });
            }
        }
        if (change.filename.endsWith('.py')) {
            // CI assesses coverage from the source alone; the editor command also feeds related tests + coverage.xml.
            const coverage = await collect(provider, (0, prompts_1.coveragePrompt)({ file, relatedTests: [], coverageReport: undefined }));
            sections.push(`### Coverage & testability\n\n${coverage}`);
            const tests = await collect(provider, (0, prompts_1.testsPrompt)(file));
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
run().catch((error) => {
    if (error instanceof CiModelProvider_1.ModelNotConfiguredError) {
        console.log(`::warning::${error.message}`);
        return;
    }
    console.error(error);
    console.log(`::error::DevAssist review failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
//# sourceMappingURL=review-pr.js.map