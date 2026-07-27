const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(root, "specification.html"), "utf8");
const source = fs.readFileSync(path.join(root, "specification-company-library.js"), "utf8");

[
  "specCompanyKnowledgeTitle",
  "specCompanyKnowledgeCategory",
  "specCompanyKnowledgeNotes",
  "specCompanyKnowledgeDrop",
  "specCompanyKnowledgePending",
  "specCompanyKnowledgeAddButton",
  "specCompanyKnowledgeInput",
  "specCompanyKnowledgeSearch",
  "specCompanyKnowledgeFilter",
  "specCompanyKnowledgeStatus",
  "specCompanyKnowledgeList"
].forEach(id => assert(source.includes(`id="${id}"`), `Missing Company Knowledge popup control: ${id}`));

const libraryScript = html.indexOf("specification-company-library.js");
const specificationScript = html.indexOf('src="specification.js');
assert(libraryScript >= 0, "Company Knowledge script is not loaded");
assert(specificationScript > libraryScript, "Company Knowledge script must load before specification.js");
assert(source.includes('.eq("document_type", SPEC_COMPANY_DOCUMENT_TYPE)'),
  "Company Knowledge queries must remain isolated by document type");
assert(source.includes("document_type: SPEC_COMPANY_DOCUMENT_TYPE"),
  "Uploads must be marked as Company Knowledge");
assert(source.includes("window.supabaseClient.auth.getSession()"),
  "Company Knowledge access must require the existing login session");
assert(source.includes("function openSpecCompanyKnowledgeModal()"),
  "Company Knowledge must have its own popup");
assert(!source.includes("Back to Local AI") && !source.includes("Back to Company Knowledge"),
  "Nested popup buttons should use the simple Close label");
assert(source.includes("closeButton.onclick = openSpecLocalAiStatusModal"),
  "Closing Company Knowledge must return to the Local AI controls");
assert(source.includes("importedFromDatabase"),
  "Company Knowledge imported from Database must continue displaying its filename");
assert(source.includes("function getSpecCompanyKnowledgeKind(item)"),
  "Company Knowledge must visibly identify specification reference types");
assert(source.includes('drop?.addEventListener("drop"'),
  "Company Knowledge must support drag-and-drop uploads");
assert(source.includes("function stageSpecCompanyKnowledgeFiles(fileList)"),
  "Dropped files must be staged before upload");
assert(source.includes('.name.replace(/\\.(pdf|docx|txt)$/i, "")'),
  "A selected specification filename must prefill the editable title without its extension");
assert(source.includes("function addPendingSpecCompanyKnowledge()"),
  "Company Knowledge upload must require the explicit Add button");
assert(!source.includes("openSpecDatabaseLibraryModal"),
  "Company Knowledge must not include the removed Database import feature");
assert(!source.includes("Use in This Project"),
  "Company Knowledge must remain separate from project Sources");
assert(!html.includes('<section class="spec-company-library"'),
  "Company Knowledge must remain separate from the Sources tab");
assert(source.includes("Remove ${item.title} for all company users?"),
  "Removal must clearly warn that the shared document affects all users");

console.log("Company Knowledge Library regression checks passed.");
