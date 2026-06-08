// src/handlers/style.ts
// Backs the /style command: reviews the active file against the style guide.

import type * as vscode from 'vscode';
import { getActiveFileContext, loadStyleGuide } from '../core/context';
import { stylePrompt } from '../core/prompts';
import type { ModelProvider } from '../core/modelProvider';

/** Streams a style-guide review of the active file. */
export async function handleStyle(
  provider: ModelProvider,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
  extensionUri: vscode.Uri,
): Promise<void> {
  const file = getActiveFileContext();
  const styleGuide = await loadStyleGuide(extensionUri);
  stream.progress(`Reviewing ${file.path} against the style guide…`);
  for await (const chunk of provider.sendRequest(stylePrompt({ file, styleGuide }), token)) {
    stream.markdown(chunk);
  }
}
