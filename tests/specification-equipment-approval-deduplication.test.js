const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.resolve(__dirname, "..", "specification.js"), "utf8");
const start = source.indexOf("function normalizeSpecExactEquipmentName");
const end = source.indexOf("function getApprovedTocEquipmentNames", start);
assert(start >= 0 && end > start, "Exact equipment-name approval helpers must exist.");
const sandbox = {};
vm.runInNewContext(source.slice(start, end), sandbox);

const normalize = sandbox.normalizeSpecExactEquipmentName;
const hideDuplicates = sandbox.hideApprovedExactEquipmentDuplicates;
assert.strictEqual(normalize("10hp reclaim pump"), normalize("10HP Reclaim Pump"));
assert.strictEqual(normalize("10-HP  Reclaim-Pump"), normalize("10HP Reclaim Pump"));
assert.notStrictEqual(normalize("10HP Reclaim Pump Assembly"), normalize("10HP Reclaim Pump"));

const candidates = [
  { id: "approved", description: "10HP Reclaim Pump", verificationStatus: "Engineer Approved" },
  { id: "same-case", description: "10hp reclaim pump", verificationStatus: "Needs Review" },
  { id: "same-spacing", description: "10 HP Reclaim-Pump", verificationStatus: "Needs Review" },
  { id: "extra-word", description: "10HP Reclaim Pump Assembly", verificationStatus: "Needs Review" }
];
assert.deepStrictEqual(Array.from(hideDuplicates(candidates), item => item.id), ["approved", "extra-word"]);
assert.deepStrictEqual(Array.from(hideDuplicates(candidates.map(item => ({ ...item, verificationStatus: "Needs Review" }))), item => item.id), candidates.map(item => item.id));
console.log("Specification exact equipment approval deduplication checks passed.");
