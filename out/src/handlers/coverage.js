"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleCoverage = handleCoverage;
const context_1 = require("../core/context");
const prompts_1 = require("../core/prompts");
async function handleCoverage(provider, stream, token) {
    const file = (0, context_1.getActiveFileContext)();
    stream.progress(`Assessing coverage for ${file.path}…`);
    const relatedTests = await (0, context_1.findRelatedTests)(file);
    const coverageReport = await (0, context_1.findCoverageReport)(file);
    for await (const chunk of provider.sendRequest((0, prompts_1.coveragePrompt)({ file, relatedTests, coverageReport }), token)) {
        stream.markdown(chunk);
    }
}
//# sourceMappingURL=coverage.js.map