const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const javascript = fs.readdirSync(root)
  .filter(file => file.endsWith(".js"))
  .map(file => fs.readFileSync(path.join(root, file), "utf8"))
  .join("\n");
const declaredFunctions = new Set(
  [...javascript.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)]
    .map(match => match[1])
);
const browserFunctions = new Set([
  "alert", "confirm", "prompt", "setTimeout", "clearTimeout",
  "Number", "String", "Boolean", "Array", "Object", "Date",
  "parseInt", "parseFloat", "encodeURIComponent", "decodeURIComponent"
]);
const missing = [];

for (const htmlFile of fs.readdirSync(root).filter(file => file.endsWith(".html"))) {
  const html = fs.readFileSync(path.join(root, htmlFile), "utf8");
  const handlers = html.matchAll(
    /\son(?:click|change|input|submit|keydown|dragover|drop)=["']([^"']*)["']/gi
  );

  for (const handler of handlers) {
    for (const call of handler[1].matchAll(/\b([A-Za-z_$][\w$]*)\s*\(/g)) {
      const name = call[1];
      if (!declaredFunctions.has(name) && !browserFunctions.has(name)) {
        missing.push(`${htmlFile}: ${name}`);
      }
    }
  }
}

assert.deepStrictEqual(
  [...new Set(missing)],
  [],
  `Inline HTML handlers have no matching JavaScript function: ${missing.join(", ")}`
);

console.log("HTML handler coverage checks passed.");
