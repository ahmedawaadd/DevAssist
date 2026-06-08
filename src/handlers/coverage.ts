// src/handlers/coverage.ts
// Backs the /coverage command: assesses the active file's coverage and
// testability, pulling in any related tests and a coverage.xml it can find.

import type * as vscode from 'vscode';
import { findCoverageReport, findRelatedTests, getActiveFileContext } from '../core/context';
import { coveragePrompt } from '../core/prompts';
import type { ModelProvider } from '../core/modelProvider';

/** Streams a coverage and testability review of the active file. */
export async function handleCoverage(
  provider: ModelProvider,
  stream: vscode.ChatResponseStream,
  token: vscode.CancellationToken,
): Promise<void> {
  const file = getActiveFileContext();
  stream.progress(`Assessing coverage for ${file.path}…`);
  const relatedTests = await findRelatedTests(file);
  const coverageReport = await findCoverageReport(file);
  for await (const chunk of provider.sendRequest(
    coveragePrompt({ file, relatedTests, coverageReport }),
    token,
  )) {
    stream.markdown(chunk);
  }
}
