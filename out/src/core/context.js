"use strict";
// src/core/context.ts
// Turns editor / workspace state into the plain payloads prompts.ts wants.
// Editor-only (uses `vscode`); the CI script gathers its own context.
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
exports.getActiveFileContext = getActiveFileContext;
exports.getRepoContext = getRepoContext;
exports.findRelatedTests = findRelatedTests;
exports.findCoverageReport = findCoverageReport;
exports.loadStyleGuide = loadStyleGuide;
const vscode = __importStar(require("vscode"));
const EXCLUDE = '**/{node_modules,.git,dist,out,.venv,venv,__pycache__,.mypy_cache}/**';
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
function toSourceFile(document) {
    return {
        path: vscode.workspace.asRelativePath(document.uri),
        language: document.languageId,
        content: document.getText(),
    };
}
/** The file in the active editor. Throws if there isn't one. */
function getActiveFileContext() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        throw new Error('No active editor. Open the file you want @devassist to work on, then run the command again.');
    }
    return toSourceFile(editor.document);
}
/** Repo name, a bounded file tree, and the focused file for README generation. */
async function getRepoContext() {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const repoName = folder?.name ?? 'workspace';
    const uris = await vscode.workspace.findFiles('**/*', EXCLUDE, 300);
    const fileTree = uris
        .map((uri) => vscode.workspace.asRelativePath(uri))
        .sort()
        .join('\n');
    const editor = vscode.window.activeTextEditor;
    const primaryFile = editor ? toSourceFile(editor.document) : undefined;
    return { repoName, fileTree, primaryFile };
}
/** Test files that look related to the given source file. */
async function findRelatedTests(file) {
    const base = file.path.split('/').pop() ?? file.path;
    const stem = base.replace(/\.[^.]+$/, '');
    const patterns = [`**/test_${stem}.*`, `**/${stem}_test.*`, `**/tests/**/*${stem}*`];
    const found = new Map();
    for (const pattern of patterns) {
        for (const uri of await vscode.workspace.findFiles(pattern, EXCLUDE, 10)) {
            found.set(uri.toString(), uri);
        }
    }
    const results = [];
    for (const uri of found.values()) {
        const document = await vscode.workspace.openTextDocument(uri);
        results.push(toSourceFile(document));
    }
    return results;
}
/** A short coverage summary parsed from a Cobertura coverage.xml, if present. */
async function findCoverageReport(file) {
    const uris = await vscode.workspace.findFiles('**/coverage.xml', EXCLUDE, 1);
    if (uris.length === 0) {
        return undefined;
    }
    const document = await vscode.workspace.openTextDocument(uris[0]);
    const xml = document.getText();
    const base = file.path.split('/').pop() ?? file.path;
    const match = new RegExp(`<class[^>]*filename="([^"]*${escapeRegExp(base)})"[^>]*line-rate="([0-9.]+)"`, 'i').exec(xml);
    if (match) {
        const percent = Math.round(parseFloat(match[2]) * 100);
        return `Cobertura coverage.xml reports ${percent}% line coverage for ${match[1]}.`;
    }
    return `A coverage.xml was found but had no entry for ${base}; treat the file as untested unless tests exist.`;
}
/** Project style guide: workspace copy if present, else the bundled standard. */
async function loadStyleGuide(extensionUri) {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (folder) {
        try {
            const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(folder.uri, 'style-guide.md'));
            return Buffer.from(bytes).toString('utf8');
        }
        catch {
            // No project-level guide; fall back to the bundled one.
        }
    }
    const bytes = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(extensionUri, 'style-guide.md'));
    return Buffer.from(bytes).toString('utf8');
}
//# sourceMappingURL=context.js.map