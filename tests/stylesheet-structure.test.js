const assert = require("assert");
const fs = require("fs");
const path = require("path");

const cssPath = path.join(__dirname, "..", "style.css");
const css = fs.readFileSync(cssPath, "utf8");
const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, "");

let depth = 0;
let quote = "";
let escaped = false;

for (let index = 0; index < withoutComments.length; index += 1) {
  const character = withoutComments[index];

  if (quote) {
    if (escaped) escaped = false;
    else if (character === "\\") escaped = true;
    else if (character === quote) quote = "";
    continue;
  }

  if (character === '"' || character === "'") {
    quote = character;
    continue;
  }

  if (character === "{") depth += 1;
  if (character === "}") depth -= 1;
  assert(depth >= 0, `style.css has an unexpected closing brace near character ${index}.`);
}

assert.strictEqual(quote, "", "style.css has an unclosed quoted value.");
assert.strictEqual(depth, 0, "style.css has unbalanced braces.");
assert(!css.includes("<<<<<<<"), "style.css contains an unresolved merge conflict.");
assert(!css.includes(">>>>>>>"), "style.css contains an unresolved merge conflict.");

const simpleBlocks = [...withoutComments.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
for (const block of simpleBlocks) {
  const selector = block[1].trim().replace(/\s+/g, " ");
  const properties = [...block[2].matchAll(/(?:^|;)\s*([\w-]+)\s*:/g)]
    .map(match => match[1]);
  const duplicates = [...new Set(properties.filter((property, index) =>
    properties.indexOf(property) !== index
  ))];

  assert.deepStrictEqual(
    duplicates,
    [],
    `${selector} repeats properties in the same rule: ${duplicates.join(", ")}`
  );
}

console.log("Stylesheet structure checks passed.");
