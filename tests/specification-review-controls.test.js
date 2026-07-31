const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "specification.html"), "utf8");
const source = fs.readFileSync(path.join(root, "specification.js"), "utf8");

assert(!/id="specAiHeaderButton"[^>]*class="[^"]*\bhidden\b/.test(html),
  "The Specification Local AI status button must remain visible while AI is offline.");
assert(source.includes('headerButton?.classList.remove("hidden")'),
  "Specification must restore the Local AI status button before checking login or service availability.");
assert(!source.includes('headerButton?.classList.toggle("hidden", !specAiAuthenticatedUser)'),
  "Specification must show an offline status instead of hiding the Local AI button when signed out.");

assert(html.includes('<details id="specEquipmentApprovalPanel"') && html.includes('id="specEquipmentApprovalBody"'),
  "Equipment approval must provide a collapsible panel.");
assert(html.includes('<details id="specExtractedFillPanel"') && html.includes('id="specExtractedFillBody"'),
  "Extracted values must provide a collapsible panel.");
assert(html.includes('onclick="undoSpecReviewAction()"') && html.includes('onclick="redoSpecReviewAction()"'),
  "Source Review must expose Undo and Redo controls.");
assert(source.includes("const SPEC_REVIEW_HISTORY_LIMIT = 20") && source.includes("function recordSpecReviewAction"),
  "Review history must be bounded and snapshot changes before mutation.");
assert(source.includes("function restoreSpecReviewSnapshot") && source.includes("saveSpecificationProject(false)"),
  "Undo and redo must restore and persist the complete review state.");
assert(source.includes("restoreSpecReviewPanelStates()"),
  "Collapsed panel choices must be restored when Specification loads.");

console.log("Specification review control checks passed.");
