// src/core/context.ts
// Turns editor / workspace state into the plain payloads prompts.ts wants.
// Editor-only (uses `vscode`); the CI script gathers its own context.

import * as vscode from 'vscode';
import type { ReadmeInput, SourceFile } from './prompts';
import { summarizeCoverage } from './coverage';

const EXCLUDE = '**/{node_modules,.git,dist,out,.venv,venv,__pycache__,.mypy_cache}/**';

function toSourceFile(document: vscode.TextDocument): SourceFile {
  return {
    path: vscode.workspace.asRelativePath(document.uri),
    language: document.languageId,
    content: document.getText(),
  };
}

/** The file in the active editor. Throws if there isn't one. */
export function getActiveFileContext(): SourceFile {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error(
      'No active editor. Open the file you want @devassist to work on, then run the command again.',
    );
  }
  return toSourceFile(editor.document);
}

/** Repo name, a bounded file tree, and the focused file for README generation. */
export async function getRepoContext(): Promise<ReadmeInput> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  const repoName = folder?.name ?? 'workspace';

  const uris = await vscode.workspace.findFiles('**/*', EXCLUDE, 300);
  const fileTree = uris
    .map((uri) => vscode.workspace.asRelativePath(uri))
    .sort()
    .join('\n');

  const editor = vscode.window.activeTextEditor;
  const primaryFile = editor ? toSourceFile(editor.document) : undefined;

  return { repoName, fileTree, primaryFile };
}

/** Test files that look related to the given source file. */
export async function findRelatedTests(file: SourceFile): Promise<SourceFile[]> {
  const base = file.path.split('/').pop() ?? file.path;
  const stem = base.replace(/\.[^.]+$/, '');
  const patterns = [`**/test_${stem}.*`, `**/${stem}_test.*`, `**/tests/**/*${stem}*`];

  const found = new Map<string, vscode.Uri>();
  for (const pattern of patterns) {
    for (const uri of await vscode.workspace.findFiles(pattern, EXCLUDE, 10)) {
      found.set(uri.toString(), uri);
    }
  }

  const results: SourceFile[] = [];
  for (const uri of found.values()) {
    const document = await vscode.workspace.openTextDocument(uri);
    results.push(toSourceFile(document));
  }
  return results;
}

/** A short coverage summary parsed from a Cobertura coverage.xml, if present. */
export async function findCoverageReport(file: SourceFile): Promise<string | undefined> {
  const uris = await vscode.workspace.findFiles('**/coverage.xml', EXCLUDE, 1);
  if (uris.length === 0) {
    return undefined;
  }

  const document = await vscode.workspace.openTextDocument(uris[0]);
  const base = file.path.split('/').pop() ?? file.path;
  return summarizeCoverage(document.getText(), base);
}

/** Project style guide: workspace copy if present, else the bundled standard. */
export async function loadStyleGuide(extensionUri: vscode.Uri): Promise<string> {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (folder) {
    try {
      const bytes = await vscode.workspace.fs.readFile(
        vscode.Uri.joinPath(folder.uri, 'style-guide.md'),
      );
      return Buffer.from(bytes).toString('utf8');
    } catch {
      // No project-level guide; fall back to the bundled one.
    }
  }
  const bytes = await vscode.workspace.fs.readFile(
    vscode.Uri.joinPath(extensionUri, 'style-guide.md'),
  );
  return Buffer.from(bytes).toString('utf8');
}
