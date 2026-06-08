// src/core/modelProvider.ts
// The model-access seam. The extension uses VsCodeLmProvider (Copilot models
// via vscode.lm). CI supplies its own implementation, because vscode.lm does
// not exist outside the editor. Anything that only needs the *interface* must
// import it with `import type`, so no `vscode` require leaks into CI.

/* This file defines HOW we talk to the AI model.
  *Everything else in the extension just calls sendRequest() and gets a text back, 
   they dont need to know whether its Copilot, some other model, or even a mock implementation for tests.
*/

import * as vscode from 'vscode';

// CancellationLike is a minimal contract for "something that can be cancelled"
// We define our own instead of using vscode's built in CancellationToken directly
// so this interface stays clean and isnt tied to the VS Code API.
// vscode.CancellationToken already matches this shape, so the extension can pass its token in without any conversion.


export interface CancellationLike {
  readonly isCancellationRequested: boolean;
  onCancellationRequested(listener: () => unknown): { dispose(): unknown };
}

// ModelProvider is the contract every model implementation must fulfill.
// It takes a prompt string, optionally a cancellation signal, and returns
// the response as a stream of text fragments rather than one big string.
// this is what lets us print the response word by word as it arrives,
// instead of waiting for the whole thing before showing anything (style choice i made, not a technical requirement).
// i implemented this style choice because of a study I read a few weeks ago, where users who got slow typed out respones
// from an AI felt more engaged and in control, compared to users who got an instant wall of text.
// I can try to find the study again if anyone's interested.

/** Sends a prompt to a chat model and streams back text fragments. */
export interface ModelProvider {
  sendRequest(prompt: string, token?: CancellationLike): AsyncIterable<string>;
}

/** Talks to Copilot-provided chat models through the stable vscode.lm API. */
// async* is what powers the word-by-word streaming in the extension
export class VsCodeLmProvider implements ModelProvider {
  async *sendRequest(prompt: string, token?: CancellationLike): AsyncIterable<string> {
    //CancellationTokenSource is VSCode's built in cancellation mechanism
    //We create one here so we can cancel the current model request if the user hits stop mid-response. Think of it like an interrupt
    const cts = new vscode.CancellationTokenSource();
    if (token) {
      if (token.isCancellationRequested) {
        //user cancelled before we even started - abort
        cts.cancel();
      } else { // user cancelled after we start - forward that cancellation to our token source so we can stop the model request
        token.onCancellationRequested(() => cts.cancel());
      }
    }


    // Ask VSCode which Copilot models are available and signed in.
    // This is the officially supported way to access Copilot models, and it respects all of the user's existing Copilot settings and authentication state.
    // Filter by vendor 'copilot' so we only get authenticated Copilot models.
    try {
      const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
      if (models.length === 0) {
        throw new Error(
          'No Copilot chat model is available. Install the GitHub Copilot extension and sign in, then try again.',
        );
      }

      // Take the first available model. (copilot picks the best one it has)
      const [model] = models;

      // Wrap the prompt as a user message, same as if you typed it into the chat UI. 
      const messages = [vscode.LanguageModelChatMessage.User(prompt)];

      // Fire the request. Justification is shown to the user, if copilot asks for consent it explains why we're using the model
      const response = await model.sendRequest(
        messages,
        { justification: 'DevAssist generates tests, docs, and code reviews for your project.' },
        cts.token,
      );

      // Stream the response back fragment by fragment
      // Each yield passes one chunk to SendRequest's caller, which in the extension prints it immediately to chat panel
      for await (const fragment of response.text) {
        yield fragment;
      }
    } finally {
      // cleaning up cancellation source otherwise it leaks memory.
      cts.dispose();
    }
  }
}