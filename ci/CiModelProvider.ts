// ci/CiModelProvider.ts
//
// STUB — read before enabling the workflow.
//
// vscode.lm only exists inside the VS Code editor, so the CI script cannot use
// Copilot models. This provider is the seam where CI talks to a model instead.
// It intentionally ships WITHOUT a default endpoint or request contract: we
// will not invent one or send your code to an unapproved service. You must
// (1) set DEVASSIST_MODEL_ENDPOINT and DEVASSIST_MODEL_TOKEN as repo secrets,
// and (2) implement the marked request body to match your gateway. Until then
// it throws ModelNotConfiguredError and the workflow skips with a warning.

import type { CancellationLike, ModelProvider } from '../src/core/modelProvider';

export class ModelNotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModelNotConfiguredError';
  }
}

export class CiModelProvider implements ModelProvider {
  private readonly endpoint = process.env.DEVASSIST_MODEL_ENDPOINT;
  private readonly token = process.env.DEVASSIST_MODEL_TOKEN;

  /** True once both the endpoint and token secrets are present. */
  get configured(): boolean {
    return Boolean(this.endpoint && this.token);
  }

  // This is an unimplemented seam: it always throws until a gateway is wired in,
  // so it deliberately never yields and doesn't read `prompt` yet. The example
  // request body below (the DECISION POINT) is where both get used.
  // eslint-disable-next-line require-yield, @typescript-eslint/no-unused-vars
  async *sendRequest(prompt: string, _token?: CancellationLike): AsyncIterable<string> {
    if (!this.configured) {
      throw new ModelNotConfiguredError(
        'CI model gateway is not configured. Set the DEVASSIST_MODEL_ENDPOINT and ' +
          'DEVASSIST_MODEL_TOKEN repo secrets, then implement the request body in ci/CiModelProvider.ts.',
      );
    }

    // ───────────────────────── DECISION POINT ─────────────────────────
    // Wire this to your organisation's approved model gateway and yield its
    // text. The exact request/response contract is YOURS — adapt the shape
    // below, then delete the throw at the end of this block.
    //
    //   const response = await fetch(this.endpoint!, {
    //     method: 'POST',
    //     headers: {
    //       'content-type': 'application/json',
    //       authorization: `Bearer ${this.token}`,
    //     },
    //     body: JSON.stringify({ prompt }),
    //   });
    //   if (!response.ok) {
    //     throw new Error(`Model gateway returned ${response.status}: ${await response.text()}`);
    //   }
    //   const data = (await response.json()) as { text: string };
    //   yield data.text;
    //   return;
    // ───────────────────────────────────────────────────────────────────

    throw new ModelNotConfiguredError(
      'CiModelProvider request body is not implemented. Adapt the DECISION POINT block in ci/CiModelProvider.ts to your gateway.',
    );
  }
}
