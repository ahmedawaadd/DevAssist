"use strict";
// src/core/modelProvider.ts
// The model-access seam. The extension uses VsCodeLmProvider (Copilot models
// via vscode.lm). CI supplies its own implementation, because vscode.lm does
// not exist outside the editor. Anything that only needs the *interface* must
// import it with `import type`, so no `vscode` require leaks into CI.
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.VsCodeLmProvider = void 0;
const vscode = __importStar(require("vscode"));
/** Talks to Copilot-provided chat models through the stable vscode.lm API. */
class VsCodeLmProvider {
    async *sendRequest(prompt, token) {
        const cts = new vscode.CancellationTokenSource();
        if (token) {
            if (token.isCancellationRequested) {
                cts.cancel();
            }
            else {
                token.onCancellationRequested(() => cts.cancel());
            }
        }
        try {
            const models = await vscode.lm.selectChatModels({ vendor: 'copilot' });
            if (models.length === 0) {
                throw new Error('No Copilot chat model is available. Install the GitHub Copilot extension and sign in, then try again.');
            }
            const [model] = models;
            const messages = [vscode.LanguageModelChatMessage.User(prompt)];
            const response = await model.sendRequest(messages, { justification: 'DevAssist generates tests, docs, and code reviews for your project.' }, cts.token);
            for await (const fragment of response.text) {
                yield fragment;
            }
        }
        finally {
            cts.dispose();
        }
    }
}
exports.VsCodeLmProvider = VsCodeLmProvider;
//# sourceMappingURL=modelProvider.js.map