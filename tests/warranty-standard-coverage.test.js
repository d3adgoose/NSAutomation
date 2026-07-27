const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const warrantySource = fs.readFileSync(path.join(root, "submittal-warranty.js"), "utf8");

for (const htmlFile of ["submittal.html", "om.html"]) {
  const html = fs.readFileSync(path.join(root, htmlFile), "utf8");
  assert(html.includes('id="useStandardWarrantyCoverage"'));
  assert(html.includes("Accept Standard Coverage"));
  assert(html.includes("90 days labor and 1 year materials"));
}

assert(/materialDuration\.value\s*=\s*"1"/.test(warrantySource));
assert(/laborDuration\.value\s*=\s*"90"/.test(warrantySource));
assert(/laborUnit\.value\s*=\s*"days"/.test(warrantySource));

console.log("Standard warranty coverage checks passed.");
