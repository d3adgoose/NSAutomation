const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.resolve(__dirname, "..", "specification.js"), "utf8");

assert(source.includes("candidate.autoRejectedSiblingIds = duplicateCandidates.map"),
  "Accepting a template value must remember competing pending suggestions");
assert(source.includes("item.rejectedByAcceptedFillId = candidate.id"),
  "Competing suggestions must be tied to the accepted value that dismissed them");
assert(source.includes("restoreAutoRejectedSiblings"),
  "Undoing an accepted value must restore only its automatically dismissed alternatives");
assert(source.includes("item.placeholder === candidate.placeholder"),
  "Only suggestions targeting the same template field may be dismissed");
assert(source.includes("function reconcileAcceptedSpecFillAlternatives()"),
  "Previously saved accepted values must dismiss matching alternatives when rendered");
assert(source.includes("reconcileAcceptedSpecFillAlternatives();"),
  "Existing projects must reconcile duplicate template suggestions before display");

console.log("Specification fill-in deduplication checks passed.");
