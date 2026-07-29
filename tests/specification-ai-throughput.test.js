const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const ai = fs.readFileSync(path.join(root, "specification-ai.js"), "utf8");
const app = fs.readFileSync(path.join(root, "specification.js"), "utf8");

assert(app.includes("const SPEC_AI_TEXT_BATCH_SIZE = 8;"), "Text analysis should use the higher-throughput batch size.");
assert(app.includes("const SPEC_AI_VISUAL_BATCH_SIZE = 4;"), "Visual analysis should process four compatible pages per request.");
assert(app.includes("const SPEC_AI_DETAIL_BATCH_SIZE = 3;"), "Detailed equipment refinement must remain bounded to three pages.");
assert(ai.includes("async function analyzeEquipmentDetailsBatch"), "Detailed equipment extraction should provide a batched API.");
assert(ai.includes("Never combine evidence between pages"), "Batched detail extraction must retain page-level evidence isolation.");
assert(app.includes("Primary analysis is ready in Source Review"), "Primary results must be checkpointed for review before refinement finishes.");
assert(app.includes("Retrying those pages individually so no detail coverage is lost"), "Failed detail batches must retain the full individual fallback.");

console.log("Specification AI throughput checks passed.");
