const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const source = fs.readFileSync(require("path").join(__dirname, "..", "specification.js"), "utf8");

function declaration(name) {
  const start = source.indexOf(`function ${name}(`);
  assert(start >= 0, `Missing ${name}`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") { quote = char; continue; }
    if (char === "{") depth += 1;
    if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Unclosed ${name}`);
}

function declarationUntil(name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start);
  assert(start >= 0 && end > start, `Missing ${name} or ${nextName}`);
  return source.slice(start, end);
}

const context = { console };
vm.createContext(context);
const extractedDeclarations = [
  declaration("sanitizeExtractedSpecText"),
  declaration("identifySpecEquipmentContext"),
  declaration("normalizeExtractedSpecCapitalization"),
  declaration("extractEquipmentTechnicalFields"),
  declaration("extractStructuredSpecEquipmentRecords"),
  declarationUntil("extractStructuredSpecFillIns", "sanitizeExtractedSpecText"),
  declarationUntil("cleanOandMOcrSpacing", "extractLegacyEquipmentSpecificationSections"),
  declaration("extractOandMProductDescriptionSuggestions"),
  declaration("convertOandMSentenceToSpecification"),
  declarationUntil("deriveOandMPart2Suggestions", "cleanOandMOcrSpacing"),
  declarationUntil("extractSpecTocProductsV2", "isSpecSourceBoilerplate"),
  declaration("isSpecSourceBoilerplate"),
  declarationUntil("formatSpecificationEditorText", "handleSpecificationEditorTab"),
  declaration("replaceApprovedEquipmentListInPart2"),
  declaration("renumberSpecificationHierarchy"),
  declarationUntil("insertSpecSuggestionAtArticle", "formatSpecSuggestionForDestination"),
  declaration("getVehicleTypeForEquipmentType")
].join("\n");
vm.runInContext(extractedDeclarations, context);

assert.strictEqual(context.renumberSpecificationHierarchy("2.5 PRODUCTS\nC. Pump\n4. First\n9. Second\nq. Detail\n(7) Detail two\nD. Controls\n8. Restarted"), "2.5 PRODUCTS\nA. Pump\n1. First\n2. Second\na. Detail\n(1) Detail two\nB. Controls\n1. Restarted");

const nestedReclaimDescription = context.insertSpecSuggestionAtArticle(
  "2.2 EQUIPMENT LIST\nA. Principal equipment:\n1. Brush System\n2. Activation System\n3. Reclaim Pump\n4. RO Pump\n\n2.3 SYSTEM OPERATION",
  { article: "2.2" },
  "Reclaim Pump:\n1. Pump shall discharge reclaim water to the Brush System.\n2. Pump shall activate with the Brush System.",
  { equipmentContext: "Reclaim Pump", placementLevel: "auto" }
);
assert(nestedReclaimDescription.includes("3. Reclaim Pump\na. Pump shall discharge reclaim water to the Brush System.\nb. Pump shall activate with the Brush System.\n4. RO Pump"), `A matching numbered equipment description should nest one level beneath that equipment item.\n${nestedReclaimDescription}`);

const chicago = `
PART 2 - PRODUCTS
WASH SYSTEM TECHNICAL SPECIFICATIONS:
Chemical Mixing Booster Pump
Chemical mixing system comes with a vertical multistage stainless steel water supply booster pump of 7.5HP capable of delivering 70GPM @ 70PSI.
Make: Grundfos
Model: CR Series
Or Approved Equal.
One (1) pH Sensor installed on the mixing tank.
Make: ABB
Model: TB551
Or Approved Equal.
PART 3 - EXECUTION
`;
assert.strictEqual(context.sanitizeExtractedSpecText("3/16\u00e2\u20ac\u009d and \u00c2\u00bc\u00e2\u20ac\u009d"), '3/16" and 1/4"');

const records = context.extractStructuredSpecEquipmentRecords(chicago);
assert.strictEqual(records.length, 2);
assert.deepStrictEqual(JSON.parse(JSON.stringify(records[0].fields.power)), ["7.5HP"]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(records[0].fields.flow)), ["70GPM"]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(records[0].fields.pressure)), ["70PSI"]);
assert.strictEqual(records[0].manufacturer, "Grundfos");
assert.strictEqual(records[0].model, "CR Series");
assert.strictEqual(records[1].description, "One (1) pH Sensor installed on the mixing tank.");
assert.strictEqual(records[1].quantity, 1);

const brush = `
PART 9: PRODUCTS: 4-BRUSH AUTOMATIC DRIVE-THROUGH
Brush Motor:
The motor shall be a 3 HP washdown-duty motor suitable for the brush module.
Manufacturer: Baldor or Approved Equal.
Model: EM3615T
PART 10: EXECUTION
`;
const brushRecords = context.extractStructuredSpecEquipmentRecords(brush);
assert.strictEqual(brushRecords.length, 1);
assert.strictEqual(brushRecords[0].description, "Brush Motor");
assert.strictEqual(brushRecords[0].manufacturer, "Baldor");
assert.strictEqual(brushRecords[0].model, "EM3615T");
assert.strictEqual(brushRecords[0].confidence, "High");

console.log("Specification equipment extraction tests passed.");

const activationPage = `28309 Ave Crocker, Valencia, California 91355 Ph: 310.412.7074 Activation System NS Part#: SYS - 90 - R & SYS - 90 - RA Product Description: The activation system is emitter/receiver type, and the main function is to activate wash system components. The system is automatically activated by the vehicle and deactivates based on a pre-programmed timer. Emitter and Receiver require 24VAC. Please refer to attached data sheets and fabrication drawings. Manufacturers of Vehicle Cleaning Equipment Since 1961 132 Rev.`;
const activation = context.extractOandMProductDescriptionSuggestions(activationPage);
assert.strictEqual(activation.length, 1);
assert.strictEqual(activation[0].equipmentContext, "Activation System");
assert.strictEqual(activation[0].destinationArticle, "2.5");
assert(!/Ave Crocker|310\.412|Manufacturers of Vehicle|attached data/i.test(activation[0].text));
assert(/SYS-90-R & SYS-90-RA/.test(activation[0].text));

const reclaimPage = `10hp Reclaim Pump NS Part #: RC-1000 Product Features: The 10hp Reclaim Pump pumps reclaim water from the existing sand/mud trap and discharges it to the Brush System during the wash cycle. The pump will activate when the Brush System activates. The Reclaim Pump consists of: o Aluminum Pump Stand (NS Part #: 900-0543) o 10hp TEFC Motor (NS Part #: 210-6208) Installation Note: All anchor bolts are to be supplied by the installer.`;
const reclaim = context.extractOandMProductDescriptionSuggestions(reclaimPage);
assert.strictEqual(reclaim.length, 1);
assert.strictEqual(reclaim[0].equipmentContext, "Reclaim Pump");
assert(!/anchor bolts|installer/i.test(reclaim[0].text));
assert.strictEqual(reclaim[0].subcomponents.length, 2);
assert(/Included components/.test(reclaim[0].text));
assert(/\na\. Aluminum Pump Stand/.test(reclaim[0].text));

const rinseArches = context.extractOandMProductDescriptionSuggestions(`Rinse Arches (RO & FreshWater) NS Part#: DIA-100 Product Description: The rinse arches rinse the vehicle with RO and freshwater after the Brush System wash cycle.`);
assert.strictEqual(rinseArches.length, 1);
assert.strictEqual(rinseArches[0].equipmentContext, "Rinse Arches");

const genericMotorTable = `AC Induction Motor Performance Data 460 V, 60 Hz Typical performance - not guaranteed values Product Information Packet EM3711T Engineering Selection Methods and Installation Instructions`;
assert.strictEqual(context.extractOandMProductDescriptionSuggestions(genericMotorTable).length, 0);

console.log("Strict O&M extraction tests passed.");

const toc = `TABLE OF CONTENTS
IV. Datasheets
- Brush System ........ 43
Activation System
134
148 - Reclaim Pump
1 HP RO Pump 249
Spray Nozzles ........ 131
V. Warranty`;
const tocProducts = context.extractSpecTocProductsV2(toc);
assert.deepStrictEqual(JSON.parse(JSON.stringify(tocProducts.map(item => [item.description, item.referencePage]))), [
  ["Brush System", 43], ["Activation System", 134], ["Reclaim Pump", 148], ["1 HP RO Pump", 249], ["Spray Nozzles", 131]
]);
const fullOandMToc = `TABLE OF CONTENTS
IV. Datasheets
• Brush System ................................ 41
- 1/2Hp Brush Motor ........................... 48
- 1Hp Brush Motor ............................. 53
- 15:1 Gear Reducer ........................... 81
- 40:1 Gear Reducer ........................... 99
- Chemical Pump .............................. 117
- Spray Nozzles .............................. 129
• Activation System .......................... 132
• 10Hp Reclaim System ........................ 146
- 10Hp Pump .................................. 183
- Coupling Elements .......................... 193
- PAC II Filter .............................. 209
- 1/2Hp Sump Pump ............................ 227
- Aluminum Stand ............................. 244
- Reclaim Filter Basket ...................... 246
• 1Hp RO Pump ................................ 247
• Curb Rails ................................. 266
• Rinse Arches ............................... 268
• RO Console ................................. 277
• Miscellaneous Components ................... 339
- 1" Solenoid Valve (brass) .................. 340
- 1" Solenoid Valve (PVC) .................... 346
- 1-1/2" Solenoid Valve (brass) .............. 354
- 750 Gallon Tank ............................ 362
- Float Switches ............................. 364
V. Shop Drawing`;
const fullTocProducts = context.extractSpecTocProductsV2(fullOandMToc);
assert(fullTocProducts.length >= 25, "The complete O&M datasheet index should retain principal equipment and child parts.");
assert.strictEqual(fullTocProducts.find(item => item.description === "Chemical Pump")?.parentDescription, "Brush System");
assert.strictEqual(fullTocProducts.find(item => item.description === "PAC II Filter")?.parentDescription, "10Hp Reclaim System");
const vendorInstructions = `CONTENTS
Check your local codes before installing. You must comply with their rules 2
Before installing or servicing your pump, BE CERTAIN pump power source is disconnected 5
CDU120/1-1HP ........ 1`;
const vendorProducts = context.extractSpecTocProductsV2(vendorInstructions);
assert.deepStrictEqual(JSON.parse(JSON.stringify(vendorProducts.map(item => item.description))), ["CDU120/1-1HP"]);

const guidedProduct = `Custom Spot-Free Water Generator NS Part #: RO-500 Product Description: The generator supplies treated rinse water to the final rinse arch at the required operating flow.`;
const guided = context.extractOandMProductDescriptionSuggestions(guidedProduct, ["Custom Spot-Free Water Generator"]);
assert.strictEqual(guided.length, 1);
assert.strictEqual(guided[0].equipmentContext, "Custom Spot-Free Water Generator");
const untabledProduct = `28309 Ave Crocker Valencia California Rev. Chemical Solution Mixing Skid NS Part #: CMS-200 Product Description: The skid mixes chemical solution and supplies it to the application arch during the wash cycle.`;
const untabled = context.extractOandMProductDescriptionSuggestions(untabledProduct);
assert.strictEqual(untabled.length, 1);
assert.strictEqual(untabled[0].equipmentContext, "Chemical Solution Mixing Skid");
const phonePrefixed = context.extractOandMProductDescriptionSuggestions(`310.673.0276 Curb Rail NS Part #: SCR-100 Product Description: The curb rail is fabricated from galvanized steel pipe. Please refer to the drawing below. Quality Management System Certified by DNV ISO 9001:2008`);
assert.strictEqual(phonePrefixed[0].equipmentContext, "Curb Rail");
assert(!/310\.673|Please refer|Quality Management/i.test(phonePrefixed[0].text));
assert.strictEqual(context.cleanOandMOcrSpacing("Th e pump provide s water from the tan k through pvc sch 80 piping ."), "The pump provides water from the tank through PVC Schedule 80 piping.");
assert.strictEqual(context.cleanOandMOcrSpacing("Pre-programmer timer for Side-to - Side motion."), "pre-programmed timer for side-to-side motion.");
assert.strictEqual(context.normalizeOandMPartNumber("PMP-00 1 RP"), "PMP-001RP");
assert.strictEqual(context.splitOandMSentences("Galvanized steel pipe, 3 dia. with welded anchors. Factory coated.").length, 2);
assert.strictEqual(context.removeTrailingOandMFragment("Water is pumped through the filter. The 10 HP Reclaim Pump", "Reclaim Pump"), "Water is pumped through the filter.");

const tankProduct = context.extractOandMProductDescriptionSuggestions(`
750 Gallon Tank
NS Part#: XXXX-XXXX
Product Description:
The 750-gallon tank dimensions are: 48" Dia. and 112" Height.
Please see the shop drawings for detail.
`, ["750 Gallon Tank"]);
assert.strictEqual(tankProduct.length, 1);
assert.strictEqual(tankProduct[0].equipmentContext, "750 Gallon Tank");
assert(context.deriveOandMPart2Suggestions(tankProduct[0]).some(item => item.destinationArticle === "2.4"));

const activationDestinations = context.deriveOandMPart2Suggestions(activation[0]);
assert.deepStrictEqual(JSON.parse(JSON.stringify(activationDestinations.map(item => item.destinationArticle))), ["2.3", "2.6"]);
assert(!/Activation System -/.test(activationDestinations[0].text));
const brushProduct = context.extractOandMProductDescriptionSuggestions(`Brush System NS Part #: ECO-3 Product Description: The brush system automatically activates as the vehicle enters. The structure is fabricated from aluminum tubing with PVC Schedule 80 piping and stainless steel anchor bolts.`, ["Brush System"])[0];
const brushDestinations = context.deriveOandMPart2Suggestions(brushProduct);
assert.deepStrictEqual(JSON.parse(JSON.stringify(brushDestinations.map(item => item.destinationArticle))), ["2.3", "2.7"]);
const performanceProduct = { equipmentContext: "Booster Pump", text: `Booster Pump:\n1. Manufacturer: N/S Corporation.\n2. N/S part number: BP-1.\n3. The pump is capable of delivering 70 GPM at 70 PSI.` };
assert.deepStrictEqual(JSON.parse(JSON.stringify(context.deriveOandMPart2Suggestions(performanceProduct).map(item => item.destinationArticle))), ["2.4"]);

const executionFillIns = context.extractStructuredSpecFillIns(`
The owner's personnel shall be trained for a minimum of 4 hours in system operation and maintenance.
Perform consecutive 15 trouble-free train washes to demonstrate reliability.
Three (3) copies of the system Operations and Maintenance Manuals shall be provided.
All field plumbing and mechanical work will be done by the general contractor or his designated mechanical contractor.
All field electrical work will be done by the general contractor or his designated electrical contractor.
The Contractor shall undertake the commissioning of the system.
The acceptance testing shall be conducted in four stages.
Warranty work specified herein shall be for two (2) years from the start-up and commissioning of the wash equipment.
`);
const fillValue = (part, placeholder) => executionFillIns.find(item => item.part === part && item.placeholder === placeholder)?.value;
assert.strictEqual(fillValue("part3", "[TRAINING HOURS]"), "4");
assert.strictEqual(fillValue("part3", "[REQUIRED TROUBLE-FREE CYCLES]"), "15");
assert.strictEqual(fillValue("part3", "[O&M MANUAL QUANTITY]"), "Three copies");
assert.strictEqual(fillValue("part3", "[WARRANTY PERIOD]"), "two years");
assert.strictEqual(fillValue("part3", "[WARRANTY START EVENT]"), "startup and commissioning of the wash equipment");
assert(fillValue("part3", "[FIELD PLUMBING RESPONSIBLE PARTY]").toLowerCase().includes("general contractor"));
assert(fillValue("part3", "[FIELD ELECTRICAL RESPONSIBLE PARTY]").toLowerCase().includes("general contractor"));
assert.strictEqual(fillValue("part3", "[ACCEPTANCE TEST PROCEDURE]"), "a four-stage manual, activation, vehicle, and consecutive reliability test procedure");

console.log("TOC-guided extraction tests passed.");

const equipmentListResult = context.replaceApprovedEquipmentListInPart2(`2.1 MANUFACTURERS
A. Manufacturer requirements.

    2.2 EQUIPMENT LIST
    A. Existing list:
        1. [MAIN EQUIPMENT]

    2.3 SYSTEM OPERATION
    A. Sequence.`, ["Brush System", "Activation System", "Reclaim Pump"]);
assert(equipmentListResult.includes("2.2  EQUIPMENT LIST"));
assert(equipmentListResult.includes("  A.  Refer to Drawings"));
assert(equipmentListResult.includes("    1.  Brush System"));
assert(equipmentListResult.includes("    2.  Activation System"));
assert(equipmentListResult.includes("    3.  Reclaim Pump"));
assert(!equipmentListResult.includes("[MAIN EQUIPMENT]"));
console.log("Approved equipment hierarchy tests passed.");
assert.strictEqual(context.getVehicleTypeForEquipmentType("Car Wash"), "passenger cars and light-duty vehicles");
assert.strictEqual(context.getVehicleTypeForEquipmentType("Truck Wash"), "trucks and heavy-duty vehicles");
assert.strictEqual(context.getVehicleTypeForEquipmentType("Train Wash"), "trainsets and rail vehicles");
assert.strictEqual(context.getVehicleTypeForEquipmentType("Transit Wash"), "transit buses and support vehicles");
