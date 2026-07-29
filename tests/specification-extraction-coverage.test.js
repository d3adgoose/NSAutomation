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
assert(source.includes("const SPEC_AI_VISUAL_BATCH_SIZE = 4"),
  "Visual Local AI analysis must group pages to avoid one model request per scanned page");
assert(source.includes("const SPEC_AI_TEXT_BATCH_SIZE = 8"),
  "Text batches must balance higher throughput with complete structured responses");
assert(source.includes("const SPEC_AI_TEXT_BATCH_CHARACTER_LIMIT = 24000") &&
  source.includes("batchTextCharacters + unitTextCharacters > SPEC_AI_TEXT_BATCH_CHARACTER_LIMIT"),
  "Dense text pages must be split by content size before they overflow a large batch");
assert(source.includes("const deferredUnits = []"),
  "Difficult Local AI pages must not block the normal document pass");
assert(source.includes("pagesWithBuiltInFindings") && source.includes("batch.length >= 3") &&
  source.includes("batchHasBuiltInFindings || unitHasBuiltInFindings"),
  "Pages already known to contain useful findings must use smaller initial batches instead of failing a large batch first");
assert(source.includes("Normal pass complete. Retrying"),
  "Deferred Local AI pages must receive a bounded recovery pass");
assert(source.includes("smaller groups of up to 3") && source.includes("Recovered after smaller-batch review"),
  "Failed large batches must retry in smaller groups before using slower individual-page recovery");
assert(source.includes('action: "Local source unresolved"'),
  "Pages that fail individual recovery must be recorded for later or manual review");
assert(!source.includes("while (history.children.length > 80)"),
  "Long Local AI runs must not discard early messages or errors");
assert(!source.includes("function filterSpecLocalAiMessages(mode"),
  "The source activity log must always show all messages without a filter");
assert(source.includes('addSpecificationDocuments(event.dataTransfer.files, "drag and drop")'),
  "Drag-and-drop imports must identify themselves in the complete message log");
assert(source.includes("Regular analysis started for ${file.name}"),
  "Regular built-in analysis must use the complete source activity log");
assert(source.includes("Skipped: ${skipExplanation}"),
  "Every screened page must display its specific skip reason");
assert(source.includes("Original issue: ${firstError}. Individual retry issue: ${retryError.message}"),
  "Unresolved pages must show both the original and recovery errors");
assert(source.includes("Show all ${specLocalAiMessageCount} activity message"),
  "The activity total must be labeled clearly so it cannot look like a page number");
assert(source.includes("no unresolved pages"),
  "Recovered retry notices must not be summarized as unresolved issues");
assert(source.includes('"analysis in progress"') && source.includes('"complete — no unresolved pages"'),
  "The activity summary must distinguish an active recovery pass from successful completion");
assert(source.includes("progress.classList.toggle(\"is-complete\""),
  "The complete Local AI progress panel must receive a visible success state");
assert(source.includes(").slice(0, 8).forEach(item =>"),
  "Equipment output limits must be enforced even when the model ignores its prompt");
assert(source.includes(").slice(0, 5).forEach(item =>"),
  "Fill-in output limits must be enforced even when the model ignores its prompt");
assert(source.includes(").slice(0, 10).forEach(item =>"),
  "Clause output limits must be enforced even when the model ignores its prompt");
assert(source.includes("function promptDuplicateSpecSourceAction(fileName, existingDocument)"),
  "Duplicate specification sources must ask the user how to proceed");
assert(source.includes("function runSpecDetailedEquipmentPass(units, record, sourceName)"),
  "Equipment-producing pages must receive a targeted detail enrichment pass");
assert(!source.includes('showSpecTab("suggestions");\n  recordSpecLocalAiMessage') &&
  source.includes("Source Review will update after each completed batch"),
  "Local AI analysis must leave the current step open while explaining that Source Review updates progressively");
assert(source.includes('if (tab === "suggestions") { renderSpecComponents();'),
  "Opening Source Review must immediately render progressively extracted equipment");
assert(source.includes('classList.add("is-updating")') && source.includes('classList.remove("is-updating")'),
  "Source Review must show and clear its live updating indicator with the analysis lifecycle");
assert(source.includes("function getSpecSourceReviewAvailabilityMessage") &&
  source.includes("available in Source Review"),
  "Completed batches with findings must tell users that results are available in Source Review");
