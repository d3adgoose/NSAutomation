const assert = require("assert");
const fs = require("fs");
const path = require("path");
const rules = require("../peer-review-utils.js");

assert.strictEqual(rules.PEER_REVIEW_TYPES.overall.label, "Overall Peer Review");
assert.strictEqual(rules.PEER_REVIEW_TYPES.overall.available, true);

assert.strictEqual(rules.normalizePeerValue("P-101", "tag"), rules.normalizePeerValue("p 101", "tag"));
assert.strictEqual(rules.normalizePeerValue("3 phase", "phase"), rules.normalizePeerValue("3PH", "phase"));
assert.strictEqual(rules.peerValuesEquivalent("460 Volts", "460V", "voltage"), true);
assert.strictEqual(rules.mapPeerEquipmentHeader("Mfr"), "manufacturer");

const equipment = rules.runPeerEquipmentRules([
  { tag: "P-101", manufacturer: "Acme", page: 2, presentColumns: ["tag", "manufacturer"] },
  { tag: "P 101", manufacturer: "Acme", page: 3, presentColumns: ["tag", "manufacturer"] },
  { tag: "", manufacturer: "", page: 4, presentColumns: ["tag", "manufacturer"] }
]);
assert(equipment.some(item => item.issue.includes("duplicate equipment tag")));
assert(equipment.some(item => item.issue.includes("missing equipment tag")));
assert(equipment.every(item => item.issue.startsWith("Potential inconsistency")));

const initial = rules.runPeerInitialRules([{ number: 1, text: "", blank: true, drawingNumber: "", projectNumber: "", pageNumberDetected: false, fingerprint: "" }]);
assert.strictEqual(initial.length, 1);
assert(initial[0].issue.includes("image-only"));
assert(initial[0].details.includes("text recognition"));

const selectableInitial = rules.runPeerInitialRules([{ number: 1, text: "TITLE BLOCK TEXT", blank: false, drawingNumber: "", projectNumber: "", pageNumberDetected: false, fingerprint: "title block text" }]);
assert(!selectableInitial.some(item => item.issue.includes("was not detected")));

const namingPages = [
  { number: 1, drawingNumber: "WS-1.0", projectNumber: "2481", sheetNumber: 1, sheetTotal: 3, sheetTitle: "EQUIPMENT LAYOUT" },
  { number: 2, drawingNumber: "WS-2.0", projectNumber: "2481", sheetNumber: 2, sheetTotal: 3, sheetTitle: "FLOW LAYOUT" },
  { number: 3, drawingNumber: "ES-3.0", projectNumber: "9999", sheetNumber: 4, sheetTotal: 4, sheetTitle: "ELECTRICAL LAYOUT" }
];
const naming = rules.runPeerNamingConventionRules(namingPages, "2481 - Example - Rev.0.pdf");
assert(naming.some(item => item.issue.includes("different naming prefix")));
assert(naming.some(item => item.issue.includes("does not match the uploaded filename")));
assert(naming.some(item => item.issue.includes("sheet number does not match")));
assert(naming.some(item => item.issue.includes("sheet total does not match")));

const sharedDrawingSeries = [
  { number: 1, text: "TITLE", fingerprint: "sheet one", drawingNumber: "WS-1.0", projectNumber: "1543", sheetNumber: 1, sheetTotal: 3, pageNumberDetected: true },
  { number: 2, text: "TITLE", fingerprint: "sheet two", drawingNumber: "WS-1.0", projectNumber: "1543", sheetNumber: 2, sheetTotal: 3, pageNumberDetected: true },
  { number: 3, text: "TITLE", fingerprint: "sheet three", drawingNumber: "WS-1.0", projectNumber: "1543", sheetNumber: 3, sheetTotal: 3, pageNumberDetected: true }
];
assert(!rules.runPeerInitialRules(sharedDrawingSeries).some(item => item.issue.includes("duplicate drawing")));
assert(!rules.runPeerNamingConventionRules(sharedDrawingSeries, "1543 - Example - Rev.0.pdf").some(item => item.issue.includes("duplicate drawing")));

