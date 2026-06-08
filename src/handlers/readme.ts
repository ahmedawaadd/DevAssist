// src/handlers/readme.ts
// Backs the /readme command: generates a README from the repo's code and layout.

import type * as vscode from 'vscode';
import { getRepoContext } from '../core/context';
import { readmePrompt } from '../core/prompts';
import type { ModelProvider } from '../core/modelProvider';

/** Streams a generated README built from the current repo context. */
export async function handleReadme(
  provider: ModelProvider,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<void> {
  stream.progress('Generating README from the code…');
  const context = await getRepoContext();
  for await (const chunk of provider.sendRequest(readmePrompt(context), token)) {
    stream.markdown(chunk);
  }
}
