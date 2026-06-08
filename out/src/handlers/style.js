"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleStyle = handleStyle;
const context_1 = require("../core/context");
const prompts_1 = require("../core/prompts");
async function handleStyle(provider, stream, token, extensionUri) {
    const file = (0, context_1.getActiveFileContext)();
    const styleGuide = await (0, context_1.loadStyleGuide)(extensionUri);
    stream.progress(`Reviewing ${file.path} against the style guide…`);
    for await (const chunk of provider.sendRequest((0, prompts_1.stylePrompt)({ file, styleGuide }), token)) {
        stream.markdown(chunk);
    }
}
//# sourceMappingURL=style.js.map