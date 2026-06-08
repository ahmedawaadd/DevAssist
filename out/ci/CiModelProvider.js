"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CiModelProvider = exports.ModelNotConfiguredError = void 0;
class ModelNotConfiguredError extends Error {
    constructor(message) {
        super(message);
        this.name = 'ModelNotConfiguredError';
    }
}
exports.ModelNotConfiguredError = ModelNotConfiguredError;
class CiModelProvider {
    endpoint = process.env.DEVASSIST_MODEL_ENDPOINT;
    token = process.env.DEVASSIST_MODEL_TOKEN;
    /** True once both the endpoint and token secrets are present. */
    get configured() {
        return Boolean(this.endpoint && this.token);
    }
    async *sendRequest(prompt, _token) {
        if (!this.configured) {
            throw new ModelNotConfiguredError('CI model gateway is not configured. Set the DEVASSIST_MODEL_ENDPOINT and ' +
                'DEVASSIST_MODEL_TOKEN repo secrets, then implement the request body in ci/CiModelProvider.ts.');
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
        throw new ModelNotConfiguredError('CiModelProvider request body is not implemented. Adapt the DECISION POINT block in ci/CiModelProvider.ts to your gateway.');
    }
}
exports.CiModelProvider = CiModelProvider;
//# sourceMappingURL=CiModelProvider.js.map