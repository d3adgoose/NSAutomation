const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "..", "specification.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "specification.html"), "utf8");
const between = (start, end) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
const part1 = between("function getPart1StarterTemplate()", "function getFixedPart1Sections()");
const part2 = between("function getPart2StarterTemplate()", "function getPart3StarterTemplateLegacy()");
const part3 = between("function getPart3StarterTemplate()", "function upgradePart3ExecutionFillIns(");

assert(part2.includes("Control system shall consist of [CONTROL PANEL / PLC / HMI DESCRIPTION]."));
assert(part2.includes("System designation or model: [SYSTEM NAME / MODEL]."));
assert(part2.includes("System shall be a complete [EQUIPMENT TYPE] installation designed and configured to wash [VEHICLE TYPE]."));
assert(part2.includes("System shall perform the following wash functions: [WASH FUNCTIONS]."));
assert(part2.includes("1. [SEQUENCE OF OPERATION]"), "Part 2 should keep the editable sequence fill-in at the first numbered hierarchy level");
assert(source.includes('numbering: listLevel >= 0 ? { reference: numberingReference, level: listLevel, instance: articleNumberingInstance }'), "Word export should restart automatic multilevel numbering for each specification article.");
assert(html.includes('onclick="exportSpecificationWord()"'), "Review and Export should provide the automatically numbered Word export.");
assert(source.includes('text: "N/S Corporation"'), "Word export should include the N/S Corporation running header.");
assert(source.includes('nextPage.drawText("N/S Corporation"'), "PDF export should include the N/S Corporation running header.");
assert(source.includes('`Specification Rev ${revision}`'), "Export filenames should include the project revision.");
assert(source.includes('PageNumber.CURRENT'), "Word export should include automatic page numbering.");
assert(source.includes('const footerText = String(pdfPageNumber);'), "PDF export should include a plain page number.");
assert(!source.includes('const revisionText = `Revision ${revisionLabel}`'), "Exported pages should not show a revision in the running header.");
assert(!source.includes('nextPage.drawLine({ start: { x: 67, y: 751 }'), "PDF running header should not include the removed horizontal line.");
assert(part3.includes("[INSTALLATION RESPONSIBLE PARTY] shall be responsible"));
assert(part3.includes("Commissioning party shall conduct acceptance testing using [ACCEPTANCE TEST PROCEDURE]."));
assert(part3.includes("Manufacturer shall warrant the Work for [WARRANTY PERIOD] beginning on [WARRANTY START EVENT]."));

const templatePlaceholders = new Set([...`${part1}\n${part2}\n${part3}`.matchAll(/\[[A-Z0-9 &/,-]+\]/g)].map(match => match[0]));
const trackedPlaceholders = new Set([...html.matchAll(/data-fill-placeholders="([^"]+)"/g)].flatMap(match => match[1].replaceAll("&amp;", "&").split(";;")));
for (const placeholder of templatePlaceholders) assert(trackedPlaceholders.has(placeholder), `Template placeholder is missing a fill-in pill: ${placeholder}`);
assert.strictEqual((html.match(/<textarea[^>]+wrap="off"[^>]+data-project-field="part[123]"/g) || []).length, 3, "All three Part editors must preserve fixed-width hierarchy without soft wrapping.");

console.log("Specification template wording and fill-in coverage tests passed.");
