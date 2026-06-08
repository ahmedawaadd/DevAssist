// src/handlers/tests.ts
// Backs the /tests command: asks the model for Pytest tests for the active file.

import type * as vscode from 'vscode';
import { getActiveFileContext } from '../core/context';
import { testsPrompt } from '../core/prompts';
import type { ModelProvider } from '../core/modelProvider';

/** Streams a Pytest test module for the file in the active editor. */
export async function handleTests(
  provider: ModelProvider,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<void> {
  const file = getActiveFileContext();
  stream.progress(`Writing Pytest tests for ${file.path}…`);
  for await (const chunk of provider.sendRequest(testsPrompt(file), token)) {
    stream.markdown(chunk);
  }
}
