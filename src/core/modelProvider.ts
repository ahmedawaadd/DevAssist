// src/core/modelProvider.ts
// The model-access seam. The ONLY implementation is VsCodeLmProvider, which
// talks to the user's Copilot models through vscode.lm. This is deliberate:
// every request stays on the user's Copilot plan and its data-handling
// guarantees. There is no external-gateway provider — the interface exists
// only so handlers can be unit-tested against a fake, never to swap in a
// different model service.

import * as vscode from 'vscode';

/**
 * Minimal "something that can be cancelled" contract. Defined here rather than
 * importing vscode's CancellationToken so a fake provider in a test doesn't
 * need the editor API; vscode.CancellationToken structurally satisfies it, so
 * the extension can pass its token straight through.
 */
export interface CancellationLike {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => unknown): { dispose(): unknown };
}

/**
 * Sends a prompt to a chat model and streams back text fragments. Streaming
 * (rather than returning one string) lets the extension render the answer
 * incrementally as it arrives.
 */
export interface ModelProvider {
  sendRequest(prompt: string, token?: CancellationLike): AsyncIterable<string>;
}

/** Talks to Copilot-provided chat models through the stable vscode.lm API. */
export class VsCodeLmProvider implements ModelProvider {
  async *sendRequest(prompt: string, token?: CancellationLike): AsyncIterable<string> {
    // Bridge the caller's cancellation signal onto a vscode token we can hand
    // to the model request, so hitting "stop" mid-response aborts the call.
    const cts = new vscode.CancellationTokenSource();
    if (token) {
      if (token.isCancellationRequested) {
        cts.cancel();
      } else {
        token.onCancellationRequested(() => cts.cancel());
      }
    }

    try {
      // The officially supported path to the user's authenticated Copilot
      // models; respects their existing Copilot settings and auth state.
      const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      if (models.length === 0) {
        throw new Error(
          'No Copilot chat model is available. Install the GitHub Copilot extension and sign in, then try again.',
        );
      }

      const [model] = models;
      const messages = [vscode.LanguageModelChatMessage.User(prompt)];

      // `justification` is surfaced to the user if Copilot prompts for consent.
      const response = await model.sendRequest(
        messages,
        { justification: 'DevAssist generates tests, docs, and code reviews for your project.' },
        cts.token,
      );

      for await (const fragment of response.text) {
        yield fragment;
      }
    } finally {
      cts.dispose();
    }
  }
}
