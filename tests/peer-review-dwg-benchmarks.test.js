const assert = require("assert");
const fs = require("fs");
const path = require("path");
const rules = require("../peer-review-utils.js");

const benchmarkPath = path.join(__dirname, "fixtures", "peer-review-dwg-benchmarks.json");
const benchmark = JSON.parse(fs.readFileSync(benchmarkPath, "utf8"));

assert.strictEqual(benchmark.version, 1);
assert(benchmark.activationRule.includes("engineer-approved"));
assert(Array.isArray(benchmark.cases) && benchmark.cases.length >= 2);
assert.strictEqual(new Set(benchmark.cases.map(item => item.id)).size, benchmark.cases.length, "Benchmark IDs must be unique");
benchmark.cases.forEach(item => {
  assert(item.drawing.toLowerCase().endsWith(".dwg"));
  assert(Array.isArray(item.expectedFindings));
  assert(Array.isArray(item.knownFalsePositives));
  if (item.status === "engineer-approved") {
    assert(item.reviewedBy, `${item.id} needs an engineer-review source`);
    assert(item.expectedFindings.length || item.knownFalsePositives.length, `${item.id} must define an acceptance target`);
  }
});
assert(benchmark.cases.some(item => item.status !== "engineer-approved"), "Unreviewed DWGs must remain candidates instead of silently becoming truth");

const candidate3248 = benchmark.cases.find(item => item.id === "3248-tlh-qta-rev0-candidate");
assert(candidate3248.knownFalsePositives.some(item => item.includes("3B") && item.includes("vertically merged")), "The 3248 benchmark must retain the merged 3A/3B quantity regression");
assert(candidate3248.knownFalsePositives.some(item => item.includes("SCR-100") && item.includes("1C")), "The 3248 benchmark must retain the multirow 1C component regression");

const approved2481 = benchmark.cases.find(item => item.id === "2481-ehi-brooksville-rev0");
const approvedFindings = rules.buildPeerSameProjectReviewExampleFindings({
  filename: approved2481.drawing,
  pages: [{ projectNumber: "2481" }, { projectNumber: "2481" }, { projectNumber: "2481" }],
  equipmentRows: []
});
const actualIssues = new Set(approvedFindings.map(item => item.issue));
assert.strictEqual(approvedFindings.length, approved2481.expectedFindings.length);
approved2481.expectedFindings.forEach(issue => assert(actualIssues.has(issue), `Approved benchmark finding is missing from the deterministic reference: ${issue}`));

console.log("Peer Review DWG benchmark tests passed.");
