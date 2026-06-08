"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleReadme = handleReadme;
const context_1 = require("../core/context");
const prompts_1 = require("../core/prompts");
async function handleReadme(provider, stream, token) {
    stream.progress('Generating README from the code…');
    const context = await (0, context_1.getRepoContext)();
    for await (const chunk of provider.sendRequest((0, prompts_1.readmePrompt)(context), token)) {
        stream.markdown(chunk);
    }
}
//# sourceMappingURL=readme.js.map