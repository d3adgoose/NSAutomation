const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "specification.js"), "utf8");

assert(!source.includes("searchableTextHandled: true"),
  "Analyze with AI must review searchable PDF text instead of skipping it");
assert(source.includes("pages.forEach(page => {"),
  "Built-in extraction must retain a page-level fallback");
assert(source.includes("(!isOandM || isSpecWorthyOandMText(text))"),
  "O&M fallback must surface spec-worthy requirements while excluding maintenance noise");
assert(source.includes("Number(item.confidence || 0) >= 0.55"),
  "Medium-confidence AI template values must remain available for user review");
assert(source.includes("Number(item.confidence || 0) >= 0.5"),
  "Reviewable AI equipment and clauses must not be discarded too aggressively");
assert(source.includes("function startSpecBuiltInAnalysisTimer()"),
  "Built-in Analyze must show its own elapsed progress");
assert(source.includes("await new Promise(resolve => requestAnimationFrame(resolve))"),
  "Built-in Analyze must paint its active state before processing");
assert(source.includes("was fully reanalyzed in"),
  "Built-in Analyze must confirm completion and duration");
assert(source.includes("item.status !== \"rejected\" && hasTraceableSpecEvidence(item)"),
  "Source Review must not destructively discard extracted suggestions during rendering");
assert(source.includes("could not be analyzed: ${result.error}"),
  "PDF reading failures must be visible instead of appearing as zero extraction");
assert(source.includes("equipmentTechnicalDescription"),
  "Built-in O&M extraction must retain technical equipment descriptions");
assert(source.includes('source.split("\\n")'),
  "Built-in extraction must preserve line-oriented submittal tables");
assert(source.includes("equipmentRecords} equipment record"),
  "Built-in Analyze must report extracted equipment records");
assert(source.includes("function hasTraceableSpecEvidence(item)"),
  "Every displayed finding must require a source location and exact evidence");
assert(source.includes("function openSpecFindingSourcePage(kind, id)"),
  "Review findings must support an on-demand source-page preview");
assert(source.includes("function getSpecFindingConfidenceScore(item)"),
  "All findings must support consistent confidence sorting");
assert(source.includes('sort.value = "confidence"'),
  "Source Review must default back to confidence sorting when filters are cleared");
[
  '"confidence-ascending"',
  '"destination"',
  '"source"',
  '"source-name"',
  '"equipment"',
  '"status"',
  '"page"',
  '"page-descending"'
].forEach(sortMode => assert(source.includes(`sortMode === ${sortMode}`),
  `Source Review is missing comparator logic for ${sortMode}`));
assert(source.includes("View Source Page"),
  "Visible findings must link to their source-page preview");
const stylesheet = fs.readFileSync(path.resolve(__dirname, "..", "style.css"), "utf8");
assert(stylesheet.includes(".spec-modal-content:has(.spec-source-page-preview)"),
  "Source-page previews must use a dedicated wide modal layout");
assert(stylesheet.includes("max-width: 100%"),
  "Rendered PDF pages must fit within the preview pane");
assert(source.includes("function formatSpecFindingConfidence(item)"),
  "All extracted finding types must show a normalized confidence label");
assert(source.includes("Math.round(Math.max(0, Math.min(1, numeric)) * 100)"),
  "AI findings must show their numeric confidence as a percentage");
assert(stylesheet.includes(".spec-confidence-badge.confidence-high"),
  "High confidence must have a distinct compact visual style");
assert(stylesheet.includes(".spec-confidence-badge.confidence-medium"),
  "Medium confidence must have a distinct compact visual style");
assert(stylesheet.includes(".spec-confidence-badge.confidence-low"),
  "Low confidence must have a distinct compact visual style");

console.log("Specification extraction coverage checks passed.");
