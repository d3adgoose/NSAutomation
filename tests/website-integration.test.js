const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const tabs = [
  "index.html", "database.html", "parts-library.html", "converter.html",
  "submittal.html", "om.html", "specification.html"
];
const packetScripts = [
  "submittal.js", "submittal-state-ui.js", "submittal-build.js",
  "submittal-warranty.js", "submittal-organizer.js", "submittal-pdf-output.js"
];

for (const htmlFile of tabs) {
  const html = fs.readFileSync(path.join(root, htmlFile), "utf8");
  const ids = [...html.matchAll(/\sid=["']([^"']+)["']/gi)].map(match => match[1]);
  const duplicateIds = [...new Set(ids.filter((id, index) => ids.indexOf(id) !== index))];
  assert.deepStrictEqual(duplicateIds, [], `${htmlFile} contains duplicate IDs.`);

  const references = [...html.matchAll(/(?:src|href)=["']([^"'#?]+)(?:\?[^"']*)?["']/gi)]
    .map(match => match[1])
    .filter(reference => !/^(?:https?:|data:|mailto:|javascript:|\/\/)/i.test(reference));
  references.forEach(reference => assert(
    fs.existsSync(path.resolve(root, reference)),
    `${htmlFile} references missing local file ${reference}.`
  ));

  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"'?]+)(?:\?[^"']*)?["']/gi)]
    .map(match => match[1]);
  const duplicateScripts = [...new Set(
    scripts.filter((script, index) => scripts.indexOf(script) !== index)
  )];
  assert.deepStrictEqual(duplicateScripts, [], `${htmlFile} loads duplicate scripts.`);

  const linkedTabs = new Set(
    [...html.matchAll(/<a\b[^>]*\bhref=["']([^"'#?]+\.html)["']/gi)]
      .map(match => match[1])
  );
  assert.deepStrictEqual(
    tabs.filter(tab => !linkedTabs.has(tab)),
    [],
    `${htmlFile} does not link to every website tab.`
  );

  const declarations = new Map();
  scripts.filter(script => !/^https?:/i.test(script)).forEach(script => {
    const source = fs.readFileSync(path.resolve(root, script), "utf8");
    const patterns = [
      ["lexical", /^(?:const|let|class)\s+([A-Za-z_$][\w$]*)/gm],
      ["global", /^(?:var\s+|(?:async\s+)?function\s+)([A-Za-z_$][\w$]*)/gm]
    ];
    patterns.forEach(([kind, pattern]) => {
      for (const match of source.matchAll(pattern)) {
        declarations.set(match[1], [...(declarations.get(match[1]) || []), { script, kind }]);
      }
    });
  });
  const conflicts = [...declarations].filter(([, entries]) =>
    new Set(entries.map(entry => entry.script)).size > 1 &&
    entries.some(entry => entry.kind === "lexical")
  );
  assert.deepStrictEqual(conflicts, [], `${htmlFile} has cross-script global conflicts.`);
}

for (const htmlFile of ["submittal.html", "om.html"]) {
  const html = fs.readFileSync(path.join(root, htmlFile), "utf8");
  const loaded = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"'?]+)(?:\?[^"']*)?["']/gi)]
    .map(match => match[1])
    .filter(script => packetScripts.includes(script));
  assert.deepStrictEqual(loaded, packetScripts, `${htmlFile} packet script order is invalid.`);
}

console.log("Whole-website integration checks passed.");