const repeatedDrawingSheet = sharedDrawingSeries.map(page => ({ ...page }));
repeatedDrawingSheet[1].sheetNumber = 1;
assert(rules.runPeerNamingConventionRules(repeatedDrawingSheet, "1543 - Example - Rev.0.pdf").some(item => item.issue.includes("duplicate drawing and sheet number")));

const equipmentNames = rules.runPeerEquipmentNamingRules([
  { tag: "P-101", description: "5HP Reclaim Pump", page: 1 },
  { tag: "P 101", description: "5 HP Reclaim Pump", page: 2 },
  { tag: "P-101", description: "10HP Reclaim Pump", page: 3 }
]);
assert(equipmentNames.some(item => item.issue.includes("same equipment tag uses different equipment names")));

[
  ["7A", "PRESSURE GAUGE, LIQUID-FILLED (0-100 PSI) SET TO 60 PSI"],
  ["8A", "UNION, PVC"],
  ["9A", "BALL VALVE, PVC (NORMALLY CLOSED)"],
  ["10A", "BRAIDED HOSE, NON-COLLAPSIBLE, 12 IN MIN."],
  ["11A", "SOLENOID VALVE, NORMALLY CLOSED, PVC, 24V"],
  ["14B", "FOOT VALVE, DEMA 100-11P"]
].forEach(([tag, description]) => assert.strictEqual(rules.isPeerMajorEquipmentRow({ tag, description }), false));
assert.strictEqual(rules.isPeerMajorEquipmentRow({ tag: "6", description: "1500 GAL RO REJECT/RECLAIM TANK" }), true);
assert.strictEqual(rules.isPeerMajorEquipmentRow({ tag: "6A", description: "5HP RECLAIM PUMP AND STAND" }), true);
assert.strictEqual(rules.getPeerEquipmentShortDescription("BRUSH SYSTEM: INCLUDES ALUMINUM STRUCTURE WITH 4 LEG SUPPORTS"), "BRUSH SYSTEM");
assert.strictEqual(rules.getPeerEquipmentShortDescription("1500 GALLON RO WATER TANK (DIMENSIONS = 66 X 126 HT.)"), "1500 GALLON RO WATER TANK");
assert.strictEqual(rules.peerEquipmentNamesEquivalent("BRUSH SYSTEM PACKAGE", "BRUSH SYSTEM"), true);
assert.strictEqual(rules.peerEquipmentNamesEquivalent("5HP RECLAIM SYSTEM", "5HP RECLAIM PUMP"), true);
assert.strictEqual(rules.peerEquipmentNamesEquivalent("RO CONSOLE", "RO CONSOLE"), true);
assert.strictEqual(rules.peerEquipmentNamesEquivalent("ANTI-SCALANT", "CARBON FILTER"), false);
assert.strictEqual(rules.isPeerMarkupColor(236, 45, 160), true);
assert.strictEqual(rules.isPeerMarkupColor(220, 35, 35), true);
assert.strictEqual(rules.isPeerMarkupColor(40, 40, 40), false);
assert.strictEqual(rules.isPeerMarkupColor(40, 40, 220), false);

const peerReviewSource = fs.readFileSync(path.join(__dirname, "..", "peer-review.js"), "utf8");
assert(peerReviewSource.includes("retrying each half separately"));
assert(peerReviewSource.includes("/\\bPARTS LIST\\b/i.test(combined)"));
assert(peerReviewSource.includes("Regional requests cannot prove document-wide absence"));
assert(peerReviewSource.includes("if (claimsMissingCallout) return false"));
assert(peerReviewSource.includes("PART / ITEM DESCRIPTION"));
assert(peerReviewSource.includes("Reviewing both halves of page"));
assert(peerReviewSource.includes("confidence 0.35 or higher"));
assert(!peerReviewSource.includes('issue: "Drawing callout has no matching main equipment-list item"'));
assert(peerReviewSource.includes("Rule check · confirm source"));
console.log("Peer Review rule tests passed.");
