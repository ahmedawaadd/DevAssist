"use strict";
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
exports.activate = activate;
exports.deactivate = deactivate;
// src/extension.ts
const vscode = __importStar(require("vscode"));
const modelProvider_1 = require("./core/modelProvider");
const tests_1 = require("./handlers/tests");
const readme_1 = require("./handlers/readme");
const coverage_1 = require("./handlers/coverage");
const style_1 = require("./handlers/style");
const PARTICIPANT_ID = 'devassist';
function activate(context) {
    const provider = new modelProvider_1.VsCodeLmProvider();
    const handler = async (request, _chatContext, stream, token) => {
        try {
            switch (request.command) {
                case 'tests':
                    await (0, tests_1.handleTests)(provider, stream, token);
                    break;
                case 'readme':
                    await (0, readme_1.handleReadme)(provider, stream, token);
                    break;
                case 'coverage':
                    await (0, coverage_1.handleCoverage)(provider, stream, token);
                    break;
                case 'style':
                    await (0, style_1.handleStyle)(provider, stream, token, context.extensionUri);
                    break;
                case 'review':
                    stream.markdown('## Style\n\n');
                    await (0, style_1.handleStyle)(provider, stream, token, context.extensionUri);
                    stream.markdown('\n\n## Coverage & testability\n\n');
                    await (0, coverage_1.handleCoverage)(provider, stream, token);
                    stream.markdown('\n\n## Suggested tests\n\n');
                    await (0, tests_1.handleTests)(provider, stream, token);
                    break;
                default:
                    printHelp(stream);
            }
        }
        catch (error) {
            reportError(error, stream);
        }
        return {};
    };
    const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
    participant.iconPath = new vscode.ThemeIcon('beaker');
    context.subscriptions.push(participant);
}
function deactivate() {
    // The participant is disposed via context.subscriptions.
}
function printHelp(stream) {
    stream.markdown([
        '**@devassist** — testing & docs assistant, running on your Copilot models.',
        '',
        '- `/tests` — Pytest unit tests for the active file (happy path, edge cases, error branches).',
        '- `/readme` — generate a README for the current module/repo from its code.',
        '- `/coverage` — assess the active file’s coverage and suggest testability refactors.',
        '- `/style` — review the active file against the project style guide.',
        '- `/review` — run style, coverage, and tests in sequence.',
        '',
        'Open the file you want to work on, then run one of the commands above.',
    ].join('\n'));
}
function reportError(error, stream) {
    if (error instanceof vscode.CancellationError) {
        return;
    }
    if (error instanceof vscode.LanguageModelError) {
        stream.markdown(`\n\n⚠️ Language model error (${error.code || 'unknown'}): ${error.message}`);
        return;
    }
    stream.markdown(`\n\n⚠️ ${error instanceof Error ? error.message : String(error)}`);
}
//# sourceMappingURL=extension.js.map