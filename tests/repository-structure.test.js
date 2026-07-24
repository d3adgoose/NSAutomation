const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const sourceFiles = fs.readdirSync(root).filter(file => file.endsWith(".js"));

for (const file of sourceFiles) {
  const source = fs.readFileSync(path.join(root, file), "utf8");
  const declarations = [...source.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/gm)];
  const linesByName = new Map();

  for (const declaration of declarations) {
    const name = declaration[1];
    const line = source.slice(0, declaration.index).split("\n").length;
    linesByName.set(name, [...(linesByName.get(name) || []), line]);
  }

  const duplicates = [...linesByName]
    .filter(([, lines]) => lines.length > 1)
    .map(([name, lines]) => `${name} (lines ${lines.join(", ")})`);

  assert.deepStrictEqual(
    duplicates,
    [],
    `${file} contains duplicate top-level function declarations: ${duplicates.join("; ")}`
  );
}

console.log("Repository structure checks passed.");