assert(source.includes("function getSpecAiEquipmentSignalScore(text)") &&
  source.includes("Equipment Completion Check") &&
  source.includes(".slice(0, 12)"),
  "High-signal pages with missed equipment must receive a bounded equipment-only completion check");
assert(source.includes("useSystemFonts: true") && source.includes("disableFontFace: false"),
  "Specification PDF reading must use available system-font fallbacks");
assert(source.includes("const selectedUnits = units.slice(0, 24)"),
  "The Detailed Equipment Pass must remain bounded on very large sources");
assert(source.includes('document.querySelector("[data-spec-tab].active")') &&
  source.includes('if (activeTab === "sources") renderSpecDocuments()'),
  "Long analysis runs must not repeatedly rebuild hidden result tabs");
assert(source.includes("existingDetailPages") && source.includes("!item.detailedAt"),
  "Previously completed sources must be enrichable without repeating their full analysis");
assert(source.includes("equipmentListCandidate: true"),
  "AI equipment must remain visible in Source Review for approval");
assert(source.includes("Possible Findings") && source.includes("low-confidence item"),
  "Low-confidence extracted items must appear in a collapsed Possible Findings section");
assert(source.includes('"Replace Existing"') && source.includes('"Keep Both"') && source.includes('"Skip"'),
  "Duplicate source choices must include replace, keep both, and skip");
assert(source.includes("item.status === \"accepted\"") && source.includes('item.verificationStatus === "Engineer Approved"'),
  "Replacing a source must preserve accepted and engineer-approved work");
assert(source.includes("specState.aiAudit = (specState.aiAudit || []).filter(item => item.documentId !== documentId)"),
  "Replacing a source must clear its old Local AI checkpoint");
assert(source.includes("const duplicate = (specState.fillInSuggestions || []).some"),
  "Repeated AI template values must be removed across the source");
assert(source.includes("const duplicate = (specState.sourceSuggestions || []).some"),
  "Repeated AI specification clauses must be removed across the source");
assert(source.includes("function isLikelySpecAiEngineeringPage(text)"),
  "Focused Local AI analysis must screen searchable pages before model requests");
assert(source.includes('id="specAiFocusedAnalysis" type="checkbox" checked'),
  "Focused Local AI analysis must be the default while allowing a full review");
assert(source.includes('entry.outcome !== "low-value page screened by focused analysis"'),
  "A later full review must remain able to analyze pages skipped by focused screening");
assert(source.includes('batch.length > 1 ? "Fast visual batch"'),
  "Visual batching progress must be visible to the user");
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
  '"page-descending"',
  '"ai-first"',
  '"built-in-first"'
].forEach(sortMode => assert(source.includes(`sortMode === ${sortMode}`),
  `Source Review is missing comparator logic for ${sortMode}`));
assert(source.includes("function isSpecAiExtractedFinding(item)") &&
  source.includes('"AI Extracted" : "Built-in Extracted"') &&
  source.includes("specSuggestionMethod"),
  "Every Source Review result must identify and filter its extraction method");
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
assert(source.includes("function collectSpecCorrectionMemoryExamples()"),
  "Reviewed extraction decisions must be available as future Local AI examples");
assert(source.includes("item.rejectedByAcceptedFillId"),
  "Automatically rejected duplicate fill-ins must not be learned as user corrections");
assert(source.includes("specSaveStandardCorrections") && source.includes("specSaveAiCorrections"),
  "Specification export must separate standard and Local AI correction memory");
assert(source.includes('aiExamples.length ? `<label>'),
  "The Local AI memory checkbox must appear only when reviewed AI results exist");
assert(source.includes('save.textContent = "Continue"') && !source.includes('exportOnly.textContent = "Export Only"'),
  "Specification export learning must use one clear Continue action");
assert(source.includes("saveSpecCorrectionMemoryExamples(correctionMemory.examples)"),
  "Approved correction examples must be saved only after a successful export build");
assert(stylesheet.includes(".spec-confidence-badge.confidence-high"),
  "High confidence must have a distinct compact visual style");
assert(stylesheet.includes(".spec-confidence-badge.confidence-medium"),
  "Medium confidence must have a distinct compact visual style");
assert(stylesheet.includes(".spec-confidence-badge.confidence-low"),
  "Low confidence must have a distinct compact visual style");

console.log("Specification extraction coverage checks passed.");
