const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const pages = [
  ["specification.html", "specification-utils.js", "specification.js"],
  ["converter.html", "converter-utils.js", "converter.js"],
  ["database.html", "database-utils.js", "database.js"],
  ["parts-library.html", "parts-library-utils.js", "partsLibrary.js"],
  ["submittal.html", "database-utils.js", "database.js"],
  ["om.html", "database-utils.js", "database.js"]
];

for (const [htmlFile, featureFile, mainFile] of pages) {
  const html = fs.readFileSync(path.join(root, htmlFile), "utf8");
  const featureIndex = html.indexOf(`src="${featureFile}`);
  const mainIndex = html.indexOf(`src="${mainFile}`);
  assert(featureIndex >= 0, `${htmlFile} does not load ${featureFile}.`);
  assert(mainIndex > featureIndex, `${htmlFile} must load ${featureFile} before ${mainFile}.`);
}

const families = [
  ["Specification", ["specification-utils.js", "specification.js"]],
  ["Converter", ["converter-utils.js", "converter.js"]],
  ["Database", ["database-utils.js", "database.js"]],
  ["Parts Library", ["parts-library-utils.js", "partsLibrary.js"]]
];

const packetScripts = [
  "submittal.js",
  "submittal-state-ui.js",
  "submittal-build.js",
  "submittal-warranty.js",
  "submittal-organizer.js",
  "submittal-pdf-output.js"
];

for (const htmlFile of ["submittal.html", "om.html"]) {
  const html = fs.readFileSync(path.join(root, htmlFile), "utf8");
  let previousIndex = -1;

  for (const scriptFile of packetScripts) {
    const scriptIndex = html.indexOf(`src="${scriptFile}`);
    assert(scriptIndex >= 0, `${htmlFile} does not load ${scriptFile}.`);
    assert(scriptIndex > previousIndex, `${htmlFile} loads packet scripts out of order.`);
    previousIndex = scriptIndex;
  }
}

families.push(["Packet Builder", packetScripts]);

for (const [label, files] of families) {
  const names = files.flatMap(file => {
    const source = fs.readFileSync(path.join(root, file), "utf8");
    return [...source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)]
      .map(match => match[1]);
  });
  const duplicates = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
  assert.deepStrictEqual(duplicates, [], `${label} scripts duplicate functions: ${duplicates.join(", ")}`);
}

console.log("Feature script-order checks passed.");
