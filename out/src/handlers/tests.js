"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleTests = handleTests;
const context_1 = require("../core/context");
const prompts_1 = require("../core/prompts");
async function handleTests(provider, stream, token) {
    const file = (0, context_1.getActiveFileContext)();
    stream.progress(`Writing Pytest tests for ${file.path}…`);
    for await (const chunk of provider.sendRequest((0, prompts_1.testsPrompt)(file), token)) {
        stream.markdown(chunk);
    }
}
//# sourceMappingURL=tests.js.map