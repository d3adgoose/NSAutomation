const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = [
  "submittal-page-selection.js",
  "submittal.js"
].map(file => fs.readFileSync(path.join(__dirname, "..", file), "utf8")).join("\n");
const submittalHtml = fs.readFileSync(path.join(__dirname, "..", "submittal.html"), "utf8");
const omHtml = fs.readFileSync(path.join(__dirname, "..", "om.html"), "utf8");

for (const [name, html] of [["submittal.html", submittalHtml], ["om.html", omHtml]]) {
  const featureIndex = html.indexOf('src="submittal-page-selection.js');
  const managerIndex = html.indexOf('src="submittal-page-manager.js');
  const mainIndex = html.indexOf('src="submittal.js');
  assert(featureIndex >= 0, `${name} must load the extracted page-selection feature.`);
  assert(managerIndex > featureIndex, `${name} must load the page manager after page selection.`);
  assert(mainIndex > managerIndex, `${name} must load extracted page features before submittal.js.`);
}

function declaration(name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `Missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;

  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }

  throw new Error(`Unclosed ${name}`);
}

function declarationUntil(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert(start >= 0 && end > start, `Missing ${name} or ${nextName}`);
  return source.slice(start, end);
}

const elementsBySelector = {
  ".pdf-page-preview": [1, 2, 3],
  ".page-manager-card": [1, 2]
};
const elements = Object.fromEntries(
  Object.entries(elementsBySelector).map(([selector, pages]) => [
    selector,
    pages.map(pageNumber => {
      const classes = new Set();
      return {
        dataset: { pageNumber: String(pageNumber) },
        classes,
        classList: {
          toggle(name, enabled) {
            if (enabled) classes.add(name);
            else classes.delete(name);
          }
        }
      };
    })
  ])
);
const statusElements = {
  pageManagerStatus: { textContent: "" },
  subsectionPageSelectionStatus: { textContent: "" }
};
const context = {
  document: {
    querySelectorAll(selector) {
      return elements[selector] || [];
    },
    getElementById(id) {
      return statusElements[id] || null;
    }
  }
};

vm.createContext(context);
vm.runInContext(
  [
    "let selectedManagedPages = new Set();",
    declarationUntil("setManagedPageSelection", "selectAllSubsectionPages"),
    declaration("selectAllSubsectionPages"),
    declaration("clearSubsectionPageSelection"),
    declaration("selectAllManagedPages"),
    declaration("clearManagedPageSelection"),
    "this.selectedPages = () => Array.from(selectedManagedPages);"
  ].join("\n"),
  context
);

const selectedPages = () => [...context.selectedPages()];

context.selectAllSubsectionPages();
assert.deepStrictEqual(selectedPages(), [1, 2, 3]);
assert(elements[".pdf-page-preview"].every(element => element.classes.has("page-action-selected")));
assert.strictEqual(statusElements.subsectionPageSelectionStatus.textContent, "3 of 3 page(s) selected for PDF actions");

context.clearSubsectionPageSelection();
assert.deepStrictEqual(selectedPages(), []);
assert(elements[".pdf-page-preview"].every(element => !element.classes.has("page-action-selected")));
assert.strictEqual(statusElements.subsectionPageSelectionStatus.textContent, "0 of 3 page(s) selected for PDF actions");

context.selectAllManagedPages();
assert.deepStrictEqual(selectedPages(), [1, 2]);
assert(elements[".page-manager-card"].every(element => element.classes.has("selected")));
assert.strictEqual(statusElements.pageManagerStatus.textContent, "2 of 2 page(s) selected");

context.clearManagedPageSelection();
assert.deepStrictEqual(selectedPages(), []);
assert(elements[".page-manager-card"].every(element => !element.classes.has("selected")));
assert.strictEqual(statusElements.pageManagerStatus.textContent, "0 of 2 page(s) selected");

console.log("Submittal page-selection tests passed.");
