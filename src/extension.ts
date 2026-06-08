// src/extension.ts
// Extension entry point. Registers the @devassist chat participant, routes its
// slash commands to the handlers, and turns thrown errors into chat messages.

import * as vscode from 'vscode';
import { VsCodeLmProvider } from './core/modelProvider';
import { handleTests } from './handlers/tests';
import { handleReadme } from './handlers/readme';
import { handleCoverage } from './handlers/coverage';
import { handleStyle } from './handlers/style';

const PARTICIPANT_ID = 'devassist';

/** Wires up the chat participant and its command routing on startup. */
export function activate(context: vscode.ExtensionContext): void {
  const provider = new VsCodeLmProvider();

  // One handler dispatches on request.command; each case streams into `stream`.
  const handler: vscode.ChatRequestHandler = async (request, _chatContext, stream, token) => {
    try {
      switch (request.command) {
        case 'tests':
          await handleTests(provider, stream, token);
          break;
        case 'readme':
          await handleReadme(provider, stream, token);
          break;
        case 'coverage':
          await handleCoverage(provider, stream, token);
          break;
        case 'style':
          await handleStyle(provider, stream, token, context.extensionUri);
          break;
        case 'review':
          // The all-in-one command: just runs style, coverage, and tests in order.
          stream.markdown('## Style\n\n');
          await handleStyle(provider, stream, token, context.extensionUri);
          stream.markdown('\n\n## Coverage & testability\n\n');
          await handleCoverage(provider, stream, token);
          stream.markdown('\n\n## Suggested tests\n\n');
          await handleTests(provider, stream, token);
          break;
        default:
          printHelp(stream);
      }
    } catch (error) {
      reportError(error, stream);
    }
    return {};
  };

  const participant = vscode.chat.createChatParticipant(PARTICIPANT_ID, handler);
  participant.iconPath = new vscode.ThemeIcon('beaker');
  context.subscriptions.push(participant);
}

export function deactivate(): void {
  // The participant is disposed via context.subscriptions.
}

/** Shown for a bare @devassist mention or an unknown command. */
function printHelp(stream: vscode.ChatResponseStream): void {
  stream.markdown(
    [
      '**@devassist** — testing & docs assistant, running on your Copilot models.',
      '',
      '- `/tests` — Pytest unit tests for the active file (happy path, edge cases, error branches).',
      '- `/readme` — generate a README for the current module/repo from its code.',
      '- `/coverage` — assess the active file’s coverage and suggest testability refactors.',
      '- `/style` — review the active file against the project style guide.',
      '- `/review` — run style, coverage, and tests in sequence.',
      '',
      'Open the file you want to work on, then run one of the commands above.',
    ].join('\n'),
  );
}

/** Reports a failure into the chat. Cancellation is expected, so it's silent. */
function reportError(error: unknown, stream: vscode.ChatResponseStream): void {
  if (error instanceof vscode.CancellationError) {
    return;
  }
  if (error instanceof vscode.LanguageModelError) {
    stream.markdown(`\n\n⚠️ Language model error (${error.code || 'unknown'}): ${error.message}`);
    return;
  }
  stream.markdown(`\n\n⚠️ ${error instanceof Error ? error.message : String(error)}`);
}
