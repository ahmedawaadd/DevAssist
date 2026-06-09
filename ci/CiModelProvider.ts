// ci/CiModelProvider.ts
//
// vscode.lm only exists inside the VS Code editor, so the CI script cannot use
// Copilot models. This provider is the seam where CI talks to a model instead.
//
// It is OPT-IN by design: it does nothing — and sends nothing — until you set
// the DEVASSIST_MODEL_ENDPOINT and DEVASSIST_MODEL_TOKEN repo secrets to point
// at your organisation's approved gateway. When unset it throws
// ModelNotConfiguredError and the workflow skips with a warning, so your code
// is never shipped to an endpoint you didn't choose.
//
// Once configured, it speaks the OpenAI-compatible Chat Completions contract
// (`POST <endpoint>` with a `messages` array, `Bearer` auth), which Azure
// OpenAI, most enterprise LLM proxies (e.g. LiteLLM), and self-hosted gateways
// all expose. If yours differs, this single method is the only thing to adapt.

import type { CancellationLike, ModelProvider } from '../src/core/modelProvider';
import { parseChatCompletion } from './lib';

export class ModelNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelNotConfiguredError';
  }
}

export class CiModelProvider implements ModelProvider {
  private readonly endpoint = process.env.DEVASSIST_MODEL_ENDPOINT;
  private readonly token = process.env.DEVASSIST_MODEL_TOKEN;
  /** Model/deployment name; required by most gateways, overridable per org. */
  private readonly model = process.env.DEVASSIST_MODEL ?? 'gpt-4o-mini';

  /** True once both the endpoint and token secrets are present. */
  get configured(): boolean {
    return Boolean(this.endpoint && this.token);
  }

  async *sendRequest(prompt: string, token?: CancellationLike): AsyncIterable<string> {
    if (!this.configured) {
      throw new ModelNotConfiguredError(
        'CI model gateway is not configured. Set the DEVASSIST_MODEL_ENDPOINT and ' +
          'DEVASSIST_MODEL_TOKEN repo secrets to your approved gateway, then re-run.',
      );
    }

    // Bridge the optional cancellation signal onto an AbortController.
    const controller = new AbortController();
    if (token) {
      if (token.isCancellationRequested) controller.abort();
      else token.onCancellationRequested(() => controller.abort());
    }

    const response = await fetch(this.endpoint as string, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${this.token}`,
      },
      body: JSON.stringify({
        model: this.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Model gateway returned ${response.status} ${response.statusText}: ${await response.text()}`,
      );
    }

    yield parseChatCompletion(await response.json());
  }
}
