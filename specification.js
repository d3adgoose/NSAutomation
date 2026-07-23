const SPEC_STORAGE_KEY = "ns-specification-project-v1";
const SPEC_PART1_TEMPLATE_KEY = "ns-specification-part1-template-v1";
const SPEC_TEMPLATE_LIBRARY_KEY = "ns-specification-template-library-v1";
const SPEC_PACKET_TRANSFER_KEY = "ns-specification-packet-transfer-v1";
const SPEC_PARTS_KEY = "nsPartsDatabaseV1";
const SPEC_HISTORY_DB_NAME = "ns-specification-history-v1";
const SPEC_HISTORY_STORE = "exports";
const SPEC_SOURCE_DB_NAME = "ns-specification-sources-v1";
const SPEC_SOURCE_STORE = "files";
const SPEC_LOCAL_AI_EXAMPLES_KEY = "ns-spec-local-ai-examples-v1";
const SPEC_AI_WRITING_HISTORY_KEY = "ns-spec-ai-writing-history-v1";
const SPEC_STATUSES = ["Needs Review", "Database Verified", "Document Extracted", "Rule Calculated", "Manually Entered", "Engineer Approved"];
let specDocumentFiles = new Map();
let specAiAuthenticatedUser = null;
let specState = createEmptySpecificationState();
let specAutosaveTimer = null;
let specLocalAiStartedAt = 0;
let specLocalAiTimer = null;
let specLocalAiLastMessage = "";
let specLocalAiActiveSource = "";
const specProjectFieldTimers = new Map();
const SPEC_AUTOSAVE_DELAY = 900;
const SPEC_OPTIONAL_EQUIPMENT_WORKFLOW_ENABLED = false;

function getPart1StarterTemplate() {
  return `1.1 SUMMARY
A. Remove and dispose of the existing wash system where indicated.
B. The completed installation shall include an industrial-quality [EQUIPMENT TYPE] system configured for automatic drive-through operation unless otherwise indicated.
C. The Work shall include required rough-in work, equipment installation, final utility connections, labor, services, and incidental materials necessary for a complete installation.
D. The Work shall include piping, wiring, controls, and switching between the wash equipment and serving utilities.
E. System designation: [SYSTEM NAME / MODEL].

1.2 RELATED WORK
A. Drawings and general provisions of the Contract, including Contract Requirements and General and Supplementary Conditions, apply to this Section.
B. Coordinate the Work of this Section with the following:
1. Mechanical work.
2. Electrical work.
3. Plumbing work.
4. Site work.

1.3 QUALITY ASSURANCE
A. Manufacturer Qualifications: Equipment manufacturer shall have an established reputation and at least 10 years of documented experience supplying comparable equipment for high-volume transit-fleet applications.
B. Brush Flexible Couplings: Couplings shall have at least 10 years of documented successful operating experience in transit-fleet bus-wash applications.
C. Manufacturer's Representative:
1. Installation: A qualified manufacturer's representative shall be on site to oversee equipment installation, commissioning, and startup.
2. Training: A qualified technical representative shall train the Owner's maintenance personnel in operation and maintenance of the specified equipment.
3. Service: Qualified service personnel shall be available to respond promptly to equipment malfunctions during the warranty period.
D. Performance Responsibility:
1. Manufacturer or supplier shall design a system capable of effectively washing the Owner's vehicle fleet to the Owner's satisfaction.
2. Vehicle washer shall remove visible heavy dirt accumulation and the majority of road film from exterior vehicle surfaces, including rear surfaces.
3. Manufacturer or supplier shall be solely responsible for compliance with specified performance requirements and, at no additional cost to the Owner, shall make modifications, additions, or alterations required to achieve satisfactory performance. If the system does not meet specified performance criteria after corrective efforts, manufacturer or supplier shall remove the washer equipment and refund purchase amounts received from the Owner, whether directly or through the Contractor.
E. Water-Reclamation Odor Control: When a water-reclamation system is included, manufacturer or supplier shall guarantee effective odor control after final acceptance. During the warranty period, correct odor conditions without chemicals and at no additional cost to the Owner.

1.4 STANDARD AND REGULATORY REQUIREMENTS
A. Comply with applicable national, state, and local codes and regulations, including requirements governing seismic restraint, fire safety, equipment supports, and installation. Comply with additional requirements identified in individual equipment articles.
B. Comply with applicable Occupational Safety and Health Administration requirements, including 29 CFR Parts 1910 and 1926 as applicable to the Work.
C. Steel Pipe Dimensions: ASME B36.10, Welded and Seamless Wrought Steel Pipe.
D. Electrical Code: NFPA 70, National Electrical Code.
E. National Electrical Manufacturers Association Standards:
1. NEMA AB 1, Molded Case Circuit Breakers, Molded Case Switches, and Circuit-Breaker Enclosures.
2. NEMA MG 1, Motors and Generators.
F. Permitting: Contractor shall obtain permits required by the Authority Having Jurisdiction for individual equipment, including deferred equipment submittals, seismic anchorage, fire-marshal review, equipment installation, and testing when applicable. Owner shall obtain permits associated with utility connections and industrial or sanitary discharge unless otherwise indicated in the Contract Documents.
G. Domestic-Preference Requirements: When required by the Contract Documents or project funding source, comply with applicable Buy America, Build America Buy America, or other domestic-preference provisions. Submit documentation necessary to demonstrate compliance. Do not assume a domestic-preference program applies unless it is identified in the Contract Documents.

1.5 SUBMITTALS
A. Product Data:
1. Submit project-specific product data for proposed equipment, components, and accessories.
2. Clearly identify proposed project-specific items using arrows, circles, underlining, reproducible highlighting, or other readily discernible markings. Generic or unmarked product data may be rejected.
3. Limit submittals to information relevant to the Project; do not submit complete catalogs when required information is confined to selected pages.
B. Shop Drawings: Submit project-specific, scaled, and dimensioned drawings of the equipment at a minimum scale of 1/8 inch equals 1 foot, or larger using a standard architectural scale. Indicate equipment size, orientation, and location; dimensions relative to structural elements or architectural grid lines; operating clearances; utility connection points; mounting requirements; and required structural supports.
C. Vehicle Compatibility Verification: Submit written verification that the washer will satisfactorily wash vehicles operated by the Owner or on order at the time of bid.
D. Experience Documentation: Submit references demonstrating the manufacturer's required experience, including contact name, telephone number, and year of installation.

1.6 CLOSEOUT SUBMITTALS
A. Operation and Maintenance Manual:
1. At the time of installation, provide a complete parts list and operating and maintenance instructions, including the following:
a. Description of the system and its components.
b. Schematic diagrams of electrical, plumbing, and compressed-air systems.
c. Manufacturer's printed operating instructions.
d. List of periodic preventive-maintenance tasks and recommended frequencies required to maintain warranty coverage. If maintenance requirements are not provided, preventive maintenance shall not be considered a condition of warranty coverage.
e. List of original manufacturer's parts, supplier part numbers, product data, recommended spare-parts stocking quantities, and local parts and service sources.
2. Assemble manuals in 8-1/2-by-11-inch format. Foldout diagrams and illustrations are acceptable. Provide the quantity and delivery format required by Division 01 and the Contract Documents.

1.7 WARRANTY
A. Warrant the Work of this Section for [WARRANTY PERIOD] beginning on [WARRANTY START EVENT] unless a longer period is indicated elsewhere in the Contract Documents.
B. Warranty shall cover materials, labor, transportation, installation, and adjustments required to correct defects and shall be fulfilled promptly to minimize disruption to the Owner's operations.
C. Defects include noisy, rough, or substandard operation; loose, damaged, or missing components; and abnormal deterioration of finishes. Defects exclude damage resulting from neglect, misuse, or failure to perform documented manufacturer-recommended preventive maintenance.
D. Provide prompt response by qualified service personnel to minimize operational downtime.
E. Make replacement parts available within the United States and available for shipment within 48 hours.

1.8 DELIVERY, STORAGE, AND HANDLING
A. Deliver equipment in manufacturer's containers, appropriately packaged or crated to protect it during shipment and storage under humid or dusty conditions.
B. Indelibly label the outside of each container, including containers packed within other containers, with item descriptions corresponding to this Specification Section.
C. Deliver equipment and materials complete in one shipment for each equipment item. Split or partial shipments are not permitted unless approved in writing.

1.9 LABELING
A. Securely attach, in a prominent location on each major item of equipment, a non-corrosive nameplate showing the manufacturer's name, address, model number, serial number, and pertinent utility or operating data.
B. Label piping in vehicle-wash and water-reclamation systems to identify function and direction of flow.
C. Provide new electrical equipment and materials listed and labeled by a nationally recognized testing laboratory for the applicable use.
D. Maintain current ISO 9001 Quality Management System certification applicable to the design, engineering, manufacturing, or assembly of vehicle-wash equipment. Certification shall be valid at the time of bid and remain current through equipment fabrication and delivery. Submit evidence of certification with the manufacturer's qualifications package.`;
}

function getFixedPart1Sections() {
  return `1.2 WORK INCLUDED
A. Equipment items as specified herein and as shown on drawings by Equipment Identifier.
B. Installation
1. General Contractor shall provide final connection of all utilities, including disconnects, floor, piping, and conduit structures, with labor services and incidentals necessary for complete and operational equipment installation.
2. Installer shall be responsible for all system wiring and plumbing required for complete operation of the wash equipment after installation.
3. General Contractor shall coordinate all washer features that interface with building systems and are required beyond the roughed-in utilities and equipment disconnects between wash equipment components with the manufacturer before construction of the building and approval of the manufacturer’s shop drawings.

1.3 QUALITY ASSURANCE
A. All royalties and fees for patents covering materials, articles, apparatus, devices, or equipment (as distinguished from processes) shall be included in prices quoted by equipment suppliers. Attention is directed to the requirements of the General Conditions concerning patents.
B. Manufacturer’s Representative:
1. Installation: Provide a qualified manufacturer’s representative at the site to supervise work related to commissioning and start-up.
2. Training: Provide a technical representative to train Owner’s maintenance personnel in the operation and maintenance of specified equipment.
3. Service: Provide a qualified manufacturer’s representative to respond within 24 hours of an equipment malfunction during the warranty period.
C. Performance
1. Manufacturer’s representative of the washer system shall be responsible for the design of a washer that satisfactorily washes the owner’s vehicle fleet, specified in the drawings.
2. The equipment shall satisfactorily wash up to 4 (four) trainsets per hour.
3. The vehicle wash shall be able to remove most visible, heavy track film accumulation and most of the track film from the owner's vehicles when they are driven through the washer at 2 (two) miles per hour. The evaluation of the system capability to remove track film shall be determined only after the vehicles have dried after the washing has been completed.`;
}

function enforceFixedPart1Sections(text) {
  const value = String(text || "");
  if (!/^1\.2\s/m.test(value) || !/^1\.4\s/m.test(value)) return value;
  return value.replace(/^1\.2\s[\s\S]*?(?=^1\.4\s)/m, `${getFixedPart1Sections()}\n\n`);
}

function getDefaultPart1Submittals() {
  return `1.4 SUBMITTALS
A. Product Data
1. Submit product data and engineered drawings in strict accordance with the requirements of these specifications.
2. Submit full, detailed drawings of the wash-system equipment layout to the Engineer or Contractor for review. The term "drawings" includes fabrication, erection, installation, and layout drawings as requested. A list of materials and equipment and descriptive data pertaining to materials may be required to demonstrate that the materials, equipment, systems, and their positions comply with the Contract requirements. Draw all drawings to scale and completely dimension them. Wiring diagrams and plumbing schematics need not be drawn to scale.
3. Submit drawings on sheets not exceeding 24 by 36 inches. Submit drawings in triplicate as blackline or blueline prints. Submit manufacturer’s literature, brochures, catalog cuts, and other pertinent printed matter or data in triplicate.`;
}

function upgradeDefaultPart1Submittals(text) {
  const oldDefault = /^1\.4\s+SUBMITTALS\s*\n\s*A\.\s+Submit product data, equipment layouts, utility requirements, wiring information, installation instructions, and selected options\.\s*\n\s*B\.\s+Identify deviations from the specification and the basis for each proposed substitution\./m;
  return String(text || "").replace(oldDefault, getDefaultPart1Submittals());
}

function getDefaultPart1Labeling() {
  return `1.7 LABELING
A. Manufacturer shall securely attach, in a prominent location on each major item of equipment, a non-corrosive nameplate showing the manufacturer’s name, address, model number, serial number, and pertinent utility or operating data.
B. Label all piping in the vehicle-wash and water-reclaim systems to identify its function and direction of flow.
C. All electrical equipment and materials shall be new and shall be listed by Underwriters Laboratories Inc. (UL) in categories for which standards have been established by that agency and labeled as such at the manufacturer’s plant.
D. The vehicle-wash system manufacturer shall maintain a current ISO 9001 Quality Management System certification applicable to the design, engineering, manufacturing, or assembly of vehicle-wash equipment. This requirement is intended to verify that the manufacturer maintains a documented quality-management process supporting consistent production, quality control, and delivery of reliable, high-quality vehicle-wash equipment. The certification shall be valid at the time of bid and remain current throughout equipment fabrication and delivery. Submit evidence of certification with the manufacturer’s qualifications package.`;
}

function upgradeDefaultPart1Labeling(text) {
  const value = String(text || "");
  if (/^1\.7\s+LABELING\b/m.test(value)) return value;
  return value.replace(/^1\.7\s+WARRANTY\b/m, `${getDefaultPart1Labeling()}\n\n1.8 WARRANTY`);
}

function getPart2StarterTemplate() {
  return `2.1 MANUFACTURERS
A. Acceptable Manufacturers: Provide a manufacturer capable of meeting the requirements of the Contract Documents.
B. System designation or model: [SYSTEM NAME / MODEL].

2.2 EQUIPMENT LIST
A. Refer to Drawings for exact quantities and equipment locations. The system shall include, at a minimum, the following principal equipment:
1. [MAIN EQUIPMENT]

2.3 SYSTEM OPERATION
A. System Application:
1. System shall be a complete [EQUIPMENT TYPE] installation designed and configured to wash [VEHICLE TYPE].
2. System shall accommodate vehicles up to [MAXIMUM HEIGHT] in height.
3. System shall accommodate vehicles up to [MAXIMUM WIDTH] in width.

B. Operating Modes and Wash Functions:
1. System shall perform the following wash functions: [WASH FUNCTIONS].

C. Sequence of Operation:
1. [SEQUENCE OF OPERATION]

2.4 SYSTEM PERFORMANCE
A. Required cycle time or operating speed: [CYCLE TIME OR OPERATING SPEED].

B. The system shall:
1. Accommodate the specified vehicle envelope without damage to the vehicle or wash equipment.
2. Maintain stable operation and consistent cleaning performance throughout the operating cycle.
3. Retract or stop affected equipment upon an emergency stop, overspeed condition, loss of power, or other unsafe condition.
4. Permit vehicles to pass through the system without washing when the appropriate bypass or pass-through mode is selected.

2.5 EQUIPMENT TECHNICAL SPECIFICATIONS
A. General Equipment Requirements:
1. Equipment shall be designed for continuous operation in a wet, corrosive vehicle-wash environment.
2. Components shall be arranged for safe access, inspection, adjustment, cleaning, and maintenance.
3. Exposed moving parts shall be guarded, and required service clearances shall be identified.

B. Coordination:
1. The final system design shall be the manufacturer's responsibility and shall be submitted as a fully coordinated design in the shop drawings.

2.6 CONTROL SYSTEM TECHNICAL SPECIFICATIONS
A. Electrical Service:
1. Voltage: [VOLTAGE].
2. Phase: [PHASE].
3. Connected load or amperage: [AMPERAGE].

B. Main Control System:
1. Control system shall consist of [CONTROL PANEL / PLC / HMI DESCRIPTION].
2. Control system shall include automatic and manual operating modes, equipment-status indication, alarm display, and emergency-stop monitoring.
3. Operator interface shall display system faults and retain sufficient information to identify the affected equipment and fault condition.
4. Internal wiring shall terminate at identified terminal blocks. Field-connection labels shall correspond with approved wiring diagrams.

C. Safety and Interlocks:
1. Provide emergency-stop devices at operator and service locations shown on the Drawings.
2. Design interlocks so that a fault in one component places affected equipment in a safe condition.
3. Require a deliberate operator reset after an emergency-stop or safety shutdown.

2.7 MISCELLANEOUS REQUIREMENTS
A. Materials:
1. Main equipment structure shall be fabricated from [STRUCTURAL MATERIAL].
2. Materials exposed to the wash environment shall be suitable for continuous wet and corrosive service.
3. Provide corrosion-resistant fasteners, supports, brackets, piping, and hardware compatible with the materials joined.
4. Electrical enclosures in wash areas shall be corrosion resistant and rated for the installed environment.
5. Motors shall be suitable for the duty, location, and operating conditions indicated.

B. Utility Services:
1. System water-service connection shall be sized [CONNECTION SIZE].
2. System shall be designed for an available water pressure of [PRESSURE].
3. System shall be designed for an available water flow of [FLOW].
4. Compressed-air service requirement shall be [AIR REQUIREMENT OR NOT REQUIRED].
5. Chemical and water-reclaim requirements shall be [REQUIREMENTS OR NOT INCLUDED].

C. Equipment:
1. Starting and stopping of automatic wash equipment shall be controlled without requiring physical contact with the vehicle unless specifically indicated otherwise.
2. Provide identification labels corresponding with the approved drawings and control-system designations.
3. Provide valves, disconnects, and service points in accessible locations.

D. Options and Accessories:
1. System shall include the following options and accessories: [SELECTED OPTIONS AND ACCESSORIES].
2. Options shall be integrated with the main controls and safety interlocks when included.`;
}

function getPart3StarterTemplateLegacy() {
  return `3.1 SITE READINESS
A. Verify that foundations, wash-bay dimensions, drainage, utilities, and equipment access are ready before installation begins.

3.2 INSTALLATION
A. Install equipment according to N/S Corporation drawings and instructions.
B. Equipment installation responsibility: [RESPONSIBLE PARTY].
C. Field plumbing responsibility: [RESPONSIBLE PARTY].
D. Field electrical responsibility: [RESPONSIBLE PARTY].

3.3 STARTUP AND COMMISSIONING
A. N/S Corporation shall perform or supervise [STARTUP REQUIREMENT].
B. Correct installation and operating deficiencies before acceptance testing.

3.4 ACCEPTANCE TESTING
A. Demonstrate [NUMBER] complete operating cycles without system failure.
B. Verify operating sequences, safety devices, controls, and selected accessories.

3.5 TRAINING
A. Provide [TRAINING HOURS] hours of operator and maintenance training for the owner’s personnel.

3.6 CLOSEOUT
A. Provide final O&M manuals, approved drawings, warranty information, and service contacts.
B. Warranty period: [WARRANTY PERIOD].`;
}

function getPart3StarterTemplate() {
  return `3.1 SITE READINESS
A. Installer shall verify that foundations, wash-bay dimensions, drainage, utilities, and equipment access are ready before installation begins.
B. Installer shall verify equipment clearances, mounting surfaces, embedded items, and utility connection points against approved shop drawings.
C. Installer shall report conditions that prevent proper installation or operation before beginning equipment installation.

3.2 INSTALLATION
A. Installer shall install equipment according to N/S Corporation drawings and instructions.
B. [INSTALLATION RESPONSIBLE PARTY] shall be responsible for delivery, unloading, and equipment installation.
C. A qualified manufacturer's representative shall oversee installation when required.
D. [FIELD PLUMBING RESPONSIBLE PARTY] shall perform field plumbing work.
1. Connect water, compressed-air, drain, chemical, and process piping between services and equipment.
2. Provide required backflow preventers, valves, fittings, supports, and final connections.
E. [FIELD ELECTRICAL RESPONSIBLE PARTY] shall perform field electrical work.
1. Connect services, conduits, control wiring, and power wiring between equipment and utility points.
2. Identify field wiring and coordinate connections with approved control drawings.

3.3 STARTUP AND COMMISSIONING
A. [COMMISSIONING RESPONSIBLE PARTY] shall perform or supervise startup and commissioning.
B. Startup shall include [STARTUP REQUIREMENT].
C. Equipment and controls shall be adjusted to achieve the specified operating sequence and performance.
D. Installation and operating deficiencies shall be corrected before acceptance testing.

3.4 ACCEPTANCE TESTING
A. Commissioning party shall conduct acceptance testing using [ACCEPTANCE TEST PROCEDURE].
B. System shall complete [REQUIRED TROUBLE-FREE CYCLES] consecutive operating cycles without failure.
C. Testing shall demonstrate manual operation, vehicle-actuated automatic operation, operating sequences, safety devices, controls, alarms, interlocks, and selected accessories.
D. Preliminary testing shall use water before vehicles and chemicals are introduced.
E. Deficiencies shall be corrected, and affected tests shall be repeated until the system satisfies specified requirements.
F. Equipment or vehicle damage resulting from system failure during testing shall be repaired at no additional cost to the Owner.

3.5 TRAINING
A. Manufacturer shall submit a training schedule for the Owner's approval.
B. Manufacturer shall provide [TRAINING HOURS] hours of operator and maintenance training for the Owner's personnel.
C. Training shall be conducted on the installed equipment and shall cover operation, safety devices, maintenance, troubleshooting, and emergency procedures.
D. Instruction shall continue until designated personnel can correctly operate and maintain the equipment.

3.6 CLOSEOUT
A. Contractor shall provide [O&M MANUAL QUANTITY] of the final operation and maintenance manual at the time of training.
B. Manuals shall include system descriptions, approved drawings, electrical and piping schematics, operating instructions, preventive-maintenance schedules, parts lists, recommended spares, warranty information, and service contacts.
C. Manuals shall be furnished in 8-1/2 by 11-inch reproducible format. Foldout drawings are acceptable.
D. Closeout information shall include names and contact information for available service and maintenance personnel.

3.7 WARRANTY
A. Manufacturer shall warrant the Work for [WARRANTY PERIOD] beginning on [WARRANTY START EVENT].
B. Warranty shall cover defects in materials, labor, workmanship, installation, and required adjustments.
C. Defects include noisy, rough, or substandard operation; loose, damaged, or missing components; and abnormal finish deterioration.
D. Qualified service personnel and replacement parts shall be available promptly to minimize interruption of the Owner's operations.`;
}

function upgradePart3ExecutionFillIns(text) {
  const value = String(text || "");
  if (!value.includes("3.1 SITE READINESS") || value.includes("[INSTALLATION RESPONSIBLE PARTY]")) return value;
  const markers = ["Equipment installation responsibility: [RESPONSIBLE PARTY].", "Demonstrate [NUMBER] complete operating cycles without system failure.", "Provide final O&M manuals, approved drawings, warranty information, and service contacts."];
  return markers.every(marker => value.includes(marker)) ? getPart3StarterTemplate() : value;
}

function createEmptySpecificationState() {
  return {
    version: 2,
    id: crypto.randomUUID(),
    project: { projectNumber: "", sectionNumber: "111126", projectName: "", customer: "", equipmentType: "", vehicleType: "", systemName: "", engineer: "", revision: "0", date: new Date().toISOString().slice(0, 10), notes: "", part1: getPart1StarterTemplate(), part2: getPart2StarterTemplate(), part3: getPart3StarterTemplate() },
    documents: [], sourceSuggestions: [], fillInSuggestions: [], components: [], rules: [], specificationRows: [], projectFieldBindings: {}, fillInValues: {}, revisionHistory: [], aiAudit: [], updatedAt: new Date().toISOString()
  };
}

function normalizeSpecificationCollections(state) {
  ["documents", "sourceSuggestions", "fillInSuggestions", "components", "rules", "specificationRows", "revisionHistory", "aiAudit"].forEach(key => {
    if (!Array.isArray(state[key])) state[key] = [];
  });
  if (!state.projectFieldBindings || typeof state.projectFieldBindings !== "object" || Array.isArray(state.projectFieldBindings)) state.projectFieldBindings = {};
  if (!state.fillInValues || typeof state.fillInValues !== "object" || Array.isArray(state.fillInValues)) state.fillInValues = {};
  return state;
}

document.addEventListener("DOMContentLoaded", () => {
  bindSpecificationUI();
  loadSpecificationProject();
  restoreSpecificationSourceFiles();
  updateSpecAiDownloadGuidanceVisibility();
  window.addEventListener("ns-auth-session-changed", updateSpecAiDownloadGuidanceVisibility);
  window.addEventListener("spec-local-ai-message", event => recordSpecLocalAiMessage(event.detail?.message));
  if (new URLSearchParams(location.search).get("sample") === "1") loadSpecificationSampleData();
});

async function updateSpecAiDownloadGuidanceVisibility() {
  const help = document.getElementById("specAiLoggedInDownloadHelp");
  const banner = document.getElementById("specLocalAiBanner");
  const headerButton = document.getElementById("specAiHeaderButton");
  if (!window.supabaseClient) { help?.classList.add("hidden"); banner?.classList.add("hidden"); headerButton?.classList.add("hidden"); return; }
  const { data } = await window.supabaseClient.auth.getSession().catch(() => ({ data: null }));
  specAiAuthenticatedUser = data?.session?.user || null;
  help?.classList.toggle("hidden", !specAiAuthenticatedUser);
  banner?.classList.toggle("hidden", !specAiAuthenticatedUser);
  headerButton?.classList.toggle("hidden", !specAiAuthenticatedUser);
  renderSpecDocuments();
  if (specAiAuthenticatedUser && headerButton) {
    headerButton.classList.remove("is-ready", "is-error");
    headerButton.classList.add("is-checking");
    const label = headerButton.querySelector(".spec-ai-header-status-label");
    if (label) label.textContent = "Checking Local AI";
    try {
      const status = await SpecificationLocalAI.status();
      setSpecAiHeaderStatus(Boolean(status?.ready));
    } catch {
      setSpecAiHeaderStatus(false);
    }
  }
}

function setSpecAiHeaderStatus(ready) {
  const button = document.getElementById("specAiHeaderButton");
  if (!button) return;
  button.classList.remove("is-checking", "is-ready", "is-error");
  button.classList.add(ready ? "is-ready" : "is-error");
  const label = button.querySelector(".spec-ai-header-status-label");
  if (label) label.textContent = ready ? "Local AI Ready" : "Local AI Offline";
  button.title = ready ? "Local AI is connected. Open status details." : "Local AI is unavailable. Open status details.";
}

function openSpecLocalAiSources() {
  showSpecTab("sources");
  document.getElementById("specLocalAiBanner")?.scrollIntoView({ behavior: "smooth", block: "center" });
}

function openSpecificationSourceDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SPEC_SOURCE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(SPEC_SOURCE_STORE)) db.createObjectStore(SPEC_SOURCE_STORE, { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local source storage."));
  });
}

async function saveSpecificationSourceFile(id, file) {
  const db = await openSpecificationSourceDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SPEC_SOURCE_STORE, "readwrite");
    transaction.objectStore(SPEC_SOURCE_STORE).put({ id, projectId: specState.id, name: file.name, type: file.type || "application/octet-stream", lastModified: file.lastModified || Date.now(), blob: file, savedAt: new Date().toISOString() });
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { const error = transaction.error; db.close(); reject(error); };
  });
}

async function getSpecificationSourceFile(id) {
  const db = await openSpecificationSourceDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(SPEC_SOURCE_STORE, "readonly").objectStore(SPEC_SOURCE_STORE).get(id);
    request.onsuccess = () => { const record = request.result; db.close(); resolve(record ? new File([record.blob], record.name, { type: record.type, lastModified: record.lastModified }) : null); };
    request.onerror = () => { const error = request.error; db.close(); reject(error); };
  });
}

async function deleteSpecificationSourceFile(id) {
  const db = await openSpecificationSourceDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(SPEC_SOURCE_STORE, "readwrite");
    transaction.objectStore(SPEC_SOURCE_STORE).delete(id);
    transaction.oncomplete = () => { db.close(); resolve(); };
    transaction.onerror = () => { const error = transaction.error; db.close(); reject(error); };
  });
}

async function restoreSpecificationSourceFiles() {
  const documents = specState.documents || [];
  if (!documents.length) return;
  let restored = 0;
  await Promise.all(documents.map(async documentRecord => {
    try {
      const file = await getSpecificationSourceFile(documentRecord.id);
      if (!file) return;
      specDocumentFiles.set(documentRecord.id, file);
      documentRecord.storage = "Saved locally in this browser";
      restored += 1;
    } catch (error) { console.warn(`Could not restore ${documentRecord.name}:`, error); }
  }));
  renderSpecDocuments();
  if (restored) setSpecSourceStatus(`${restored} saved source file${restored === 1 ? "" : "s"} restored automatically.`, "is-complete");
}

function bindSpecificationUI() {
  document.querySelectorAll("[data-spec-tab]").forEach(button => button.addEventListener("click", () => showSpecTab(button.dataset.specTab)));
  document.querySelectorAll("[data-project-field]").forEach(field => field.addEventListener("input", () => {
    const key = field.dataset.projectField;
    specState.project[key] = field.value;
    if (key === "equipmentType") syncDerivedVehicleType(field.value);
    if (key === "notes") syncOptionalProjectNotes(field.value);
    if (SPEC_PROJECT_PLACEHOLDERS[key]) {
      clearTimeout(specProjectFieldTimers.get(key));
      specProjectFieldTimers.set(key, setTimeout(() => syncSpecificationProjectField(key, field.value), 350));
    }
    touchSpecificationProject();
  }));
  document.querySelectorAll("[data-project-field]").forEach(field => field.addEventListener("change", () => {
    const key = field.dataset.projectField;
    if (key === "equipmentType") syncDerivedVehicleType(field.value);
    if (SPEC_PROJECT_PLACEHOLDERS[key]) {
      clearTimeout(specProjectFieldTimers.get(key));
      syncSpecificationProjectField(key, field.value);
    }
  }));
  document.querySelectorAll('[data-project-field="part1"], [data-project-field="part2"], [data-project-field="part3"]').forEach(field => {
    field.addEventListener("keydown", handleSpecificationEditorTab);
    field.addEventListener("keydown", handleSpecificationEditorEnter);
    field.addEventListener("keydown", handleSpecificationEditorBackspace);
  });
  document.querySelectorAll("[data-fill-part][data-fill-placeholders]").forEach(indicator => {
    indicator.setAttribute("role", "button");
    indicator.setAttribute("tabindex", "0");
    indicator.addEventListener("click", () => openSpecificationFillIn(indicator));
    indicator.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      openSpecificationFillIn(indicator);
    });
  });
  document.getElementById("specComponentSearch")?.addEventListener("input", renderSpecComponents);
  document.getElementById("specComponentStatusFilter")?.addEventListener("change", renderSpecComponents);
  document.getElementById("specComponentSort")?.addEventListener("change", renderSpecComponents);
  const input = document.getElementById("specDocumentInput");
  input?.addEventListener("change", event => addSpecificationDocuments(event.target.files));
  const drop = document.getElementById("specDocumentDrop");
  drop?.addEventListener("dragover", event => { event.preventDefault(); drop.classList.add("dragover"); });
  drop?.addEventListener("dragleave", () => drop.classList.remove("dragover"));
  drop?.addEventListener("drop", event => { event.preventDefault(); drop.classList.remove("dragover"); addSpecificationDocuments(event.dataTransfer.files); });
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") saveSpecificationProject(false);
  });
  window.addEventListener("pagehide", () => saveSpecificationProject(false));
}

function showSpecTab(tab) {
  document.querySelectorAll("[data-spec-tab]").forEach(button => button.classList.toggle("active", button.dataset.specTab === tab));
  document.querySelectorAll(".spec-tab-panel").forEach(panel => panel.classList.toggle("hidden", panel.id !== `specTab-${tab}`));
  document.getElementById("specReviewLocalSaves")?.classList.toggle("hidden", tab !== "review");
  if (tab === "review") { renderSpecificationReview(); renderSpecificationLocalSaves(); }
  if (tab === "suggestions") { renderSpecSourceSuggestions(); renderExtractedSpecFillIns(); }
}

function touchSpecificationProject() {
  specState.updatedAt = new Date().toISOString();
  updateSpecificationFillIndicators();
  setSpecSaveStatus("Unsaved changes — autosaving...", "is-saving");
  updateSpecProjectTitle();
  clearTimeout(specAutosaveTimer);
  specAutosaveTimer = setTimeout(() => saveSpecificationProject(false), SPEC_AUTOSAVE_DELAY);
}

function saveSpecificationProject(manual = false) {
  clearTimeout(specAutosaveTimer);
  specState.updatedAt = new Date().toISOString();
  if (manual) {
    specState.revisionHistory.push({ at: specState.updatedAt, action: "Engineer saved project", revision: specState.project.revision || "0" });
    specState.revisionHistory = specState.revisionHistory.slice(-50);
  }
  try {
    localStorage.setItem(SPEC_STORAGE_KEY, JSON.stringify(specState));
    setSpecSaveStatus(`${manual ? "Project saved" : "Autosaved"} locally at ${new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}.`, "is-saved");
  } catch (error) {
    setSpecSaveStatus("Project could not be saved in this browser.", "is-error");
    showSpecMessage("Save Failed", /quota/i.test(error?.message || "") ? "Browser storage is full. Clear unneeded local history or browser data, then try again." : error.message);
  }
}

function loadSpecificationProject() {
  try {
    const stored = JSON.parse(localStorage.getItem(SPEC_STORAGE_KEY) || "null");
    if (stored?.version) {
      const previousVersion = Number(stored.version || 1);
      specState = normalizeSpecificationCollections({ ...createEmptySpecificationState(), ...stored, version: 2, project: { ...createEmptySpecificationState().project, ...(stored.project || {}) } });
      if (previousVersion < 2) {
        if (!String(specState.project.part1 || "").trim()) specState.project.part1 = getPart1StarterTemplate();
        if (!String(specState.project.part2 || "").trim()) specState.project.part2 = getPart2StarterTemplate();
        if (!String(specState.project.part3 || "").trim()) specState.project.part3 = getPart3StarterTemplate();
        specState.project.part1 = fillStarterWithProjectFields(specState.project.part1);
        specState.project.part2 = fillStarterWithProjectFields(specState.project.part2);
        specState.project.part3 = fillStarterWithProjectFields(specState.project.part3);
      }
    }
  } catch (error) { console.warn("Could not restore specification project:", error); }
  applySpecificationStateToUI();
  setSpecSaveStatus(localStorage.getItem(SPEC_STORAGE_KEY)
    ? "Saved project restored. Autosave is on."
    : "Autosave is on. Project data stays in this browser.", "is-saved");
}

function setSpecSaveStatus(message, state = "") {
  const status = document.getElementById("specSaveStatus");
  if (!status) return;
  const text = document.getElementById("specSaveStatusText");
  if (text) text.textContent = message;
  const indicatorState = state === "is-saving" ? "saving" : state === "is-error" ? "save-failed" : "saved-local";
  status.className = `parts-save-indicator ${indicatorState}`;
}

function applySpecificationStateToUI() {
  specState.projectFieldBindings = specState.projectFieldBindings || {};
  if (!String(specState.project.vehicleType || "").trim()) specState.project.vehicleType = getVehicleTypeForEquipmentType(specState.project.equipmentType);
  specState.project.part1 = formatSpecificationEditorText(upgradeSpecificationFillInWording(upgradePart1WarrantyFillIns(stripProjectInformationForExport(formatOptionalProjectNotes(specState.project.part1, specState.project.notes))), "part1"));
  specState.project.part2 = formatSpecificationEditorText(upgradeSpecificationFillInWording(specState.project.part2, "part2"));
  specState.project.part3 = formatSpecificationEditorText(upgradeSpecificationFillInWording(upgradePart3ExecutionFillIns(specState.project.part3), "part3"));
  Object.keys(SPEC_PROJECT_PLACEHOLDERS).forEach(key => {
    const value = String(specState.project[key] || "").trim();
    if (!value) return;
    const priorBinding = String(specState.projectFieldBindings[key] || "").trim();
    ["part1", "part2", "part3"].forEach(partKey => {
      let text = String(specState.project[partKey] || "");
      SPEC_PROJECT_PLACEHOLDERS[key].forEach(placeholder => { text = text.split(placeholder).join(value); });
      if (priorBinding.length >= 3 && priorBinding !== value) text = text.split(priorBinding).join(value);
      specState.project[partKey] = formatSpecificationEditorText(text);
    });
    specState.projectFieldBindings[key] = value;
  });
  document.querySelectorAll("[data-project-field]").forEach(field => { field.value = specState.project[field.dataset.projectField] || ""; });
  updateSpecProjectTitle(); renderSpecDocuments(); renderSpecSourceSuggestions(); renderExtractedSpecFillIns(); renderSpecComponents(); renderSpecRules(); renderSpecificationRows(); renderSpecificationReview(); renderSpecificationLocalSaves(); updateSpecificationFillIndicators();
}

function getSpecificationTemplates() {
  try {
    const saved = JSON.parse(localStorage.getItem(SPEC_TEMPLATE_LIBRARY_KEY) || "[]");
    if (Array.isArray(saved) && saved.length) return saved;
    const legacy = JSON.parse(localStorage.getItem(SPEC_PART1_TEMPLATE_KEY) || "null");
    if (legacy?.text) {
      const migrated = [{ id: crypto.randomUUID(), name: "Saved Part 1 Template", partNumber: 1, text: legacy.text, savedAt: legacy.savedAt || new Date().toISOString() }];
      saveSpecificationTemplates(migrated);
      localStorage.removeItem(SPEC_PART1_TEMPLATE_KEY);
      return migrated;
    }
    return Array.isArray(saved) ? saved : [];
  } catch {}
  return [];
}

function saveSpecificationTemplates(templates) {
  localStorage.setItem(SPEC_TEMPLATE_LIBRARY_KEY, JSON.stringify(templates));
}

const SPEC_PROJECT_PLACEHOLDERS = {
  projectNumber: ["[PROJECT NUMBER]"],
  sectionNumber: ["[SECTION NUMBER]"],
  projectName: ["[PROJECT NAME]"],
  customer: ["[CUSTOMER]"],
  equipmentType: ["[EQUIPMENT TYPE]"],
  vehicleType: ["[VEHICLE TYPE]"],
  systemName: ["[SYSTEM NAME / MODEL]", "[SYSTEM NAME]", "[MODEL]"],
  engineer: ["[ENGINEER]"],
  revision: ["[REVISION]"],
  date: ["[DATE]"]
};
const SPEC_PROJECT_LABELS = {
  projectNumber: "Project Number",
  sectionNumber: "Specification Section",
  projectName: "Project Name",
  customer: "Customer",
  equipmentType: "Equipment Type",
  vehicleType: "Vehicle Type",
  systemName: "System Name",
  engineer: "Prepared By",
  revision: "Revision",
  date: "Date"
};

function getVehicleTypeForEquipmentType(equipmentType) {
  return ({
    "Car Wash": "passenger cars and light-duty vehicles",
    "Truck Wash": "trucks and heavy-duty vehicles",
    "Train Wash": "trainsets and rail vehicles",
    "Transit Wash": "transit buses and support vehicles"
  })[String(equipmentType || "").trim()] || "";
}

function syncDerivedVehicleType(equipmentType) {
  const vehicleType = getVehicleTypeForEquipmentType(equipmentType);
  if (!vehicleType) return;
  specState.project.vehicleType = vehicleType;
  syncSpecificationProjectField("vehicleType", vehicleType);
}

function formatOptionalProjectNotes(text, notes) {
  return String(text || "")
    .replace(/^\s*Project Notes:\s*(?:\[PROJECT NOTES\])?[^\r\n]*\r?\n?/gim, "")
    .replace(/^\s*\[PROJECT NOTES\]\s*\r?\n?/gim, "");
}

function upgradePart1WarrantyFillIns(text) {
  return String(text || "").replace(
    /Warrant the Work of this Section for one year from the date of Substantial Completion unless a longer period is indicated elsewhere in the Contract Documents\./i,
    "Warrant the Work of this Section for [WARRANTY PERIOD] beginning on [WARRANTY START EVENT] unless a longer period is indicated elsewhere in the Contract Documents."
  );
}

function upgradeSpecificationFillInWording(text, part) {
  let value = String(text || "");
  const replacements = part === "part1" ? [
    ["Provide an industrial-quality, automatic, drive-through, four-brush [EQUIPMENT TYPE] system that is complete and fully operational.", "Provide a complete, industrial-quality [EQUIPMENT TYPE] system configured for automatic drive-through operation unless otherwise indicated."]
  ] : part === "part2" ? [
    ["1. Acceptable Manufacturers: Any manufacturer that can meet the requirements set forth in the construction documents.", "A. Acceptable Manufacturers: Provide a manufacturer capable of meeting the requirements of the Contract Documents.\nB. System designation or model: [SYSTEM NAME / MODEL]."],
    ["1. Configure the system to wash [VEHICLE TYPE].", "1. Provide a complete [EQUIPMENT TYPE] system configured to wash [VEHICLE TYPE]."],
    ["1. [WASH FUNCTIONS]", "1. Provide the following operating modes and wash functions: [WASH FUNCTIONS]."],
    ["1. Provide [CONTROL PANEL / PLC / HMI DESCRIPTION].", "1. Provide a control system consisting of [CONTROL PANEL / PLC / HMI DESCRIPTION]."],
    ["2. Provide automatic and manual operating modes, equipment status indication, alarm display, and emergency-stop monitoring.", "2. Provide automatic and manual operating modes, equipment-status indication, alarm display, and emergency-stop monitoring."],
    ["3. Report system faults at the operator interface and retain information needed to identify the affected equipment.", "3. Display system faults at the operator interface and retain sufficient information to identify the affected equipment and fault condition."],
    ["4. Terminate internal wiring at identified terminal blocks and label field connection points to correspond with approved drawings.", "4. Terminate internal wiring at identified terminal blocks. Label field-connection points to correspond with approved wiring diagrams."],
    ["1. Main structural material: [STRUCTURAL MATERIAL].", "1. Fabricate the main equipment structure from [STRUCTURAL MATERIAL]."],
    ["1. Water connection size: [CONNECTION SIZE].", "1. Provide a water-service connection sized [CONNECTION SIZE]."],
    ["2. Required water pressure: [PRESSURE].", "2. Provide an available water pressure of [PRESSURE]."],
    ["3. Required water flow: [FLOW].", "3. Provide an available water flow of [FLOW]."],
    ["4. Compressed air service: [AIR REQUIREMENT OR NOT REQUIRED].", "4. Provide compressed-air service as follows: [AIR REQUIREMENT OR NOT REQUIRED]."],
    ["5. Chemical and water-reclaim equipment: [REQUIREMENTS OR NOT INCLUDED].", "5. Provide chemical and water-reclaim equipment as follows: [REQUIREMENTS OR NOT INCLUDED]."],
    ["1. [WHEEL WASH, UNDERCARRIAGE WASH, RECLAIM, FREEZE PROTECTION, OR OTHER OPTIONS]", "1. Provide the following options and accessories: [WHEEL WASH, UNDERCARRIAGE WASH, RECLAIM, FREEZE PROTECTION, OR OTHER OPTIONS]."]
  ] : [
    ["B. Delivery, unloading, and equipment installation responsibility: [INSTALLATION RESPONSIBLE PARTY].", "B. [INSTALLATION RESPONSIBLE PARTY] shall be responsible for delivery, unloading, and equipment installation."],
    ["D. Field plumbing responsibility: [FIELD PLUMBING RESPONSIBLE PARTY].", "D. [FIELD PLUMBING RESPONSIBLE PARTY] shall perform field plumbing work."],
    ["E. Field electrical responsibility: [FIELD ELECTRICAL RESPONSIBLE PARTY].", "E. [FIELD ELECTRICAL RESPONSIBLE PARTY] shall perform field electrical work."],
    ["A. Startup and commissioning responsibility: [COMMISSIONING RESPONSIBLE PARTY].", "A. [COMMISSIONING RESPONSIBLE PARTY] shall perform or supervise startup and commissioning."],
    ["A. Acceptance test procedure: [ACCEPTANCE TEST PROCEDURE].", "A. Conduct acceptance testing using [ACCEPTANCE TEST PROCEDURE]."],
    ["A. Provide [O&M MANUAL QUANTITY] complete copies of final operation and maintenance manuals at the time of training.", "A. Provide [O&M MANUAL QUANTITY] of the final operation and maintenance manual at the time of training."],
    ["A. Warranty period: [WARRANTY PERIOD].\nB. Warranty begins on [WARRANTY START EVENT].", "A. Warrant the Work for [WARRANTY PERIOD] beginning on [WARRANTY START EVENT]."]
  ];
  replacements.forEach(([before, after]) => {
    value = value.split(before).join(after);
    value = value.split(formatSpecificationEditorText(before)).join(formatSpecificationEditorText(after));
  });
  const outcomePairs = part === "part1" ? [
    ["Provide a complete, industrial-quality [EQUIPMENT TYPE] system configured for automatic drive-through operation unless otherwise indicated.", "The completed installation shall include an industrial-quality [EQUIPMENT TYPE] system configured for automatic drive-through operation unless otherwise indicated."],
    ["Provide required rough-in work, equipment installation, and final utility connections, including labor, services, and incidental materials required for a complete installation.", "The Work shall include required rough-in work, equipment installation, final utility connections, labor, services, and incidental materials necessary for a complete installation."],
    ["Provide piping, wiring, controls, and switching between the wash equipment and serving utilities.", "The Work shall include piping, wiring, controls, and switching between the wash equipment and serving utilities."]
  ] : part === "part2" ? [
    ["Provide a complete [EQUIPMENT TYPE] system configured to wash [VEHICLE TYPE].", "System shall be a complete [EQUIPMENT TYPE] installation designed and configured to wash [VEHICLE TYPE]."],
    ["System shall be designed and configured to wash [VEHICLE TYPE].", "System shall be a complete [EQUIPMENT TYPE] installation designed and configured to wash [VEHICLE TYPE]."],
    ["Maximum vehicle height: [MAXIMUM HEIGHT].", "System shall accommodate vehicles up to [MAXIMUM HEIGHT] in height."],
    ["Maximum vehicle width: [MAXIMUM WIDTH].", "System shall accommodate vehicles up to [MAXIMUM WIDTH] in width."],
    ["Provide the following operating modes and wash functions: [WASH FUNCTIONS].", "System shall perform the following wash functions: [WASH FUNCTIONS]."],
    ["Automatically activate and deactivate each component as the vehicle advances through its designated operating zone.", "System shall automatically activate and deactivate each component as the vehicle advances through its designated operating zone."],
    ["Interlock equipment, controls, and safety devices to provide orderly startup, shutdown, fault response, and system reset.", "Controls shall interlock equipment and safety devices to provide an orderly operating sequence, fault response, and system reset."],
    ["Prevent a new operating cycle from beginning until the preceding cycle is complete and the system is ready.", "System shall prevent a new operating cycle from starting until the preceding cycle is complete and the system is ready."],
    ["Provide manual controls for setup, maintenance, testing, and recovery from a fault condition.", "System shall include manual controls for setup, testing, maintenance, and recovery from a fault condition."],
    ["Provide a control system consisting of [CONTROL PANEL / PLC / HMI DESCRIPTION].", "Control system shall consist of [CONTROL PANEL / PLC / HMI DESCRIPTION]."],
    ["Provide automatic and manual operating modes, equipment-status indication, alarm display, and emergency-stop monitoring.", "Control system shall include automatic and manual operating modes, equipment-status indication, alarm display, and emergency-stop monitoring."],
    ["Display system faults at the operator interface and retain sufficient information to identify the affected equipment and fault condition.", "Operator interface shall display system faults and retain sufficient information to identify the affected equipment and fault condition."],
    ["Terminate internal wiring at identified terminal blocks. Label field-connection points to correspond with approved wiring diagrams.", "Internal wiring shall terminate at identified terminal blocks. Field-connection labels shall correspond with approved wiring diagrams."],
    ["Fabricate the main equipment structure from [STRUCTURAL MATERIAL].", "Main equipment structure shall be fabricated from [STRUCTURAL MATERIAL]."],
    ["Provide a water-service connection sized [CONNECTION SIZE].", "System water-service connection shall be sized [CONNECTION SIZE]."],
    ["Provide an available water pressure of [PRESSURE].", "System shall be designed for an available water pressure of [PRESSURE]."],
    ["Provide an available water flow of [FLOW].", "System shall be designed for an available water flow of [FLOW]."],
    ["Provide compressed-air service as follows: [AIR REQUIREMENT OR NOT REQUIRED].", "Compressed-air service requirement shall be [AIR REQUIREMENT OR NOT REQUIRED]."],
    ["Provide chemical and water-reclaim equipment as follows: [REQUIREMENTS OR NOT INCLUDED].", "Chemical and water-reclaim requirements shall be [REQUIREMENTS OR NOT INCLUDED]."],
    ["Provide the following options and accessories: [WHEEL WASH, UNDERCARRIAGE WASH, RECLAIM, FREEZE PROTECTION, OR OTHER OPTIONS].", "System shall include the following options and accessories: [WHEEL WASH, UNDERCARRIAGE WASH, RECLAIM, FREEZE PROTECTION, OR OTHER OPTIONS]."]
  ] : [
    ["Verify that foundations, wash-bay dimensions, drainage, utilities, and equipment access are ready before installation begins.", "Installer shall verify that foundations, wash-bay dimensions, drainage, utilities, and equipment access are ready before installation begins."],
    ["Install equipment according to N/S Corporation drawings and instructions.", "Installer shall install equipment according to N/S Corporation drawings and instructions."],
    ["Provide a qualified manufacturer's representative to oversee installation when required.", "A qualified manufacturer's representative shall oversee installation when required."],
    ["Provide [STARTUP REQUIREMENT].", "Startup shall include [STARTUP REQUIREMENT]."],
    ["Conduct acceptance testing using [ACCEPTANCE TEST PROCEDURE].", "Commissioning party shall conduct acceptance testing using [ACCEPTANCE TEST PROCEDURE]."],
    ["Demonstrate [REQUIRED TROUBLE-FREE CYCLES] complete consecutive operating cycles without system failure.", "System shall complete [REQUIRED TROUBLE-FREE CYCLES] consecutive operating cycles without failure."],
    ["Submit a training schedule for the Owner's approval.", "Manufacturer shall submit a training schedule for the Owner's approval."],
    ["Provide [TRAINING HOURS] hours of operator and maintenance training for the Owner's personnel.", "Manufacturer shall provide [TRAINING HOURS] hours of operator and maintenance training for the Owner's personnel."],
    ["Provide [O&M MANUAL QUANTITY] of the final operation and maintenance manual at the time of training.", "Contractor shall provide [O&M MANUAL QUANTITY] of the final operation and maintenance manual at the time of training."],
    ["Warrant the Work for [WARRANTY PERIOD] beginning on [WARRANTY START EVENT].", "Manufacturer shall warrant the Work for [WARRANTY PERIOD] beginning on [WARRANTY START EVENT]."]
  ];
  outcomePairs.forEach(([before, after]) => {
    value = value.split(before).join(after);
    value = value.split(formatSpecificationEditorText(before)).join(formatSpecificationEditorText(after));
  });
  if (part === "part2") {
    const defaultSequence = `1. System shall automatically activate and deactivate each component as the vehicle advances through its designated operating zone.\n2. Controls shall interlock equipment and safety devices to provide an orderly operating sequence, fault response, and system reset.\n3. System shall prevent a new operating cycle from starting until the preceding cycle is complete and the system is ready.\n4. System shall include manual controls for setup, testing, maintenance, and recovery from a fault condition.`;
    value = value.split(defaultSequence).join("1. [SEQUENCE OF OPERATION]");
    value = value.split(formatSpecificationEditorText(defaultSequence)).join(formatSpecificationEditorText("1. [SEQUENCE OF OPERATION]"));
    value = value.replace(/^[ \t]*\[SEQUENCE OF OPERATION\][ \t]*$/m, "1. [SEQUENCE OF OPERATION]");
  }
  value = value.split("[WHEEL WASH, UNDERCARRIAGE WASH, RECLAIM, FREEZE PROTECTION, OR OTHER OPTIONS]").join("[SELECTED OPTIONS AND ACCESSORIES]");
  return value;
}

function formatSpecificationEditorText(text) {
  const formattedLines = String(text || "").replace(/\r\n/g, "\n").split("\n").map(rawLine => {
    const line = rawLine.trim();
    if (!line) return "";
    let match = line.match(/^(\d+\.\d+(?:\.\d+)?)\s+(.+)$/);
    if (match) return formatSpecificationEditorLine(0, match[1], match[2]);
    match = line.match(/^([A-Z]+\.)\s+(.+)$/);
    if (match) return formatSpecificationEditorLine(1, match[1], match[2]);
    match = line.match(/^(\d+\.)\s+(.+)$/);
    if (match) return formatSpecificationEditorLine(2, match[1], match[2]);
    match = line.match(/^([a-z]+\.)\s+(.+)$/);
    if (match) return formatSpecificationEditorLine(3, match[1], match[2]);
    match = line.match(/^(\(\d+\))\s+(.+)$/);
    if (match) return formatSpecificationEditorLine(4, match[1], match[2]);
    return rawLine.trimEnd();
  });
  const normalizedLines = [];
  let pendingBlank = false;
  formattedLines.forEach(line => {
    if (!line.trim()) { pendingBlank = true; return; }
    const isArticleHeading = /^\d+\.\d+(?:\.\d+)?\s+/.test(line);
    if (pendingBlank && isArticleHeading && normalizedLines.length) normalizedLines.push("");
    normalizedLines.push(line);
    pendingBlank = false;
  });
  return normalizedLines.join("\n").trim();
}

function formatSpecificationEditorLine(level, marker, content) {
  return `${" ".repeat(Math.max(0, level) * 2)}${marker}  ${content}`;
}

function handleSpecificationEditorTab(event) {
  if (event.key !== "Tab") return;
  event.preventDefault();
  const field = event.currentTarget;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  const lineStart = field.value.lastIndexOf("\n", start - 1) + 1;
  const selectedEnd = end > start && field.value[end - 1] === "\n" ? end - 1 : end;
  const block = field.value.slice(lineStart, selectedEnd);
  let priorTargetMarker = "";
  const replacement = block.split("\n").map(line => {
    const parsed = parseSpecificationEditorLine(line);
    if (!parsed) return event.shiftKey ? (line.startsWith("\t") ? line.slice(1) : line) : `\t${line}`;
    const targetLevel = Math.max(0, Math.min(4, parsed.level + (event.shiftKey ? -1 : 1)));
    if (targetLevel === parsed.level) return line;
    let marker;
    if (priorTargetMarker) marker = nextSpecificationListMarker(priorTargetMarker);
    else if (event.shiftKey) {
      const previous = findPreviousSpecificationMarker(field.value.slice(0, lineStart), targetLevel);
      marker = previous ? nextSpecificationListMarker(previous) : firstSpecificationMarker(targetLevel);
    } else marker = firstSpecificationMarker(targetLevel);
    priorTargetMarker = marker;
    return formatSpecificationEditorLine(targetLevel, marker, parsed.content);
  }).join("\n");
  field.setRangeText(replacement, lineStart, selectedEnd, "start");
  if (start === end) {
    const originalLine = parseSpecificationEditorLine(block);
    const replacementLine = parseSpecificationEditorLine(replacement);
    const originalContentStart = lineStart + (originalLine?.contentStart || 0);
    const replacementContentStart = lineStart + (replacementLine?.contentStart || 0);
    const contentOffset = Math.max(0, start - originalContentStart);
    const nextCursor = replacementContentStart + contentOffset;
    field.setSelectionRange(nextCursor, nextCursor);
  } else {
    field.setSelectionRange(lineStart, lineStart + replacement.length);
  }
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function handleSpecificationEditorBackspace(event) {
  if (event.key !== "Backspace" || event.currentTarget.selectionStart !== event.currentTarget.selectionEnd) return;
  const field = event.currentTarget;
  const cursor = field.selectionStart;
  const lineStart = field.value.lastIndexOf("\n", cursor - 1) + 1;
  const lineEndIndex = field.value.indexOf("\n", cursor);
  const lineEnd = lineEndIndex === -1 ? field.value.length : lineEndIndex;
  const line = field.value.slice(lineStart, lineEnd);
  const parsed = parseSpecificationEditorLine(line);
  if (!parsed || parsed.level === 0 || cursor > lineStart + parsed.contentStart) return;
  event.preventDefault();
  const targetLevel = parsed.level - 1;
  const previous = findPreviousSpecificationMarker(field.value.slice(0, lineStart), targetLevel);
  const marker = previous ? nextSpecificationListMarker(previous) : firstSpecificationMarker(targetLevel);
  const replacement = formatSpecificationEditorLine(targetLevel, marker, parsed.content);
  field.setRangeText(replacement, lineStart, lineEnd, "start");
  const contentStart = lineStart + parseSpecificationEditorLine(replacement).contentStart;
  field.setSelectionRange(contentStart, contentStart);
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function parseSpecificationEditorLine(line) {
  const match = String(line || "").match(/^([\t ]*)(\d+\.\d+(?:\.\d+)?|[A-Z]+\.|[a-z]+\.|\d+\.|\(\d+\))[\t ]+(.*)$/);
  if (!match) return null;
  const marker = match[2];
  const level = /^\d+\.\d+/.test(marker) ? 0 : /^[A-Z]+\.$/.test(marker) ? 1 : /^\d+\.$/.test(marker) ? 2 : /^[a-z]+\.$/.test(marker) ? 3 : 4;
  return { marker, level, content: match[3], contentStart: match[0].length - match[3].length };
}

function firstSpecificationMarker(level) {
  return ["1.1", "A.", "1.", "a.", "(1)"][Math.max(0, Math.min(4, level))];
}

function findPreviousSpecificationMarker(text, level) {
  const lines = String(text || "").split("\n");
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const parsed = parseSpecificationEditorLine(lines[index]);
    if (parsed?.level === level) return parsed.marker;
  }
  return "";
}

function handleSpecificationEditorEnter(event) {
  if (event.key !== "Enter" || event.shiftKey) return;
  const field = event.currentTarget;
  const start = field.selectionStart;
  const end = field.selectionEnd;
  if (start !== end) return;
  const lineStart = field.value.lastIndexOf("\n", start - 1) + 1;
  const lineEndIndex = field.value.indexOf("\n", start);
  const lineEnd = lineEndIndex === -1 ? field.value.length : lineEndIndex;
  const beforeCursor = field.value.slice(lineStart, start);
  const afterCursor = field.value.slice(start, lineEnd);
  const match = beforeCursor.match(/^(\s*)(\d+\.\d+(?:\.\d+)?|[A-Z]+\.|[a-z]+\.|\d+\.|\(\d+\))(?:\s+)(.*)$/);
  if (!match) return;
  event.preventDefault();
  const [, indentation, marker, content] = match;
  if (!content.trim() && !afterCursor.trim()) {
    const reducedIndentation = indentation.startsWith("\t") ? indentation.slice(1) : indentation.replace(/^ {1,4}/, "");
    field.setRangeText(reducedIndentation, lineStart, lineEnd, "end");
    field.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }
  const nextMarker = nextSpecificationListMarker(marker);
  const level = /^\d+\.\d+/.test(nextMarker) ? 0 : /^[A-Z]+\.$/.test(nextMarker) ? 1 : /^\d+\.$/.test(nextMarker) ? 2 : /^[a-z]+\.$/.test(nextMarker) ? 3 : 4;
  field.setRangeText(`\n${formatSpecificationEditorLine(level, nextMarker, "")}`, start, end, "end");
  field.dispatchEvent(new Event("input", { bubbles: true }));
}

function nextSpecificationListMarker(marker) {
  if (/^\d+\.\d+(?:\.\d+)?$/.test(marker)) {
    const levels = marker.split(".").map(Number);
    levels[levels.length - 1] += 1;
    return levels.join(".");
  }
  if (/^\d+\.$/.test(marker)) return `${Number(marker.slice(0, -1)) + 1}.`;
  if (/^\(\d+\)$/.test(marker)) return `(${Number(marker.slice(1, -1)) + 1})`;
  if (/^[A-Z]+\.$/.test(marker)) return `${incrementSpecificationLetters(marker.slice(0, -1))}.`;
  if (/^[a-z]+\.$/.test(marker)) return `${incrementSpecificationLetters(marker.slice(0, -1))}.`;
  return marker;
}

function incrementSpecificationLetters(value) {
  const lowerCase = value === value.toLowerCase();
  const letters = value.toUpperCase().split("");
  let index = letters.length - 1;
  while (index >= 0 && letters[index] === "Z") { letters[index] = "A"; index -= 1; }
  if (index < 0) letters.unshift("A");
  else letters[index] = String.fromCharCode(letters[index].charCodeAt(0) + 1);
  const result = letters.join("");
  return lowerCase ? result.toLowerCase() : result;
}

function syncOptionalProjectNotes(notes) {
  specState.project.part1 = formatOptionalProjectNotes(specState.project.part1, notes);
  const part1Field = document.querySelector('[data-project-field="part1"]');
  if (part1Field) part1Field.value = specState.project.part1;
  updateSpecificationFillIndicators();
}

function syncSpecificationProjectField(key, value) {
  const placeholders = SPEC_PROJECT_PLACEHOLDERS[key];
  if (!placeholders) return;
  if (!String(specState.project.part1 || "").trim()) specState.project.part1 = getPart1StarterTemplate();
  if (!String(specState.project.part2 || "").trim()) specState.project.part2 = getPart2StarterTemplate();
  if (!String(specState.project.part3 || "").trim()) specState.project.part3 = getPart3StarterTemplate();
  const priorBinding = specState.projectFieldBindings?.[key] || "";
  const replacement = value || placeholders[0];
  ["part1", "part2", "part3"].forEach(partKey => {
    let text = String(specState.project[partKey] || "");
    placeholders.forEach(placeholder => { text = text.split(placeholder).join(replacement); });
    const label = SPEC_PROJECT_LABELS[key];
    if (partKey === "part1" && label) text = text.replace(new RegExp(`^${label}:.*$`, "m"), `${label}: ${replacement}`);
    if (priorBinding.length >= 3 && priorBinding !== value) text = text.split(priorBinding).join(replacement);
    specState.project[partKey] = text;
    const field = document.querySelector(`[data-project-field="${partKey}"]`);
    if (field) field.value = text;
  });
  specState.projectFieldBindings = { ...(specState.projectFieldBindings || {}), [key]: value };
  updateSpecificationFillIndicators();
}

function updateSpecificationFillIndicators() {
  Object.entries(SPEC_PROJECT_PLACEHOLDERS).forEach(([projectKey, placeholders]) => {
    const value = String(specState.project?.[projectKey] || "").trim();
    if (!value) return;
    ["part1", "part2", "part3"].forEach(partKey => {
      let text = String(specState.project?.[partKey] || "");
      const priorText = text;
      placeholders.forEach(placeholder => { text = text.split(placeholder).join(value); });
      if (text === priorText) return;
      specState.project[partKey] = formatSpecificationEditorText(text);
      const editor = document.querySelector(`[data-project-field="${partKey}"]`);
      if (editor) editor.value = specState.project[partKey];
    });
    specState.projectFieldBindings = { ...(specState.projectFieldBindings || {}), [projectKey]: value };
  });
  document.querySelectorAll("[data-fill-part][data-fill-placeholders]").forEach(indicator => {
    const part = indicator.dataset.fillPart;
    const text = String(specState.project?.[part] || "");
    const placeholders = String(indicator.dataset.fillPlaceholders || "").split(";;").filter(Boolean);
    const missing = !text.trim() || placeholders.some(placeholder => text.includes(placeholder));
    indicator.classList.toggle("is-missing", missing);
    indicator.classList.toggle("is-complete", !missing);
    indicator.setAttribute("aria-label", `${indicator.textContent.trim()}: ${missing ? "not filled in" : "complete"}`);
    indicator.title = missing ? "Click to enter this value" : "Click to review or change this value";
  });
  updateSpecificationOverallState();
}

function openSpecificationFillIn(indicator) {
  const part = indicator.dataset.fillPart;
  const placeholders = String(indicator.dataset.fillPlaceholders || "").split(";;").filter(Boolean);
  if (!part || !placeholders.length) return;
  specState.fillInValues = specState.fillInValues || {};
  const fillId = `${part}|${placeholders.join("|")}`;
  const placeholderProjectKeys = placeholders.map(placeholder => Object.keys(SPEC_PROJECT_PLACEHOLDERS).find(key => SPEC_PROJECT_PLACEHOLDERS[key].includes(placeholder)) || "");
  const projectKey = placeholderProjectKeys[0] && placeholderProjectKeys.every(key => key === placeholderProjectKeys[0]) ? placeholderProjectKeys[0] : "";
  const label = indicator.textContent.trim();
  const fields = projectKey
    ? [{ id: "specFillInValue0", label, placeholders, value: specState.project[projectKey] || "" }]
    : placeholders.map((placeholder, index) => ({ id: `specFillInValue${index}`, label: placeholder.replace(/^\[|\]$/g, "").replace(/\s*\/\s*/g, " / ").toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()), placeholders: [placeholder], value: specState.fillInValues[`${fillId}|${placeholder}`] || "" }));
  const fieldMarkup = fields.map(field => `<label class="${fields.length === 1 ? "spec-wide-field spec-fill-editor-wide" : ""}">${escapeSpec(field.label)}<textarea id="${field.id}" rows="${field.placeholders.includes("[SEQUENCE OF OPERATION]") ? 9 : 2}" wrap="off" placeholder="${escapeSpecAttr(getSpecificationFillExample(field.placeholders[0], field.label))}">${escapeSpec(field.value)}</textarea></label>`).join("");
  showSpecFormModal(`Fill In: ${label}`, `<div class="spec-form-grid">${fieldMarkup}</div><p class="converter-muted">Each value will replace every matching fill-in in ${part.replace("part", "Part ")}.${projectKey ? " The matching project field and other specification sections will also be updated." : ""}</p><div id="specFillInPillPreview" class="spec-inline-placement-preview spec-fill-placement-preview"><div class="spec-inline-placement-heading"><strong>Live placement preview</strong><span>${escapeSpec(part.replace("part", "Part "))}</span></div><div class="spec-inline-placement-body"></div></div>`, () => {
    const values = fields.map(field => ({ ...field, value: cleanSpecificationFillValue(val(field.id)) }));
    const missing = values.find(field => !field.value);
    if (missing) return showSpecMessage("Value Required", `Enter a value for ${missing.label}.`);
    if (projectKey) {
      const value = values[0].value;
      specState.project[projectKey] = value;
      const projectField = document.querySelector(`[data-project-field="${projectKey}"]`);
      if (projectField) projectField.value = value;
      syncSpecificationProjectField(projectKey, value);
    } else {
      let text = String(specState.project[part] || "");
      values.forEach(field => field.placeholders.forEach(placeholder => {
        const valueKey = `${fillId}|${placeholder}`;
        const priorValue = specState.fillInValues[valueKey];
        if (placeholder === "[SEQUENCE OF OPERATION]") text = text.replace(/^[ \t]*1\.[ \t]+\[SEQUENCE OF OPERATION\][ \t]*$/m, field.value);
        else text = text.split(placeholder).join(field.value);
        if (priorValue && priorValue !== field.value) text = text.split(priorValue).join(field.value);
        specState.fillInValues[valueKey] = field.value;
      }));
      specState.project[part] = formatSpecificationEditorText(text);
      const field = document.querySelector(`[data-project-field="${part}"]`);
      if (field) field.value = specState.project[part];
    }
    closeSpecModal();
    touchSpecificationProject();
    updateSpecificationFillIndicators();
  });
  const refreshPreview = () => renderSpecificationFillPillPreview(part, fields);
  fields.forEach(field => {
    const input = document.getElementById(field.id);
    input?.addEventListener("input", refreshPreview);
    input?.addEventListener("keydown", handleSpecificationEditorTab);
    input?.addEventListener("keydown", handleSpecificationEditorEnter);
    input?.addEventListener("keydown", handleSpecificationEditorBackspace);
  });
  refreshPreview();
  setTimeout(() => document.getElementById("specFillInValue0")?.focus(), 0);
}

function cleanSpecificationFillValue(value) {
  return formatSpecificationEditorText(String(value || "").split("\n").filter(line => !/^\s*(?:[A-Z]+\.|[a-z]+\.|\d+\.|\(\d+\))\s*$/.test(line)).join("\n").trim());
}

function renderSpecificationFillPillPreview(part, fields) {
  const preview = document.getElementById("specFillInPillPreview");
  const body = preview?.querySelector(".spec-inline-placement-body");
  const heading = preview?.querySelector(".spec-inline-placement-heading span");
  if (!preview || !body) return;
  let text = String(specState.project?.[part] || "");
  const originalLines = text.split("\n");
  const targetPlaceholders = fields.flatMap(field => field.placeholders || []);
  const existingValues = fields.map(field => String(field.value || "").trim()).filter(Boolean);
  let locationIndex = originalLines.findIndex(line => targetPlaceholders.some(placeholder => line.includes(placeholder)));
  if (locationIndex < 0) locationIndex = originalLines.findIndex(line => existingValues.some(value => line.toLowerCase().includes(value.toLowerCase())));
  if (locationIndex < 0) locationIndex = 0;
  fields.forEach(field => {
    const input = document.getElementById(field.id);
    const enteredValue = cleanSpecificationFillValue(String(input ? input.value : field.value || ""));
    field.placeholders.forEach(placeholder => {
      if (placeholder === "[SEQUENCE OF OPERATION]") text = text.replace(/^[ \t]*1\.[ \t]+\[SEQUENCE OF OPERATION\][ \t]*$/m, enteredValue || "1. [SEQUENCE OF OPERATION]");
      else text = text.split(placeholder).join(enteredValue || placeholder);
    });
  });
  const lines = text.split("\n");
  locationIndex = Math.min(locationIndex, Math.max(0, lines.length - 1));
  const articlePattern = /^\s*(\d+\.\d+(?:\.\d+)?)\s+(.+)$/;
  let start = locationIndex;
  while (start > 0 && !articlePattern.test(lines[start])) start -= 1;
  if (!articlePattern.test(lines[start] || "")) start = Math.max(0, locationIndex - 4);
  let end = Math.min(lines.length, Math.max(locationIndex + 5, start + 1));
  for (let index = start + 1; index < lines.length; index += 1) {
    if (articlePattern.test(lines[index])) { end = index; break; }
    end = Math.min(lines.length, index + 1);
  }
  const article = (lines[start] || "").match(articlePattern);
  if (heading) heading.textContent = article ? `${article[1]} - ${article[2]}` : part.replace("part", "Part ");
  body.replaceChildren();
  renderSpecPlacementPreviewLines(body, lines.slice(start, end).join("\n").trim() || "The selected fill-in is not currently present in this Part.");
}

function getSpecificationFillExample(placeholder, label = "value") {
  return ({
    "[EQUIPMENT TYPE]": "Example: Automatic vehicle wash system",
    "[SYSTEM NAME / MODEL]": "Example: Brush Module 3000",
    "[SYSTEM NAME]": "Example: Brush Module",
    "[MODEL]": "Example: BM-3000",
    "[MAIN EQUIPMENT]": "Example: Brush system, rinse arch, and reclaim system",
    "[VEHICLE TYPE]": "Example: Police cars and light-duty vehicles",
    "[MAXIMUM HEIGHT]": "Example: 9 feet 6 inches",
    "[MAXIMUM WIDTH]": "Example: 8 feet 6 inches",
    "[CYCLE TIME OR OPERATING SPEED]": "Example: 45 vehicles per hour",
    "[WASH FUNCTIONS]": "Example: Presoak, brush wash, rinse, and spot-free rinse",
    "[SEQUENCE OF OPERATION]": "1. Vehicle detection shall initiate the wash cycle.\n2. Wash components shall operate in the required order.\n3. System shall stop affected equipment upon a fault or emergency stop.",
    "[STRUCTURAL MATERIAL]": "Example: Aluminum and stainless steel",
    "[VOLTAGE]": "Example: 480 VAC",
    "[PHASE]": "Example: 3 phase",
    "[AMPERAGE]": "Example: 60 A",
    "[CONTROL PANEL / PLC / HMI DESCRIPTION]": "Example: PLC control panel with touchscreen HMI",
    "[CONNECTION SIZE]": "Example: 2-inch NPT",
    "[PRESSURE]": "Example: 40 PSI minimum",
    "[FLOW]": "Example: 70 GPM",
    "[AIR REQUIREMENT OR NOT REQUIRED]": "Example: 15 CFM at 100 PSI, or not required",
    "[REQUIREMENTS OR NOT INCLUDED]": "Example: Reclaim system included",
    "[SELECTED OPTIONS AND ACCESSORIES]": "Example: Water reclaim and freeze protection",
    "[INSTALLATION RESPONSIBLE PARTY]": "Example: General Contractor with manufacturer supervision",
    "[FIELD PLUMBING RESPONSIBLE PARTY]": "Example: Mechanical Contractor",
    "[FIELD ELECTRICAL RESPONSIBLE PARTY]": "Example: Electrical Contractor",
    "[COMMISSIONING RESPONSIBLE PARTY]": "Example: N/S Corporation factory-authorized representative",
    "[STARTUP REQUIREMENT]": "Example: Factory-authorized startup and commissioning",
    "[ACCEPTANCE TEST PROCEDURE]": "Example: Four-stage manual, automatic, chemical, and vehicle test",
    "[REQUIRED TROUBLE-FREE CYCLES]": "Example: 15",
    "[TRAINING HOURS]": "Example: 4 hours",
    "[O&M MANUAL QUANTITY]": "Example: Three printed copies and one electronic copy",
    "[WARRANTY PERIOD]": "Example: One year",
    "[WARRANTY START EVENT]": "Example: Date of Substantial Completion"
  })[placeholder] || `Example: Enter ${String(label || "value").toLowerCase()}`;
}

function updateSpecificationOverallState() {
  const state = document.getElementById("specOverallState");
  if (!state) return;
  const missingFillIns = document.querySelectorAll("[data-fill-part].is-missing").length;
  const pendingFillValues = (specState.fillInSuggestions || []).filter(item => item.status === "pending").length;
  const pendingSuggestions = (specState.sourceSuggestions || []).filter(item => item.status === "pending").length;
  let type = "is-ready";
  let title = "Ready to export";
  let message = "All tracked fill-ins and source suggestions are complete.";
  if (missingFillIns) {
    type = "is-setup";
    title = "Specification setup needed";
    message = `${missingFillIns} fill-in field${missingFillIns === 1 ? "" : "s"} still need information.`;
  } else if (pendingFillValues || pendingSuggestions) {
    type = "is-source-review";
    title = "Source review needed";
    const items = [];
    if (pendingFillValues) items.push(`${pendingFillValues} extracted template value${pendingFillValues === 1 ? "" : "s"}`);
    if (pendingSuggestions) items.push(`${pendingSuggestions} source suggestion${pendingSuggestions === 1 ? "" : "s"}`);
    message = `${items.join(" and ")} still need review.`;
  }
  state.className = `spec-overall-state ${type}`;
  state.innerHTML = `<strong>${title}</strong><span>${message}</span>`;
}

function fillStarterWithProjectFields(text) {
  let result = String(text || "");
  Object.entries(SPEC_PROJECT_PLACEHOLDERS).forEach(([key, placeholders]) => {
    const value = specState.project[key];
    if (!value) return;
    placeholders.forEach(placeholder => { result = result.split(placeholder).join(value); });
    specState.projectFieldBindings[key] = value;
  });
  return formatSpecificationEditorText(formatOptionalProjectNotes(result, specState.project.notes));
}

function getPreservedSpecificationFillValue(partKey, placeholder) {
  const projectKey = Object.keys(SPEC_PROJECT_PLACEHOLDERS).find(key => SPEC_PROJECT_PLACEHOLDERS[key].includes(placeholder));
  if (projectKey && String(specState.project[projectKey] || "").trim()) return String(specState.project[projectKey]).trim();
  const legacyPlaceholder = placeholder === "[SELECTED OPTIONS AND ACCESSORIES]" ? "[WHEEL WASH, UNDERCARRIAGE WASH, RECLAIM, FREEZE PROTECTION, OR OTHER OPTIONS]" : "";
  const storedEntry = Object.entries(specState.fillInValues || {}).reverse().find(([key, value]) => key.includes(`|${partKey}|`) && (key.endsWith(`|${placeholder}`) || (legacyPlaceholder && key.endsWith(`|${legacyPlaceholder}`))) && String(value || "").trim())
    || Object.entries(specState.fillInValues || {}).reverse().find(([key, value]) => key.startsWith(`${partKey}|`) && key.endsWith(`|${placeholder}`) && String(value || "").trim());
  if (storedEntry) return String(storedEntry[1]).trim();
  const accepted = (specState.fillInSuggestions || []).find(item => item.status === "accepted" && item.part === partKey && item.placeholder === placeholder && String(item.value || "").trim());
  return accepted ? String(accepted.value).trim() : "";
}

function restoreReviewedContentToStarter(text, partKey) {
  let restored = String(text || "");
  const placeholders = Array.from(new Set(restored.match(/\[[A-Z0-9 &/,-]+\]/g) || []));
  placeholders.forEach(placeholder => {
    const value = getPreservedSpecificationFillValue(partKey, placeholder);
    if (!value) return;
    if (placeholder === "[SEQUENCE OF OPERATION]") restored = restored.replace(/^[ \t]*1\.[ \t]+\[SEQUENCE OF OPERATION\][ \t]*$/m, value);
    else restored = restored.split(placeholder).join(value);
  });
  restored = formatSpecificationEditorText(restored);
  if (partKey === "part2") restored = replaceApprovedEquipmentListInPart2(restored, getApprovedTocEquipmentNames());
  (specState.sourceSuggestions || []).filter(item => item.status === "accepted" && item.targetPart === partKey).forEach(item => {
    const destination = getSpecSuggestionDestination(item);
    const formatted = formatSpecSuggestionForDestination(item, destination);
    restored = formatSpecificationEditorText(insertSpecSuggestionAtArticle(restored, destination, formatted, item));
  });
  return restored;
}

async function loadSpecStarterTemplate(part) {
  const key = part === 1 ? "part1" : part === 3 ? "part3" : "part2";
  const rawStarter = part === 1 ? getPart1StarterTemplate() : part === 3 ? getPart3StarterTemplate() : getPart2StarterTemplate();
  const starter = restoreReviewedContentToStarter(fillStarterWithProjectFields(rawStarter), key);
  const current = String(specState.project[key] || "").trim();
  if (current && current !== starter) {
    const replace = await showSpecConfirm(`Reload Part ${part} Starter`, `Refresh the standard Part ${part} wording while preserving completed fill-ins, approved equipment, and accepted source wording? Manual text that was not added through those review tools will be replaced.`, "Refresh Starter");
    if (!replace) return;
  }
  specState.project[key] = starter;
  const field = document.querySelector(`[data-project-field="${key}"]`);
  if (field) field.value = starter;
  touchSpecificationProject();
  showSpecMessage(`Part ${part} Starter Refreshed`, `The N/S Part ${part} starter was refreshed. Completed fill-ins, approved equipment, and accepted source wording were reapplied.`);
}

function fillSpecificationProjectFields() {
  let completed = 0;
  Object.keys(SPEC_PROJECT_PLACEHOLDERS).forEach(key => {
    const value = specState.project[key];
    if (!value) return;
    syncSpecificationProjectField(key, value);
    completed += 1;
  });
  if (!completed) return showSpecMessage("Project Information Required", "Enter the project information before refreshing the specification fields.");
  touchSpecificationProject();
  showSpecMessage("Project Fields Refreshed", "The completed project fields were applied to matching fill-ins in Parts 1, 2, and 3.");
}

function openPacketBuilderFromSpecification(page) {
  const payload = {
    projectNumber: specState.project.projectNumber,
    projectName: specState.project.projectName,
    washType: specState.project.equipmentType,
    systemName: specState.project.systemName,
    revision: specState.project.revision,
    transferredAt: new Date().toISOString()
  };
  localStorage.setItem(SPEC_PACKET_TRANSFER_KEY, JSON.stringify(payload));
  saveSpecificationProject(false);
  window.location.href = `${page}?fromSpec=1`;
}

function saveSpecificationPartTemplate(partNumber) {
  const partKey = `part${partNumber}`;
  const text = String(specState.project[partKey] || "").trim();
  if (!text) return showSpecMessage(`Part ${partNumber} Required`, `Load or edit Part ${partNumber} before saving it as a template.`);
  const suggestedName = `${specState.project.equipmentType || "General"} - Part ${partNumber}`;
  showSpecFormModal(`Save Part ${partNumber} as Template`, `<label>Template name<input id="specTemplateName" maxlength="80" value="${escapeSpecAttr(suggestedName)}" placeholder="Example: Train Wash - Part ${partNumber}"></label><p class="converter-muted">The current Part ${partNumber} wording will be saved in this browser and can be reused in another project.</p>`, () => {
    const name = val("specTemplateName").trim();
    if (!name) return showSpecMessage("Template Name Required", "Enter a name for this template.");
    const templates = getSpecificationTemplates();
    templates.push({ id: crypto.randomUUID(), name, partNumber, text, savedAt: new Date().toISOString() });
    saveSpecificationTemplates(templates);
    closeSpecModal();
    showSpecMessage("Template Saved", `${name} was added to your template library.`);
  });
  setTimeout(() => document.getElementById("specTemplateName")?.select(), 0);
}

function openSpecificationTemplateLibrary(preferredPart = 1) {
  const templates = getSpecificationTemplates().sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
  const cards = templates.length ? templates.map(template => `<article class="spec-template-card"><div><strong>${escapeSpec(template.name)}</strong><p>Part ${Number(template.partNumber) || 1} · Saved ${escapeSpec(new Date(template.savedAt).toLocaleString())}</p></div><div class="button-row"><button type="button" onclick="loadSpecificationTemplate('${escapeSpecAttr(template.id)}')">Load</button><button type="button" class="delete-btn" onclick="deleteSpecificationTemplate('${escapeSpecAttr(template.id)}',${preferredPart})">Delete</button></div></article>`).join("") : `<p class="converter-muted">No named templates have been saved yet. Choose “Save as Template” in any part to add one.</p>`;
  showSpecFormModal("Specification Template Library", `<p class="converter-muted">All saved Part 1, Part 2, and Part 3 templates are shown here. Loading a template replaces only its matching part.</p><div class="spec-template-library">${cards}</div>`, closeSpecModal);
  const saveButton = document.querySelector("#specModalActions button:not(.secondary)");
  if (saveButton) saveButton.remove();
  const cancelButton = document.querySelector("#specModalActions .secondary");
  if (cancelButton) cancelButton.textContent = "Close";
}

async function loadSpecificationTemplate(id) {
  const template = getSpecificationTemplates().find(item => item.id === id);
  if (!template) return showSpecMessage("Template Not Found", "That saved template is no longer available.");
  const partNumber = Number(template.partNumber) || 1;
  const partKey = `part${partNumber}`;
  if (String(specState.project[partKey] || "").trim()) {
    const replace = await showSpecConfirm(`Load ${template.name}`, `Replace the current Part ${partNumber} text with this saved template?`, "Load Template");
    if (!replace) return openSpecificationTemplateLibrary(partNumber);
  }
  const text = fillStarterWithProjectFields(template.text);
  specState.project[partKey] = formatSpecificationEditorText(text);
  const editor = document.querySelector(`[data-project-field="${partKey}"]`);
  if (editor) editor.value = specState.project[partKey];
  closeSpecModal();
  touchSpecificationProject();
  updateSpecificationFillIndicators();
}

async function deleteSpecificationTemplate(id, preferredPart = 1) {
  const templates = getSpecificationTemplates();
  const template = templates.find(item => item.id === id);
  if (!template) return openSpecificationTemplateLibrary(preferredPart);
  const remove = await showSpecConfirm("Delete Template", `Delete “${template.name}”?`, "Delete");
  if (!remove) return openSpecificationTemplateLibrary(preferredPart);
  saveSpecificationTemplates(templates.filter(item => item.id !== id));
  openSpecificationTemplateLibrary(preferredPart);
}

function updateSpecProjectTitle() {
  document.getElementById("specProjectTitle").textContent = [specState.project.projectNumber, specState.project.projectName].filter(Boolean).join(" — ") || "Untitled Specification Project";
}

async function newSpecificationProject() {
  if (!(await showSpecConfirm("New Project", "Clear the current specification project and start over? This removes the locally autosaved project.", "Start New"))) return;
  const sourceIds = (specState.documents || []).map(item => item.id);
  await Promise.all(sourceIds.map(id => deleteSpecificationSourceFile(id).catch(error => console.warn("Could not remove saved source:", error))));
  specState = createEmptySpecificationState(); specDocumentFiles.clear(); localStorage.removeItem(SPEC_STORAGE_KEY); applySpecificationStateToUI();
}

async function handleSpecAiToggle(event) {
  if (!event.target.checked) {
    SpecificationAIService.configure({ provider: "disabled" });
    document.getElementById("specAiState").textContent = "Local Mode — AI Disabled";
    return;
  }
  const approved = await showSpecConfirm("Optional AI Assistance", "AI is not configured and no data will be sent. Before any future external request, this tool will list the exact text or document section, provider, and excluded sensitive fields and require confirmation. Enable the interface placeholder?", "Enable Interface");
  if (!approved) { event.target.checked = false; return; }
  document.getElementById("specAiState").textContent = "AI Interface Enabled — No Provider Connected";
  specState.aiAudit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), action: "AI interface enabled", provider: "none", dataSent: false, outcome: "No request made" });
  saveSpecificationProject(false);
}

function openSpecAiConfiguration() {
  const current = SpecificationAIService.getState();
  showSpecFormModal("AI Configuration", `<div class="spec-privacy-panel"><strong>No credentials are stored in frontend code.</strong><p>Local/self-hosted AI is preferred. Connecting an enterprise provider later will require an approved server-side proxy and a confirmation before every request.</p></div><div class="spec-form-grid"><label>Provider<select id="specAiProvider"><option value="disabled">Disabled</option><option value="ollama">Local / Ollama (future)</option><option value="enterprise">Approved enterprise provider (future)</option></select></label><label>Local or approved proxy endpoint<input id="specAiEndpoint" placeholder="Example: http://localhost:11434" value="${escapeSpecAttr(current.endpoint)}"></label><label class="spec-wide-field">Data policy<input value="Minimum necessary text only; explicit confirmation required" disabled></label></div>`, () => {
    const provider = val("specAiProvider");
    const endpoint = val("specAiEndpoint");
    SpecificationAIService.configure({ provider, endpoint });
    document.getElementById("specUseAi").checked = provider !== "disabled";
    document.getElementById("specAiState").textContent = provider === "disabled" ? "Local Mode — AI Disabled" : `${provider === "ollama" ? "Local AI" : "Enterprise AI Interface"} Configured — Confirmation Still Required`;
    specState.aiAudit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), action: "AI configuration changed", provider, endpointStored: !!endpoint, dataSent: false });
    closeSpecModal(); saveSpecificationProject(false);
  });
  const select = document.getElementById("specAiProvider"); if (select) select.value = current.provider || "disabled";
}

async function addSpecificationDocuments(fileList) {
  const selectedFiles = Array.from(fileList || []);
  const files = selectedFiles.filter(file => /pdf|word|text/i.test(file.type) || /\.(pdf|docx|txt)$/i.test(file.name));
  if (!files.length) return setSpecSourceStatus("No supported files were selected. Choose PDF, Word, or Text files.", "is-error");
  setSpecSourceStatus(`Loading ${files.length} source file${files.length === 1 ? "" : "s"}...`, "is-loading");
  let pdfCount = 0;
  let suggestionCount = 0;
  let fillInCount = 0;
  let tocProductCount = 0;
  let equipmentRecordCount = 0;
  for (const file of files) {
    const id = crypto.randomUUID();
    specDocumentFiles.set(id, file);
    let storedLocally = true;
    try { await saveSpecificationSourceFile(id, file); }
    catch (error) { storedLocally = false; console.warn(`Could not persist ${file.name}:`, error); }
    const isReadableDocument = /\.(pdf|docx|txt)$/i.test(file.name);
    const documentRecord = { id, name: file.name, size: file.size, type: file.type || "file", addedAt: new Date().toISOString(), storage: storedLocally ? "Saved locally in this browser" : "Available until this tab closes", importSummary: "Reading source text..." };
    specState.documents.push(documentRecord);
    if (isReadableDocument) {
      const result = await extractSpecSourceSuggestions(file, id);
      const count = Math.max(0, result?.suggestions || 0);
      const tocCount = Math.max(0, result?.tocProducts || 0);
      const extractedFillCount = Math.max(0, result?.fillIns || 0);
      const extractedEquipmentCount = Math.max(0, result?.equipmentRecords || 0);
      suggestionCount += count;
      tocProductCount += tocCount;
      fillInCount += extractedFillCount;
      equipmentRecordCount += extractedEquipmentCount;
      const summaryParts = [];
      if (count) summaryParts.push(`${count} source suggestion${count === 1 ? "" : "s"} ready for review`);
      if (extractedFillCount) summaryParts.push(`${extractedFillCount} template value${extractedFillCount === 1 ? "" : "s"} extracted`);
      if (extractedEquipmentCount) summaryParts.push(`${extractedEquipmentCount} equipment record${extractedEquipmentCount === 1 ? "" : "s"} extracted`);
      documentRecord.importSummary = summaryParts.join("; ") || "No searchable specification text found";
      if (/\.pdf$/i.test(file.name)) pdfCount += 1;
    }
  }
  touchSpecificationProject(); saveSpecificationProject(false); renderSpecDocuments(); renderSpecComponents();
  const skipped = selectedFiles.length - files.length;
  const messages = [];
  if (pdfCount) messages.push(`${pdfCount} PDF${pdfCount === 1 ? "" : "s"} read locally`);
  if (suggestionCount) messages.push(`${suggestionCount} source suggestion${suggestionCount === 1 ? "" : "s"} ready for review`);
  if (fillInCount) messages.push(`${fillInCount} template value${fillInCount === 1 ? "" : "s"} ready to apply`);
  if (equipmentRecordCount) messages.push(`${equipmentRecordCount} structured equipment record${equipmentRecordCount === 1 ? "" : "s"} ready to review`);
  if (skipped) messages.push(`${skipped} unsupported file${skipped === 1 ? "" : "s"} skipped`);
  setSpecSourceStatus(`${messages.join("; ")}. Review suggestions before anything is added to Parts 2 or 3.`, "is-complete");
  renderSpecSourceSuggestions();
  renderExtractedSpecFillIns();
}

async function importSpecificationExcel(file, documentId) {
  try {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]], { defval: "" });
    let importedCount = 0;
    rows.forEach((row, index) => {
      const read = names => { const key = Object.keys(row).find(k => names.includes(k.toLowerCase().replace(/[^a-z0-9]/g, ""))); return key ? String(row[key]).trim() : ""; };
      const description = read(["description", "partdescription", "itemdescription"]);
      const partNumber = read(["partnumber", "itemcode", "currentpartnumber", "newpartnumber"]);
      if (!description && !partNumber) return;
      const quantity = Number(read(["quantity", "qty", "count"])) || 1;
      const component = createSpecComponent({ partNumber, description, quantity, manufacturer: read(["manufacturer", "mfr"]), model: read(["model", "modelnumber"]), unit: read(["unit", "uom"]) || "ea", sourceDocument: file.name, sourcePage: `Row ${index + 2}`, detectionMethod: "Structured Excel table", verificationStatus: "Document Extracted", quantityExplanation: `Direct quantity ${quantity} from ${file.name}, row ${index + 2}.`, sourceDocumentId: documentId });
      applyApprovedPartMatch(component); specState.components.push(component);
      importedCount += 1;
    });
    return importedCount;
  } catch (error) { showSpecMessage("Excel Import Failed", `${file.name} could not be read. ${error.message}`); return -1; }
}

async function extractSpecSourceSuggestions(file, documentId) {
  try {
    const pages = [];
    if (/\.pdf$/i.test(file.name)) {
      if (!window.pdfjsLib) throw new Error("The PDF reader is unavailable.");
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        setSpecSourceStatus(`Reading ${file.name}, page ${pageNumber} of ${pdf.numPages}...`, "is-loading");
        const page = await pdf.getPage(pageNumber);
        const content = await page.getTextContent();
        pages.push({ page: `Page ${pageNumber}`, text: sanitizeExtractedSpecText(reconstructSpecificationPdfText(content.items)) });
      }
    } else if (/\.docx$/i.test(file.name)) {
      if (!window.mammoth) throw new Error("The Word reader is unavailable.");
      pages.push({ page: "Word document", text: sanitizeExtractedSpecText((await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value) });
    } else {
      pages.push({ page: "Text document", text: sanitizeExtractedSpecText(await file.text()) });
    }
    let added = 0;
    let tocProductsAdded = 0;
    let fillInsAdded = 0;
    let equipmentRecordsAdded = 0;
    const fullDocumentText = pages.map(page => page.text).join("\n");
    const isOandM = isSpecOandMDocument(file.name, fullDocumentText);
    const existingFillIns = new Set((specState.fillInSuggestions || []).filter(item => item.status !== "rejected").map(item => `${item.documentId}|${item.part}|${item.placeholder}|${item.value.toLowerCase()}`));
    const extractedFillIns = extractStructuredSpecFillIns(fullDocumentText).filter(candidate => !isOandM || candidate.placeholder === "[SYSTEM NAME / MODEL]");
    extractedFillIns.forEach(candidate => {
      const fingerprint = `${documentId}|${candidate.part}|${candidate.placeholder}|${candidate.value.toLowerCase()}`;
      if (existingFillIns.has(fingerprint)) return;
      existingFillIns.add(fingerprint);
      const evidenceNeedle = candidate.evidence.toLowerCase().replace(/\s+/g, " ").slice(0, 45);
      const evidencePage = pages.find(page => page.text.toLowerCase().replace(/\s+/g, " ").includes(evidenceNeedle)) || pages[0];
      specState.fillInSuggestions.push({ id: crypto.randomUUID(), documentId, sourceDocument: file.name, sourcePage: evidencePage?.page || "Document", status: "pending", createdAt: new Date().toISOString(), ...candidate });
      fillInsAdded += 1;
    });
    const existingComponents = new Set((specState.components || []).map(item => `${item.sourceDocumentId}|${String(item.description || "").toLowerCase()}`));
    const tocProductNames = [];
    pages.forEach((page, pageIndex) => {
      const tocProducts = pageIndex < 40 ? [...extractSpecTocProductsV2(page.text), ...extractSpecTocProducts(page.text)].filter((product, index, all) => all.findIndex(other => other.description.toLowerCase() === product.description.toLowerCase()) === index) : [];
      tocProducts.forEach(product => {
        tocProductNames.push(product.description);
        const fingerprint = `${documentId}|${product.description.toLowerCase()}`;
        if (existingComponents.has(fingerprint)) return;
        existingComponents.add(fingerprint);
        specState.components.push(createSpecComponent({
          description: product.description,
          quantity: 1,
          unit: "ea",
          sourceDocument: file.name,
          sourceDocumentId: documentId,
          sourcePage: `Page ${product.referencePage} (listed in TOC)`,
          detectionMethod: "Table of contents product list",
          assembly: product.parentDescription || "",
          equipmentListCandidate: product.tocLevel !== "child",
          verificationStatus: "Needs Review",
          quantityExplanation: "The product was listed in the table of contents. Confirm the required quantity from the equipment schedule or product pages."
        }));
        tocProductsAdded += 1;
      });
    });
    extractStructuredSpecEquipmentRecords(fullDocumentText).forEach(record => {
      const fingerprint = `${documentId}|${record.description.toLowerCase()}|${record.manufacturer.toLowerCase()}|${record.model.toLowerCase()}`;
      if (existingComponents.has(fingerprint)) return;
      existingComponents.add(fingerprint);
      specState.components.push(createSpecComponent({
        description: record.description, manufacturer: record.manufacturer, model: record.model,
        quantity: record.quantity, unit: record.unit, assembly: record.assembly,
        sourceDocument: file.name, sourceDocumentId: documentId,
        sourcePage: pages.find(page => page.text.toLowerCase().includes(record.evidenceNeedle))?.page || pages[0]?.page || "Document",
        detectionMethod: "Structured equipment extraction", verificationStatus: "Document Extracted",
        quantityExplanation: record.quantityEvidence, notes: record.requirements.join("\n"),
        extractionConfidence: record.confidence, extractionEvidence: record.evidence,
        extractedFields: record.fields, extractionWarnings: record.warnings,
        equipmentListCandidate: true, conflict: false
      }));
      equipmentRecordsAdded += 1;
    });
    markStructuredEquipmentConflicts(specState.components);
    const existing = new Set((specState.sourceSuggestions || []).map(item => `${item.sourceDocument}|${item.text.toLowerCase()}`));
    const structuredSections = isOandM
      ? [...extractOandMSequenceSuggestions(fullDocumentText), ...pages.flatMap(page => extractOandMProductDescriptionSuggestions(page.text, tocProductNames).flatMap(section => [section, ...deriveOandMPart2Suggestions(section)]).map(section => ({ ...section, sourcePage: page.page })))]
      : extractStructuredSpecificationSections(fullDocumentText);
    structuredSections.forEach(section => {
      if (added >= 80) return;
      const fingerprint = `${file.name}|${section.text.toLowerCase()}`;
      if (existing.has(fingerprint)) return;
      existing.add(fingerprint);
      const evidenceNeedle = section.text.toLowerCase().replace(/\s+/g, " ").slice(0, 55);
      const evidencePage = section.sourcePage ? null : pages.find(page => page.text.toLowerCase().replace(/\s+/g, " ").includes(evidenceNeedle)) || pages[0];
      const sourcePage = section.sourcePage || evidencePage?.page || "Document";
      specState.sourceSuggestions.push({ id: crypto.randomUUID(), documentId, sourceDocument: file.name, sourcePage, targetPart: section.targetPart, destinationArticle: section.destinationArticle, equipmentContext: section.equipmentContext, text: section.text, extractionKind: section.extractionKind || (isOandM ? "O&M sequence of operation" : "Structured specification subsection"), extractionConfidence: section.confidence || "Medium", subcomponents: section.subcomponents || [], status: "pending", createdAt: new Date().toISOString() });
      if (section.extractionKind === "O&M product description") {
        const topFingerprint = `${documentId}|${section.equipmentContext.toLowerCase()}`;
        const partNumber = section.text.match(/N\/S part number:\s*([^\n.]+)/i)?.[1]?.trim() || "";
        if (!existingComponents.has(topFingerprint)) {
          existingComponents.add(topFingerprint);
          specState.components.push(createSpecComponent({ description: section.equipmentContext, partNumber, quantity: 1, unit: "ea", sourceDocument: file.name, sourceDocumentId: documentId, sourcePage, detectionMethod: "O&M product description", equipmentListCandidate: true, verificationStatus: "Needs Review", extractionConfidence: section.confidence || "High", quantityExplanation: "Principal equipment identified from an N/S Product Description page; confirm quantity from drawings or schedule." }));
        }
        (section.subcomponents || []).forEach(component => {
          const childFingerprint = `${documentId}|${component.description.toLowerCase()}|${component.partNumber.toLowerCase()}`;
          if (existingComponents.has(childFingerprint)) return;
          existingComponents.add(childFingerprint);
          specState.components.push(createSpecComponent({ description: component.description, partNumber: component.partNumber, quantity: 1, unit: "ea", assembly: section.equipmentContext, sourceDocument: file.name, sourceDocumentId: documentId, sourcePage, detectionMethod: "O&M included component", equipmentListCandidate: false, verificationStatus: "Document Extracted", quantityExplanation: `Listed as an included component of ${section.equipmentContext}; confirm quantity from the source and drawings.` }));
        });
      }
      added += 1;
    });
    if (!structuredSections.length && !isOandM) pages.forEach(page => {
      splitSpecSourceText(page.text).map(formatExtractedSpecSuggestion).filter(text => !isSpecSourceBoilerplate(text) && !isSpecOandMTroubleshootingText(text) && classifySpecSourceText(text)).slice(0, 4).forEach(text => {
        if (added >= 50) return;
        if (isOandM && !isSpecWorthyOandMText(text)) return;
        if (isSpecSourceBoilerplate(text)) return;
        const targetPart = classifySpecSourceText(text);
        if (!targetPart) return;
        const fingerprint = `${file.name}|${text.toLowerCase()}`;
        if (existing.has(fingerprint)) return;
        existing.add(fingerprint);
        specState.sourceSuggestions.push({ id: crypto.randomUUID(), documentId, sourceDocument: file.name, sourcePage: page.page, targetPart, equipmentContext: identifySpecEquipmentContext(text), text, extractionKind: isOandM ? "O&M technical requirement" : "General document requirement", status: "pending", createdAt: new Date().toISOString() });
        added += 1;
      });
    });
    return { suggestions: added, tocProducts: tocProductsAdded, fillIns: fillInsAdded, equipmentRecords: equipmentRecordsAdded };
  } catch (error) {
    console.warn(`Could not read ${file.name}:`, error);
    return { suggestions: 0, tocProducts: 0, fillIns: 0, equipmentRecords: 0 };
  }
}

function extractStructuredSpecEquipmentRecords(text) {
  const lines = String(text || "").replace(/\r/g, "").split("\n").map(line => sanitizeExtractedSpecText(line)).filter(Boolean);
  const productStart = lines.findIndex(line => /^PART\s+\d+\s*[-:]\s*PRODUCTS?\b/i.test(line));
  const executionOffset = productStart >= 0 ? lines.slice(productStart + 1).findIndex(line => /^PART\s+\d+\s*[-:]\s*(?:EXECUTION|INSTALLATION)\b/i.test(line)) : -1;
  const productLines = productStart >= 0 ? lines.slice(productStart + 1, executionOffset >= 0 ? productStart + 1 + executionOffset : lines.length) : lines;
  const records = [];
  const makePattern = /^(?:Make|Manufacturer)\s*:\s*(.+)$/i;
  const modelPattern = /^Model\s*:\s*(.+)$/i;
  const skipHeading = /^(?:PART\s+\d+|MANUFACTURERS?|EQUIPMENT LIST|SYSTEM OPERATION|SYSTEM PERFORMANCE|WASH SYSTEM TECHNICAL SPECIFICATIONS|CONTROL SYSTEM TECHNICAL SPECIFICATIONS|MISCELLANEOUS|MATERIALS?|EQUIPMENT|CHEMICALS?)\b/i;
  const usefulDescription = value => value && value.length <= 220 && !skipHeading.test(value) && !/^(?:Make|Manufacturer|Model|Or Approved Equal|Basis of Design)\s*:?/i.test(value);
  const nearestDescription = index => {
    for (let offset = 1; offset <= 8; offset += 1) {
      const candidate = productLines[index - offset];
      if (!usefulDescription(candidate)) continue;
      if (/\b(?:shall|must|will|is designed|comes with|consists of)\b/i.test(candidate)) continue;
      return candidate.replace(/^\s*(?:[A-Za-z]|\d+)[.)]\s+/, "").replace(/:$/, "").trim();
    }
    return "Unidentified equipment";
  };
  productLines.forEach((line, index) => {
    const make = line.match(makePattern);
    if (!make) return;
    const relativeModelIndex = productLines.slice(index + 1, index + 6).findIndex(candidate => modelPattern.test(candidate));
    const modelIndex = relativeModelIndex >= 0 ? index + 1 + relativeModelIndex : -1;
    const model = modelIndex >= 0 ? productLines[modelIndex].match(modelPattern)?.[1]?.trim() || "" : "";
    const description = nearestDescription(index);
    const evidenceLines = productLines.slice(Math.max(0, index - 5), Math.min(productLines.length, Math.max(modelIndex, index) + 3)).filter(value => !/^Or Approved Equal\.?$/i.test(value));
    const quantityMatch = description.match(/^(?:One|Two|Three|Four|Five|Six|Seven|Eight|Nine|Ten|\d+)\s*\((\d+)\)|^(\d+)\s+/i);
    const quantity = Number(quantityMatch?.[1] || quantityMatch?.[2] || 1);
    const requirements = evidenceLines.filter(value => value !== line && value !== productLines[modelIndex] && value !== description && /\b(?:shall|must|capable|rated|equipped|constructed|fabricated|supply|deliver|GPM|PSI|HP|NEMA|stainless|gallon|voltage|phase)\b/i.test(value));
    const warnings = [];
    if (!model) warnings.push("No nearby model label was found.");
    if (description === "Unidentified equipment") warnings.push("The equipment name could not be tied confidently to this manufacturer.");
    const confidence = description !== "Unidentified equipment" && model ? "High" : description !== "Unidentified equipment" ? "Medium" : "Low";
    const evidence = evidenceLines.join(" | ");
    records.push({ description, manufacturer: make[1].replace(/,?\s*(?:Basis of Design|or Approved Equal)\.?$/i, "").trim(), model, quantity, unit: "ea", assembly: identifySpecEquipmentContext(`${description} ${evidence}`), requirements, fields: extractEquipmentTechnicalFields(evidence), warnings, confidence, evidence, evidenceNeedle: line.toLowerCase().slice(0, 45), quantityEvidence: quantityMatch ? `Extracted from \"${description}\".` : "Quantity was not explicit; defaulted to one for engineer review." });
  });
  return records.filter((record, index) => records.findIndex(other => `${other.description}|${other.manufacturer}|${other.model}`.toLowerCase() === `${record.description}|${record.manufacturer}|${record.model}`.toLowerCase()) === index);
}

function extractEquipmentTechnicalFields(text) {
  const value = String(text || "");
  const collect = pattern => Array.from(new Set(Array.from(value.matchAll(pattern), match => match[0].replace(/\s+/g, " ").trim())));
  return { power: collect(/\b\d+(?:\.\d+)?\s*(?:HP|kW)\b/gi), flow: collect(/\b\d+(?:\.\d+)?\s*GPM\b/gi), pressure: collect(/\b\d+(?:\.\d+)?\s*PSI\b/gi), capacity: collect(/\b\d{1,3}(?:,\d{3})*(?:\.\d+)?\s*(?:US\s*)?(?:gallons?|gal\.)\b/gi), electrical: collect(/\b\d{2,4}\s*(?:V|volts?)\b|\b(?:single|three|1|3)[ -]?phase\b/gi), material: collect(/\b(?:304(?:\/304L)?|316L?)\s+stainless steel\b|\b(?:galvanized steel|aluminum 6061-T6|HDLPE|fiberglass)\b/gi), rating: collect(/\bNEMA\s*\d+[A-Z]?\b|\bUL\s*(?:listed|labeled|labelled)?\b/gi) };
}

function markStructuredEquipmentConflicts(components, documentId = "") {
  const norm = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const records = (components || []).filter(item => item.detectionMethod === "Structured equipment extraction" && (!documentId || item.sourceDocumentId === documentId));
  records.forEach(item => {
    const conflicts = (components || []).filter(other => other.id !== item.id && other.detectionMethod === "Structured equipment extraction" && norm(other.description) === norm(item.description) && ((item.manufacturer && other.manufacturer && norm(item.manufacturer) !== norm(other.manufacturer)) || (item.model && other.model && norm(item.model) !== norm(other.model))));
    if (!conflicts.length) return;
    item.conflict = true; item.verificationStatus = "Needs Review";
    item.extractionWarnings = [...new Set([...(item.extractionWarnings || []), `Conflicting manufacturer or model found in ${conflicts.map(other => other.sourceDocument).join(", ")}.`])];
  });
}

function extractStructuredSpecificationSections(text) {
  const source = String(text || "").replace(/\r/g, "").replace(/\u00a0/g, " ");
  const articleMatches = Array.from(source.matchAll(/^\s*((?:2|3)\.\d+)\s+([^\n]+)\s*$/gm));
  if (articleMatches.length < 2) return extractLegacyEquipmentSpecificationSections(source);
  const supported = new Set(["2.1", "2.2", "2.3", "2.4", "2.5", "2.6", "2.7", "3.1", "3.2", "3.3", "3.4", "3.5", "3.6"]);
  const results = [];
  articleMatches.forEach((articleMatch, articleIndex) => {
    const article = articleMatch[1];
    if (!supported.has(article)) return;
    const bodyStart = articleMatch.index + articleMatch[0].length;
    const bodyEnd = articleMatches[articleIndex + 1]?.index ?? source.length;
    const body = source.slice(bodyStart, bodyEnd).trim();
    if (!body) return;
    const clauseMatches = Array.from(body.matchAll(/^\s*([A-Z])\.\s+([^\n]+)$/gm));
    const blocks = clauseMatches.length ? clauseMatches.map((clause, index) => {
      const start = clause.index;
      const end = clauseMatches[index + 1]?.index ?? body.length;
      return body.slice(start, end).trim().replace(/^\s*[A-Z]\.\s+/, "");
    }) : [body];
    blocks.forEach(block => {
      const clean = sanitizeExtractedSpecText(block).replace(/\n{3,}/g, "\n\n").trim();
      const wordCount = (clean.match(/[A-Za-z][A-Za-z'/-]*/g) || []).length;
      if (wordCount < 8 || clean.length > 9000 || isSpecSourceBoilerplate(clean)) return;
      const firstLine = clean.split("\n")[0].replace(/:$/, "").trim();
      const equipmentContext = article === "2.3" ? "System Operation" : article === "2.4" ? "System Performance" : firstLine.length <= 100 ? firstLine : identifySpecEquipmentContext(clean);
      const targetPart = article.startsWith("3.") ? "part3" : "part2";
      const destinationArticle = targetPart === "part3" ? getSpecSuggestionDestination({ targetPart, text: clean, equipmentContext }).article : article;
      results.push({ targetPart, destinationArticle, equipmentContext, text: clean });
    });
  });
  return results;
}

function isSpecOandMDocument(fileName, text = "") {
  const name = String(fileName || "");
  const sample = String(text || "").slice(0, 30000);
  return /(?:^|[\s_-])O\s*&\s*M(?:[\s_.-]|$)|operations?\s*(?:and|&)\s*maintenance/i.test(name) || /\boperation and maintenance manual\b|\bdaily maintenance\b[\s\S]{0,500}\bweekly maintenance\b/i.test(sample);
}

function extractOandMSequenceSuggestions(text) {
  const source = String(text || "").replace(/\r/g, "");
  const headings = Array.from(source.matchAll(/^\s*(?:\d+(?:\.\d+)*[.)]?\s+)?(?:SYSTEM\s+)?SEQUENCE OF OPERATION\s*:?[ \t]*$/gmi));
  return headings.slice(0, 4).map((heading, index) => {
    const start = heading.index + heading[0].length;
    const nextHeading = /^\s*(?:[A-Z][A-Z0-9 /&()-]{5,}|\d+(?:\.\d+)+\s+[A-Z][^\n]+)\s*$/gm;
    nextHeading.lastIndex = start;
    const next = nextHeading.exec(source);
    const end = headings[index + 1]?.index ?? next?.index ?? Math.min(source.length, start + 7000);
    const clean = sanitizeExtractedSpecText(source.slice(start, end)).replace(/\n{3,}/g, "\n\n").trim();
    return { targetPart: "part2", destinationArticle: "2.3", equipmentContext: "System Operation", text: clean };
  }).filter(item => (item.text.match(/[A-Za-z][A-Za-z'/-]*/g) || []).length >= 20 && !isSpecOandMTroubleshootingText(item.text));
}

function extractOandMProductDescriptionSuggestions(text, tocEquipmentNames = []) {
  const normalized = sanitizeExtractedSpecText(String(text || "")).replace(/\r/g, "").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n");
  const flat = normalized.replace(/\s+/g, " ").trim();
  if (!/\bNS\s+Part\s*#?\s*:/i.test(flat) || !/\bProduct\s+(?:Description|Features)\s*:/i.test(flat)) return [];
  if (/\b(?:troubleshooting|service assistance|engineering selection methods|typical performance\s*-\s*not guaranteed|installation instructions)\b/i.test(flat)) return [];
  const markers = Array.from(flat.matchAll(/\bNS\s+Part\s*#?\s*:\s*([A-Z0-9][A-Z0-9 ./&-]{1,80}?)\s+Product\s+(?:Description|Features)\s*:\s*/gi));
  const equipmentPatterns = [
    /\b\d+(?:\.\d+)?\s*HP\s+(?:RO|R\/O|Reclaim|High[- ]Pressure|Booster|Chemical)?\s*Pump\b/gi,
    /\b(?:RO|R\/O|Reclaim|High[- ]Pressure|Booster|Chemical)\s+Pump\b/gi,
    /\b(?:Electric[- ]Eye\s+)?Activation System\b/gi,
    /\b(?:Wash Main|Brush Air|Blower)?\s*Control Panel\b/gi,
    /\b(?:Acid|Alkaline|Rinse|Flooder|Reverse Osmosis|R\/O|High[- ]Pressure)\s+Arches?\b/gi,
    /\b(?:Brush|Blower|Dryer|Water Softener|Neutralization|Anti[- ]Freeze|Reclaim)\s+(?:Module|System)\b/gi,
    /\b(?:Spray Nozzles?|Air Compressor|Traffic Control System|Speed Control System|RO Console|Miscellaneous Components)\b/gi,
    /\b\d+(?:,\d{3})?\s*Gallon\s+(?:Water\s+)?Tank\b/gi,
    /\b(?:Curb|Guide|Entrance)\s+Rails?\b/gi,
    /\b(?:Water|Chemical|Reclaim|RO|R\/O)\s+(?:Storage\s+)?Tank\b/gi
  ];
  const dynamicEquipmentPatterns = Array.from(new Set((tocEquipmentNames || []).map(name => String(name || "").trim()).filter(name => name.length >= 3 && name.length <= 100))).sort((a, b) => b.length - a.length).map(name => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\s+/g, "\\s+")}\\b`, "gi"));
  const results = [];
  markers.forEach((marker, markerIndex) => {
    const prefix = flat.slice(Math.max(0, marker.index - 220), marker.index);
    const equipmentMatches = [...dynamicEquipmentPatterns, ...equipmentPatterns].flatMap(pattern => Array.from(prefix.matchAll(pattern))).sort((a, b) => (a.index + a[0].length) - (b.index + b[0].length) || a[0].length - b[0].length);
    let equipmentContext = equipmentMatches.at(-1)?.[0]?.replace(/\s+/g, " ").trim() || "";
    if (!equipmentContext) {
      const tail = prefix.replace(/^.*(?:Rev\.?|Manufacturers? of Vehicle Cleaning Equipment Since \d{4})\s*/i, "").replace(/(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}/g, " ").replace(/\b(?:Ph|Phone|Fax|Tel)\s*:?/gi, " ").replace(/\s+/g, " ").trim();
      const titleCandidate = tail.match(/([A-Z0-9][A-Za-z0-9/&()+.#-]*(?:\s+[A-Z0-9][A-Za-z0-9/&()+.#-]*){0,7})\s*$/)?.[1]?.trim() || "";
      if (titleCandidate && !/\b(?:Ave|Street|Road|California|Phone|Fax|Page|Manual|Corporation)\b/i.test(titleCandidate)) equipmentContext = titleCandidate;
    }
    if (!equipmentContext) return;
    const bodyStart = marker.index + marker[0].length;
    const bodyEnd = markers[markerIndex + 1]?.index ?? flat.length;
    let body = flat.slice(bodyStart, bodyEnd)
      .replace(/\b(?:Please (?:see|refer to)|Refer to)\b[\s\S]*$/i, "")
      .replace(/\bManufacturers? of Vehicle Cleaning Equipment Since \d{4}[\s\S]*$/i, "")
      .replace(/\bQuality Management System Certified by\b[\s\S]*$/i, "")
      .replace(/\bInstallation Note\s*:[\s\S]*$/i, "")
      .replace(/\b\d{1,4}\s+Rev\.?\s*$/i, "")
      .replace(/\s+/g, " ").trim();
    if (body.length < 35 || body.length > 3500) return;
    const partNumber = marker[1].replace(/\s*[-–]\s*/g, "-").replace(/\s+/g, " ").trim().replace(/\s+(?:Product|Rev)\b.*$/i, "");
    const sentences = splitOandMSentences(body).filter(sentence => !/\b(?:maintenance|inspect|clean|replace|service|troubleshoot|daily|weekly|monthly)\b/i.test(sentence));
    const cleanBody = cleanOandMOcrSpacing(sentences.join(" ").trim());
    if (cleanBody.length < 35) return;
    const canonicalContext = identifySpecEquipmentContext(equipmentContext) === "General System Requirement" ? normalizeExtractedSpecCapitalization(equipmentContext) : identifySpecEquipmentContext(equipmentContext);
    const subcomponents = Array.from(cleanBody.matchAll(/(?:^|\s)(?:o|[-•])?\s*([^.;:]{2,100}?)\s*\(NS\s+Part\s*#?\s*:\s*([A-Z0-9][A-Z0-9 /.-]{1,40})\)/gi)).map(match => ({ description: match[1].trim(), partNumber: match[2].replace(/\s*[-–]\s*/g, "-").replace(/\s+/g, " ").trim() }));
    let descriptionBody = cleanBody;
    if (subcomponents.length) descriptionBody = cleanBody.slice(0, cleanBody.search(/\bconsists? of\s*:/i) >= 0 ? cleanBody.search(/\bconsists? of\s*:/i) : cleanBody.length).trim();
    descriptionBody = removeTrailingOandMFragment(descriptionBody, canonicalContext);
    const descriptionSentences = splitOandMSentences(descriptionBody).map(convertOandMSentenceToSpecification).filter(Boolean);
    const descriptionLines = descriptionSentences.map((sentence, index) => `${index + 3}. ${sentence}`).join("\n");
    const componentHeadingNumber = descriptionSentences.length + 3;
    const componentLines = subcomponents.map((component, index) => `${String.fromCharCode(97 + Math.min(index, 25))}. ${component.description}; N/S part number ${normalizeOandMPartNumber(component.partNumber)}.`).join("\n");
    const text = `${canonicalContext}:\n1. Manufacturer: N/S Corporation.\n2. N/S part number: ${normalizeOandMPartNumber(partNumber)}.${descriptionLines ? `\n${descriptionLines}` : ""}${componentLines ? `\n${componentHeadingNumber}. Included components:\n${componentLines}` : ""}`;
    results.push({ targetPart: "part2", destinationArticle: "2.5", equipmentContext: canonicalContext, text, extractionKind: "O&M product description", confidence: "High", subcomponents });
  });
  return results.filter((item, index) => results.findIndex(other => `${other.equipmentContext}|${other.text}`.toLowerCase() === `${item.equipmentContext}|${item.text}`.toLowerCase()) === index);
}

function convertOandMSentenceToSpecification(sentence) {
  let value = String(sentence || "").trim();
  if (!value) return "";
  value = value
    .replace(/\bcomes? with\b/gi, "shall include")
    .replace(/\bwill be\b/gi, "shall be")
    .replace(/\bwill (activate|deactivate|start|stop|operate|pump|send|supply|provide)\b/gi, "shall $1")
    .replace(/\bcomprises of\b/gi, "shall consist of");
  return /[.!?]$/.test(value) ? value : `${value}.`;
}

function deriveOandMPart2Suggestions(productSection) {
  const source = String(productSection?.text || "").replace(/^.*?:\s*/, "").replace(/^\s*[12]\.\s+(?:Manufacturer|N\/S part number):.*$/gmi, "").replace(/^\s*3\.\s*/, "").replace(/^\s*4\.\s+Included components:[\s\S]*$/mi, "").replace(/\s+/g, " ").trim();
  if (!source) return [];
  const sentences = splitOandMSentences(source).map(sentence => sentence.trim()).filter(sentence => sentence.length >= 20 && sentence.length <= 600);
  const results = [];
  const add = (destinationArticle, label, patterns, extractionKind) => {
    let matches = sentences.filter(sentence => patterns.some(pattern => pattern.test(sentence)));
    if (destinationArticle === "2.6") matches = matches.filter(sentence => !/\b(?:stand|bracket|frame|base)\b.{0,45}\b(?:holds?|supports?|mounts?)\b.{0,30}\bcontrol panel\b/i.test(sentence));
    if (!matches.length) return;
    results.push({ targetPart: "part2", destinationArticle, equipmentContext: productSection.equipmentContext, text: matches.join("\n"), extractionKind, confidence: "Medium", destinationLabel: label });
  };
  add("2.3", "Operating Sequence", [/\bautomatically (?:activate|deactivate|start|stop)/i, /\bactivates? when\b/i, /\bduring the wash cycle\b/i, /\bas the vehicle\b/i, /\brequiring no intervention\b/i], "O&M operating facts");
  add("2.4", "Documented Performance", [/\bcapable of (?:delivering|producing|washing|operating)/i, /\brated (?:flow|pressure|capacity|output)/i, /\b\d+(?:\.\d+)?\s*(?:GPM|PSI|MPH)\b/i, /\bdimensions?\s+(?:are|is)\b/i, /\b\d+(?:,\d{3})?[- ]gallon\b/i], "O&M performance facts");
  add("2.6", "Controls and Electrical", [/\bcontrol panel\b/i, /\bPLC\b/i, /\bHMI\b/i, /\b\d{2,4}\s*VAC?\b/i, /\b(?:emitter|receiver|photoelectric|electric eye)\b/i, /\bpre[- ]?programmed timer\b/i], "O&M control facts");
  add("2.7", "Materials and Construction", [/\b(?:aluminum|stainless steel|galvanized steel|PVC|HDPE|fiberglass)\b/i, /\bSchedule\s*\d+\b/i, /\banchor bolts?\b/i, /\b\d+(?:\/\d+)?(?:[- ]inch|[”"])?\s*(?:tubing|pipe|angle|flat bar)\b/i], "O&M material facts");
  return results;
}

function cleanOandMOcrSpacing(text) {
  return String(text || "")
    .replace(/\b([A-Za-z]{2,})\s+-\s+([A-Za-z]{2,})\b/g, "$1-$2")
    .replace(/\b(Th|th)\s+e\b/g, "$1e")
    .replace(/\b(provide|require|include|comprise|activate|deactivate)\s+s\b/gi, "$1s")
    .replace(/\b(tan|ban|lin|pip)\s+k\b/gi, "$1k")
    .replace(/\bPVC\s+sch\s+(\d+)\b/gi, "PVC Schedule $1")
    .replace(/\bpre[- ]programmer\s+timer\b/gi, "pre-programmed timer")
    .replace(/\bside\s*-\s*to\s*-\s*side\b/gi, "side-to-side")
    .replace(/\b(\d+(?:\.\d+)?)\s*hp\b/gi, "$1 HP")
    .replace(/\b(\d+(?:\.\d+)?)\s*vac\b/gi, "$1 VAC")
    .replace(/\b(\d+(?:\.\d+)?)\s*psi\b/gi, "$1 PSI")
    .replace(/\bcomprises? of\b/gi, "comprises")
    .replace(/\bis made up of\b/gi, "consists of")
    .replace(/\s+([.,;:])/g, "$1")
    .replace(/\s+/g, " ").trim();
}

function removeTrailingOandMFragment(text, equipmentContext) {
  const value = String(text || "").trim();
  const sentences = splitOandMSentences(value);
  if (sentences.length < 2) return value;
  const last = sentences.at(-1).replace(/[.:;,-]+$/, "").trim();
  const equipment = String(equipmentContext || "").replace(/[.:;,-]+$/, "").trim();
  const looksIncomplete = !/[.!?]$/.test(sentences.at(-1)) && (last.length < 45 || last.toLowerCase() === equipment.toLowerCase() || new RegExp(`^(?:the\s+)?(?:\d+(?:\.\d+)?\s*HP\s+)?${equipment.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i").test(last));
  return looksIncomplete ? sentences.slice(0, -1).join(" ").trim() : value;
}

function splitOandMSentences(text) {
  const protectedText = String(text || "")
    .replace(/\b(dia|approx|typ|no|fig|rev)\.(?=\s|$)/gi, "$1<PERIOD>")
    .replace(/\b(\d+)\s*in\.(?=\s|$)/gi, "$1 inch");
  return protectedText.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).map(sentence => sentence.replace(/<PERIOD>/g, ".").trim()).filter(Boolean);
}

function normalizeOandMPartNumber(value) {
  let result = String(value || "").replace(/\s*[-–]\s*/g, "-").replace(/\s+/g, " ").trim();
  if (/^[A-Z0-9]+-[A-Z0-9 ]+$/i.test(result)) result = result.replace(/\s+/g, "");
  return result;
}

function extractLegacyEquipmentSpecificationSections(source) {
  if (!/PART\s+\d+\s*:\s*PRODUCTS/i.test(source) || !/Description of each component/i.test(source)) return [];
  const descriptionHeading = /^\s*\d+\.\s*Description of each component\s*:\s*$/mi.exec(source);
  if (!descriptionHeading) return [];
  const bodyStart = descriptionHeading.index + descriptionHeading[0].length;
  const remaining = source.slice(bodyStart);
  const nextPart = /^\s*PART\s+\d+\s*:/mi.exec(remaining);
  const body = remaining.slice(0, nextPart?.index ?? remaining.length);
  const componentMatches = Array.from(body.matchAll(/^\s*([a-z])\.\s+([^\n]+?)\s*:?\s*$/gm));
  return componentMatches.map((component, index) => {
    const start = component.index;
    const end = componentMatches[index + 1]?.index ?? body.length;
    const block = body.slice(start, end).trim().replace(/^\s*[a-z]\.\s+/, "");
    const clean = sanitizeExtractedSpecText(block).replace(/\n{3,}/g, "\n\n").trim();
    const equipmentContext = component[2].replace(/:$/, "").trim();
    return { targetPart: "part2", destinationArticle: "2.5", equipmentContext, text: clean };
  }).filter(item => (item.text.match(/[A-Za-z][A-Za-z'/-]*/g) || []).length >= 8 && !isSpecSourceBoilerplate(item.text));
}

function reconstructSpecificationPdfText(items) {
  const lines = [];
  (items || []).filter(item => String(item.str || "").trim()).forEach(item => {
    const x = Number(item.transform?.[4] || 0);
    const y = Number(item.transform?.[5] || 0);
    let line = lines.find(candidate => Math.abs(candidate.y - y) <= 2.5);
    if (!line) { line = { y, items: [] }; lines.push(line); }
    line.items.push({ x, text: String(item.str || "").trim() });
  });
  return lines.sort((a, b) => b.y - a.y).map(line => line.items.sort((a, b) => a.x - b.x).map(item => item.text).join(" ")).join("\n");
}

function extractStructuredSpecFillIns(text) {
  const source = String(text || "").replace(/\r/g, "");
  const normalized = source.replace(/[ \t]+/g, " ");
  const candidates = [];
  const add = (part, placeholder, label, value, evidence, confidence = "Medium") => {
    const cleanValue = String(value || "").replace(/\s+/g, " ").replace(/^[\s:;,-]+|[\s:;,-]+$/g, "").trim();
    if (!cleanValue || cleanValue.length > 240 || candidates.some(item => item.part === part && item.placeholder === placeholder && item.value.toLowerCase() === cleanValue.toLowerCase())) return;
    candidates.push({ part, placeholder, label, value: cleanValue, evidence: String(evidence || cleanValue).replace(/\s+/g, " ").trim().slice(0, 320), confidence });
  };
  const equipmentType = normalized.match(/\b(train|rail(?:car)?|bus|truck|car|vehicle)[ -]?wash(?:ing)? system\b/i);
  if (equipmentType) add("part1", "[EQUIPMENT TYPE]", "Equipment type", `${equipmentType[1].replace(/^rail(?:car)?$/i, "Train")} Wash`, equipmentType[0], "High");
  const systemName = normalized.match(/\b(?:system designation|wash system model)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._/-]{2,})\b/i);
  if (systemName) add("part1", "[SYSTEM NAME / MODEL]", "System name / model", systemName[1], systemName[0], "High");
  const vehicleType = normalized.match(/\b(passenger rail cars?|train sets?|transit buses?|buses|trucks|passenger vehicles?)\b/i);
  if (vehicleType) add("part2", "[VEHICLE TYPE]", "Vehicle type", vehicleType[1], vehicleType[0], "Medium");
  const maxHeight = normalized.match(/\bmaximum(?: overall)? height\s*(?:of|:|=)?\s*(\d+(?:\.\d+)?\s*(?:inches|inch|in\.?|[\"”]|feet|ft\.?))/i);
  if (maxHeight) add("part2", "[MAXIMUM HEIGHT]", "Maximum height", maxHeight[1], maxHeight[0], "High");
  const maxWidth = normalized.match(/\bmaximum(?: overall)? width\s*(?:of|:|=)?\s*(\d+(?:\.\d+)?\s*(?:inches|inch|in\.?|[\"”]|feet|ft\.?))/i) || normalized.match(/\bmaximum\s+(\d+(?:\.\d+)?\s*(?:inches|inch|in\.?|[\"”]|feet|ft\.?))\s+width\b/i);
  if (maxWidth) add("part2", "[MAXIMUM WIDTH]", "Maximum width", maxWidth[1], maxWidth[0], "High");
  const speed = normalized.match(/\b(?:maximum )?(?:wash|operating|travel) speed\s*(?:of|:|=)?\s*(\d+(?:\.\d+)?\s*(?:mph|miles per hour))\b/i) || normalized.match(/\bmaximum speed of travel[\s\S]{0,80}?\b(\d+(?:\.\d+)?\s*MPH)\b/i);
  if (speed) add("part2", "[CYCLE TIME OR OPERATING SPEED]", "Operating speed", speed[1], speed[0], "High");
  const voltage = normalized.match(/\b(?:electrical service|power supply|supply voltage|voltage)\s*[:=]?\s*(\d{2,4}(?:\s*[-/]\s*\d{2,4})?\s*(?:V|volts?))\b/i);
  if (voltage) add("part2", "[VOLTAGE]", "Voltage", voltage[1], voltage[0], "High");
  const phase = normalized.match(/\b(1|3)\s*(?:phase|ph)\b/i);
  if (phase) add("part2", "[PHASE]", "Phase", `${phase[1]} phase`, phase[0], "Medium");
  const amperage = normalized.match(/\b(?:amperage|full load amps?|FLA)\s*[:=]?\s*(\d+(?:\.\d+)?\s*(?:A|amps?))\b/i);
  if (amperage) add("part2", "[AMPERAGE]", "Amperage", amperage[1], amperage[0], "High");
  const material = normalized.match(/\b(304(?:\/304L)? stainless steel|316(?:L)? stainless steel|galvanized steel|aluminum)\b/i);
  if (material) add("part2", "[STRUCTURAL MATERIAL]", "Structural material", material[1], material[0], "Medium");
  if (/\bPLC\b/i.test(normalized) && /\bHMI\b/i.test(normalized)) add("part2", "[CONTROL PANEL / PLC / HMI DESCRIPTION]", "Controls", "PLC-based wash control panel with on-board HMI", normalized.match(/[^.]{0,100}\bPLC\b[^.]{0,140}\bHMI\b[^.]*\.?/i)?.[0] || "PLC and HMI", "Medium");
  const equipmentTerms = ["entrance push button station", "acid application arch", "brush modules", "high-pressure spinner arch", "reverse osmosis arch", "blower arch", "water-reclamation system", "control system", "anti-freeze system"];
  const foundEquipment = equipmentTerms.filter(term => normalized.toLowerCase().includes(term));
  if (foundEquipment.length) add("part2", "[MAIN EQUIPMENT]", "Main equipment", foundEquipment.map(term => term.replace(/\b\w/g, letter => letter.toUpperCase())).join(", "), foundEquipment.join(", "), "Medium");
  const washFunctions = [
    ["acid application", /\bacid application|acid arch/i], ["brush wash", /\bbrush module|brush wash/i], ["high-pressure wash", /\bhigh-pressure spinner|high pressure wash/i], ["reverse-osmosis rinse", /\breverse osmosis arch|R\/O arch/i], ["forced-air drying", /\bblower arch|dryer/i]
  ].filter(([, pattern]) => pattern.test(normalized)).map(([label]) => label);
  if (washFunctions.length) add("part2", "[WASH FUNCTIONS]", "Wash functions", washFunctions.join(", "), washFunctions.join(", "), "Medium");
  const optionTerms = [
    ["water-reclamation system", /\bwater reclamation|reclaim system/i], ["anti-freeze system", /\banti-freeze system|freeze protection/i], ["chemical bulk replenishment system", /\bchemical bulk (?:tank )?replenishment/i], ["splash-containment system", /\bsplash containment/i]
  ].filter(([, pattern]) => pattern.test(normalized)).map(([label]) => label);
  if (optionTerms.length) add("part2", "[SELECTED OPTIONS AND ACCESSORIES]", "Options and accessories", optionTerms.join(", "), optionTerms.join(", "), "Medium");
  if (/\bair compressor\b/i.test(normalized)) add("part2", "[AIR REQUIREMENT OR NOT REQUIRED]", "Air service", "Provide an air compressor and compressed-air service sized for the specified pneumatic equipment", normalized.match(/[^.]{0,120}\bair compressor\b[^.]*\.?/i)?.[0] || "Air compressor", "Medium");
  if (/\b(?:acid|alkaline) chemical mixing|chemical injection|neutralization system/i.test(normalized)) add("part2", "[REQUIREMENTS OR NOT INCLUDED]", "Chemical and reclaim requirements", "Provide the specified chemical mixing, injection, neutralization, and water-reclamation equipment", normalized.match(/[^.]{0,140}\b(?:chemical mixing|chemical injection|neutralization system)\b[^.]*\.?/i)?.[0] || "Chemical and reclaim systems", "Medium");
  const training = normalized.match(/\btrained\b.{0,90}?\b(?:minimum of\s*)?(\d+(?:\.\d+)?)\s*hours?\b/i)
    || normalized.match(/\bprovide\s+(?:a minimum of\s*)?(\d+(?:\.\d+)?)\s*hours?\b.{0,90}\btraining\b/i);
  if (training) add("part3", "[TRAINING HOURS]", "Training hours", training[1], training[0], "High");
  const cycles = normalized.match(/\b(?:consecutive\s+)?(\d+)(?:\s*\([a-z]+\))?\s+(?:complete\s+)?(?:trouble[- ]free\s+)?(?:train washes|vehicle washes|wash cycles|operating cycles)\b/i);
  if (cycles) add("part3", "[REQUIRED TROUBLE-FREE CYCLES]", "Trouble-free test cycles", cycles[1], cycles[0], "High");
  const manualCopies = normalized.match(/\b(one|two|three|four|five|six|\d+)(?:\s*\(\d+\))?\s+copies\s+of\s+(?:the\s+)?(?:system\s+)?(?:operations?\s+and\s+maintenance|O&M)\s+manuals?\b/i);
  if (manualCopies) add("part3", "[O&M MANUAL QUANTITY]", "O&M manual quantity", `${manualCopies[1]} copies`, manualCopies[0], "High");
  const warranty = normalized.match(/\b(?:warrant(?:y|ed)?(?:\s+work)?|warrant\s+the\s+work)\b.{0,140}?\b(?:period\s+of|for)\s+(one|two|three|four|five|\d+)(?:\s*\(\d+\))?\s+(years?|months?)\b/i);
  if (warranty) {
    add("part1", "[WARRANTY PERIOD]", "Warranty period", `${warranty[1]} ${warranty[2]}`, warranty[0], "High");
    add("part3", "[WARRANTY PERIOD]", "Warranty period", `${warranty[1]} ${warranty[2]}`, warranty[0], "High");
    const warrantyContext = normalized.slice(warranty.index, warranty.index + 320);
    const startEvent = /\bdate of Substantial Completion\b/i.test(warrantyContext) ? "the date of Substantial Completion"
      : /\bstart[- ]?up and commissioning(?: of the wash equipment)?\b/i.test(warrantyContext) ? "startup and commissioning of the wash equipment" : "";
    if (startEvent) {
      add("part1", "[WARRANTY START EVENT]", "Warranty start event", startEvent, warrantyContext, "High");
      add("part3", "[WARRANTY START EVENT]", "Warranty start event", startEvent, warrantyContext, "High");
    }
  }
  const plumbingParty = normalized.match(/\ball field plumbing and mechanical work\s+(?:will|shall)\s+be done by\s+(.+?)(?:\.|;)/i);
  if (plumbingParty) add("part3", "[FIELD PLUMBING RESPONSIBLE PARTY]", "Field plumbing responsibility", normalizeExtractedSpecCapitalization(plumbingParty[1]), plumbingParty[0], "High");
  const electricalParty = normalized.match(/\ball field electrical work\s+(?:will|shall)\s+be done by\s+(.+?)(?:\.|;)/i);
  if (electricalParty) add("part3", "[FIELD ELECTRICAL RESPONSIBLE PARTY]", "Field electrical responsibility", normalizeExtractedSpecCapitalization(electricalParty[1]), electricalParty[0], "High");
  const commissioningParty = normalized.match(/\b(the contractor|the manufacturer|manufacturer(?:'s)? representative|qualified manufacturer(?:'s)? representative)\s+shall\s+(?:undertake|perform|supervise|provide).{0,80}\b(?:commissioning|startup|start-up)\b/i);
  if (commissioningParty) add("part3", "[COMMISSIONING RESPONSIBLE PARTY]", "Commissioning responsibility", normalizeExtractedSpecCapitalization(commissioningParty[1]), commissioningParty[0], "Medium");
  const fourStageTest = normalized.match(/\bacceptance testing shall be conducted in four stages\b/i);
  const speedTest = normalized.match(/\btest\b.{0,160}\bvehicle\b.{0,100}\b(?:speed of\s*)?(\d+(?:\.\d+)?)\s*MPH\b/i) || normalized.match(/\bvehicle\b.{0,100}\b(?:speed of\s*)?(\d+(?:\.\d+)?)\s*MPH\b.{0,160}\btest\b/i);
  if (fourStageTest) add("part3", "[ACCEPTANCE TEST PROCEDURE]", "Acceptance test procedure", "a four-stage manual, activation, vehicle, and consecutive reliability test procedure", fourStageTest[0], "Medium");
  else if (speedTest) add("part3", "[ACCEPTANCE TEST PROCEDURE]", "Acceptance test procedure", `a post-installation ${speedTest[1]} MPH vehicle pass-through test with no damage to the wash system`, speedTest[0], "Medium");
  return candidates;
}

function sanitizeExtractedSpecText(text) {
  const winAnsiExtras = new Set([0x0152, 0x0153, 0x0160, 0x0161, 0x0178, 0x017D, 0x017E, 0x0192, 0x02C6, 0x02DC, 0x2013, 0x2014, 0x2018, 0x2019, 0x201A, 0x201C, 0x201D, 0x201E, 0x2020, 0x2021, 0x2026, 0x2030, 0x2039, 0x203A, 0x20AC, 0x2122]);
  const normalized = String(text || "")
    .replace(/\u00E2\u20AC[\u009C\u009D\u0153]/g, '"')
    .replace(/\u00C2\u00BC/g, "1/4")
    .replace(/\u00C2\u00BD/g, "1/2")
    .replace(/\u00C2\u00BE/g, "3/4")
    .replace(/\u00C3\u02DC/g, " diameter ")
    .replace(/\u00E2\u20AC[\u009C\u009D]/g, '"')
    .replace(/\u00E2\u20AC\u2122/g, "'")
    .replace(/\u00E2\u20AC[\u201C\u201D]/g, "-")
    .replace(/\u00C2\u00B0/g, " degrees ")
    .replace(/(?:ï‚·|â€¢|\uF0B7|\uF0A7|[\u2022\u2023\u2043\u25AA\u25CF])/g, " ")
    .replace(/\u03A9/g, "Ohm")
    .replace(/[\u2190-\u21FF]/g, " ")
    .normalize("NFC");
  return Array.from(normalized, character => {
    const code = character.codePointAt(0);
    if (character === "\n" || character === "\r" || character === "\t") return character;
    if ((code >= 0x20 && code <= 0x7E) || (code >= 0xA0 && code <= 0xFF) || winAnsiExtras.has(code)) return character;
    return " ";
  }).join("").replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

function extractSpecTocProducts(text) {
  const raw = String(text || "").replace(/\u00a0/g, " ");
  const value = raw.replace(/\s+/g, " ").trim();
  if (!/\.{5,}/.test(value) && !/\b(?:table of contents|contents)\b/i.test(value)) return [];
  const products = [];
  const seen = new Set();
  let inDatasheets = false;
  raw.replace(/\r\n/g, "\n").split("\n").forEach(rawLine => {
    const line = rawLine.trim();
    if (/^IV\.\s+Datasheets\b/i.test(line)) { inDatasheets = true; return; }
    if (inDatasheets && /^V\.\s+/i.test(line)) { inDatasheets = false; return; }
    if (!inDatasheets || /^[-–—]\s*/.test(line)) return;
    const entry = line.match(/^(?:[•▪]\s*)?(.+?)\s*\.{3,}\s*(\d{1,4})\s*$/);
    if (!entry) return;
    const description = normalizeExtractedSpecCapitalization(entry[1].replace(/\s+/g, " ").trim()).replace(/^[\s:;,-]+|[\s:;,-]+$/g, "");
    const wordCount = (description.match(/[A-Za-z][A-Za-z'/-]*/g) || []).length;
    const key = description.toLowerCase();
    if (/^datasheets?$/i.test(description) || wordCount < 2 || description.length > 100 || seen.has(key) || isSpecSourceBoilerplate(description)) return;
    seen.add(key);
    products.push({ description, referencePage: Number(entry[2]) });
  });
  const entryPattern = /(?:^|\s)(\d{1,4})\s*[-–]\s*([^\r\n.]{3,100}?)(?=\s*\.{3,})/g;
  let match;
  while ((match = entryPattern.exec(value)) && products.length < 150) {
    const referencePage = Number(match[1]);
    let description = normalizeExtractedSpecCapitalization(match[2].replace(/\s+/g, " ").trim());
    description = description.replace(/^[\s:;,-]+|[\s:;,-]+$/g, "");
    const wordCount = (description.match(/[A-Za-z][A-Za-z'/-]*/g) || []).length;
    if (!referencePage || wordCount < 2 || description.length > 100 || isSpecSourceBoilerplate(description)) continue;
    const key = description.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    products.push({ description, referencePage });
  }
  return products;
}

function extractSpecTocProductsV2(text) {
  const raw = String(text || "").replace(/\u00a0/g, " ");
  const value = raw.replace(/\s+/g, " ").trim();
  const rawLines = raw.replace(/\r\n/g, "\n").split("\n").map(line => line.trim()).filter(Boolean);
  const hasMasterHeading = rawLines.some(line => /^(?:TABLE OF CONTENTS|CONTENTS|(?:[IVXLC]+\.?|\d+[.)]?)?\s*(?:DATASHEETS?|PRODUCT DATA|EQUIPMENT(?: INDEX| LIST)?))\s*:?$/i.test(line));
  const leaderEntryCount = rawLines.filter(line => /\.{2,}\s*(?:Page\s*)?\d{1,4}\s*$/i.test(line)).length;
  if (!hasMasterHeading && leaderEntryCount < 2) return [];
  const products = [];
  const seen = new Set();
  let currentParent = "";
  const addProduct = (rawDescription, rawPage, level = "principal") => {
    const referencePage = Number(rawPage);
    const description = normalizeExtractedSpecCapitalization(String(rawDescription || "").replace(/\.{2,}/g, " ").replace(/\s+/g, " ").trim()).replace(/^[\s?:;,.\-–—•▪]+|[\s:;,.\-–—]+$/g, "");
    const wordCount = (description.match(/[A-Za-z][A-Za-z'/-]*/g) || []).length;
    const key = description.toLowerCase();
    if (!referencePage || referencePage > 5000 || /^(?:table of contents|contents|datasheets?|product data|equipment|section|page)$/i.test(description) || /^(?:manufacturers? of|check|before|make sure|complete|avoid|do not|open packages?|warning|caution)\b/i.test(description) || wordCount < 1 || wordCount > 14 || description.length < 3 || description.length > 120 || /[.!?]$/.test(description) || seen.has(key) || isSpecSourceBoilerplate(description)) return;
    seen.add(key);
    products.push({ description, referencePage, tocLevel: level, parentDescription: level === "child" ? currentParent : "" });
    if (level === "principal") currentParent = description;
  };
  const lines = rawLines;
  let inEquipmentSection = lines.some(line => /^(?:TABLE OF CONTENTS|CONTENTS)\s*:?$/i.test(line));
  lines.forEach((line, index) => {
    if (/^(?:[IVXLC]+\.?|\d+[.)]?)?\s*(?:Datasheets?|Product Data|Equipment(?: Index| List)?)\b/i.test(line)) { inEquipmentSection = true; return; }
    if (inEquipmentSection && /^(?:[IVXLC]+\.|\d+[.)])\s+[A-Z][A-Z ]{3,}$/i.test(line) && !/(?:Datasheets?|Product Data|Equipment)/i.test(line)) { inEquipmentSection = false; return; }
    if (!inEquipmentSection) return;
    const titleThenPage = line.match(/^(?:[-–—•▪]\s*)?(.+?)\s*(?:\.{2,}|[-–—]\s+|\s{2,})\s*(?:Page\s*)?(\d{1,4})\s*$/i);
    const pageThenTitle = line.match(/^(?:Page\s*)?(\d{1,4})\s*(?:[-–—:.]|\s{2,})\s*(.+)$/i);
    const simpleTitleThenPage = line.match(/^(?:[-–—•▪]\s*)?([A-Za-z0-9][A-Za-z0-9 /&(),.'#-]{2,100}?)\s+(\d{1,4})$/);
    const level = /^[-–—]\s*/.test(line) ? "child" : "principal";
    if (titleThenPage) addProduct(titleThenPage[1], titleThenPage[2], level);
    else if (pageThenTitle) addProduct(pageThenTitle[2], pageThenTitle[1], level);
    else if (simpleTitleThenPage) addProduct(simpleTitleThenPage[1], simpleTitleThenPage[2], level);
    else if (/^(?:[-–—•▪]\s*)?[A-Za-z][A-Za-z0-9 /&(),.'#-]{2,100}$/.test(line) && /^\s*(?:Page\s*)?\d{1,4}\s*$/i.test(lines[index + 1] || "")) addProduct(line, (lines[index + 1] || "").match(/\d+/)?.[0]);
  });
  const flattened = /(?:^|\s)(\d{1,4})\s*[-–]\s*([^\r\n.]{3,100}?)(?=\s*\.{3,})/g;
  let match;
  while (!products.length && (match = flattened.exec(value)) && products.length < 150) addProduct(match[2], match[1]);
  return products;
}

function isSpecSourceBoilerplate(text) {
  const value = String(text || "").replace(/\s+/g, " ").trim();
  const lower = value.toLowerCase();
  if (!value) return true;

  const dotLeaderCount = (value.match(/\.{5,}/g) || []).length;
  const tocEntryCount = (value.match(/(?:^|\s)\d+(?:\s*[-–]\s*|\.\s+)[A-Z0-9][^.]{2,90}\.{3,}\s*\d+/gi) || []).length;
  const hasContentsHeading = /\b(?:table of contents|contents)\b/i.test(value);
  const hasRepeatedPageEntries = (value.match(/\.{3,}\s*\d+\b/g) || []).length >= 2;
  if (dotLeaderCount >= 1 || tocEntryCount >= 1 || hasRepeatedPageEntries || (hasContentsHeading && value.length < 1200)) return true;

  const words = value.match(/[A-Za-z][A-Za-z'/-]*/g) || [];
  const numberTokens = value.match(/(?:^|\s)\d+(?:\.\d+)?(?=\s|$)/g) || [];
  const encodingPunctuation = value.match(/[@$^*_={}<>|\\`~]/g) || [];
  const singleLetterTokens = value.match(/\b[A-Za-z]\b/g) || [];
  const encodedCharacterRuns = value.match(/(?:[A-Za-z0-9][^\sA-Za-z0-9]{1,3}){8,}/g) || [];
  if (value.length > 120 && (encodingPunctuation.length / value.length > 0.055 || encodedCharacterRuns.length >= 1)) return true;
  if (value.length > 160 && singleLetterTokens.length >= 20 && singleLetterTokens.length > words.length * 0.28) return true;
  const brokenCharacters = value.match(/[�□\uFFFD\u25A1\u0000-\u0008\u000B\u000C\u000E-\u001F]/g) || [];
  const unusualCharacters = value.match(/[^A-Za-z0-9\s.,;:()'"/+#%&°¼½¾–—-]/g) || [];
  if (brokenCharacters.length >= 2 || (value.length > 40 && unusualCharacters.length / value.length > 0.12)) return true;
  if (value.length > 100 && numberTokens.length > words.length * 0.65) return true;

  const contactSignals = [
    /\b(?:ave(?:nue)?|street|st\.?|road|rd\.?|boulevard|blvd\.?|drive|dr\.?|lane|ln\.?)\b/i,
    /\b[A-Z]{2}\s+\d{5}(?:-\d{4})?\b/,
    /\b(?:ph|phone|fax|tel)\s*[:.]?\s*\+?\d/i,
    /\b\d{3}[.)-]\d{3}[.-]\d{4}\b/,
    /\b(?:www\.|https?:\/\/|[\w.+-]+@[\w.-]+\.[a-z]{2,})/i,
    /\b(?:copyright|all rights reserved)\b/i,
    /\bmanufacturers? of\b.*\bsince\s+\d{4}\b/i
  ].filter(pattern => pattern.test(value)).length;
  const specificationSignals = [
    /\bshall\b/i,
    /\b(?:fabricated|mounted|installed|provided|include[sd]?|consists? of|rated|capacity)\b/i,
    /\b\d+(?:\.\d+)?\s*(?:v|volt|amp|psi|gpm|hp|kw|inch|in\.|mm|ft|feet|degree|°)\b/i,
    /[¼½¾]|\b\d+\/\d+\s*(?:inch|in\.|\")/i
  ].filter(pattern => pattern.test(value)).length;

  return contactSignals >= 2 && specificationSignals === 0 ||
    (contactSignals >= 1 && /\bmanufacturers? of\b.*\bsince\s+\d{4}\b/i.test(lower) && specificationSignals === 0);
}

function isSpecOandMTroubleshootingText(text) {
  const value = String(text || "").toLowerCase();
  const symptomSignals = ["pump is starving", "pump not functioning", "then quits", "suspected", "external object is stuck", "filter is almost clogged", "suction line is blocked", "mechanical defects", "troubleshooting"];
  const diagnosticSignals = ["cause", "check", "inspect", "remove the impeller", "run the motor", "may be", "can be", "mislead maintenance"];
  return symptomSignals.filter(signal => value.includes(signal)).length >= 1 && diagnosticSignals.filter(signal => value.includes(signal)).length >= 1;
}

function isSpecWorthyOandMText(text) {
  const value = String(text || "");
  if (isSpecOandMTroubleshootingText(value)) return false;
  if (/\b(?:daily|weekly|monthly|quarterly|annual) maintenance\b|\bpossible causes?\b|\btroubleshooting\b|\bclean(?:ing)? (?:the |all )?(?:filter|screen|tank|pit)|\breplace if (?:needed|worn|damaged)\b/i.test(value)) return false;
  const designDirective = /\bshall\b|\bmust be (?:fabricated|constructed|rated|equipped|provided|designed)|\bprovide[ds]?\b/i.test(value);
  const technicalIdentity = /\b(?:manufacturer|make|model|basis of design|structural material|electrical service|rated capacity|flow rate|operating pressure|horsepower)\s*[:#]/i.test(value);
  const measurements = value.match(/\b\d+(?:\.\d+)?\s*(?:V|volts?|A|amps?|HP|GPM|PSI|RPM|kW|inches?|in\.|feet|ft\.|mm|gallons?)\b/gi) || [];
  const operation = /\bsequence of operation\b|\bwash mode\b|\bpass-through mode\b|\bautomatically (?:activate|deactivate|start|stop)|\bwhen the vehicle (?:enters|passes|exits)\b|\belectric eye activation systems?\b|\bset the system to ["“]?auto|\bverify rotation of each motor and pump\b/i.test(value);
  return operation || technicalIdentity || (designDirective && measurements.length >= 1) || measurements.length >= 3;
}

function splitSpecSourceText(text) {
  const normalized = String(text || "").replace(/\u00a0/g, " ").replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim();
  if (!normalized) return [];
  // A colon commonly separates technical labels from their values (for example,
  // "NS Part #: 900-0543"). Treating it as a sentence boundary detached the
  // value and the rest of a component list from the equipment description.
  const sentences = normalized.split(/(?<=[.!?;])\s+(?=[A-Z0-9])/).map(item => item.trim()).filter(item => item.length >= 35);
  const chunks = [];
  let current = "";
  sentences.forEach(sentence => {
    if (current && `${current} ${sentence}`.length > 1400) { chunks.push(current); current = sentence; }
    else current = current ? `${current} ${sentence}` : sentence;
  });
  if (current) chunks.push(current);
  return chunks.slice(0, 250).map(normalizeExtractedSpecCapitalization);
}

function formatExtractedSpecSuggestion(text) {
  const value = String(text || "").trim();
  if (isPumpStartupInstruction(value)) {
    return `Pump Startup and Protection:
1. Before pump startup, fill water tanks, pits, and associated reservoirs with fresh water when the water level is less than 12 to 18 inches above the pump suction.
2. Verify that each pump is fully primed and that no air is trapped within the pump or suction piping before operation.
3. Inspect chemical containers and verify that sufficient detergent is available for operation.
4. Replace missing, damaged, or broken spray nozzles before operating the associated pump system.
5. Do not operate a pump without adequate suction water or for an extended period near its dead-head condition of maximum pressure and no flow. Damage resulting from improper priming, inadequate water level, or prolonged dead-head operation is not covered by the manufacturer's warranty.`;
  }
  return value;
}

function isPumpStartupInstruction(text) {
  const value = String(text || "");
  return /\bpumps? (?:are|is) primed|\bair is trapped inside the pumps?|\bdead head zone\b/i.test(value) && /\bwater tanks?|\bpits?|\bsuction of pumps?\b/i.test(value);
}

function normalizeExtractedSpecCapitalization(text) {
  const original = String(text || "").trim();
  const letters = original.match(/[A-Za-z]/g) || [];
  if (letters.length < 12) return original;
  const uppercaseLetters = letters.filter(letter => letter === letter.toUpperCase()).length;
  if (uppercaseLetters / letters.length < 0.82) return original;

  let result = original.toLowerCase();
  result = result.replace(/(^|[.!?;:]\s+)([a-z])/g, (_, lead, letter) => `${lead}${letter.toUpperCase()}`);
  const technicalTerms = {
    "plc": "PLC", "hmi": "HMI", "vfd": "VFD", "psi": "PSI", "gpm": "GPM", "hp": "HP",
    "ul": "UL", "nec": "NEC", "nfpa": "NFPA", "ansi": "ANSI", "astm": "ASTM", "iso": "ISO",
    "ac": "AC", "dc": "DC", "o&m": "O&M", "n/s": "N/S"
  };
  Object.entries(technicalTerms).forEach(([term, replacement]) => {
    result = result.replace(new RegExp(`\\b${term.replace(/[&/]/g, "\\$&")}\\b`, "gi"), replacement);
  });
  result = result.replace(/\bN\/S corporation\b/gi, "N/S Corporation");
  return result;
}

function classifySpecSourceText(text) {
  const value = text.toLowerCase();
  const executionTerms = ["install", "installation", "commission", "start-up", "startup", "field wiring", "field plumbing", "training", "acceptance test", "testing shall", "contractor shall", "site preparation", "pump startup", "pump is fully primed", "pumps are primed", "before operation", "maintenance", "inspect chemical"];
  const productTerms = ["system", "equipment", "motor", "pump", "brush", "control", "panel", "plc", "hmi", "voltage", "phase", "amp", "water", "pressure", "flow", "stainless", "galvanized", "dimension", "capacity", "model", "manufacturer", "reclaim", "chemical", "safety"];
  const wordCount = (value.match(/[a-z][a-z'/-]*/g) || []).length;
  const directiveOrDescription = /\b(?:shall|provide[ds]?|install(?:ed|ation)?|verify|coordinate|perform|demonstrate|submit|include[sd]?|fabricated|mounted|designed|equipped|required|allow(?:s|ed)?|consists? of|rated)\b/i.test(text);
  const sentenceLike = wordCount >= 18 && /[.!?;:]/.test(text);
  if (!directiveOrDescription && !sentenceLike) return "";
  if (executionTerms.some(term => value.includes(term))) return "part3";
  if (productTerms.some(term => value.includes(term))) return "part2";
  return "";
}

function identifySpecEquipmentContext(text) {
  const value = String(text || "").toLowerCase();
  const equipment = [
    ["Skid Plates", /\bskid plate/],
    ["Wrap-Around Brush", /\bwrap[- ]?around brush|\bwrap brush/],
    ["Brush Motor", /\bbrush motor/],
    ["Gear Reducer", /\bgear reducer|\bgearbox/],
    ["Chemical Pump", /\bchemical pump/],
    ["RO Pump", /\b(?:ro|r\/o|reverse osmosis) pump/],
    ["High-Pressure Pump", /\bhigh[- ]pressure pump/],
    ["Reclaim Pump", /\b(?:\d+\s*hp\s+)?reclaim pump/],
    ["Spray Nozzles", /\bspray nozzle/],
    ["Activation System", /\bactivation system|\bvehicle activation/],
    ["Reclaim System", /\breclaim system|\bwater reclaim/],
    ["Control Panel", /\bcontrol panel|\bplc|\bhmi/],
    ["Wheel Wash", /\bwheel wash/],
    ["Undercarriage Wash", /\bundercarriage/],
    ["Dryer / Blower", /\bdryer|\bblower/],
    ["Vehicle Detection", /\bphoto ?eye|\bvehicle detect/],
    ["Brush System", /\bbrush(?:es)?\b/],
    ["Pump", /\bpump\b/],
    ["Wash System", /\bwash system|\bvehicle[- ]wash system/]
  ];
  return equipment.find(([, pattern]) => pattern.test(value))?.[0] || "General System Requirement";
}

function renderSpecSourceSuggestions() {
  const list = document.getElementById("specSuggestionList");
  const summary = document.getElementById("specSuggestionSummary");
  if (!list || !summary) return;
  const savedSuggestions = specState.sourceSuggestions || [];
  const originalSuggestions = savedSuggestions;
  const normalizedSuggestions = originalSuggestions.map(item => {
    if (item.status !== "pending") return item;
    const originalText = normalizeExtractedSpecCapitalization(sanitizeExtractedSpecText(item.text));
    const pumpStartup = isPumpStartupInstruction(originalText);
    let normalizedText = formatExtractedSpecSuggestion(originalText);
    const detectedContext = identifySpecEquipmentContext(normalizedText);
    const approvedContext = getApprovedTocEquipmentNames().sort((a, b) => b.length - a.length).find(name => normalizedText.toLowerCase().includes(name.toLowerCase()));
    const context = /\b(?:\d+\s*hp\s+)?reclaim pump\b/i.test(normalizedText) ? "Reclaim Pump" : approvedContext || item.equipmentContext || detectedContext;
    if (/spray nozzles?/i.test(context) && /spray features and benefits|flat spray pattern|spray angle/i.test(normalizedText)) normalizedText = formatSprayNozzleSpecification(context, normalizedText);
    return { ...item, text: normalizedText, targetPart: pumpStartup ? "part3" : item.targetPart, destinationArticle: pumpStartup ? "3.3" : item.destinationArticle, equipmentContext: pumpStartup ? "Pump Startup and Protection" : context };
  });
  const suggestions = normalizedSuggestions.filter(item => item.status !== "rejected" && (item.status !== "pending" || (!isSpecSourceBoilerplate(item.text) && !isSpecOandMTroubleshootingText(item.text) && classifySpecSourceText(item.text))));
  if (suggestions.length !== savedSuggestions.length || suggestions.some((item, index) => item.text !== savedSuggestions[index]?.text || item.equipmentContext !== savedSuggestions[index]?.equipmentContext || item.targetPart !== savedSuggestions[index]?.targetPart || item.destinationArticle !== savedSuggestions[index]?.destinationArticle)) specState.sourceSuggestions = suggestions;
  const pending = suggestions.filter(item => item.status === "pending").length;
  const accepted = suggestions.filter(item => item.status === "accepted").length;
  const searchValue = String(document.getElementById("specSuggestionSearch")?.value || "").trim().toLowerCase();
  const statusValue = document.getElementById("specSuggestionStatus")?.value || "";
  const sortMode = document.getElementById("specSuggestionSort")?.value || "destination";
  const displayedSuggestions = suggestions.filter(item => {
    if (statusValue && item.status !== statusValue) return false;
    if (!searchValue) return true;
    const destination = getSpecSuggestionDestination(item);
    return [item.equipmentContext, item.text, item.sourceDocument, item.sourcePage, destination.article, destination.title].some(value => String(value || "").toLowerCase().includes(searchValue));
  }).sort((a, b) => {
    if (sortMode === "equipment") return String(a.equipmentContext || identifySpecEquipmentContext(a.text)).localeCompare(String(b.equipmentContext || identifySpecEquipmentContext(b.text)), undefined, { numeric: true });
    if (sortMode === "destination") return getSpecSuggestionDestination(a).article.localeCompare(getSpecSuggestionDestination(b).article, undefined, { numeric: true }) || String(a.equipmentContext || "").localeCompare(String(b.equipmentContext || ""), undefined, { numeric: true }) || String(a.sourceDocument || "").localeCompare(String(b.sourceDocument || "")) || (Number(String(a.sourcePage || "").match(/\d+/)?.[0]) || 0) - (Number(String(b.sourcePage || "").match(/\d+/)?.[0]) || 0);
    if (sortMode === "status") return (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || String(a.equipmentContext || "").localeCompare(String(b.equipmentContext || ""));
    if (sortMode === "page") return (Number(String(a.sourcePage || "").match(/\d+/)?.[0]) || 0) - (Number(String(b.sourcePage || "").match(/\d+/)?.[0]) || 0);
    return 0;
  });
  summary.textContent = `${pending} awaiting review · ${accepted} accepted`;
  summary.className = `spec-load-status ${pending ? "is-loading" : "is-complete"}`;
  const aiSuggestionCount = suggestions.filter(item => item.extractionKind === "Local Qwen3-VL engineering extraction").length;
  if (aiSuggestionCount) summary.textContent += ` · ${aiSuggestionCount} from AI`;
  list.innerHTML = displayedSuggestions.length ? displayedSuggestions.map(item => {
    const destination = getSpecSuggestionDestination(item);
    const articleOptions = getSpecSuggestionArticleOptions(destination.key).map(option => `<option value="${option.article}" ${option.article === destination.article ? "selected" : ""}>${option.article} - ${escapeSpec(option.title)}</option>`).join("");
    const placementLevel = item.placementLevel || "auto";
    const placementOptions = [
      ["auto", "Auto - beneath matching equipment name"],
      ["letter", "A. Article paragraph"],
      ["number", "1. Numbered item"],
      ["lower", "a. Subitem"],
      ["detail", "(1) Detail item"]
    ].map(([value, label]) => `<option value="${value}" ${placementLevel === value ? "selected" : ""}>${label}</option>`).join("");
    const actions = item.status === "accepted"
      ? `<button type="button" class="secondary" onclick="undoSpecSourceSuggestion('${item.id}')">Undo Accept</button>`
      : `<button type="button" onclick="acceptSpecSourceSuggestion('${item.id}')">Accept into ${escapeSpec(destination.article)}</button><button type="button" class="delete-btn" onclick="rejectSpecSourceSuggestion('${item.id}')">Reject</button>`;
    return `<article class="spec-suggestion-card ${item.status}"><div class="spec-suggestion-heading"><div><span class="spec-status ${item.status}">${escapeSpec(item.status)}</span><strong>${escapeSpec(item.sourceDocument)}</strong><small>${escapeSpec(item.sourcePage)}</small><label class="spec-description-for"><span>Description applies to</span><input list="specApprovedEquipmentNames" value="${escapeSpecAttr(item.equipmentContext || identifySpecEquipmentContext(item.text))}" onchange="updateSpecSuggestion('${item.id}','equipmentContext',this.value)" ${item.status !== "pending" ? "disabled" : ""}></label></div><select aria-label="Specification part" onchange="updateSpecSuggestion('${item.id}','targetPart',this.value)" ${item.status !== "pending" ? "disabled" : ""}><option value="part2" ${item.targetPart === "part2" ? "selected" : ""}>Part 2 - Products</option><option value="part3" ${item.targetPart === "part3" ? "selected" : ""}>Part 3 - Execution</option></select></div><div class="spec-suggestion-placement-controls"><label class="spec-suggestion-destination"><strong>${item.status === "accepted" ? "Placed in" : "Place in article"}</strong><select onchange="updateSpecSuggestion('${item.id}','destinationArticle',this.value)" ${item.status !== "pending" ? "disabled" : ""}>${articleOptions}</select></label><label class="spec-suggestion-destination"><strong>Hierarchy level</strong><select onchange="updateSpecSuggestion('${item.id}','placementLevel',this.value)" ${item.status !== "pending" ? "disabled" : ""}>${placementOptions}</select></label></div><textarea aria-label="Extracted specification description" rows="5" spellcheck="true" autocapitalize="sentences" onchange="updateSpecSuggestion('${item.id}','text',this.value)" ${item.status !== "pending" ? "disabled" : ""}>${escapeSpec(item.text)}</textarea><div class="button-row spec-suggestion-actions">${actions}</div></article>`;
  }).join("") : `<p class="converter-muted">No source suggestions to review. Add a source document in Step 2 to extract new suggestions.</p>`;
  Array.from(list.querySelectorAll(".spec-suggestion-card")).forEach((card, index) => {
    const item = displayedSuggestions[index];
    if (!item) return;
    if (item.extractionKind === "Local Qwen3-VL engineering extraction") {
      const badge = document.createElement("span");
      badge.className = "spec-ai-origin-badge";
      badge.textContent = "AI Extracted";
      badge.title = "Created by Local AI and requires engineer review";
      card.querySelector(".spec-suggestion-heading > div")?.prepend(badge);
    }
    const destination = getSpecSuggestionDestination(item);
    const preview = document.createElement("div");
    preview.className = "spec-inline-placement-preview";
    const heading = document.createElement("div");
    heading.className = "spec-inline-placement-heading";
    heading.innerHTML = `<strong>Live placement preview</strong><span>${escapeSpec(destination.article)} - ${escapeSpec(destination.title)}</span>`;
    const body = document.createElement("div");
    body.className = "spec-inline-placement-body";
    renderSpecPlacementPreviewLines(body, getSpecSuggestionPlacementPreview(item, destination));
    preview.append(heading, body);
    card.querySelector("textarea")?.insertAdjacentElement("afterend", preview);
  });
  renderSpecEquipmentApprovals();
}

function getTocEquipmentCandidates() {
  return (specState.components || []).filter(item => (item.detectionMethod === "Table of contents product list" || item.detectionMethod === "Structured equipment extraction" || item.equipmentListCandidate) && item.equipmentListCandidate !== false && item.verificationStatus !== "Rejected");
}

function getApprovedTocEquipmentNames() {
  return Array.from(new Set(getTocEquipmentCandidates().filter(item => item.verificationStatus === "Engineer Approved").map(item => String(item.description || "").trim()).filter(Boolean)));
}

function replaceApprovedEquipmentListInPart2(text, names) {
  const list = names.length ? names.map((name, index) => `${index + 1}. ${name}`).join("\n") : "1. [MAIN EQUIPMENT]";
  const replacement = `2.2 EQUIPMENT LIST\nA. Refer to Drawings for exact quantities and equipment locations. The system shall include, at a minimum, the following principal equipment:\n${list}\n\n`;
  const current = String(text || "");
  const pattern = /^\s*2\.2\s+EQUIPMENT LIST\s*[\s\S]*?(?=^\s*2\.3\s+)/m;
  if (pattern.test(current)) return formatSpecificationEditorText(current.replace(pattern, replacement));
  const nextArticle = /^\s*2\.3\s+/m;
  return formatSpecificationEditorText(nextArticle.test(current) ? current.replace(nextArticle, `${replacement}$&`) : `${current.trim()}\n\n${replacement}`);
}

function syncApprovedEquipmentListToPart2() {
  const names = getApprovedTocEquipmentNames();
  const current = String(specState.project.part2 || getPart2StarterTemplate());
  specState.project.part2 = replaceApprovedEquipmentListInPart2(current, names);
  const editor = document.querySelector('[data-project-field="part2"]');
  if (editor) editor.value = specState.project.part2;
  updateSpecificationFillIndicators();
  renderSpecificationReview();
}

function renderSpecEquipmentApprovals() {
  const list = document.getElementById("specEquipmentApprovalList");
  const summary = document.getElementById("specEquipmentApprovalSummary");
  if (!list || !summary) return;
  const candidates = getTocEquipmentCandidates();
  const pending = candidates.filter(item => item.verificationStatus !== "Engineer Approved").length;
  const approved = candidates.length - pending;
  summary.textContent = candidates.length ? `${pending} awaiting review · ${approved} approved for the equipment list` : "No equipment records extracted yet.";
  summary.className = `spec-load-status ${pending ? "is-loading" : candidates.length ? "is-complete" : ""}`;
  list.innerHTML = `<datalist id="specApprovedEquipmentNames">${getApprovedTocEquipmentNames().map(name => `<option value="${escapeSpecAttr(name)}"></option>`).join("")}</datalist>` + candidates.map(item => {
    const includedParts = (specState.components || []).filter(component => ["O&M included component", "Table of contents product list"].includes(component.detectionMethod) && component.id !== item.id && component.sourceDocumentId === item.sourceDocumentId && String(component.assembly || "").toLowerCase() === String(item.description || "").toLowerCase());
    const includedPartCount = includedParts.length;
    const details = [item.manufacturer && `Manufacturer: ${item.manufacturer}`, item.model && `Model: ${item.model}`, item.quantity && `Quantity: ${item.quantity} ${item.unit || "ea"}`, includedPartCount && `${includedPartCount} included parts extracted`].filter(Boolean);
    const technical = Object.values(item.extractedFields || {}).flat().join(" · ");
    const warning = (item.extractionWarnings || []).join(" ");
    const badgeClass = item.conflict ? "conflict" : item.verificationStatus === "Engineer Approved" ? "accepted" : "pending";
    const badgeText = item.conflict ? "conflict" : item.verificationStatus === "Engineer Approved" ? "approved" : `${item.extractionConfidence || "Review"} confidence`;
    return `<article class="spec-equipment-approval-card ${item.verificationStatus === "Engineer Approved" ? "accepted" : "pending"} ${item.conflict ? "has-conflict" : ""}"><div><span class="spec-status ${badgeClass}">${escapeSpec(badgeText)}</span><input aria-label="Equipment name" value="${escapeSpecAttr(item.description)}" onchange="updateTocEquipmentName('${item.id}',this.value)" ${item.verificationStatus === "Engineer Approved" ? "disabled" : ""}>${details.length ? `<p class="spec-equipment-identity">${details.map(escapeSpec).join(" · ")}</p>` : ""}${technical ? `<p class="spec-equipment-technical">${escapeSpec(technical)}</p>` : ""}${warning ? `<p class="spec-equipment-warning">${escapeSpec(warning)}</p>` : ""}<small>${escapeSpec(item.sourceDocument)} · ${escapeSpec(item.sourcePage)}</small>${item.extractionEvidence ? `<details><summary>Source evidence</summary><p>${escapeSpec(item.extractionEvidence)}</p></details>` : ""}</div><div class="button-row">${item.verificationStatus === "Engineer Approved" ? `<button type="button" class="secondary" onclick="undoTocEquipmentApproval('${item.id}')">Undo Approval</button>` : `<button type="button" onclick="approveTocEquipment('${item.id}')">Approve for 2.2</button><button type="button" class="delete-btn" onclick="rejectTocEquipment('${item.id}')">Reject</button>`}</div></article>`;
  }).join("");
}

function updateTocEquipmentName(id, value) { const item = specState.components.find(row => row.id === id); if (!item) return; item.description = String(value || "").trim(); touchSpecificationProject(); renderSpecEquipmentApprovals(); }
function openManualTocEquipmentEntry() { showSpecFormModal("Add Equipment for Review", `<label>Equipment name<input id="specManualEquipmentName" placeholder="Example: Reclaim Pump"></label>`, () => { const description = val("specManualEquipmentName").trim(); if (!description) return; specState.components.push(createSpecComponent({ description, sourceDocument: "Manual equipment-list entry", detectionMethod: "Table of contents product list", verificationStatus: "Needs Review", quantityExplanation: "Manually added for approval before inclusion in Article 2.2." })); closeSpecModal(); touchSpecificationProject(); renderSpecEquipmentApprovals(); }); }
function approveTocEquipment(id) { const item = specState.components.find(row => row.id === id); if (!item || !item.description.trim()) return; item.verificationStatus = "Engineer Approved"; item.approvedBy = specState.project.engineer || "Engineer"; syncApprovedEquipmentListToPart2(); touchSpecificationProject(); renderSpecEquipmentApprovals(); renderSpecSourceSuggestions(); }
function undoTocEquipmentApproval(id) { const item = specState.components.find(row => row.id === id); if (!item) return; item.verificationStatus = "Needs Review"; item.approvedBy = ""; syncApprovedEquipmentListToPart2(); touchSpecificationProject(); renderSpecEquipmentApprovals(); renderSpecSourceSuggestions(); }
function rejectTocEquipment(id) { const item = specState.components.find(row => row.id === id); if (!item) return; item.verificationStatus = "Rejected"; item.include = false; syncApprovedEquipmentListToPart2(); touchSpecificationProject(); renderSpecEquipmentApprovals(); renderSpecSourceSuggestions(); }

function addAcceptedSuggestionToEquipmentApproval(suggestion, destination) {
  if (destination.article !== "2.5") return;
  const description = String(suggestion.equipmentContext || identifySpecEquipmentContext(suggestion.text) || "").replace(/:$/, "").trim();
  if (!description) return;
  const existing = (specState.components || []).find(item => (item.equipmentListCandidate || item.detectionMethod === "Table of contents product list") && String(item.description || "").trim().toLowerCase() === description.toLowerCase());
  if (existing) return;
  specState.components.push(createSpecComponent({
    description,
    sourceDocument: suggestion.sourceDocument || "Accepted Article 2.5 description",
    sourceDocumentId: suggestion.documentId || "",
    sourcePage: suggestion.sourcePage || "",
    detectionMethod: "Accepted Article 2.5 description",
    equipmentListCandidate: true,
    sourceSuggestionId: suggestion.id,
    verificationStatus: "Needs Review",
    quantityExplanation: "Added for equipment-list approval after its Article 2.5 description was accepted."
  }));
}

function renderSpecPlacementPreviewLines(container, text) {
  const appendPreviewText = (target, value) => {
    const parts = String(value || "").split(/(\[[A-Z0-9 &/,-]+\])/g);
    parts.forEach(part => {
      if (/^\[[A-Z0-9 &/,-]+\]$/.test(part)) {
        const fill = document.createElement("strong");
        fill.className = "spec-preview-fill-in";
        fill.textContent = part;
        target.appendChild(fill);
      } else target.appendChild(document.createTextNode(part));
    });
  };
  String(text || "").split("\n").forEach(rawLine => {
    const line = rawLine.trim();
    if (!line) {
      const spacer = document.createElement("div");
      spacer.className = "spec-preview-spacer";
      container.appendChild(spacer);
      return;
    }
    const patterns = [
      [/^(\d+\.\d+(?:\.\d+)?)\s+(.+)$/, 0],
      [/^([A-Z]+\.)\s+(.+)$/, 1],
      [/^(\d+\.)\s+(.+)$/, 2],
      [/^([a-z]+\.)\s+(.+)$/, 3],
      [/^(\(\d+\))\s+(.+)$/, 4]
    ];
    const parsed = patterns.map(([pattern, level]) => ({ match: line.match(pattern), level })).find(value => value.match);
    const row = document.createElement("div");
    row.className = `spec-preview-line level-${parsed?.level ?? 2}`;
    if (parsed) {
      const marker = document.createElement("span");
      marker.className = "spec-preview-marker";
      marker.textContent = parsed.match[1];
      const content = document.createElement("span");
      content.className = "spec-preview-content";
      appendPreviewText(content, parsed.match[2]);
      row.append(marker, content);
    } else {
      row.classList.add("unmarked");
      appendPreviewText(row, line);
    }
    container.appendChild(row);
  });
}

function getExtractedSpecFillConflict(candidate) {
  const projectKey = Object.keys(SPEC_PROJECT_PLACEHOLDERS).find(key => SPEC_PROJECT_PLACEHOLDERS[key].includes(candidate.placeholder));
  if (projectKey) {
    const currentValue = String(specState.project[projectKey] || "").trim();
    return { conflict: !!currentValue && currentValue.toLowerCase() !== String(candidate.value || "").trim().toLowerCase(), currentValue, projectKey, canReplace: true };
  }
  const fillEntries = Object.entries(specState.fillInValues || {});
  const matchingEntry = fillEntries.find(([key]) => key === `extracted|${candidate.part}|${candidate.placeholder}` || (key.startsWith(`${candidate.part}|`) && key.endsWith(`|${candidate.placeholder}`)));
  const currentValue = String(matchingEntry?.[1] || "").trim();
  const partText = String(specState.project[candidate.part] || "");
  const isFilled = currentValue || (!partText.includes(candidate.placeholder) && partText.trim());
  return { conflict: !!isFilled && (!currentValue || currentValue.toLowerCase() !== String(candidate.value || "").trim().toLowerCase()), currentValue, fillValueKey: matchingEntry?.[0] || "", canReplace: !!currentValue || partText.includes(candidate.placeholder) };
}

function getExtractedSpecFillPlacementPreview(candidate) {
  const part = candidate.part || "part2";
  const originalText = String(specState.project?.[part] || "");
  const placeholder = String(candidate.placeholder || "");
  const value = String(candidate.value || "").trim();
  const projectKey = Object.keys(SPEC_PROJECT_PLACEHOLDERS).find(key => SPEC_PROJECT_PLACEHOLDERS[key].includes(placeholder));
  if (projectKey) {
    const projectLabel = SPEC_PROJECT_LABELS[projectKey] || "Project Information";
    return { label: `Project Information - ${projectLabel}`, text: `PROJECT INFORMATION\n${projectLabel}: ${value || placeholder}\n\nThis value updates the ${projectLabel} project field and its matching specification placeholders.` };
  }
  const searchText = `${candidate.label || ""} ${placeholder}`.replace(/[\[\]_.]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  if (!originalText.includes(placeholder)) {
    const equipmentFields = [
      [/\b(?:ns )?part number|catalog number|item number\b/, "Part number"],
      [/\bmanufacturer|manufactured by|make\b/, "Manufacturer"],
      [/\bmodel(?: number)?\b/, "Model"],
      [/\btotal qty|quantity|qty\b/, "Quantity"],
      [/\bf\.?l\.?a|full load amp|amperes?|amps?\b/, "Electrical - full-load amperes"],
      [/\bvoltage|volts?\b/, "Electrical - voltage"],
      [/\bphase|hertz|frequency\b/, "Electrical - phase / frequency"],
      [/\bhorsepower|\bhp\b/, "Performance - horsepower"],
      [/\bflow|gpm|pressure|psi|capacity|rating\b/, "Performance rating"],
      [/\bdimension|height|width|length|weight\b/, "Dimensions"],
      [/\bmaterial|stainless|galvanized\b/, "Material"],
    ];
    const equipmentField = equipmentFields.find(([pattern]) => pattern.test(searchText))?.[1];
    if (equipmentField) return { label: `Equipment Schedule - ${equipmentField}`, text: `EQUIPMENT AND COMPONENTS\nSuggested field: ${equipmentField}\nExtracted value: ${value || "Not provided"}\n\nAssociate this value with the correct equipment record before generating the specification sheet. Technical requirements may then be placed in Article 2.5.` };
    if (/\bcustomer|owner|department|agency\b/.test(searchText)) return { label: "Project Information - Customer", text: `PROJECT INFORMATION\nSuggested field: Customer\nExtracted value: ${value || "Not provided"}\n\nReview before replacing the current project customer.` };
    if (/\bcity|state|location|address\b/.test(searchText)) return { label: "Project Information - Location", text: `PROJECT INFORMATION\nSuggested field: Project name / location\nExtracted value: ${value || "Not provided"}\n\nNo dedicated location field exists; review and place this manually if needed.` };
    if (/\bcar wash|truck wash|train wash|transit wash|equipment type\b/.test(searchText)) return { label: "Project Information - Equipment Type", text: `PROJECT INFORMATION\nSuggested field: Equipment Type\nExtracted value: ${value || "Not provided"}` };
    return { label: "No automatic template destination", text: `MANUAL REVIEW REQUIRED\nExtracted field: ${candidate.label || placeholder || "Unknown field"}\nExtracted value: ${value || "Not provided"}\n\nThis source label does not match a supported specification placeholder. Reject it or place it manually after confirming its purpose.` };
  }
  let previewText = originalText;
  let locationNeedle = placeholder;
  if (candidate.status === "pending" && placeholder && originalText.includes(placeholder)) {
    previewText = originalText.split(placeholder).join(value || placeholder);
    locationNeedle = value || placeholder;
  } else if (value && previewText.toLowerCase().includes(value.toLowerCase())) locationNeedle = value;
  const lines = previewText.split("\n");
  let locationIndex = lines.findIndex(line => line.toLowerCase().includes(locationNeedle.toLowerCase()));
  if (locationIndex < 0) locationIndex = 0;
  const articlePattern = /^\s*(\d+\.\d+(?:\.\d+)?)\s+(.+)$/;
  let start = locationIndex;
  while (start > 0 && !articlePattern.test(lines[start])) start -= 1;
  if (!articlePattern.test(lines[start] || "")) start = Math.max(0, locationIndex - 4);
  let end = Math.min(lines.length, Math.max(locationIndex + 5, start + 1));
  for (let index = start + 1; index < lines.length; index += 1) {
    if (articlePattern.test(lines[index])) { end = index; break; }
    end = Math.min(lines.length, index + 1);
  }
  const article = (lines[start] || "").match(articlePattern);
  return { label: article ? `${article[1]} - ${article[2]}` : part.replace("part", "Part "), text: lines.slice(start, end).join("\n").trim() || `${placeholder} will be replaced with ${value}.` };
}

function renderExtractedSpecFillIns() {
  const list = document.getElementById("specExtractedFillList");
  const summary = document.getElementById("specExtractedFillSummary");
  if (!list || !summary) return;
  const candidates = (specState.fillInSuggestions || []).filter(item => item.status !== "rejected");
  const pending = candidates.filter(item => item.status === "pending").length;
  const applied = candidates.filter(item => item.status === "accepted").length;
  summary.textContent = candidates.length ? `${pending} awaiting review · ${applied} applied to the template` : "No template values extracted yet.";
  summary.className = `spec-load-status ${pending ? "is-loading" : candidates.length ? "is-complete" : ""}`;
  const aiFillCount = candidates.filter(item => item.detectionMethod === "Local Qwen3-VL extraction").length;
  if (aiFillCount) summary.textContent += ` · ${aiFillCount} from AI`;
  list.innerHTML = candidates.map(item => {
    const comparison = item.status === "pending" ? getExtractedSpecFillConflict(item) : { conflict: false, currentValue: "" };
    const badge = item.status === "accepted" ? "Applied" : comparison.conflict ? "Conflict" : "Review";
    const conflictMarkup = comparison.conflict ? `<div class="spec-fill-conflict"><strong>Current template value:</strong> ${comparison.currentValue ? escapeSpec(comparison.currentValue) : "This fill-in was already completed manually."}</div>` : "";
    const actions = item.status === "accepted" ? `<button type="button" class="secondary" onclick="undoExtractedSpecFillIn('${item.id}')">Undo Apply</button>` : `<button type="button" onclick="applyExtractedSpecFillIn('${item.id}')" ${comparison.conflict && !comparison.canReplace ? "disabled" : ""}>${comparison.conflict ? comparison.canReplace ? "Replace Existing" : "Review in Part" : "Apply to Template"}</button><button type="button" class="delete-btn" onclick="rejectExtractedSpecFillIn('${item.id}')">Reject</button>`;
    return `<article class="spec-extracted-fill-card ${item.status} ${comparison.conflict ? "has-conflict" : ""}"><div class="spec-extracted-fill-heading"><div><span class="spec-status ${comparison.conflict ? "conflict" : item.status}">${badge}</span><strong>${escapeSpec(item.label)}</strong><code>${escapeSpec(item.placeholder)}</code></div><span class="spec-confidence">${escapeSpec(item.confidence)} confidence</span></div>${conflictMarkup}<p class="spec-extracted-value"><span>Extracted value</span>${escapeSpec(item.value)}</p><small>${escapeSpec(item.sourceDocument)} · ${escapeSpec(item.sourcePage)}</small><details><summary>Source evidence</summary><p>${escapeSpec(item.evidence)}</p></details><div class="button-row">${actions}</div></article>`;
  }).join("");
  Array.from(list.querySelectorAll(".spec-extracted-fill-card")).forEach((card, index) => {
    const item = candidates[index];
    if (!item) return;
    if (item.detectionMethod === "Local Qwen3-VL extraction") {
      const badge = document.createElement("span");
      badge.className = "spec-ai-origin-badge";
      badge.textContent = "AI Extracted";
      badge.title = "Created by Local AI and requires engineer review";
      card.querySelector(".spec-extracted-fill-heading > div")?.prepend(badge);
    }
    const placement = getExtractedSpecFillPlacementPreview(item);
    const preview = document.createElement("div");
    preview.className = "spec-inline-placement-preview spec-fill-placement-preview";
    const heading = document.createElement("div");
    heading.className = "spec-inline-placement-heading";
    heading.innerHTML = `<strong>Live placement preview</strong><span>${escapeSpec(placement.label)}</span>`;
    const body = document.createElement("div");
    body.className = "spec-inline-placement-body";
    renderSpecPlacementPreviewLines(body, placement.text);
    preview.append(heading, body);
    card.querySelector("details")?.insertAdjacentElement("afterend", preview);
  });
}

function applyExtractedSpecFillIn(id, silent = false) {
  const candidate = (specState.fillInSuggestions || []).find(item => item.id === id);
  if (!candidate || candidate.status !== "pending") return false;
  candidate.undoSnapshot = { project: { part1: specState.project.part1, part2: specState.project.part2, part3: specState.project.part3 }, projectFields: {}, projectFieldBindings: { ...(specState.projectFieldBindings || {}) }, fillInValues: { ...(specState.fillInValues || {}) } };
  const projectKey = Object.keys(SPEC_PROJECT_PLACEHOLDERS).find(key => SPEC_PROJECT_PLACEHOLDERS[key].includes(candidate.placeholder));
  if (projectKey) {
    candidate.undoSnapshot.projectFields[projectKey] = specState.project[projectKey] || "";
    specState.project[projectKey] = candidate.value;
    const projectField = document.querySelector(`[data-project-field="${projectKey}"]`);
    if (projectField) projectField.value = candidate.value;
    syncSpecificationProjectField(projectKey, candidate.value);
  } else {
    const fillKey = `extracted|${candidate.part}|${candidate.placeholder}`;
    const comparison = getExtractedSpecFillConflict(candidate);
    const priorValue = comparison.currentValue || specState.fillInValues?.[fillKey] || "";
    let text = String(specState.project[candidate.part] || "");
    const hadPlaceholder = text.includes(candidate.placeholder);
    if (hadPlaceholder) text = text.split(candidate.placeholder).join(candidate.value);
    else if (priorValue) text = text.split(priorValue).join(candidate.value);
    else {
      if (!silent) showSpecMessage("Fill-in Not Found", `${candidate.placeholder} is not present in ${candidate.part.replace("part", "Part ")}. Reload the starter or edit the section before applying this value.`);
      delete candidate.undoSnapshot;
      return false;
    }
    specState.fillInValues = specState.fillInValues || {};
    specState.fillInValues[fillKey] = candidate.value;
    specState.project[candidate.part] = formatSpecificationEditorText(text);
    const field = document.querySelector(`[data-project-field="${candidate.part}"]`);
    if (field) field.value = specState.project[candidate.part];
  }
  candidate.undoSnapshot.appliedProject = { part1: specState.project.part1, part2: specState.project.part2, part3: specState.project.part3 };
  candidate.status = "accepted";
  candidate.reviewedAt = new Date().toISOString();
  updateSpecificationFillIndicators();
  renderExtractedSpecFillIns();
  touchSpecificationProject();
  return true;
}

function undoExtractedSpecFillIn(id) {
  const candidate = (specState.fillInSuggestions || []).find(item => item.id === id);
  const snapshot = candidate?.undoSnapshot;
  if (!candidate || candidate.status !== "accepted") return;
  if (!snapshot) {
    const projectKey = Object.keys(SPEC_PROJECT_PLACEHOLDERS).find(key => SPEC_PROJECT_PLACEHOLDERS[key].includes(candidate.placeholder));
    const affectedParts = projectKey ? ["part1", "part2", "part3"] : [candidate.part];
    affectedParts.forEach(partKey => {
      const currentText = String(specState.project[partKey] || "");
      specState.project[partKey] = formatSpecificationEditorText(currentText.split(candidate.value).join(candidate.placeholder));
      const editor = document.querySelector(`[data-project-field="${partKey}"]`);
      if (editor) editor.value = specState.project[partKey];
    });
    if (projectKey && specState.project[projectKey] === candidate.value) {
      specState.project[projectKey] = "";
      specState.projectFieldBindings[projectKey] = "";
      const field = document.querySelector(`[data-project-field="${projectKey}"]`);
      if (field) field.value = "";
    }
    const fillKey = `extracted|${candidate.part}|${candidate.placeholder}`;
    if (specState.fillInValues?.[fillKey] === candidate.value) delete specState.fillInValues[fillKey];
    candidate.status = "pending";
    candidate.reviewedAt = "";
    touchSpecificationProject();
    updateSpecificationFillIndicators();
    renderExtractedSpecFillIns();
    return;
  }
  ["part1", "part2", "part3"].forEach(partKey => {
    const currentText = String(specState.project[partKey] || "");
    if (currentText === String(snapshot.appliedProject?.[partKey] || "")) {
      specState.project[partKey] = snapshot.project[partKey] || "";
    } else if (currentText !== String(snapshot.project[partKey] || "")) {
      const priorProjectValue = Object.values(snapshot.projectFields || {})[0];
      const restoreValue = priorProjectValue || candidate.placeholder;
      specState.project[partKey] = currentText.split(candidate.value).join(restoreValue);
    }
    const editor = document.querySelector(`[data-project-field="${partKey}"]`);
    if (editor) editor.value = specState.project[partKey];
  });
  Object.entries(snapshot.projectFields || {}).forEach(([key, value]) => {
    specState.project[key] = value;
    const field = document.querySelector(`[data-project-field="${key}"]`);
    if (field) field.value = value;
  });
  specState.projectFieldBindings = { ...(snapshot.projectFieldBindings || {}) };
  specState.fillInValues = { ...(snapshot.fillInValues || {}) };
  candidate.status = "pending";
  candidate.reviewedAt = "";
  delete candidate.undoSnapshot;
  touchSpecificationProject();
  updateSpecificationFillIndicators();
  renderExtractedSpecFillIns();
}

function rejectExtractedSpecFillIn(id) {
  const candidate = (specState.fillInSuggestions || []).find(item => item.id === id);
  if (!candidate || candidate.status !== "pending") return;
  candidate.status = "rejected";
  candidate.reviewedAt = new Date().toISOString();
  renderExtractedSpecFillIns();
  touchSpecificationProject();
}

function applyAllExtractedSpecFillIns() {
  const seen = new Set();
  let applied = 0;
  const confidenceRank = { High: 0, Medium: 1, Low: 2 };
  (specState.fillInSuggestions || []).filter(item => item.status === "pending").sort((a, b) => (confidenceRank[a.confidence] ?? 9) - (confidenceRank[b.confidence] ?? 9)).forEach(candidate => {
    const key = `${candidate.part}|${candidate.placeholder}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (applyExtractedSpecFillIn(candidate.id, true)) applied += 1;
  });
  renderExtractedSpecFillIns();
  if (!applied) showSpecMessage("No Values Applied", "No pending extracted values matched an unfilled template field.");
}

function updateSpecSuggestion(id, key, value) {
  const suggestion = specState.sourceSuggestions.find(item => item.id === id);
  if (!suggestion || suggestion.status !== "pending") return;
  suggestion[key] = key === "text" ? sanitizeExtractedSpecText(value) : value;
  if (key === "text") suggestion.equipmentContext = identifySpecEquipmentContext(suggestion[key]);
  if (key === "targetPart") suggestion.destinationArticle = "";
  touchSpecificationProject();
  if (key === "targetPart" || key === "destinationArticle" || key === "placementLevel") renderSpecSourceSuggestions();
  else if (key === "text" || key === "equipmentContext") setTimeout(renderSpecSourceSuggestions, 0);
}

function getSpecSuggestionArticleOptions(key) {
  return key === "part3" ? [
    { article: "3.1", title: "Site Readiness" },
    { article: "3.2", title: "Installation" },
    { article: "3.3", title: "Startup and Commissioning" },
    { article: "3.4", title: "Acceptance Testing" },
    { article: "3.5", title: "Training" },
    { article: "3.6", title: "Closeout" }
  ] : [
    { article: "2.2", title: "Equipment List" },
    { article: "2.3", title: "System Operation" },
    { article: "2.4", title: "System Performance" },
    { article: "2.5", title: "Equipment Technical Specifications" },
    { article: "2.6", title: "Control System Technical Specifications" },
    { article: "2.7", title: "Miscellaneous Requirements" }
  ];
}

function getSpecSuggestionDestination(suggestion) {
  const key = suggestion.targetPart === "part3" ? "part3" : "part2";
  const selected = getSpecSuggestionArticleOptions(key).find(option => option.article === suggestion.destinationArticle);
  if (selected) return { key, ...selected };
  const value = `${suggestion.text || ""} ${suggestion.equipmentContext || ""}`.toLowerCase();
  if (key === "part3") {
    if (/\bsite|foundation|readiness|existing condition|verify dimensions\b/.test(value)) return { key, article: "3.1", title: "Site Readiness" };
    if (/\binstall|installation|field wir|field plumb|anchoring|connection|erection\b/.test(value)) return { key, article: "3.2", title: "Installation" };
    if (/\bstartup|start-up|commission|adjustment|initial operation|prim(?:e|ed|ing)|pump suction|dead-head|dead head|fill water tanks?\b/.test(value)) return { key, article: "3.3", title: "Startup and Commissioning" };
    if (/\btest|testing|demonstrat|acceptance|operating cycle\b/.test(value)) return { key, article: "3.4", title: "Acceptance Testing" };
    if (/\btrain|instruction|operator|maintenance personnel\b/.test(value)) return { key, article: "3.5", title: "Training" };
    return { key, article: "3.6", title: "Closeout" };
  }
  if (/\bequipment list|shall include|consist of the following|at a minimum\b/.test(value)) return { key, article: "2.2", title: "Equipment List" };
  if (/\bsequence of operation|wash mode|automatically activate|automatically deactivate|interlock|traffic light|pass-through|manual override|vehicle-triggered|electric eye activation\b/.test(value)) return { key, article: "2.3", title: "System Operation" };
  if (/\bperformance|speed|mph|capacity|clean|pressure against|vehicle envelope|clearance\b/.test(value)) return { key, article: "2.4", title: "System Performance" };
  if (/\bplc|hmi|control panel|electrical|voltage|phase|amp|sensor|emergency stop|vfd|network|alarm\b/.test(value)) return { key, article: "2.6", title: "Control System Technical Specifications" };
  if (/\boption|accessor|freeze|anti-freeze|miscellaneous|identification label\b/.test(value)) return { key, article: "2.7", title: "Miscellaneous Requirements" };
  return { key, article: "2.5", title: "Equipment Technical Specifications" };
}

function insertSpecSuggestionAtArticle(content, destination, suggestionText, suggestion = {}) {
  const text = String(content || "").trim();
  const articlePattern = new RegExp(`^${destination.article.replace(".", "\\.")}\\s+.*$`, "m");
  const articleMatch = articlePattern.exec(text);
  if (!articleMatch) return `${text}\n\n${suggestionText}`.trim();
  const afterHeading = articleMatch.index + articleMatch[0].length;
  const remainder = text.slice(afterHeading);
  const nextArticle = /\n\s*\d+\.\d+(?:\.\d+)?\s+/.exec(remainder);
  const insertAt = nextArticle ? afterHeading + nextArticle.index : text.length;
  const articleBody = text.slice(afterHeading, insertAt);
  const suggestionLines = suggestionText.trim().split("\n");
  const proposedParent = suggestionLines[0].trim().replace(/:$/, "");
  const requestedLevel = suggestion.placementLevel || "auto";
  if (requestedLevel === "auto" && proposedParent && suggestionLines.length > 1) {
    const escapedParent = proposedParent.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const existingParent = new RegExp(`^[ \\t]*([A-Z]\\.|\\d+\\.|[a-z]+\\.|\\(\\d+\\))[ \\t]+${escapedParent}:?[ \\t]*$`, "mi").exec(articleBody);
    if (existingParent) {
      const parentEnd = afterHeading + existingParent.index + existingParent[0].length;
      const afterParent = text.slice(parentEnd, insertAt);
      const parentMarker = existingParent[1];
      const parentLevel = /^[A-Z]\.$/.test(parentMarker) ? 1 : /^\d+\.$/.test(parentMarker) ? 2 : /^[a-z]+\.$/.test(parentMarker) ? 3 : 4;
      const siblingPatterns = { 1: /\n[ \t]*[A-Z]\.[ \t]+/, 2: /\n[ \t]*(?:[A-Z]\.|\d+\.)[ \t]+/, 3: /\n[ \t]*(?:[A-Z]\.|\d+\.|[a-z]+\.)[ \t]+/, 4: /\n[ \t]*(?:[A-Z]\.|\d+\.|[a-z]+\.|\(\d+\))[ \t]+/ };
      const nextSibling = siblingPatterns[parentLevel].exec(afterParent);
      const subsectionEnd = nextSibling ? parentEnd + nextSibling.index : insertAt;
      const subsection = text.slice(parentEnd, subsectionEnd);
      const childLevel = Math.min(4, parentLevel + 1);
      const childPattern = childLevel === 2 ? /^\s*(\d+)\.\s+/gm : childLevel === 3 ? /^\s*([a-z]+)\.\s+/gm : /^\s*\((\d+)\)\s+/gm;
      const existingChildren = Array.from(subsection.matchAll(childPattern), match => childLevel === 3 ? match[1].charCodeAt(0) - 96 : Number(match[1]));
      const startingNumber = existingChildren.length ? Math.max(...existingChildren) : 0;
      const childLines = suggestionLines.slice(1).map((line, index) => {
        const content = line.trim().replace(/^\d+\.\s+/, "");
        const itemNumber = startingNumber + index + 1;
        const marker = childLevel === 2 ? `${itemNumber}.` : childLevel === 3 ? `${String.fromCharCode(96 + Math.min(itemNumber, 26))}.` : `(${itemNumber})`;
        return `${marker} ${content}`;
      }).filter(line => !/^(?:\d+\.|[a-z]+\.|\(\d+\))\s*$/.test(line));
      const separator = nextSibling ? "\n" : "\n\n";
      return `${text.slice(0, subsectionEnd).trimEnd()}\n${childLines.join("\n")}${separator}${text.slice(subsectionEnd).trimStart()}`.trim();
    }
  }
  if (requestedLevel !== "auto") {
    const contentLines = (suggestionLines.length > 1 ? suggestionLines.slice(1) : suggestionLines).map(line => line.trim().replace(/^(?:[A-Z]|\d+|[a-z]+)\.\s+|^\(\d+\)\s+/, "")).filter(Boolean);
    const existingMarkers = requestedLevel === "letter" ? Array.from(articleBody.matchAll(/^\s*([A-Z])\.\s+/gm), match => match[1].charCodeAt(0) - 64) : [];
    const start = existingMarkers.length ? Math.max(...existingMarkers) : 0;
    const placed = contentLines.map((line, index) => {
      const number = start + index + 1;
      const marker = requestedLevel === "letter" ? `${String.fromCharCode(64 + Math.min(number, 26))}.` : requestedLevel === "number" ? `${index + 1}.` : requestedLevel === "lower" ? `${String.fromCharCode(97 + Math.min(index, 25))}.` : `(${index + 1})`;
      return `${marker} ${line}`;
    }).join("\n");
    return `${text.slice(0, insertAt).trimEnd()}\n${placed}\n\n${text.slice(insertAt).trimStart()}`.trim();
  }
  const clauseLetters = Array.from(articleBody.matchAll(/^\s*([A-Z])\.\s+/gm), match => match[1].charCodeAt(0));
  const nextLetter = String.fromCharCode(Math.min(90, (clauseLetters.length ? Math.max(...clauseLetters) : 64) + 1));
  const placedText = /^(?:[A-Z]|\d+|[a-z])\.\s+|^\(\d+\)\s+/.test(suggestionText.trim()) ? suggestionText.trim() : `${nextLetter}. ${suggestionText.trim()}`;
  return `${text.slice(0, insertAt).trimEnd()}\n${placedText}\n\n${text.slice(insertAt).trimStart()}`.trim();
}

function formatSpecSuggestionForDestination(suggestion, destination) {
  const cleanText = sanitizeExtractedSpecText(formatExtractedSpecSuggestion(suggestion.text));
  const equipmentName = String(suggestion.equipmentContext || identifySpecEquipmentContext(cleanText)).trim();
  if (!equipmentName) return cleanText;
  if (destination.article === "2.5" && /spray nozzles?/i.test(equipmentName) && /spray features and benefits|flat spray pattern|spray angle/i.test(cleanText)) return formatSprayNozzleSpecification(equipmentName, cleanText);
  if (destination.article === "2.5" && /pump/i.test(equipmentName) && /drain plugs|pump shaft bearing bracket|rubber deflector/i.test(cleanText)) return formatPumpFeatureSpecification(equipmentName, cleanText);
  const firstLine = cleanText.split("\n")[0].trim();
  const alreadyUsesEquipmentHeading = firstLine.toLowerCase() === equipmentName.toLowerCase() || firstLine.toLowerCase() === `${equipmentName.toLowerCase()}:`;
  if (alreadyUsesEquipmentHeading) return cleanText;
  if (destination.article === "2.3" && /TURN ON \(ALL\) CONTROL PANEL\(S\)|CHECK ELECTRIC EYE ACTIVATION SYSTEMS/i.test(cleanText)) {
    const controlText = cleanText.match(/TURN ON \(ALL\) CONTROL PANEL\(S\)\s*([\s\S]*?)(?=CHECK ELECTRIC EYE ACTIVATION SYSTEMS|$)/i)?.[1]?.trim();
    const activationText = cleanText.match(/CHECK ELECTRIC EYE ACTIVATION SYSTEMS\s*([\s\S]*)$/i)?.[1]?.trim();
    const requirements = [controlText && `Control Panels: ${controlText}`, activationText && `Electric-Eye Activation Systems: ${activationText}`].filter(Boolean);
    return `${equipmentName.replace(/:$/, "")}:
${requirements.map((requirement, index) => `${index + 1}. ${requirement}`).join("\n")}`;
  }
  const numberedText = /^\s*\d+\.\s+/m.test(cleanText)
    ? cleanText
    : cleanText.split("\n").map((line, index) => `${index + 1}. ${line.trim()}`).join("\n");
  return `${equipmentName.replace(/:$/, "")}:
${numberedText}`;
}

function getSpecSuggestionPlacementPreview(suggestion, destination) {
  let previewText = String(specState.project[destination.key] || "");
  if (suggestion.status === "pending") {
    const formattedSuggestion = formatSpecSuggestionForDestination(suggestion, destination);
    previewText = insertSpecSuggestionAtArticle(previewText, destination, formattedSuggestion, suggestion);
  }
  previewText = formatSpecificationEditorText(previewText);
  const escapedArticle = destination.article.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const articleMatch = new RegExp(`^\\s*${escapedArticle}\\s+.*$`, "m").exec(previewText);
  if (!articleMatch) return previewText || "This article does not have any content yet.";
  const articleStart = articleMatch.index;
  const afterHeading = articleStart + articleMatch[0].length;
  const nextArticle = /\n\s*\d+\.\d+(?:\.\d+)?\s+/.exec(previewText.slice(afterHeading));
  const articleEnd = nextArticle ? afterHeading + nextArticle.index : previewText.length;
  return previewText.slice(articleStart, articleEnd).trim();
}

function formatSprayNozzleSpecification(equipmentName, text) {
  let value = String(text || "")
    .replace(/^\s*Spray Nozzles?\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
  value = value.replace(/(^|\s)(?:\d+|[a-z])\.(?=\s)/g, " ").replace(/(?::\s*){2,}/g, " ").replace(/\s+/g, " ").trim();
  const standardStart = value.search(/standard spray features and benefits/i);
  const taperedStart = value.search(/(?:^|\s)S?\s*Specially tapered spray pattern/i);
  const flatNozzleStart = value.search(/flat spray nozzle\s*:?\s*high impact/i);
  const standardText = value.slice(standardStart >= 0 ? standardStart : 0, taperedStart > 0 ? taperedStart : flatNozzleStart > 0 ? flatNozzleStart : value.length).replace(/^standard spray features and benefits\s*/i, "").trim();
  const taperedText = taperedStart >= 0 ? value.slice(taperedStart, flatNozzleStart > taperedStart ? flatNozzleStart : value.length).replace(/^\s*S?\s*Specially tapered spray pattern\s*/i, "").trim() : "";
  const flatText = flatNozzleStart >= 0 ? value.slice(flatNozzleStart).replace(/^flat spray nozzle\s*:?\s*/i, "").trim() : "";
  const sentenceClauses = segment => {
    const protectedDecimals = String(segment || "").replace(/(\d)\.(\d)/g, "$1<DECIMAL>$2");
    return (protectedDecimals.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(item => item.replace(/<DECIMAL>/g, ".").replace(/^[\s:;,-]+/, "").trim()).filter(Boolean);
  };
  const groups = [
    { title: "Standard Spray Features and Benefits", clauses: sentenceClauses(standardText) },
    { title: "Specially Tapered Spray Pattern", clauses: sentenceClauses(taperedText) },
    { title: "Flat Spray Nozzle", clauses: sentenceClauses(flatText) }
  ].filter(group => group.clauses.length);
  const lines = [`${equipmentName.replace(/:$/, "")}:`];
  groups.forEach((group, groupIndex) => {
    lines.push(`${groupIndex + 1}. ${group.title}:`);
    group.clauses.forEach((clause, clauseIndex) => lines.push(`${String.fromCharCode(97 + clauseIndex)}. ${clause}`));
  });
  return lines.join("\n");
}

function formatPumpFeatureSpecification(equipmentName, text) {
  const value = String(text || "").replace(/\s+/g, " ").trim().replace(/^Pump:?\s*/i, "");
  const headings = [
    { title: "Drain Plugs", pattern: /DRAIN PLUGS?/i },
    { title: "Pump Shaft-Bearing Bracket", pattern: /PUMP SHAFT BEARING BRACKET/i },
    { title: "Rubber Deflector", pattern: /RUBBER DEFLECTOR/i }
  ].map(item => ({ ...item, match: item.pattern.exec(value) })).filter(item => item.match).sort((a, b) => a.match.index - b.match.index);
  const lines = [`${equipmentName.replace(/:$/, "")}:`];
  const prefix = headings.length ? value.slice(0, headings[0].match.index).replace(/^\s*(?:[a-z]|\d+)\.\s*/, "").trim() : "";
  headings.forEach((heading, index) => {
    const start = heading.match.index + heading.match[0].length;
    const end = headings[index + 1]?.match.index ?? value.length;
    const extractedDescription = value.slice(start, end).replace(/^[\s:;-]+/, "").trim();
    const description = index === 0 && prefix ? `${prefix} ${extractedDescription}`.trim() : extractedDescription;
    const title = index === 0 && prefix ? "Seal and Drain Features" : heading.title;
    lines.push(`${index + 1}. ${title}:`);
    if (description) lines.push(`a. ${description}`);
  });
  return lines.join("\n");
}

function previewSpecSourceSuggestion(id) {
  const suggestion = specState.sourceSuggestions.find(item => item.id === id);
  if (!suggestion) return;
  const destination = getSpecSuggestionDestination(suggestion);
  const inserted = formatSpecificationEditorText(insertSpecSuggestionAtArticle(specState.project[destination.key], destination, formatSpecSuggestionForDestination(suggestion, destination), suggestion));
  const headingPattern = new RegExp(`^${destination.article.replace(".", "\\.")}\\s+.*$`, "m");
  const heading = headingPattern.exec(inserted);
  let preview = inserted;
  if (heading) {
    const remainder = inserted.slice(heading.index + heading[0].length);
    const nextArticle = /\n\s*\d+\.\d+(?:\.\d+)?\s+/.exec(remainder);
    preview = inserted.slice(heading.index, nextArticle ? heading.index + heading[0].length + nextArticle.index : inserted.length).trim();
  }
  showSpecFormModal(`Preview: ${destination.article} ${destination.title}`, `<p class="converter-muted">This is how the complete article will read after acceptance. Close the preview and edit the suggestion or choose another article if needed.</p><pre class="spec-placement-preview">${escapeSpec(preview)}</pre>`, closeSpecModal);
  document.querySelector("#specModalActions button")?.remove();
  const closeButton = document.querySelector("#specModalActions .secondary");
  if (closeButton) closeButton.textContent = "Close";
}

function acceptSpecSourceSuggestion(id, silent = false) {
  const suggestion = specState.sourceSuggestions.find(item => item.id === id);
  if (!suggestion || suggestion.status !== "pending") return;
  const destination = getSpecSuggestionDestination(suggestion);
  const key = destination.key;
  const cleanSuggestionText = formatSpecSuggestionForDestination(suggestion, destination);
  suggestion.undoSnapshot = { key, textBefore: specState.project[key] || "" };
  specState.project[key] = formatSpecificationEditorText(insertSpecSuggestionAtArticle(specState.project[key], destination, cleanSuggestionText, suggestion));
  suggestion.text = cleanSuggestionText;
  suggestion.destinationArticle = destination.article;
  suggestion.destinationTitle = destination.title;
  suggestion.undoSnapshot.textAfter = specState.project[key];
  const field = document.querySelector(`[data-project-field="${key}"]`);
  if (field) field.value = specState.project[key];
  suggestion.status = "accepted";
  suggestion.reviewedAt = new Date().toISOString();
  addAcceptedSuggestionToEquipmentApproval(suggestion, destination);
  touchSpecificationProject();
  if (!silent) renderSpecSourceSuggestions();
}

function undoSpecSourceSuggestion(id) {
  const suggestion = specState.sourceSuggestions.find(item => item.id === id);
  if (!suggestion || suggestion.status !== "accepted") return;
  const snapshot = suggestion.undoSnapshot;
  const key = snapshot?.key || (suggestion.targetPart === "part3" ? "part3" : "part2");
  if (snapshot && specState.project[key] === snapshot.textAfter) {
    specState.project[key] = snapshot.textBefore;
  } else {
    const escapedText = String(suggestion.text || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    specState.project[key] = formatSpecificationEditorText(String(specState.project[key] || "").replace(new RegExp(`(?:^|\\n)\\s*(?:[A-Z]\\.\\s+)?${escapedText}\\s*(?=\\n|$)`, "m"), "\n"));
  }
  const field = document.querySelector(`[data-project-field="${key}"]`);
  if (field) field.value = specState.project[key];
  suggestion.status = "pending";
  suggestion.reviewedAt = "";
  suggestion.destinationArticle = "";
  suggestion.destinationTitle = "";
  delete suggestion.undoSnapshot;
  specState.components = (specState.components || []).filter(item => item.sourceSuggestionId !== suggestion.id || item.verificationStatus === "Engineer Approved");
  touchSpecificationProject();
  renderSpecSourceSuggestions();
}

function rejectSpecSourceSuggestion(id) {
  const suggestion = specState.sourceSuggestions.find(item => item.id === id);
  if (!suggestion || suggestion.status !== "pending") return;
  specState.sourceSuggestions = specState.sourceSuggestions.filter(item => item.id !== id);
  touchSpecificationProject();
  renderSpecSourceSuggestions();
}

function isSpecSuggestionVisible(item) {
  const statusValue = document.getElementById("specSuggestionStatus")?.value || "";
  const searchValue = String(document.getElementById("specSuggestionSearch")?.value || "").trim().toLowerCase();
  if (statusValue && item.status !== statusValue) return false;
  if (!searchValue) return true;
  const destination = getSpecSuggestionDestination(item);
  return [item.equipmentContext, item.text, item.sourceDocument, item.sourcePage, destination.article, destination.title].some(value => String(value || "").toLowerCase().includes(searchValue));
}

function clearSpecSuggestionFilters() {
  const search = document.getElementById("specSuggestionSearch");
  const status = document.getElementById("specSuggestionStatus");
  const sort = document.getElementById("specSuggestionSort");
  if (search) search.value = "";
  if (status) status.value = "";
  if (sort) sort.value = "destination";
  renderSpecSourceSuggestions();
}

function refreshSpecSourceReview() {
  renderExtractedSpecFillIns();
  renderSpecSourceSuggestions();
  renderSpecificationReview();
  updateSpecificationFillIndicators();
  touchSpecificationProject();
  const summary = document.getElementById("specSuggestionSummary");
  if (summary) summary.setAttribute("aria-label", "Source Review refreshed");
}

function acceptAllSpecSuggestions() {
  (specState.sourceSuggestions || []).filter(item => item.status === "pending" && isSpecSuggestionVisible(item)).forEach(item => acceptSpecSourceSuggestion(item.id, true));
  renderSpecSourceSuggestions();
}

function rejectAllSpecSuggestions() {
  specState.sourceSuggestions = (specState.sourceSuggestions || []).filter(item => item.status !== "pending" || !isSpecSuggestionVisible(item));
  touchSpecificationProject();
  renderSpecSourceSuggestions();
}

function setSpecSourceStatus(message, state = "") {
  const status = document.getElementById("specSourceStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `spec-load-status${state ? ` ${state}` : ""}`;
  recordSpecLocalAiMessage(message);
}

function formatSpecLocalAiElapsed(milliseconds) {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds % 3600 / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${seconds}` : `${minutes}:${seconds}`;
}

function updateSpecLocalAiElapsed() {
  if (!specLocalAiStartedAt) return;
  const elapsed = document.getElementById("specAiElapsed");
  if (elapsed) elapsed.textContent = formatSpecLocalAiElapsed(performance.now() - specLocalAiStartedAt);
}

function recordSpecLocalAiMessage(message) {
  if (!message || message === specLocalAiLastMessage || !specLocalAiStartedAt) return;
  specLocalAiLastMessage = message;
  const history = document.getElementById("specAiMessageHistory");
  if (!history) return;
  const item = document.createElement("li");
  const time = document.createElement("time");
  const text = document.createElement("span");
  time.textContent = formatSpecLocalAiElapsed(performance.now() - specLocalAiStartedAt);
  text.textContent = message;
  item.append(time, text);
  history.appendChild(item);
  while (history.children.length > 80) history.firstElementChild?.remove();
  history.scrollTop = history.scrollHeight;
}

function startSpecLocalAiTimer(message) {
  specLocalAiStartedAt = performance.now();
  specLocalAiLastMessage = "";
  document.getElementById("specAiMessageHistory")?.replaceChildren();
  const elapsed = document.getElementById("specAiElapsed");
  if (elapsed) elapsed.textContent = "0:00";
  clearInterval(specLocalAiTimer);
  specLocalAiTimer = setInterval(updateSpecLocalAiElapsed, 250);
  setSpecSourceStatus(message, "is-loading");
}

function stopSpecLocalAiTimer() {
  updateSpecLocalAiElapsed();
  clearInterval(specLocalAiTimer);
  specLocalAiTimer = null;
  specLocalAiStartedAt = 0;
  specLocalAiActiveSource = "";
}

function renderSpecDocuments() {
  const list = document.getElementById("specDocumentList"); if (!list) return;
  list.innerHTML = specState.documents.length ? specState.documents.map(doc => `<div class="spec-document-row"><div><strong>${escapeSpec(doc.name)}</strong><span>${formatSpecBytes(doc.size)} · ${doc.storage} · ${escapeSpec(doc.importSummary || "Reference attached")}</span></div><div class="button-row">${specAiAuthenticatedUser ? `<button onclick="analyzeSpecDocumentWithLocalAI('${doc.id}')">Analyze with Local AI</button>` : ""}<button class="secondary" onclick="reanalyzeSpecDocument('${doc.id}')">${specDocumentFiles.has(doc.id) ? "Reanalyze" : "Reattach & Reanalyze"}</button><button class="secondary" onclick="downloadSpecDocument('${doc.id}')">Download</button><button class="delete-btn" onclick="removeSpecDocument('${doc.id}')">Remove</button></div></div>`).join("") : `<p class="converter-muted">No project documents added.</p>`;
  list.querySelectorAll(".spec-document-row").forEach(row => {
    row.firstElementChild?.classList.add("spec-document-info");
    row.lastElementChild?.classList.remove("button-row");
    row.lastElementChild?.classList.add("spec-document-actions");
    const aiButton = row.querySelector('[onclick^="analyzeSpecDocumentWithLocalAI"]');
    const analyzeButton = row.querySelector('[onclick^="reanalyzeSpecDocument"]');
    if (aiButton) { aiButton.classList.add("spec-ai-source-button"); aiButton.innerHTML = '<span aria-hidden="true">✦</span><span>Analyze with AI</span>'; aiButton.title = "Visual review with Local AI"; }
    if (analyzeButton) { analyzeButton.textContent = "Analyze"; analyzeButton.title = "Fast built-in text extraction"; }
  });
}

async function analyzeSpecDocumentWithLocalAI(id) {
  const record = specState.documents.find(item => item.id === id);
  if (!record || !window.SpecificationLocalAI) return showSpecMessage("Local AI Unavailable", "The local AI connector did not load.");
  let file = specDocumentFiles.get(id) || await getSpecificationSourceFile(id).catch(() => null);
  if (!file) return showSpecMessage("Source Unavailable", "Reattach this source once so it can be analyzed.");
  specDocumentFiles.set(id, file);
  const user = await getSpecAiLoggedInUser().catch(error => { showSpecMessage("Database Login Required", error.message); return null; });
  if (!user) return;
  if (!(await showSpecAiSetupNotice(user))) return;
  try {
    const status = await SpecificationLocalAI.status();
    if (!status.ready) return showSpecMessage("Model Not Installed", `Install ${status.model} in Ollama before analyzing this source.`);
  } catch (error) { return showSpecMessage("Local AI Not Ready", error.message); }
  const confirmed = await showSpecConfirm("Analyze Confidential Source Locally", `${file.name} will be sent only to the N/S local AI service after your database login is verified. Extracted results will require review.`, "Analyze Locally");
  if (!confirmed) return;
  specLocalAiActiveSource = file.name;
  startSpecLocalAiTimer(`Preparing ${file.name}...`);
  try {
    const source = await createSpecAiAnalysisSource(file);
    const completedPages = new Set((specState.aiAudit || [])
      .filter(entry => ["Local source analyzed", "Local source skipped"].includes(entry.action) && entry.documentId === id && entry.sourcePage)
      .map(entry => entry.sourcePage));
    recordSpecLocalAiMessage(`Opened ${source.total} page(s). ${completedPages.size} page(s) were restored from the previous checkpoint.`);
    const pendingIndexes = Array.from({ length: source.total }, (_, index) => index).filter(index => !completedPages.has(source.pageLabel(index)));
    if (!pendingIndexes.length) {
      setSpecSourceStatus(`Local AI already finished all ${source.total} page(s) in ${file.name}.`, "is-complete");
      stopSpecLocalAiTimer();
      return;
    }
    let equipmentAdded = 0, fillsAdded = 0, clausesAdded = 0, skipped = 0, timedOut = 0, cursor = 0, queuedUnit = null;
    const seenText = new Set();
    while (cursor < pendingIndexes.length || queuedUnit) {
      const batch = [];
      let batchMode = "";
      while ((cursor < pendingIndexes.length || queuedUnit) && batch.length < (batchMode === "text" ? 10 : 1)) {
        const unit = queuedUnit || await source.getUnit(pendingIndexes[cursor++]);
        queuedUnit = null;
        const textKey = String(unit.text || "").toLowerCase().replace(/\s+/g, " ").trim();
        const skipReason = unit.visuallyBlank ? "blank page"
          : unit.searchableTextHandled ? "searchable text already handled by built-in extraction"
          : textKey.length > 160 && seenText.has(textKey) ? "exact duplicate page"
          : "";
        if (textKey.length > 160) seenText.add(textKey);
        if (skipReason) {
          specState.aiAudit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), action: "Local source skipped", provider: "built-in-text-screening", documentId: id, sourcePage: unit.sourcePage, dataSent: false, outcome: skipReason });
          completedPages.add(unit.sourcePage); skipped += 1;
          setSpecSourceStatus(`Screening ${unit.sourcePage} | ${completedPages.size} of ${source.total} | ${unit.searchableTextHandled ? "Text already extracted" : "Skipped"}`, "is-loading");
          if (skipped % 20 === 0) saveSpecificationProject(false);
        } else {
          const unitMode = unit.imageBase64 ? "vision" : "text";
          if (batchMode && unitMode !== batchMode) { queuedUnit = unit; break; }
          batchMode = unitMode;
          batch.push(unit);
        }
      }
      if (!batch.length) continue;
      const pageNumbers = batch.map(unit => Number(String(unit.sourcePage).match(/\d+/)?.[0])).filter(Number.isFinite);
      const pageRange = pageNumbers.length && pageNumbers.length === batch.length
        ? `Page${pageNumbers.length === 1 ? "" : "s"} ${pageNumbers[0]}${pageNumbers.length > 1 ? `-${pageNumbers.at(-1)}` : ""}`
        : batch.map(unit => unit.sourcePage).join(", ");
      setSpecSourceStatus(`Analyzing ${pageRange} | ${completedPages.size} of ${source.total} complete | ${batchMode === "text" ? "Fast text batch" : "Visual page"}`, "is-loading");
      let results;
      const batchStartedAt = performance.now();
      try {
        results = await SpecificationLocalAI.analyzeBatch({ units: batch, sourceName: file.name });
      } catch (batchError) {
        if (/stopped by user/i.test(batchError.message)) throw batchError;
        if (/90-second page limit/i.test(batchError.message) && batch.every(unit => unit.imageBase64)) {
          results = batch.map(() => ({ equipment: [], fillIns: [], clauses: [], model: SpecificationLocalAI.model, user: user.email || user.id, visualTimedOut: true }));
          timedOut += batch.length;
          recordSpecLocalAiMessage(`${pageRange} exceeded 90 seconds and was marked for manual review. Analysis will continue.`);
        } else {
        if (/stopped responding|background service|fetch failed/i.test(batchError.message)) throw batchError;
        recordSpecLocalAiMessage(`Batch response could not be used (${batchError.message}). Retrying ${batch.length === 1 ? "the page" : "each page"} individually.`);
        results = [];
        for (const unit of batch) results.push(await SpecificationLocalAI.analyze({ ...unit, sourceName: file.name }));
        }
      }
      let batchEquipment = 0, batchFills = 0, batchClauses = 0;
      batch.forEach((unit, batchIndex) => {
        const result = results[batchIndex];
        const counts = importSpecLocalAiResult(result, record, unit.sourcePage);
        equipmentAdded += counts.equipment; fillsAdded += counts.fills; clausesAdded += counts.clauses;
        batchEquipment += counts.equipment; batchFills += counts.fills; batchClauses += counts.clauses;
        specState.aiAudit.push({ id: crypto.randomUUID(), at: new Date().toISOString(), action: result.visualTimedOut ? "Local visual review timed out" : "Local source analyzed", user: result.user, provider: "ollama-local", model: result.model, documentId: id, sourcePage: unit.sourcePage, dataSent: true, destination: "Company-controlled local AI", suggestionStatus: result.visualTimedOut ? "Manual page review required" : "Pending engineer review", batchSize: batch.length });
        if (!result.visualTimedOut) completedPages.add(unit.sourcePage);
      });
      recordSpecLocalAiMessage(`Completed ${pageRange} in ${formatSpecLocalAiElapsed(performance.now() - batchStartedAt)}. Added ${batchEquipment} equipment, ${batchFills} fill-in, and ${batchClauses} clause suggestion(s).`);
      saveSpecificationProject(false);
      renderSpecLocalAiSavedResults();
    }
    const savedCounts = getSpecLocalAiSavedCounts(record.id);
    record.importSummary = `${completedPages.size} of ${source.total} page(s) completed (${skipped} screened, ${timedOut} visual timeout); ${savedCounts.equipment} AI equipment item(s), ${savedCounts.fills} fill-in(s), and ${savedCounts.clauses} clause(s) saved for review`;
    touchSpecificationProject(); renderSpecLocalAiSavedResults();
    setSpecSourceStatus(timedOut
      ? `Analysis finalized through the last readable page. Saved for review: ${savedCounts.equipment} equipment, ${savedCounts.fills} fill-in, and ${savedCounts.clauses} specification clause result(s). ${timedOut} visual page(s) still need retry or manual review.`
      : `Local AI finished ${file.name}. Saved for review: ${savedCounts.equipment} equipment, ${savedCounts.fills} fill-in, and ${savedCounts.clauses} specification clause result(s).`, timedOut ? "is-error" : "is-complete");
    recordSpecLocalAiMessage(`${completedPages.size} of ${source.total} page(s) complete; ${skipped} page(s) screened without vision; ${timedOut} page(s) require manual visual review.`);
    stopSpecLocalAiTimer();
  } catch (error) {
    const savedCounts = getSpecLocalAiSavedCounts(record.id);
    renderSpecLocalAiSavedResults();
    setSpecSourceStatus(/stopped by user/i.test(error.message)
      ? `Analysis stopped. ${savedCounts.total} result(s) extracted so far are saved in Source Review.`
      : `Analysis paused: ${error.message} ${savedCounts.total} result(s) extracted before the interruption are saved in Source Review.`, /stopped by user/i.test(error.message) ? "" : "is-error");
    stopSpecLocalAiTimer();
  }
}

function getSpecLocalAiSavedCounts(documentId) {
  const equipment = (specState.components || []).filter(item => item.sourceDocumentId === documentId && item.aiInvolved).length;
  const fills = (specState.fillInSuggestions || []).filter(item => item.documentId === documentId && item.detectionMethod === "Local Qwen3-VL extraction").length;
  const clauses = (specState.sourceSuggestions || []).filter(item => item.documentId === documentId && item.extractionKind === "Local Qwen3-VL engineering extraction").length;
  return { equipment, fills, clauses, total: equipment + fills + clauses };
}

function renderSpecLocalAiSavedResults() {
  renderSpecDocuments();
  renderSpecComponents();
  renderExtractedSpecFillIns();
  renderSpecSourceSuggestions();
  renderSpecificationReview();
}

async function checkSpecLocalAiFromBanner() {
  return openSpecLocalAiStatusModal();
}

async function openSpecLocalAiStatusModal() {
  const modal = document.getElementById("specModal");
  const body = document.getElementById("specModalBody");
  const actions = document.getElementById("specModalActions");
  document.getElementById("specModalTitle").textContent = "Local AI Control Center";
  body.innerHTML = `<div class="spec-ai-status-dashboard"><div class="spec-ai-status-hero"><div class="spec-ai-status-orb">AI</div><div><h3>Checking Local AI...</h3><p>Verifying the background service and approved model.</p></div></div></div>`;
  actions.replaceChildren();
  const closeButton = document.createElement("button");
  closeButton.type = "button"; closeButton.className = "secondary"; closeButton.textContent = "Close"; closeButton.onclick = closeSpecModal;
  actions.append(closeButton);
  modal.classList.remove("hidden");

  const user = await getSpecAiLoggedInUser().catch(error => ({ email: "Database login required", statusError: error.message }));
  let status = null, statusError = user.statusError || "";
  if (!statusError) {
    try { status = await SpecificationLocalAI.status(); }
    catch (error) { statusError = error.message; }
  }
  const ready = Boolean(status?.ready) && !statusError;
  setSpecAiHeaderStatus(ready);
  const active = Boolean(specLocalAiStartedAt);
  const currentMessage = document.getElementById("specSourceStatus")?.textContent || "Waiting for a source.";
  body.innerHTML = `<div class="spec-ai-status-dashboard">
    <div class="spec-ai-status-hero${ready ? "" : " is-error"}"><div class="spec-ai-status-orb">AI</div><div><h3>${ready ? "Local AI is ready" : "Local AI needs attention"}</h3><p>${escapeSpec(statusError || (status.loaded ? "Qwen is loaded in memory and ready for the next page." : "The approved model is installed and will load when analysis begins."))}</p></div></div>
    <div class="spec-ai-status-grid">
      <div class="spec-ai-status-card"><span>Background service</span><strong>${ready ? "Connected" : "Unavailable"}</strong></div>
      <div class="spec-ai-status-card"><span>Model</span><strong>${escapeSpec(status?.model || window.SpecificationLocalAI?.model || "Qwen3-VL")}</strong></div>
      <div class="spec-ai-status-card"><span>Model memory</span><strong>${status?.loaded ? "Loaded now" : ready ? "Loads on demand" : "Not available"}</strong></div>
      <div class="spec-ai-status-card"><span>Database account</span><strong>${escapeSpec(user.email || user.id || "Signed in")}</strong></div>
      <div class="spec-ai-status-card"><span>Current activity</span><strong>${active ? "Analysis running" : "Idle"}</strong></div>
      <div class="spec-ai-status-card"><span>Elapsed</span><strong>${active ? formatSpecLocalAiElapsed(performance.now() - specLocalAiStartedAt) : "0:00"}</strong></div>
    </div>
    <div class="spec-ai-pipeline"><strong>Optimized analysis pipeline</strong><div class="spec-ai-pipeline-steps"><div class="spec-ai-pipeline-step"><b>1. Screen locally</b>Searchable, blank, and duplicate pages avoid redundant model work.</div><div class="spec-ai-pipeline-step"><b>2. Ground extraction</b>Qwen reviews only visual pages and must cite visible evidence.</div><div class="spec-ai-pipeline-step"><b>3. Review safely</b>90-second limits, checkpoints, and manual-review flags prevent stalled jobs.</div></div></div>
    ${active ? `<p class="spec-ai-status-note"><strong>Working now:</strong> ${escapeSpec(specLocalAiActiveSource)}<br>${escapeSpec(currentMessage)}</p>` : `<p class="spec-ai-status-note">Add or resume a source from the Sources + Local AI tab. Extracted results always remain pending until engineer review.</p>`}
  </div>`;

  const sourcesButton = document.createElement("button");
  sourcesButton.type = "button"; sourcesButton.textContent = "Open Sources"; sourcesButton.onclick = () => { closeSpecModal(); openSpecLocalAiSources(); };
  actions.prepend(sourcesButton);
  const examplesButton = document.createElement("button");
  examplesButton.type = "button"; examplesButton.className = "secondary"; examplesButton.textContent = "Manage Examples";
  examplesButton.onclick = openSpecLocalAiExamplesModal;
  actions.prepend(examplesButton);
  if (active && window.SpecificationLocalAI?.cancel) {
    const stopButton = document.createElement("button");
    stopButton.type = "button"; stopButton.className = "delete-btn"; stopButton.textContent = "Stop Analysis";
    stopButton.onclick = () => { SpecificationLocalAI.cancel(); closeSpecModal(); };
    actions.prepend(stopButton);
  }
}

function openSpecLocalAiExamplesModal() {
  const saved = localStorage.getItem(SPEC_LOCAL_AI_EXAMPLES_KEY) || "";
  const builtInExample = `BUILT-IN REFERENCE: Chicago Canal Spec, Section 111126 - Vehicle-Washing Equipment\n\nPART 2 - EQUIPMENT\nSOURCE PATTERN: Acid Application Arch; 1 inch Schedule 40 304/304L stainless-steel pipe; minimum 30 GPM at 60 PSI; multistage stainless-steel pump.\nEXPECTED: One named equipment record plus concise Part 2 equipment/component clauses. Preserve material and performance values and quote exact evidence.\n\nPART 2 - OPERATION\nSOURCE PATTERN: Overspeed bypass, final rinse/blower exceptions, and brush retraction behavior.\nEXPECTED: System-operation clauses in the closest Part 2 article, not maintenance items.\n\nPART 3 - TRAINING AND CLOSEOUT\nSOURCE PATTERN: Minimum four hours of training and three O&M manual copies.\nEXPECTED: Training Hours = 4; O&M Manual Quantity = 3; applicable Part 3 clauses.\n\nPART 3 - WARRANTY\nSOURCE PATTERN: Two-year warranty from startup and commissioning.\nEXPECTED: Warranty Period = 2 years; Warranty Start Event = startup and commissioning; applicable Part 3 clause.\n\nRESPONSIBILITY\nSOURCE PATTERN: General Contractor provides final utilities, field plumbing/mechanical, or field electrical work.\nEXPECTED: Place responsibility in Part 1 or Part 3, never in Manufacturer.\n\nIMPORTANT: This reference teaches organization only. Its facts must never be copied into an unrelated source.`;
  showSpecFormModal("Local AI Examples", `<div class="spec-ai-example-editor"><div class="spec-ai-example-default"><strong>Chicago Canal Spec is the built-in reference</strong><span>Every user receives these approved equipment, operation, training, closeout, warranty, and responsibility patterns automatically. No file import is required.</span><details><summary>View built-in reference</summary><pre>${escapeSpec(builtInExample)}</pre></details></div><label>Optional examples for this browser<textarea id="specLocalAiExamples" rows="14" spellcheck="true" placeholder="Add another approved SOURCE EXAMPLE → EXPECTED RESULT → DESTINATION → EVIDENCE pair, or leave this blank.">${escapeSpec(saved)}</textarea></label><div class="spec-ai-example-help"><strong>Optional local guidance</strong><span>Extra examples entered here apply only on this computer and browser.</span><span>Add IGNORE EXAMPLE entries for additional content the AI should skip.</span></div><p class="converter-muted">The Chicago Canal reference remains active even when this field is blank. It is intentionally condensed so Local AI stays fast. Keep optional examples concise; do not paste an entire manual.</p></div>`, () => {
    const examples = val("specLocalAiExamples").trim().slice(0, 12000);
    if (examples) localStorage.setItem(SPEC_LOCAL_AI_EXAMPLES_KEY, examples);
    else localStorage.removeItem(SPEC_LOCAL_AI_EXAMPLES_KEY);
    closeSpecModal();
    showSpecMessage("AI Examples Saved", examples ? "The Chicago Canal reference and your local examples will guide future analysis on this browser." : "Local examples were cleared. The Chicago Canal reference remains active for every user.");
  });
}

function getSpecAiWritingProjectKey() {
  return [specState.project.projectNumber, specState.project.projectName].map(value => String(value || "").trim()).filter(Boolean).join("|") || "untitled-project";
}

function getSpecAiWritingHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(SPEC_AI_WRITING_HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history : [];
  } catch { return []; }
}

function saveSpecAiWritingHistory(history) {
  const projectCounts = new Map();
  const recentByProject = history.filter(item => {
    const key = item.projectKey || "untitled-project";
    const count = projectCounts.get(key) || 0;
    if (count >= 3) return false;
    projectCounts.set(key, count + 1);
    return true;
  }).slice(0, 24);
  try { localStorage.setItem(SPEC_AI_WRITING_HISTORY_KEY, JSON.stringify(recentByProject)); }
  catch { localStorage.setItem(SPEC_AI_WRITING_HISTORY_KEY, JSON.stringify(recentByProject.slice(0, 6))); }
}

function addSpecAiWritingHistory(entry) {
  const history = getSpecAiWritingHistory();
  const record = { id: crypto.randomUUID(), projectKey: getSpecAiWritingProjectKey(), createdAt: new Date().toISOString(), status: "Previewed", ...entry };
  history.unshift(record);
  saveSpecAiWritingHistory(history);
  return record.id;
}

function updateSpecAiWritingHistory(id, changes) {
  const history = getSpecAiWritingHistory();
  const record = history.find(item => item.id === id);
  if (record) Object.assign(record, changes);
  saveSpecAiWritingHistory(history);
}

function renderSpecAiWritingHistory() {
  const history = getSpecAiWritingHistory().filter(item => item.projectKey === getSpecAiWritingProjectKey()).slice(0, 3);
  if (!history.length) return `<details class="spec-ai-writing-history"><summary><span>Writing history</span><small>No revisions yet</small></summary><p class="converter-muted">AI requests and revisions for this project will appear here.</p></details>`;
  const cards = history.map(item => `<article class="spec-ai-history-card"><div class="spec-ai-history-heading"><div><strong>Part ${escapeSpec(item.part)} · ${escapeSpec(item.instruction || "General quality review")}</strong><small>${escapeSpec(new Date(item.createdAt).toLocaleString())}</small></div><span class="${item.status === "Accepted" ? "is-accepted" : ""}">${escapeSpec(item.status || "Previewed")}</span></div>${item.summary ? `<p>${escapeSpec(item.summary)}</p>` : ""}<details><summary>Compare original and revision</summary><div class="spec-ai-history-compare"><div><strong>Before</strong><pre>${escapeSpec(item.before || "")}</pre></div><div><strong>AI revision</strong><pre>${escapeSpec(item.after || "")}</pre></div></div></details></article>`).join("");
  return `<details class="spec-ai-writing-history"><summary><span>Writing history</span><small>${history.length} recent revision${history.length === 1 ? "" : "s"}</small></summary><div class="spec-ai-history-list">${cards}</div></details>`;
}

function renderSpecAiWritingDiff(beforeText, afterText) {
  const before = String(beforeText || "").split("\n");
  const after = String(afterText || "").split("\n");
  let operations = [];
  if (before.length * after.length <= 90000) {
    const table = Array.from({ length: before.length + 1 }, () => new Uint16Array(after.length + 1));
    for (let i = before.length - 1; i >= 0; i--) for (let j = after.length - 1; j >= 0; j--) table[i][j] = before[i] === after[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
    let i = 0, j = 0;
    while (i < before.length || j < after.length) {
      if (i < before.length && j < after.length && before[i] === after[j]) { operations.push({ type: "same", text: before[i], oldLine: ++i, newLine: ++j }); }
      else if (j < after.length && (i === before.length || table[i][j + 1] >= table[i + 1][j])) { operations.push({ type: "added", text: after[j], oldLine: "", newLine: ++j }); }
      else { operations.push({ type: "removed", text: before[i], oldLine: ++i, newLine: "" }); }
    }
  } else {
    operations = [...before.map((text, index) => ({ type: "removed", text, oldLine: index + 1, newLine: "" })), ...after.map((text, index) => ({ type: "added", text, oldLine: "", newLine: index + 1 }))];
  }
  const similarity = (left, right) => {
    const leftWords = new Set(String(left).toLowerCase().match(/[a-z0-9]+/g) || []), rightWords = new Set(String(right).toLowerCase().match(/[a-z0-9]+/g) || []);
    if (!leftWords.size || !rightWords.size) return left === right ? 1 : 0;
    const shared = [...leftWords].filter(word => rightWords.has(word)).length;
    return (2 * shared) / (leftWords.size + rightWords.size);
  };
  const modifiedText = (left, right) => {
    let prefix = 0, suffix = 0;
    while (prefix < left.length && prefix < right.length && left[prefix] === right[prefix]) prefix++;
    while (suffix < left.length - prefix && suffix < right.length - prefix && left[left.length - 1 - suffix] === right[right.length - 1 - suffix]) suffix++;
    const start = escapeSpec(right.slice(0, prefix));
    const removed = escapeSpec(left.slice(prefix, left.length - suffix));
    const added = escapeSpec(right.slice(prefix, right.length - suffix));
    const end = escapeSpec(suffix ? right.slice(right.length - suffix) : "");
    return `${start}${removed ? `<del>${removed}</del>` : ""}${added ? `<ins>${added}</ins>` : ""}${end}` || " ";
  };
  const visible = [];
  let block = [];
  const flushBlock = () => {
    if (!block.length) return;
    const removed = block.filter(item => item.type === "removed"), added = block.filter(item => item.type === "added");
    const paired = Math.min(removed.length, added.length);
    for (let index = 0; index < paired; index++) {
      if (similarity(removed[index].text, added[index].text) >= 0.48) visible.push({ type: "modified", oldLine: removed[index].oldLine, newLine: added[index].newLine, html: modifiedText(removed[index].text, added[index].text) });
      else visible.push(removed[index], added[index]);
    }
    visible.push(...removed.slice(paired), ...added.slice(paired));
    block = [];
  };
  operations.forEach(operation => { if (operation.type === "same") flushBlock(); else block.push(operation); });
  flushBlock();
  if (!visible.length) return `<div class="spec-ai-diff-empty">No wording changed. The specification will remain exactly as it is.</div>`;
  return `<div class="spec-ai-diff-lines">${visible.map(operation => `<div class="spec-ai-diff-line ${operation.type}"><span>${operation.oldLine}</span><span>${operation.newLine}</span><b>${operation.type === "added" ? "+" : operation.type === "removed" ? "−" : "~"}</b><code>${operation.html || escapeSpec(operation.text) || " "}</code></div>`).join("")}</div>`;
}

function getSpecAiFillablePlaceholders(text) {
  return [...new Set(String(text || "").match(/\[[A-Z0-9][A-Z0-9 &/.,()'’:+-]*\]/g) || [])];
}

function specAiAllowsPlaceholderRemoval(placeholder, instruction) {
  const request = String(instruction || "").toLowerCase();
  const namesPlaceholder = request.includes(String(placeholder).toLowerCase()) || /\b(all|every)\s+(fillable|placeholder|template field)s?\b/.test(request);
  return namesPlaceholder && /\b(remove|delete|omit|drop)\b/.test(request);
}

function buildSpecAiUnifiedDiff(beforeText, afterText) {
  const before = String(beforeText || "").split("\n"), after = String(afterText || "").split("\n");
  const table = before.length * after.length <= 120000 ? Array.from({ length: before.length + 1 }, () => new Uint16Array(after.length + 1)) : null;
  if (table) for (let i = before.length - 1; i >= 0; i--) for (let j = after.length - 1; j >= 0; j--) table[i][j] = before[i] === after[j] ? table[i + 1][j + 1] + 1 : Math.max(table[i + 1][j], table[i][j + 1]);
  const operations = [];
  if (table) {
    let i = 0, j = 0;
    while (i < before.length || j < after.length) {
      if (i < before.length && j < after.length && before[i] === after[j]) operations.push({ type: "same", text: before[i], oldLine: ++i, newLine: ++j });
      else if (j < after.length && (i === before.length || table[i][j + 1] >= table[i + 1][j])) operations.push({ type: "added", text: after[j], oldLine: "", newLine: ++j });
      else operations.push({ type: "removed", text: before[i], oldLine: ++i, newLine: "" });
    }
  } else {
    operations.push(...before.map((text, index) => ({ type: "removed", text, oldLine: index + 1, newLine: "" })), ...after.map((text, index) => ({ type: "added", text, oldLine: "", newLine: index + 1 })));
  }
  const entries = [];
  let block = [];
  const flush = () => {
    if (!block.length) return;
    const removed = block.filter(item => item.type === "removed"), added = block.filter(item => item.type === "added"), paired = Math.min(removed.length, added.length);
    for (let index = 0; index < paired; index++) entries.push({ id: crypto.randomUUID(), type: "modified", oldText: removed[index].text, newText: added[index].text, oldLine: removed[index].oldLine, newLine: added[index].newLine, accepted: true });
    removed.slice(paired).forEach(item => entries.push({ id: crypto.randomUUID(), type: "removed", oldText: item.text, oldLine: item.oldLine, newLine: "", accepted: true }));
    added.slice(paired).forEach(item => entries.push({ id: crypto.randomUUID(), type: "added", newText: item.text, oldLine: "", newLine: item.newLine, accepted: true }));
    block = [];
  };
  operations.forEach(operation => { if (operation.type === "same") { flush(); entries.push({ id: crypto.randomUUID(), ...operation }); } else block.push(operation); });
  flush();
  return entries;
}

function getSpecAiUnifiedDiffText(entries) {
  return entries.flatMap(entry => entry.type === "same" ? [entry.text] : entry.type === "modified" ? [entry.accepted ? entry.newText : entry.oldText] : entry.type === "added" ? (entry.accepted ? [entry.newText] : []) : (entry.accepted ? [] : [entry.oldText])).join("\n");
}

function renderSpecAiInlineEdit(beforeText, afterText) {
  const before = String(beforeText || ""), after = String(afterText || "");
  let prefix = 0, suffix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  const unchangedStart = escapeSpec(after.slice(0, prefix));
  const removed = escapeSpec(before.slice(prefix, before.length - suffix));
  const added = escapeSpec(after.slice(prefix, after.length - suffix));
  const unchangedEnd = escapeSpec(suffix ? after.slice(after.length - suffix) : "");
  return `${unchangedStart}${removed ? `<del>${removed}</del>` : ""}${added ? `<ins>${added}</ins>` : ""}${unchangedEnd}` || " ";
}

function renderSpecAiChangedLine(beforeText, afterText, mode) {
  const before = String(beforeText || ""), after = String(afterText || ""), current = mode === "removed" ? before : after;
  let prefix = 0, suffix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix] === after[prefix]) prefix++;
  while (suffix < before.length - prefix && suffix < after.length - prefix && before[before.length - 1 - suffix] === after[after.length - 1 - suffix]) suffix++;
  const start = escapeSpec(current.slice(0, prefix)), changed = escapeSpec(current.slice(prefix, current.length - suffix)), end = escapeSpec(suffix ? current.slice(current.length - suffix) : "");
  return `${start}${changed ? `<mark>${changed}</mark>` : ""}${end}` || " ";
}

function renderSpecAiUnifiedDiff(entries) {
  return `<div class="spec-ai-unified-diff"><div class="spec-ai-unified-content">${entries.map(entry => entry.type === "same" ? `<div class="spec-ai-unified-line same"><span>${entry.oldLine}</span><span>${entry.newLine}</span><code>${escapeSpec(entry.text) || " "}</code></div>` : `<div class="spec-ai-unified-change ${entry.accepted ? "is-accepted" : "is-reverted"}${entry.lockedPlaceholder ? " protects-fillable" : ""}" data-ai-diff-entry="${entry.id}">${entry.type !== "added" ? `<div class="spec-ai-unified-line removed"><span>${entry.oldLine}</span><span></span><b>−</b><code>${entry.type === "modified" ? renderSpecAiChangedLine(entry.oldText, entry.newText, "removed") : escapeSpec(entry.oldText) || " "}</code></div>` : ""}${entry.type !== "removed" ? `<div class="spec-ai-unified-line added"><span></span><span>${entry.newLine}</span><b>+</b><code>${entry.type === "modified" ? renderSpecAiChangedLine(entry.oldText, entry.newText, "added") : escapeSpec(entry.newText) || " "}</code></div>` : ""}<div class="spec-ai-line-decisions"><button type="button" data-ai-diff-decision="accept"${entry.accepted ? ' class="active"' : ""}${entry.lockedPlaceholder ? ' disabled title="This change removes a protected fillable field."' : ""}>Accept</button><button type="button" data-ai-diff-decision="revert"${entry.accepted ? "" : ' class="active"'}>Revert</button></div></div>`).join("")}</div></div>`;
}

async function openSpecificationAiWriter(defaultPart = 1, draftInstruction = "") {
  defaultPart = [1, 2, 3].includes(Number(defaultPart)) ? Number(defaultPart) : 1;
  const signedInUser = await getSpecAiLoggedInUser().catch(error => {
    showSpecMessage("Database Login Required", error.message || "Sign in with your Database account before using Local AI.");
    return null;
  });
  if (!signedInUser) return;
  const getScope = () => {
    const part = Number(val("specAiWritingPart")) || 1;
    const editor = document.querySelector(`[data-project-field="part${part}"]`);
    const fullText = editor?.value || "";
    const start = Number.isInteger(editor?.selectionStart) ? editor.selectionStart : 0;
    const end = Number.isInteger(editor?.selectionEnd) ? editor.selectionEnd : 0;
    const hasSelection = end > start;
    return { part, editor, fullText, start, end, hasSelection, sourceText: hasSelection ? fullText.slice(start, end) : fullText };
  };
  showSpecFormModal("Improve with Local AI", `<div class="spec-ai-writing-modal"><div class="spec-ai-writing-intro"><span class="spec-ai-writing-icon" aria-hidden="true">✦</span><div><strong>Improve specification writing</strong><p id="specAiWritingScopeText">Select a part and describe what you want changed. Local AI preserves known facts, structure, numbering, and fillable fields, and nothing changes until you accept it.</p></div></div><div class="spec-ai-writing-setup"><label class="spec-ai-part-picker"><span>Part to improve</span><select id="specAiWritingPart"><option value="1"${defaultPart === 1 ? " selected" : ""}>Part 1 — General</option><option value="2"${defaultPart === 2 ? " selected" : ""}>Part 2 — Products</option><option value="3"${defaultPart === 3 ? " selected" : ""}>Part 3 — Execution</option></select><small>The writing rules adjust automatically for each part.</small></label></div>${renderSpecAiWritingHistory()}<details class="spec-ai-source-preview"><summary><span>Text Local AI will review</span><small>Source preview</small></summary><pre id="specAiWritingSource"></pre></details><label class="spec-ai-writing-prompt"><span>What should change? <em>Required</em></span><div class="spec-ai-prompt-compose"><textarea id="specAiWritingInstruction" rows="5" spellcheck="true" autocorrect="on" autocapitalize="sentences" placeholder="Example: Clarify the warranty responsibility and start date without changing any facts.">${escapeSpec(draftInstruction)}</textarea><div id="specAiGenerateSlot"></div></div><small>Enter sends. Shift+Enter adds a new line. Misspelled requests are understood and spelling is checked.</small><span id="specAiWritingInstructionError" class="spec-ai-field-error hidden">Describe what you want changed before generating a preview.</span></label></div>`, async () => {
    const scope = getScope();
    if (!scope.sourceText.trim()) return showSpecMessage(`Part ${scope.part} Text Needed`, `Add Part ${scope.part} wording before using the writing helper.`);
    const generateButton = document.getElementById("specAiGenerateButton");
    const instruction = val("specAiWritingInstruction").trim();
    if (!instruction) {
      document.getElementById("specAiWritingInstructionError")?.classList.remove("hidden");
      document.getElementById("specAiWritingInstruction")?.focus();
      return;
    }
    if (generateButton) { generateButton.disabled = true; generateButton.textContent = "…"; generateButton.title = "Generating preview"; }
    try {
      await SpecificationLocalAI.status();
      const result = await SpecificationLocalAI.improveSpecificationPart({ part: scope.part, text: scope.sourceText, project: { ...specState.project, part1: undefined, part2: undefined, part3: undefined }, instruction });
      const warnings = Array.isArray(result.warnings) ? result.warnings.filter(Boolean) : [];
      const requiredPlaceholders = getSpecAiFillablePlaceholders(scope.sourceText);
      const protectedPlaceholders = requiredPlaceholders.filter(placeholder => !specAiAllowsPlaceholderRemoval(placeholder, instruction));
      const diffEntries = buildSpecAiUnifiedDiff(scope.sourceText, result.revisedText);
      diffEntries.forEach(entry => {
        const acceptedText = entry.type === "modified" ? entry.newText : entry.type === "removed" ? "" : entry.type === "added" ? entry.newText : entry.text;
        const removesProtected = protectedPlaceholders.some(placeholder => String(entry.oldText || "").includes(placeholder) && !String(result.revisedText || "").includes(placeholder));
        if (removesProtected) { entry.accepted = false; entry.lockedPlaceholder = true; }
      });
      const historyId = addSpecAiWritingHistory({ part: scope.part, instruction: instruction || "General quality review", before: scope.sourceText.slice(0, 12000), after: String(result.revisedText).slice(0, 12000), summary: result.summary || "", warnings });
      showSpecFormModal(`Review Part ${scope.part} AI Revision`, `<div class="spec-ai-writing-modal spec-ai-writing-review"><div class="spec-ai-writing-intro"><span class="spec-ai-writing-icon" aria-hidden="true">✓</span><div><strong>Review the proposed changes</strong><p>${escapeSpec(result.summary || `Local AI prepared a revised Part ${scope.part} passage.`)}</p></div></div>${warnings.length ? `<details class="spec-ai-workspace-details"><summary><span>Items to verify</span><small>${warnings.length} item${warnings.length === 1 ? "" : "s"}</small></summary><div class="spec-ai-example-help">${warnings.map(item => `<span>${escapeSpec(item)}</span>`).join("")}</div></details>` : ""}<div id="specAiFillableWarning" class="spec-ai-fillable-warning hidden"></div><section class="spec-ai-github-diff"><header><strong>Part ${scope.part} line review</strong><span><b class="neutral"></b>Unchanged <b class="removed"></b>Removed <b class="added"></b>Added</span></header>${renderSpecAiUnifiedDiff(diffEntries)}</section><textarea id="specAiWritingRevision" class="hidden">${escapeSpec(getSpecAiUnifiedDiffText(diffEntries))}</textarea>${renderSpecAiWritingHistory()}</div>`, () => {
        const revisedText = val("specAiWritingRevision").trim();
        if (!revisedText) return showSpecMessage("Revision Required", "The revised text cannot be blank.");
        const missingPlaceholders = protectedPlaceholders.filter(placeholder => !revisedText.includes(placeholder));
        if (missingPlaceholders.length) return;
        if (scope.hasSelection) {
          if (scope.editor.value.slice(scope.start, scope.end) !== scope.sourceText) return showSpecMessage(`Part ${scope.part} Changed`, `Part ${scope.part} changed while the preview was open. Select the passage again so no newer writing is overwritten.`);
          scope.editor.value = `${scope.editor.value.slice(0, scope.start)}${revisedText}${scope.editor.value.slice(scope.end)}`;
        } else {
          if (scope.editor.value !== scope.fullText) return showSpecMessage(`Part ${scope.part} Changed`, `Part ${scope.part} changed while the preview was open. Open the writing helper again so no newer writing is overwritten.`);
          scope.editor.value = revisedText;
        }
        scope.editor.dispatchEvent(new Event("input", { bubbles: true }));
        updateSpecAiWritingHistory(historyId, { status: "Accepted", acceptedAt: new Date().toISOString(), after: revisedText.slice(0, 12000) });
        closeSpecModal();
        showSpecMessage(`Part ${scope.part} Changes Accepted`, scope.hasSelection ? "The accepted revision replaced the selected passage." : `The accepted revision replaced the Part ${scope.part} text.`);
      });
      const applyButton = document.querySelector("#specModalActions button");
      if (applyButton) applyButton.textContent = "Accept Changes";
      const revisionEditor = document.getElementById("specAiWritingRevision");
      const fillableWarning = document.getElementById("specAiFillableWarning");
      const validateFillables = () => {
        const missing = protectedPlaceholders.filter(placeholder => !String(revisionEditor?.value || "").includes(placeholder));
        diffEntries.forEach(entry => {
          const finalText = entry.type === "same" ? entry.text : entry.type === "modified" ? (entry.accepted ? entry.newText : entry.oldText) : entry.type === "added" ? (entry.accepted ? entry.newText : "") : (entry.accepted ? "" : entry.oldText);
          const removesProtectedField = missing.some(placeholder => String(entry.oldText || "").includes(placeholder) && !String(finalText || "").includes(placeholder));
          document.querySelector(`[data-ai-diff-entry="${entry.id}"]`)?.classList.toggle("removes-fillable", removesProtectedField);
        });
        if (applyButton) { applyButton.disabled = missing.length > 0; applyButton.title = missing.length ? "Restore the fillable placeholders before accepting." : "Accept these changes"; }
        if (fillableWarning) { fillableWarning.classList.toggle("hidden", !missing.length); fillableWarning.textContent = missing.length ? `The AI removed a fillable template field: ${missing.join(", ")}. Select Revert on the outlined change that removed it before accepting.` : ""; }
      };
      revisionEditor?.addEventListener("input", validateFillables);
      document.querySelector(".spec-ai-unified-diff")?.addEventListener("click", event => {
        const decisionButton = event.target.closest("[data-ai-diff-decision]");
        const change = decisionButton?.closest("[data-ai-diff-entry]");
        if (!decisionButton || !change) return;
        const entry = diffEntries.find(item => item.id === change.dataset.aiDiffEntry);
        if (!entry) return;
        entry.accepted = decisionButton.dataset.aiDiffDecision === "accept";
        change.classList.toggle("is-accepted", entry.accepted);
        change.classList.toggle("is-reverted", !entry.accepted);
        change.querySelectorAll("[data-ai-diff-decision]").forEach(button => button.classList.toggle("active", button === decisionButton));
        if (revisionEditor) { revisionEditor.value = getSpecAiUnifiedDiffText(diffEntries); revisionEditor.dispatchEvent(new Event("input", { bubbles: true })); }
      });
      validateFillables();
      const declineButton = document.querySelector("#specModalActions .secondary");
      if (declineButton) {
        declineButton.textContent = "Do Not Accept";
        declineButton.onclick = () => { updateSpecAiWritingHistory(historyId, { status: "Not Accepted", decidedAt: new Date().toISOString() }); closeSpecModal(); openSpecificationAiWriter(scope.part, instruction); };
      }
    } catch (error) {
      closeSpecModal();
      showSpecMessage(`Local AI Could Not Improve Part ${scope.part}`, error.message || "Try again with a smaller selection.");
    }
  });
  const refreshScope = () => {
    const scope = getScope();
    const source = document.getElementById("specAiWritingSource");
    const scopeText = document.getElementById("specAiWritingScopeText");
    if (source) source.textContent = scope.sourceText || `Part ${scope.part} is currently blank.`;
    if (scopeText) scopeText.textContent = `${scope.hasSelection ? `Selected Part ${scope.part} text` : `Part ${scope.part}`} is ready. Describe what you want changed. Local AI preserves known facts, structure, numbering, and fillable fields, and nothing changes until you accept it.`;
  };
  document.getElementById("specAiWritingPart")?.addEventListener("change", refreshScope);
  refreshScope();
  const actions = document.getElementById("specModalActions");
  const generateButton = actions?.querySelector("button:not(.secondary)");
  const closeButton = actions?.querySelector(".secondary");
  if (generateButton) { generateButton.id = "specAiGenerateButton"; generateButton.textContent = "↑"; generateButton.title = "Generate preview"; generateButton.setAttribute("aria-label", "Generate preview"); document.getElementById("specAiGenerateSlot")?.append(generateButton); }
  if (closeButton) closeButton.textContent = "Close";
  document.getElementById("specAiWritingInstruction")?.addEventListener("input", event => {
    if (event.target.value.trim()) document.getElementById("specAiWritingInstructionError")?.classList.add("hidden");
  });
  document.getElementById("specAiWritingInstruction")?.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); generateButton?.click(); }
  });
}

async function getSpecAiLoggedInUser() {
  if (!window.supabaseClient) throw new Error("Open Database and sign in before using Local AI.");
  const { data, error } = await window.supabaseClient.auth.getSession();
  if (error || !data.session?.user) throw new Error("Open Database and sign in with your normal database login, then return to Spec Automation.");
  return data.session.user;
}

function showSpecAiSetupNotice(user) {
  const userKey = String(user.id || user.email || "user").replace(/[^a-z0-9_-]/gi, "_");
  const storageKey = `ns-spec-local-ai-setup-notice-v1:${userKey}`;
  if (localStorage.getItem(storageKey) === "hidden") return Promise.resolve(true);
  return new Promise(resolve => {
    const modal = document.getElementById("specModal");
    document.getElementById("specModalTitle").textContent = "Local AI Setup";
    document.getElementById("specModalBody").innerHTML = `<div class="spec-privacy-panel"><strong>Local AI keeps source analysis on this computer.</strong><p>Ollama and the Qwen3-VL model must be installed on each computer that performs AI analysis. This pilot computer is already configured.</p></div><p>If Local AI is not installed on another approved company computer, download Ollama from the official website and ask the automation administrator to install the approved Qwen3-VL model.</p><p><a class="button-link" href="https://ollama.com/download/windows" target="_blank" rel="noopener noreferrer">Download Ollama for Windows</a></p><label class="spec-ai-notice-choice"><input id="specAiHideSetupNotice" type="checkbox"> Don’t show this message again for my login on this computer</label>`;
    const actions = document.getElementById("specModalActions");
    actions.replaceChildren();
    const continueButton = document.createElement("button");
    continueButton.textContent = "Continue to Local AI";
    continueButton.onclick = () => {
      if (document.getElementById("specAiHideSetupNotice")?.checked) localStorage.setItem(storageKey, "hidden");
      closeSpecModal(); resolve(true);
    };
    const cancelButton = document.createElement("button");
    cancelButton.className = "secondary"; cancelButton.textContent = "Cancel";
    cancelButton.onclick = () => { closeSpecModal(); resolve(false); };
    actions.append(continueButton, cancelButton);
    modal.classList.remove("hidden");
  });
}

async function createSpecAiAnalysisSource(file) {
  if (/\.pdf$/i.test(file.name)) {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
    return { total: pdf.numPages, pageLabel: index => `Page ${index + 1}`, getUnit: async index => {
      const pageNumber = index + 1;
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = sanitizeExtractedSpecText(reconstructSpecificationPdfText(content.items));
      // A substantial PDF text layer contains the same engineering labels and
      // values at a fraction of the inference cost. Sparse/scanned pages still
      // receive full visual review.
      if (text.replace(/\s+/g, " ").trim().length >= 80) return { sourcePage: `Page ${pageNumber}`, text, visuallyBlank: false, searchableTextHandled: true };
      const viewport = page.getViewport({ scale: 0.65 });
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext("2d", { alpha: false });
      await page.render({ canvasContext: context, viewport }).promise;
      const stepX = Math.max(1, Math.floor(canvas.width / 80));
      const stepY = Math.max(1, Math.floor(canvas.height / 100));
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
      let samples = 0, inkSamples = 0;
      for (let y = 0; y < canvas.height; y += stepY) for (let x = 0; x < canvas.width; x += stepX) {
        const offset = (y * canvas.width + x) * 4;
        if (pixels[offset] + pixels[offset + 1] + pixels[offset + 2] < 720) inkSamples += 1;
        samples += 1;
      }
      return { sourcePage: `Page ${pageNumber}`, text, imageBase64: canvas.toDataURL("image/jpeg", 0.58).split(",")[1], visuallyBlank: text.trim().length < 20 && inkSamples / Math.max(1, samples) < 0.004 };
    } };
  }
  let text = "";
  if (/\.docx$/i.test(file.name)) text = (await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })).value;
  else text = await file.text();
  const chunks = String(text).match(/[\s\S]{1,18000}/g) || [""];
  const pageLabel = index => chunks.length === 1 ? "Document" : `Text section ${index + 1}`;
  return { total: chunks.length, pageLabel, getUnit: async index => ({ sourcePage: pageLabel(index), text: chunks[index], visuallyBlank: !String(chunks[index] || "").trim() }) };
}

function importSpecLocalAiResult(result, record, sourcePage) {
  const count = { equipment: 0, fills: 0, clauses: 0 };
  const confidenceLabel = value => Number(value || 0) >= 0.85 ? "High" : Number(value || 0) >= 0.65 ? "Medium" : "Low";
  (result.equipment || []).filter(item => item.description && Number(item.confidence || 0) >= 0.55).forEach(item => {
    const duplicate = specState.components.some(existing => existing.sourceDocumentId === record.id && existing.description.toLowerCase() === String(item.description).toLowerCase() && existing.sourcePage === sourcePage);
    if (duplicate) return;
    specState.components.push(createSpecComponent({ partNumber: item.partNumber || "", description: item.description, manufacturer: item.manufacturer || "", model: item.model || "", quantity: Number(item.quantity) || 1, unit: item.unit || "ea", assembly: item.assembly || "", notes: item.technicalDetails || "", sourceDocument: record.name, sourceDocumentId: record.id, sourcePage, detectionMethod: "Local Qwen3-VL extraction", verificationStatus: "Needs Review", quantityExplanation: `AI extraction from ${sourcePage}; verify against source. Evidence: ${item.evidence || "not provided"}`, aiInvolved: true, extractionConfidence: item.confidence, extractionEvidence: item.evidence || "" }));
    count.equipment += 1;
  });
  (result.fillIns || []).filter(item => item.placeholder && item.value && Number(item.confidence || 0) >= 0.65).forEach(item => {
    const placeholder = item.placeholder.startsWith("[") ? item.placeholder : `[${item.placeholder.toUpperCase()}]`;
    const part = /3/.test(item.part || "") ? "part3" : /1/.test(item.part || "") ? "part1" : "part2";
    specState.fillInSuggestions.push({ id: crypto.randomUUID(), documentId: record.id, sourceDocument: record.name, sourcePage, status: "pending", createdAt: new Date().toISOString(), part, placeholder, label: placeholder.slice(1, -1).toLowerCase().replace(/\b\w/g, letter => letter.toUpperCase()), value: item.value, evidence: item.evidence || "Local AI extraction", confidence: confidenceLabel(item.confidence), numericConfidence: item.confidence, detectionMethod: "Local Qwen3-VL extraction" });
    count.fills += 1;
  });
  (result.clauses || []).filter(item => item.text && Number(item.confidence || 0) >= 0.6).forEach(item => {
    const targetPart = /3/.test(item.targetPart || "") ? "part3" : "part2";
    const articleMatch = String(item.targetArticle || "").match(/[23]\.\d+/);
    const level = String(item.hierarchyLevel || "").toLowerCase();
    const placementLevel = level === "equipment" || level === "letter" ? "letter" : level === "detail" ? "detail" : level === "subitem" || level === "lower" ? "lower" : "number";
    specState.sourceSuggestions.push({ id: crypto.randomUUID(), documentId: record.id, sourceDocument: record.name, sourcePage, status: "pending", createdAt: new Date().toISOString(), targetPart, destinationArticle: articleMatch?.[0] || (targetPart === "part3" ? "3.2" : "2.5"), equipmentContext: item.descriptionAppliesTo || "General System Requirement", placementLevel, text: item.text, extractionKind: "Local Qwen3-VL engineering extraction", extractionConfidence: confidenceLabel(item.confidence), extractionEvidence: item.evidence || "", numericConfidence: item.confidence });
    count.clauses += 1;
  });
  return count;
}

async function reanalyzeSpecDocument(id) {
  let file = specDocumentFiles.get(id);
  const documentRecord = specState.documents.find(doc => doc.id === id);
  if (!documentRecord) return showSpecMessage("Document Unavailable", "This document record is no longer available.");
  if (!file) {
    try {
      file = await getSpecificationSourceFile(id);
      if (file) specDocumentFiles.set(id, file);
    } catch (error) { console.warn(`Could not restore ${documentRecord.name}:`, error); }
  }
  if (!file) {
    const picker = document.createElement("input");
    picker.type = "file";
    picker.accept = ".pdf,.docx,.txt";
    picker.onchange = async () => {
      const selected = picker.files?.[0];
      if (!selected) return;
      specDocumentFiles.set(id, selected);
      try {
        await saveSpecificationSourceFile(id, selected);
        documentRecord.storage = "Saved locally in this browser";
        documentRecord.name = selected.name;
        documentRecord.size = selected.size;
        documentRecord.type = selected.type || documentRecord.type;
        saveSpecificationProject(false);
      } catch (error) {
        documentRecord.storage = "Available until this tab closes";
        console.warn(`Could not persist ${selected.name}:`, error);
      }
      reanalyzeSpecDocument(id);
    };
    picker.click();
    return;
  }
  specState.sourceSuggestions = (specState.sourceSuggestions || []).filter(item => item.documentId !== id || item.status === "accepted");
  specState.fillInSuggestions = (specState.fillInSuggestions || []).filter(item => item.documentId !== id || item.status === "accepted");
  specState.components = (specState.components || []).filter(item => item.sourceDocumentId !== id || item.verificationStatus === "Engineer Approved" || !["Table of contents product list", "Structured equipment extraction", "O&M product description", "O&M included component"].includes(item.detectionMethod));
  setSpecSourceStatus(`Reanalyzing ${file.name}...`, "is-loading");
  const result = await extractSpecSourceSuggestions(file, id);
  const suggestions = Math.max(0, result?.suggestions || 0);
  const fillIns = Math.max(0, result?.fillIns || 0);
  documentRecord.importSummary = suggestions || fillIns ? `${suggestions} review suggestion${suggestions === 1 ? "" : "s"}; ${fillIns} template value${fillIns === 1 ? "" : "s"}` : "No clearly usable specification requirements found";
  touchSpecificationProject();
  renderSpecDocuments(); renderSpecSourceSuggestions(); renderExtractedSpecFillIns();
  setSpecSourceStatus(`${file.name} was reanalyzed. ${suggestions} source suggestion${suggestions === 1 ? "" : "s"} and ${fillIns} template value${fillIns === 1 ? "" : "s"} are ready for review.`, "is-complete");
}

async function downloadSpecDocument(id) { let file = specDocumentFiles.get(id); if (!file) file = await getSpecificationSourceFile(id).catch(() => null); if (!file) return showSpecMessage("File Unavailable", "This older source was saved before persistent source storage was added. Reattach it once to save it locally."); specDocumentFiles.set(id, file); downloadFile(file, file.name, file.type || "application/octet-stream"); }
async function removeSpecDocument(id) { specState.documents = specState.documents.filter(doc => doc.id !== id); specState.sourceSuggestions = (specState.sourceSuggestions || []).filter(item => item.documentId !== id); specState.fillInSuggestions = (specState.fillInSuggestions || []).filter(item => item.documentId !== id); specState.components = (specState.components || []).filter(item => item.sourceDocumentId !== id || !["Table of contents product list", "Structured equipment extraction", "O&M product description", "O&M included component"].includes(item.detectionMethod)); specDocumentFiles.delete(id); await deleteSpecificationSourceFile(id).catch(error => console.warn("Could not remove saved source:", error)); touchSpecificationProject(); renderSpecDocuments(); renderSpecSourceSuggestions(); renderExtractedSpecFillIns(); renderSpecComponents(); renderSpecificationReview(); }

function createSpecComponent(values = {}) {
  return { id: crypto.randomUUID(), selected: false, include: true, partNumber: "", alternatePartNumber: "", description: "", manufacturer: "", model: "", quantity: 1, unit: "ea", assembly: "", sourceDocument: "Manual entry", sourceDocumentId: "", sourcePage: "", detectionMethod: "Manual engineer entry", verificationStatus: "Manually Entered", notes: "", quantityExplanation: "Manual engineer entry.", rulesUsed: [], aiInvolved: false, approvedBy: "", modifiedAt: new Date().toISOString(), matchConfidence: "", matchMethod: "", ...values };
}

function openSpecComponentEditor(id = "") {
  const existing = specState.components.find(item => item.id === id);
  const item = existing || createSpecComponent();
  showSpecFormModal(existing ? "Edit Component" : "Add Component", componentFormHTML(item), () => saveSpecComponentForm(item.id, !!existing));
}

function componentFormHTML(item) {
  return `<div class="spec-form-grid"><label>Internal part number<input id="scPart" placeholder="Example: PUMP-1001" value="${escapeSpecAttr(item.partNumber)}"></label><label>Old / alternate part number<input id="scAlt" placeholder="Example: 1001-OLD" value="${escapeSpecAttr(item.alternatePartNumber)}"></label><label class="spec-wide-field">Description<input id="scDescription" placeholder="Example: High-pressure stainless-steel wash pump" value="${escapeSpecAttr(item.description)}"></label><label>Manufacturer<input id="scManufacturer" placeholder="Example: Goulds" value="${escapeSpecAttr(item.manufacturer)}"></label><label>Model<input id="scModel" placeholder="Example: e-SH" value="${escapeSpecAttr(item.model)}"></label><label>Quantity<input id="scQuantity" type="number" min="0" step="0.01" placeholder="Example: 1" value="${Number(item.quantity)}"></label><label>Unit<input id="scUnit" placeholder="Example: ea" value="${escapeSpecAttr(item.unit)}"></label><label>Equipment / assembly<input id="scAssembly" placeholder="Example: High-Pressure Wash System" value="${escapeSpecAttr(item.assembly)}"></label><label>Source document<input id="scSource" placeholder="Example: Pump Datasheet.pdf" value="${escapeSpecAttr(item.sourceDocument)}"></label><label>Source page / row<input id="scPage" placeholder="Example: Page 2" value="${escapeSpecAttr(item.sourcePage)}"></label><label>Verification status<select id="scStatus">${SPEC_STATUSES.map(status => `<option ${status === item.verificationStatus ? "selected" : ""}>${status}</option>`).join("")}</select></label><label>Approved by<input id="scApprovedBy" placeholder="Example: J. Smith" value="${escapeSpecAttr(item.approvedBy)}"></label><label class="spec-wide-field">Quantity explanation<textarea id="scExplanation" placeholder="Example: One pump required for the high-pressure wash circuit.">${escapeSpec(item.quantityExplanation)}</textarea></label><label class="spec-wide-field">Notes<textarea id="scNotes" placeholder="Example: Confirm motor voltage before release.">${escapeSpec(item.notes)}</textarea></label></div>`;
}

function saveSpecComponentForm(id, exists) {
  const item = exists ? specState.components.find(row => row.id === id) : createSpecComponent();
  Object.assign(item, { partNumber: val("scPart"), alternatePartNumber: val("scAlt"), description: val("scDescription"), manufacturer: val("scManufacturer"), model: val("scModel"), quantity: Number(val("scQuantity")) || 0, unit: val("scUnit") || "ea", assembly: val("scAssembly"), sourceDocument: val("scSource") || "Manual entry", sourcePage: val("scPage"), verificationStatus: val("scStatus"), approvedBy: val("scApprovedBy"), quantityExplanation: val("scExplanation") || "Manual engineer entry.", notes: val("scNotes"), modifiedAt: new Date().toISOString() });
  if (item.verificationStatus === "Engineer Approved" && !item.approvedBy) return showSpecMessage("Approver Required", "Enter the engineer who approved this component.");
  if (!exists) specState.components.push(item);
  applyApprovedPartMatch(item); closeSpecModal(); touchSpecificationProject(); renderSpecComponents(); renderSpecificationReview();
}

function getLocalApprovedParts() { try { const data = JSON.parse(localStorage.getItem(SPEC_PARTS_KEY) || "{}"); return { master: data.master || [], aliases: data.aliases || [] }; } catch { return { master: [], aliases: [] }; } }
function applyApprovedPartMatch(item) {
  if (item.verificationStatus === "Engineer Approved") return;
  const db = getLocalApprovedParts(); const norm = value => String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  let match = db.master.find(row => norm(row.current_part_number) === norm(item.partNumber)); let method = "Exact part number";
  if (!match && item.alternatePartNumber) { const alias = db.aliases.find(row => norm(row.old_part_number) === norm(item.alternatePartNumber)); if (alias) { match = db.master.find(row => norm(row.current_part_number) === norm(alias.current_part_number)); method = "Approved old part number"; } }
  if (!match && item.model) { match = db.master.find(row => norm(row.model || row.model_number) === norm(item.model)); method = "Exact manufacturer model"; }
  if (!match && item.description) { match = db.master.find(row => norm(row.description) === norm(item.description)); method = "Exact description"; }
  if (!match) return;
  item.partNumber = match.current_part_number || item.partNumber; item.description = match.description || item.description; item.manufacturer = match.manufacturer || item.manufacturer; item.model = match.model || match.model_number || item.model; item.verificationStatus = "Database Verified"; item.matchConfidence = "100%"; item.matchMethod = method;
}

function renderSpecComponents() {
  const body = document.getElementById("specComponentBody"); if (!body) return;
  const search = val("specComponentSearch").toLowerCase(); const filter = val("specComponentStatusFilter"); const sort = val("specComponentSort") || "partNumber";
  const rows = specState.components.filter(item => (!filter || item.verificationStatus === filter) && (!search || [item.partNumber, item.alternatePartNumber, item.description, item.manufacturer, item.model, item.sourceDocument].join(" ").toLowerCase().includes(search))).sort((a, b) => sort === "quantity" ? Number(a.quantity) - Number(b.quantity) : String(a[sort] || "").localeCompare(String(b[sort] || "")));
  body.innerHTML = rows.length ? rows.map(item => `<tr><td><input type="checkbox" ${item.selected ? "checked" : ""} onchange="setSpecComponentValue('${item.id}','selected',this.checked)"></td><td><input type="checkbox" ${item.include ? "checked" : ""} onchange="setSpecComponentValue('${item.id}','include',this.checked)"></td><td>${escapeSpec(item.partNumber || "—")}</td><td>${escapeSpec(item.alternatePartNumber || "—")}</td><td>${escapeSpec(item.description || "—")}</td><td>${escapeSpec([item.manufacturer,item.model].filter(Boolean).join(" / ") || "—")}</td><td><button class="spec-quantity-link" onclick="showSpecQuantityDetails('${item.id}')">${item.quantity} ${escapeSpec(item.unit)}</button></td><td>${escapeSpec(item.assembly || "—")}</td><td>${escapeSpec(item.sourceDocument)}${item.sourcePage ? `<br><small>${escapeSpec(item.sourcePage)}</small>` : ""}</td><td>${escapeSpec(item.detectionMethod)}</td><td><span class="spec-status ${statusClass(item.verificationStatus)}">${escapeSpec(item.verificationStatus)}</span></td><td><div class="spec-row-actions"><button onclick="openSpecComponentEditor('${item.id}')">Edit</button><button class="secondary" onclick="duplicateSpecComponent('${item.id}')">Duplicate</button><button class="secondary" onclick="approveSpecComponent('${item.id}')">Approve</button><button class="delete-btn" onclick="deleteSpecComponent('${item.id}')">Delete</button></div></td></tr>`).join("") : `<tr><td colspan="12">No components added.</td></tr>`;
  Array.from(body.querySelectorAll("tr")).forEach((row, index) => {
    if (!rows[index]?.aiInvolved || !row.cells[9]) return;
    const badge = document.createElement("span");
    badge.className = "spec-ai-origin-badge";
    badge.textContent = "AI";
    badge.title = "Created by Local AI and requires engineer review";
    row.cells[9].prepend(badge, document.createElement("br"));
  });
}

function setSpecComponentValue(id, key, value) { const item = specState.components.find(row => row.id === id); if (item) { item[key] = value; touchSpecificationProject(); } }
function duplicateSpecComponent(id) { const source = specState.components.find(row => row.id === id); if (!source) return; specState.components.push({ ...source, id: crypto.randomUUID(), selected: false, verificationStatus: "Needs Review", approvedBy: "", modifiedAt: new Date().toISOString() }); touchSpecificationProject(); renderSpecComponents(); }
function deleteSpecComponent(id) { specState.components = specState.components.filter(row => row.id !== id); touchSpecificationProject(); renderSpecComponents(); }
function approveSpecComponent(id) { const item = specState.components.find(row => row.id === id); if (!item) return; const engineer = specState.project.engineer || "Engineer"; item.verificationStatus = "Engineer Approved"; item.approvedBy = engineer; item.modifiedAt = new Date().toISOString(); specState.aiAudit.push({ id: crypto.randomUUID(), at: item.modifiedAt, action: item.aiInvolved ? "AI suggestion approved" : "Component approved", componentId: id, engineer }); renderSpecComponents(); touchSpecificationProject(); }

function showSpecQuantityDetails(id) { const item = specState.components.find(row => row.id === id); if (!item) return; showSpecMessage("Quantity Details", `<strong>Final quantity:</strong> ${item.quantity} ${escapeSpec(item.unit)}<br><strong>Calculation:</strong> ${escapeSpec(item.quantityExplanation)}<br><strong>Source:</strong> ${escapeSpec(item.sourceDocument)} ${escapeSpec(item.sourcePage)}<br><strong>Rules used:</strong> ${escapeSpec(item.rulesUsed.join(", ") || "None")}<br><strong>AI involved:</strong> ${item.aiInvolved ? "Yes — approval required" : "No"}<br><strong>Approved by:</strong> ${escapeSpec(item.approvedBy || "Not approved")}<br><strong>Last modified:</strong> ${new Date(item.modifiedAt).toLocaleString()}`, true); }

function mergeSelectedSpecComponents() { const selected = specState.components.filter(item => item.selected); if (selected.length < 2) return showSpecMessage("Select Components", "Select at least two components to merge."); const target = selected[0]; const quantities = selected.map(item => Number(item.quantity || 0)); target.quantity = quantities.reduce((sum, quantity) => sum + quantity, 0); target.quantityExplanation = `Merged ${selected.length} engineer-selected entries: ${quantities.join(" + ")} = ${target.quantity} ${target.unit}.`; target.verificationStatus = "Needs Review"; target.selected = false; specState.components = specState.components.filter(item => !item.selected || item.id === target.id); touchSpecificationProject(); renderSpecComponents(); }
function recalculateSelectedSpecComponents() { const selected = specState.components.filter(item => item.selected); if (!selected.length) return showSpecMessage("Select Components", "Select components to recalculate."); selected.forEach(item => { item.verificationStatus = item.rulesUsed.length ? "Rule Calculated" : "Needs Review"; item.modifiedAt = new Date().toISOString(); }); previewApplySpecRules(selected.map(item => item.id)); }

function openSpecRuleEditor(id = "") { const existing = specState.rules.find(rule => rule.uid === id || rule.id === id); const rule = existing || { id: `QR-${String(specState.rules.length + 1).padStart(3,"0")}`, uid: crypto.randomUUID(), name: "", parent: "", child: "", multiplier: 1, conditions: "", unit: "ea", active: true, notes: "" }; showSpecFormModal(existing ? "Edit Quantity Rule" : "Add Quantity Rule", `<div class="spec-form-grid"><label>Rule ID<input id="srId" value="${escapeSpecAttr(rule.id)}"></label><label>Rule name<input id="srName" value="${escapeSpecAttr(rule.name)}"></label><label>Parent component / equipment<input id="srParent" value="${escapeSpecAttr(rule.parent)}"></label><label>Required child component<input id="srChild" value="${escapeSpecAttr(rule.child)}"></label><label>Quantity multiplier<input id="srMultiplier" type="number" min="0" step="0.01" value="${rule.multiplier}"></label><label>Unit<input id="srUnit" value="${escapeSpecAttr(rule.unit)}"></label><label class="spec-wide-field">Conditions<input id="srConditions" value="${escapeSpecAttr(rule.conditions)}"></label><label class="spec-wide-field">Notes<textarea id="srNotes">${escapeSpec(rule.notes)}</textarea></label><label><input id="srActive" type="checkbox" ${rule.active ? "checked" : ""}> Active</label></div>`, () => { const values = { id: val("srId").trim(), name: val("srName").trim(), parent: val("srParent").trim(), child: val("srChild").trim(), multiplier: Number(val("srMultiplier")), unit: val("srUnit").trim() || "ea", conditions: val("srConditions"), notes: val("srNotes"), active: document.getElementById("srActive").checked }; if (!values.id || !values.name || !values.parent || !values.child || !Number.isFinite(values.multiplier) || values.multiplier <= 0) return showSpecMessage("Rule Information Required", "Enter a rule ID, name, parent, required child, and a multiplier greater than zero."); Object.assign(rule, values); if (!existing) specState.rules.push(rule); closeSpecModal(); touchSpecificationProject(); renderSpecRules(); }); }

function renderSpecRules() { const body = document.getElementById("specRuleBody"); if (!body) return; body.innerHTML = specState.rules.length ? specState.rules.map(rule => `<tr><td>${escapeSpec(rule.id)}</td><td>${escapeSpec(rule.name)}</td><td>${escapeSpec(rule.parent)}</td><td>${escapeSpec(rule.child)}</td><td>${rule.multiplier}</td><td>${escapeSpec(rule.conditions || "—")}</td><td>${escapeSpec(rule.unit)}</td><td>${rule.active ? "Active" : "Inactive"}</td><td><div class="spec-row-actions"><button onclick="openSpecRuleEditor('${rule.uid}')">Edit</button><button class="secondary" onclick="toggleSpecRule('${rule.uid}')">${rule.active ? "Disable" : "Enable"}</button><button class="delete-btn" onclick="deleteSpecRule('${rule.uid}')">Delete</button></div></td></tr>`).join("") : `<tr><td colspan="9">No quantity rules defined.</td></tr>`; }
function toggleSpecRule(uid) { const rule = specState.rules.find(row => row.uid === uid); if (rule) { rule.active = !rule.active; touchSpecificationProject(); renderSpecRules(); } }
function deleteSpecRule(uid) { specState.rules = specState.rules.filter(row => row.uid !== uid); touchSpecificationProject(); renderSpecRules(); }

async function previewApplySpecRules(selectedIds = null) { const proposals = []; specState.rules.filter(rule => rule.active).forEach(rule => { const parents = specState.components.filter(item => (!selectedIds || selectedIds.includes(item.id)) && [item.description,item.partNumber,item.assembly].join(" ").toLowerCase().includes(rule.parent.toLowerCase())); parents.forEach(parent => { let child = specState.components.find(item => [item.description,item.partNumber].join(" ").toLowerCase().includes(rule.child.toLowerCase())); proposals.push({ rule, parent, child, quantity: Number(parent.quantity) * Number(rule.multiplier) }); }); }); if (!proposals.length) return showSpecMessage("No Rule Changes", "No active rules matched the current components."); const approved = await showSpecConfirm("Apply Quantity Rules", proposals.map(p => `${p.rule.id}: ${p.parent.quantity} ${p.parent.description || p.parent.partNumber} × ${p.rule.multiplier} = ${p.quantity} ${p.rule.unit} ${p.rule.child}`).join("\n"), "Apply Changes"); if (!approved) return; proposals.forEach(p => { const child = p.child || createSpecComponent({ description: p.rule.child, unit: p.rule.unit, sourceDocument: `Quantity Rule ${p.rule.id}` }); child.quantity = p.quantity; child.quantityExplanation = `${p.parent.quantity} ${p.rule.parent} × ${p.rule.multiplier} ${p.rule.child} per ${p.rule.parent}`; child.rulesUsed = Array.from(new Set([...(child.rulesUsed || []), p.rule.id])); child.detectionMethod = "Approved quantity rule"; child.verificationStatus = "Rule Calculated"; child.modifiedAt = new Date().toISOString(); if (!p.child) specState.components.push(child); }); touchSpecificationProject(); renderSpecComponents(); }

function generateSpecificationRows() { specState.specificationRows = specState.components.filter(item => item.include).map(item => ({ componentId: item.id, partNumber: item.partNumber, description: item.description, quantity: item.quantity, manufacturer: item.manufacturer, model: item.model, dimensions: "", material: "", electrical: "", performance: "", standards: "", installation: "", notes: item.notes, sourceReferences: [item.sourceDocument, item.sourcePage].filter(Boolean).join(" — "), status: item.verificationStatus })); touchSpecificationProject(); renderSpecificationRows(); }
function renderSpecificationRows() { const wrap = document.getElementById("specSheetRows"); if (!wrap) return; wrap.innerHTML = specState.specificationRows.length ? specState.specificationRows.map((row,index) => `<article class="spec-sheet-row"><div class="spec-sheet-row-heading"><strong>${escapeSpec(row.partNumber || "Unmatched part")} — ${escapeSpec(row.description || "No description")}</strong><span class="spec-status ${statusClass(row.status)}">${escapeSpec(row.status)}</span></div><div class="spec-form-grid">${["partNumber","description","quantity","manufacturer","model","dimensions","material","electrical","performance","standards","installation","notes","sourceReferences"].map(key => `<label class="${["description","notes","sourceReferences"].includes(key) ? "spec-wide-field" : ""}">${specFieldLabel(key)}<input value="${escapeSpecAttr(row[key])}" onchange="updateSpecificationRow(${index},'${key}',this.value)"></label>`).join("")}</div></article>`).join("") : `<p class="converter-muted">Generate the sheet from included components to begin.</p>`; }
function updateSpecificationRow(index,key,value) { specState.specificationRows[index][key] = key === "quantity" ? Number(value) || 0 : value; touchSpecificationProject(); }
function specFieldLabel(key) { return ({partNumber:"Internal part number",description:"Description",quantity:"Quantity",manufacturer:"Manufacturer",model:"Model",dimensions:"Dimensions",material:"Material",electrical:"Electrical requirements",performance:"Performance ratings",standards:"Applicable standards",installation:"Installation requirements",notes:"Notes",sourceReferences:"Source references"})[key] || key; }

function renderSpecificationReview() { const wrap = document.getElementById("specReviewSummary"); if (!wrap) return; const pendingFillIns = (specState.fillInSuggestions || []).filter(item => item.status === "pending").length; const pendingSources = (specState.sourceSuggestions || []).filter(item => item.status === "pending").length; const unresolvedPills = document.querySelectorAll("[data-fill-part].is-missing").length; const metrics = [{label:"Extracted values awaiting review",value:pendingFillIns},{label:"Source suggestions awaiting review",value:pendingSources},{label:"Fill-in values still blank",value:unresolvedPills}]; wrap.innerHTML = metrics.map(metric => `<div class="spec-review-card ${metric.value ? "needs-review" : "clear"}"><strong>${metric.value}</strong><span>${metric.label}</span></div>`).join(""); }

function openSpecificationHistoryDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(SPEC_HISTORY_DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(SPEC_HISTORY_STORE, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getSpecificationHistory() {
  const db = await openSpecificationHistoryDB();
  return new Promise((resolve, reject) => {
    const request = db.transaction(SPEC_HISTORY_STORE, "readonly").objectStore(SPEC_HISTORY_STORE).getAll();
    request.onsuccess = () => { db.close(); resolve(request.result.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))); };
    request.onerror = () => { db.close(); reject(request.error); };
  });
}

async function putSpecificationHistory(item) {
  const db = await openSpecificationHistoryDB();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(SPEC_HISTORY_STORE, "readwrite");
    transaction.objectStore(SPEC_HISTORY_STORE).put(item);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  const history = await getSpecificationHistory();
  for (const oldItem of history.slice(3)) await deleteSpecificationHistoryRecord(oldItem.id, false);
}

async function deleteSpecificationHistoryRecord(id, confirmFirst = true) {
  if (confirmFirst && !(await showSpecConfirm("Remove Saved PDF", "Remove this specification from local history?", "Remove"))) return;
  const db = await openSpecificationHistoryDB();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(SPEC_HISTORY_STORE, "readwrite");
    transaction.objectStore(SPEC_HISTORY_STORE).delete(id);
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close();
  if (confirmFirst) renderSpecificationLocalSaves();
}

async function renderSpecificationLocalSaves() {
  const wrap = document.getElementById("specLocalSaveSlots");
  const status = document.getElementById("specHistoryStatus");
  if (!wrap) return;
  try {
    const history = (await getSpecificationHistory()).slice(0, 3);
    wrap.innerHTML = history.length ? history.map(item => `<div class="packet-history-row"><div class="packet-history-info"><strong>${escapeSpec(item.fileName)}</strong><span>${new Date(item.savedAt).toLocaleString()}</span><span>1 PDF</span></div><div class="button-row packet-history-actions"><button type="button" onclick="editSpecificationHistory('${item.id}')">Edit</button><button type="button" onclick="downloadSpecificationHistory('${item.id}')">Download</button><button type="button" onclick="renameSpecificationHistory('${item.id}')">Rename</button><button type="button" class="delete-btn" onclick="deleteSpecificationHistoryRecord('${item.id}')">Remove</button></div></div>`).join("") : `<p class="converter-muted">No exported specifications saved yet.</p>`;
    if (status) status.textContent = `Showing ${history.length} saved specification${history.length === 1 ? "" : "s"}.`;
    updateSpecificationHistoryStorage();
  } catch (error) {
    if (status) status.textContent = "Local history could not be loaded.";
  }
}

async function updateSpecificationHistoryStorage() {
  const card = document.getElementById("specHistoryStorage");
  if (!card || !navigator.storage?.estimate) return;
  const estimate = await navigator.storage.estimate();
  const used = Number(estimate.usage || 0);
  const quota = Number(estimate.quota || 0);
  const percent = quota ? Math.min(100, used / quota * 100) : 0;
  const label = card.querySelector(".storage-usage-label span");
  const bar = card.querySelector(".storage-usage-track span");
  if (label) label.textContent = `${Math.round(used / 1048576)} MB of ${Math.round(quota / 1048576)} MB used`;
  if (bar) bar.style.width = `${percent}%`;
  const detail = card.querySelector("small");
  if (detail) detail.textContent = `Local drafts and history · ${percent.toFixed(1)}% used`;
}

async function getSpecificationHistoryRecord(id) { return (await getSpecificationHistory()).find(item => item.id === id); }

async function editSpecificationHistory(id) {
  const item = await getSpecificationHistoryRecord(id);
  if (!item?.state || !(await showSpecConfirm("Edit Saved Specification", "Replace the current workspace with this saved specification?", "Edit"))) return;
  specState = normalizeSpecificationCollections({ ...createEmptySpecificationState(), ...item.state, project: { ...createEmptySpecificationState().project, ...(item.state.project || {}) } });
  applySpecificationStateToUI();
  saveSpecificationProject(false);
}

async function downloadSpecificationHistory(id) {
  const item = await getSpecificationHistoryRecord(id);
  if (item?.pdfBlob) downloadFile(item.pdfBlob, item.fileName, "application/pdf");
}

async function renameSpecificationHistory(id) {
  const item = await getSpecificationHistoryRecord(id);
  if (!item) return;
  showSpecFormModal("Rename Saved PDF", `<label>PDF name<input id="specHistoryRename" value="${escapeSpecAttr(item.fileName.replace(/\.pdf$/i, ""))}"></label>`, async () => {
    const name = val("specHistoryRename").trim();
    if (!name) return;
    item.fileName = `${name.replace(/\.pdf$/i, "")}.pdf`;
    await putSpecificationHistory(item);
    closeSpecModal(); renderSpecificationLocalSaves();
  });
}

async function clearSpecificationHistory() {
  if (!(await showSpecConfirm("Clear Local History", "Remove all saved specification PDFs from this device?", "Clear History"))) return;
  const db = await openSpecificationHistoryDB();
  await new Promise((resolve, reject) => {
    const transaction = db.transaction(SPEC_HISTORY_STORE, "readwrite");
    transaction.objectStore(SPEC_HISTORY_STORE).clear();
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
  db.close(); renderSpecificationLocalSaves();
}
function findSpecConflicts(rows) { const groups = new Map(); rows.forEach(item => { const key = item.partNumber || item.description.toLowerCase(); if (!key) return; if (!groups.has(key)) groups.set(key,new Set()); groups.get(key).add(`${item.quantity}|${item.model}|${item.manufacturer}`); }); return Array.from(groups.values()).filter(set => set.size > 1); }

function exportSpecificationExcel() { const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet([specState.project]),"Project"); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(specState.components),"Components"); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(specState.rules),"Quantity Rules"); XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(specState.specificationRows),"Specification Sheet"); XLSX.writeFile(wb,specificationFileName("xlsx")); }

function setSpecExportStatus(message, state = "") {
  const status = document.getElementById("specExportStatus");
  if (!status) return;
  status.textContent = message;
  status.className = `spec-load-status${state ? ` ${state}` : ""}`;
}

function chicagoSpecParagraphs(text, numberingReference) {
  const { Paragraph, TextRun, AlignmentType } = window.docx;
  let priorListLevel = -1;
  let articleNumberingInstance = 0;
  return String(text || "").split(/\r?\n/).map(rawLine => {
    const line = rawLine.trim();
    if (!line) { priorListLevel = -1; return new Paragraph({ spacing: { after: 80 }, children: [] }); }
    const numberedHeading = /^\d+\.\d+(?:\.\d+)?\s+/.test(line);
    if (numberedHeading) articleNumberingInstance += 1;
    const letterClause = /^[A-Z]\.\s+/.test(line);
    const numberedClause = /^\d+\.\s+/.test(line);
    const lowercaseClause = /^[a-z]\.\s+/.test(line);
    const parentheticalClause = /^\(\d+\)\s+/.test(line);
    const allCapsHeading = line.length < 100 && line === line.toUpperCase() && /[A-Z]/.test(line);
    const marked = line.match(/^(\d+\.\d+(?:\.\d+)?|[A-Z]+\.|\d+\.|[a-z]+\.|\(\d+\))\s+(.+)$/);
    const listLevel = letterClause ? 0 : numberedClause ? 1 : lowercaseClause ? 2 : parentheticalClause ? 3 : -1;
    const indent = listLevel >= 0 ? undefined : priorListLevel >= 0 ? { left: [360, 720, 1080, 1440][priorListLevel] } : undefined;
    const children = marked && listLevel >= 0
      ? [new TextRun({ text: marked[2], font: "Times New Roman", size: 22 })]
      : [new TextRun({ text: line, font: "Times New Roman", size: 22, bold: numberedHeading || allCapsHeading })];
    priorListLevel = listLevel >= 0 ? listLevel : priorListLevel;
    if (numberedHeading || allCapsHeading) priorListLevel = -1;
    return new Paragraph({
      alignment: AlignmentType.LEFT,
      keepNext: numberedHeading || allCapsHeading,
      indent,
      numbering: listLevel >= 0 ? { reference: numberingReference, level: listLevel, instance: articleNumberingInstance } : undefined,
      spacing: numberedHeading || allCapsHeading ? { before: 180, after: 80, line: 240 } : { after: 40, line: 240 },
      children
    });
  });
}

function stripProjectInformationForExport(text) {
  const projectLine = /^(?:PROJECT INFORMATION|Project Number|Specification Section|Project Name|Customer|Equipment Type|System Name|Prepared By|Revision|Date|Project Notes)\s*(?::.*)?$/i;
  return String(text || "").split(/\r?\n/).filter(line => !projectLine.test(line.trim())).join("\n").replace(/^\s+/, "");
}

function renumberSpecificationHierarchy(text) {
  const counters = [0, 0, 0, 0];
  return String(text || "").split(/\r?\n/).map(rawLine => {
    const line = rawLine.trim();
    if (!line) return "";
    if (/^\d+\.\d+(?:\.\d+)?\s+/.test(line)) { counters.fill(0); return line; }
    const patterns = [/^[A-Z]+\.\s+(.+)$/, /^\d+\.\s+(.+)$/, /^[a-z]+\.\s+(.+)$/, /^\(\d+\)\s+(.+)$/];
    const level = patterns.findIndex(pattern => pattern.test(line));
    if (level < 0) return line;
    const content = line.match(patterns[level])[1];
    counters[level] += 1;
    for (let child = level + 1; child < counters.length; child += 1) counters[child] = 0;
    const marker = level === 0 ? `${String.fromCharCode(64 + Math.min(counters[level], 26))}.` : level === 1 ? `${counters[level]}.` : level === 2 ? `${String.fromCharCode(96 + Math.min(counters[level], 26))}.` : `(${counters[level]})`;
    return `${marker} ${content}`;
  }).join("\n");
}

async function exportSpecificationWord() {
  if (!window.docx) return showSpecMessage("Word Export Unavailable", "The Word export library did not load. Check the internet connection and reload the page.");
  setSpecExportStatus("Building Chicago-style Word specification...", "is-loading");
  try {
    const { Document, Packer, Paragraph, TextRun, AlignmentType, Header, Footer, PageNumber } = window.docx;
    const sectionNumber = String(specState.project.sectionNumber || "111126").trim();
    const equipmentLabel = String(specState.project.equipmentType || "Vehicle Wash").toUpperCase();
    const children = [];
    const partHeading = text => new Paragraph({
      keepNext: true,
      spacing: { before: 220, after: 120 },
      children: [new TextRun({ text, font: "Times New Roman", size: 22, bold: false })]
    });
    children.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { after: 80 },
      children: [new TextRun({ text: `SECTION ${sectionNumber} - ${equipmentLabel}ING EQUIPMENT`, font: "Times New Roman", size: 22, bold: false })]
    }));
    children.push(partHeading("PART 1 - GENERAL"), ...chicagoSpecParagraphs(stripProjectInformationForExport(specState.project.part1), "spec-part1"));
    children.push(partHeading("PART 2 - PRODUCTS"), ...chicagoSpecParagraphs(specState.project.part2, "spec-part2"));
    if (SPEC_OPTIONAL_EQUIPMENT_WORKFLOW_ENABLED && specState.specificationRows.length) {
      children.push(new Paragraph({ keepNext: true, spacing: { before: 180, after: 80 }, children: [new TextRun({ text: "EQUIPMENT SCHEDULE", font: "Times New Roman", size: 22, bold: false })] }));
      specState.specificationRows.forEach((row, index) => {
        children.push(new Paragraph({
          keepNext: true,
          spacing: { before: 120, after: 60 },
          children: [new TextRun({ text: `${index + 1}. ${row.description || row.partNumber || "Equipment Item"}`, font: "Times New Roman", size: 22, bold: false })]
        }));
        const details = [
          row.manufacturer && `Manufacturer: ${row.manufacturer}`,
          row.model && `Model: ${row.model}`,
          row.quantity && `Quantity: ${row.quantity}`,
          row.dimensions && `Dimensions: ${row.dimensions}`,
          row.material && `Material: ${row.material}`,
          row.electrical && `Electrical: ${row.electrical}`,
          row.performance && `Performance: ${row.performance}`,
          row.standards && `Standards: ${row.standards}`,
          row.installation && `Installation: ${row.installation}`,
          row.notes && `Additional Requirements: ${row.notes}`
        ].filter(Boolean);
        details.forEach(detail => children.push(new Paragraph({ indent: { left: 360 }, spacing: { after: 60, line: 240 }, children: [new TextRun({ text: detail, font: "Times New Roman", size: 22 })] })));
      });
    }
    children.push(partHeading("PART 3 - EXECUTION"), ...chicagoSpecParagraphs(specState.project.part3, "spec-part3"));
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 260 },
      children: [new TextRun({ text: `END OF SECTION ${sectionNumber}`, font: "Times New Roman", size: 22, bold: false })]
    }));
    const documentFile = new Document({
      creator: "N/S Corporation",
      title: `${specState.project.projectName || "Project"} Specification`,
      description: "N/S Corporation equipment specification",
      numbering: {
        config: ["spec-part1", "spec-part2", "spec-part3"].map(reference => ({
          reference,
          levels: [
            { level: 0, format: "upperLetter", text: "%1.", alignment: "left", style: { paragraph: { indent: { left: 360, hanging: 180 } } } },
            { level: 1, format: "decimal", text: "%2.", alignment: "left", restart: 0, style: { paragraph: { indent: { left: 720, hanging: 180 } } } },
            { level: 2, format: "lowerLetter", text: "%3.", alignment: "left", restart: 1, style: { paragraph: { indent: { left: 1080, hanging: 180 } } } },
            { level: 3, format: "decimal", text: "(%4)", alignment: "left", restart: 2, style: { paragraph: { indent: { left: 1440, hanging: 240 } } } }
          ]
        }))
      },
      sections: [{
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1380, right: 1280, bottom: 1220, left: 1340, header: 727, footer: 1029 }
          }
        },
        headers: {
          default: new Header({
            children: [new Paragraph({
              alignment: AlignmentType.LEFT,
              spacing: { after: 40 },
              children: [new TextRun({ text: "N/S Corporation", font: "Times New Roman", size: 18, bold: false })]
            })]
          })
        },
        footers: {
          default: new Footer({
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({ font: "Times New Roman", size: 18, children: [PageNumber.CURRENT] })]
            })]
          })
        },
        children
      }]
    });
    const blob = await Packer.toBlob(documentFile);
    downloadFile(blob, specificationFileName("docx"), "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    setSpecExportStatus("Chicago-style Word specification created.", "is-complete");
  } catch (error) {
    console.error("Word export failed:", error);
    setSpecExportStatus("Word export failed. Review the message and try again.", "is-error");
    showSpecMessage("Word Export Failed", error.message);
  }
}

async function exportSpecificationPDF() {
  try {
    const { PDFDocument, StandardFonts, rgb } = PDFLib;
    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.TimesRoman);
    const bold = await pdf.embedFont(StandardFonts.TimesRomanBold);
    let pdfPageNumber = 0;
    const addSpecPdfPage = () => {
      const nextPage = pdf.addPage([612, 792]);
      pdfPageNumber += 1;
      nextPage.drawText("N/S Corporation", { x: 67, y: 760, size: 9, font: regular, color: rgb(0, 0, 0) });
      const footerText = String(pdfPageNumber);
      nextPage.drawText(footerText, { x: (612 - regular.widthOfTextAtSize(footerText, 9)) / 2, y: 31, size: 9, font: regular, color: rgb(0, 0, 0) });
      return nextPage;
    };
    let page = addSpecPdfPage();
    const leftMargin = 67;
    const rightMargin = 64;
    const topY = 723;
    const bottomMargin = 61;
    let y = topY;
    const ensureSpace = height => {
      if (y >= bottomMargin + height) return;
      page = addSpecPdfPage();
      y = topY;
    };
    const pdfSafeText = (text, font) => {
      const normalized = String(text || "")
        .replace(/[\uF0B7\uF0A7]/g, "\u2022")
        .replace(/\u00A0/g, " ")
        .replace(/[\u000B\u000C\u2028\u2029]/g, "\n");
      return Array.from(normalized, character => {
        if (character === "\n" || character === "\r" || character === "\t") return character;
        try {
          font.encodeText(character);
          return character;
        } catch (_) {
          const fallback = ({ "\u2010": "-", "\u2212": "-", "\u2192": "->", "\u03A9": "Ohm" })[character] || "?";
          try {
            font.encodeText(fallback);
            return fallback;
          } catch (_) {
            return "?";
          }
        }
      }).join("");
    };
    const drawWrapped = (text, options = {}) => {
      const size = options.size || 11;
      const font = options.bold ? bold : regular;
      const x = options.x ?? leftMargin;
      const lineX = options.lineX ?? x;
      const lineHeight = options.lineHeight || 12.4;
      const maxWidth = 612 - rightMargin - lineX;
      const words = pdfSafeText(text, font).trim().split(/\s+/).filter(Boolean);
      if (!words.length) return;
      const lines = [];
      let current = "";
      words.forEach(word => {
        const candidate = current ? `${current} ${word}` : word;
        if (!current || font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
        else { lines.push(current); current = word; }
      });
      if (current) lines.push(current);
      lines.forEach((line, index) => {
        ensureSpace(lineHeight);
        page.drawText(line, { x: index ? lineX : x, y, size, font, color: rgb(0, 0, 0) });
        y -= lineHeight;
      });
      y -= options.after ?? 2.5;
    };
    const drawMarkedParagraph = (marker, text, level) => {
      const markerX = leftMargin + [20, 42, 66, 90][Math.min(level, 3)];
      const textX = leftMargin + [42, 72, 96, 120][Math.min(level, 3)];
      ensureSpace(25);
      page.drawText(pdfSafeText(marker, regular), { x: markerX, y, size: 11, font: regular, color: rgb(0, 0, 0) });
      drawWrapped(text, { x: textX, lineX: textX, size: 11, lineHeight: 12.4, after: level ? 1.5 : 5 });
    };
    const drawArticleHeading = (marker, text) => {
      ensureSpace(42);
      page.drawText(pdfSafeText(marker, regular), { x: leftMargin, y, size: 11, font: regular, color: rgb(0, 0, 0) });
      drawWrapped(text, { x: leftMargin + 42, lineX: leftMargin + 42, size: 11, lineHeight: 12.4, after: 12 });
    };
    const drawStructuredContent = content => {
      const lines = pdfSafeText(content, regular).replace(/\r/g, "").split("\n");
      let priorListLevel = -1;
      lines.forEach(rawLine => {
        const line = rawLine.replace(/\s+/g, " ").trim();
        if (!line) { y -= 4; priorListLevel = -1; return; }
        let match = line.match(/^(\d+\.\d+(?:\.\d+)?)\s+(.+)$/);
        if (match) {
          priorListLevel = -1;
          return drawArticleHeading(match[1], match[2]);
        }
        match = line.match(/^([A-Z]+\.)\s+(.+)$/);
        if (match) { priorListLevel = 0; return drawMarkedParagraph(match[1], match[2], 0); }
        match = line.match(/^(\d+\.)\s+(.+)$/);
        if (match) { priorListLevel = 1; return drawMarkedParagraph(match[1], match[2], 1); }
        match = line.match(/^([a-z]+\.)\s+(.+)$/);
        if (match) { priorListLevel = 2; return drawMarkedParagraph(match[1], match[2], 2); }
        match = line.match(/^(\(\d+\))\s+(.+)$/);
        if (match) { priorListLevel = 3; return drawMarkedParagraph(match[1], match[2], 3); }
        const continuationX = priorListLevel >= 0 ? leftMargin + [42, 72, 96, 120][priorListLevel] : leftMargin + 29;
        drawWrapped(line, { x: continuationX, lineX: continuationX, size: 11, lineHeight: 12.4, after: 3 });
      });
    };
    const sectionNumber = String(specState.project.sectionNumber || "111126").trim();
    const equipmentType = String(specState.project.equipmentType || "Vehicle Wash").trim().replace(/\s+equipment$/i, "");
    const equipmentLabel = /wash$/i.test(equipmentType) ? `${equipmentType.replace(/\s+wash$/i, "-Washing")} Equipment` : `${equipmentType} Equipment`;
    drawWrapped(`SECTION ${sectionNumber} - ${equipmentLabel.toUpperCase()}`, { size: 11, lineHeight: 12.5, after: 25 });
    const drawPart = (heading, content) => {
      if (!String(content || "").trim()) return;
      ensureSpace(52);
      drawWrapped(heading, { size: 11, lineHeight: 12.5, after: 25 });
      drawStructuredContent(renumberSpecificationHierarchy(content));
      y -= 5;
    };
    drawPart("PART 1 - GENERAL", stripProjectInformationForExport(specState.project.part1));
    drawPart("PART 2 - PRODUCTS", specState.project.part2);
    if (SPEC_OPTIONAL_EQUIPMENT_WORKFLOW_ENABLED && specState.specificationRows.length) {
      ensureSpace(30);
      drawWrapped("EQUIPMENT SCHEDULE", { size: 11, after: 12 });
    }
    if (SPEC_OPTIONAL_EQUIPMENT_WORKFLOW_ENABLED) specState.specificationRows.forEach((row, index) => {
      ensureSpace(45);
      drawWrapped(`${index + 1}. ${row.partNumber || "Unmatched"} - ${row.description}`, { bold: true, size: 11, after: 4 });
      drawWrapped(`Quantity: ${row.quantity}   Manufacturer: ${row.manufacturer || "-"}   Model: ${row.model || "-"}`, { x: leftMargin + 29, lineX: leftMargin + 29 });
      ["dimensions", "material", "electrical", "performance", "standards", "installation", "notes", "sourceReferences"].forEach(key => {
        if (row[key]) drawWrapped(`${specFieldLabel(key)}: ${row[key]}`, { x: leftMargin + 29, lineX: leftMargin + 29 });
      });
      drawWrapped(`Status: ${row.status}`, { x: leftMargin + 29, lineX: leftMargin + 29 });
      y -= 6;
    });
    drawPart("PART 3 - EXECUTION", specState.project.part3);
    ensureSpace(24);
    drawWrapped(`END OF SECTION ${sectionNumber}`, { size: 11, after: 4 });
    const bytes = await pdf.save();
    const fileName = specificationFileName("pdf");
    const pdfBlob = new Blob([bytes], { type: "application/pdf" });
    downloadFile(pdfBlob, fileName, "application/pdf");
    try {
      await putSpecificationHistory({ id: crypto.randomUUID(), fileName, savedAt: new Date().toISOString(), pdfBlob, state: JSON.parse(JSON.stringify(specState)) });
      await renderSpecificationLocalSaves();
      setSpecExportStatus("PDF exported and saved automatically in Local History.", "is-complete");
    } catch (historyError) {
      console.warn("Could not save specification history:", historyError);
      setSpecExportStatus("PDF exported, but it could not be saved in Local History.", "is-error");
    }
  } catch (error) {
    showSpecMessage("PDF Export Failed", error.message);
  }
}
function specificationFileName(ext) {
  const revision = String(specState.project.revision || "0").trim();
  const baseName = [specState.project.projectNumber, specState.project.projectName, `Specification Rev ${revision}`].filter(Boolean).join(" - ") || `Specification Project Rev ${revision}`;
  return `${baseName.replace(/[<>:"/\\|?*]+/g, "-").replace(/\s+/g, " ").trim()}.${ext}`;
}

function loadSpecificationSampleData() { specState=createEmptySpecificationState(); Object.assign(specState.project,{projectNumber:"24001",projectName:"Sample Wash System",customer:"Sample Customer",equipmentType:"Vehicle Wash Equipment",engineer:"Test Engineer",revision:"0"}); specState.components=[createSpecComponent({partNumber:"MOTOR-00482",description:"Wash brush motor",manufacturer:"Baldor",model:"Sample-5HP",quantity:4,unit:"ea",assembly:"Brush modules",sourceDocument:"Sample BOM.xlsx",sourcePage:"Row 8",detectionMethod:"Structured Excel table",verificationStatus:"Document Extracted",quantityExplanation:"Direct quantity 4 from sample BOM."}),createSpecComponent({description:"Motor mounting bracket",quantity:8,unit:"ea",assembly:"Brush modules",sourceDocument:"Quantity Rule QR-014",detectionMethod:"Approved quantity rule",verificationStatus:"Rule Calculated",quantityExplanation:"4 motors × 2 mounting brackets per motor.",rulesUsed:["QR-014"]})]; specState.rules=[{uid:crypto.randomUUID(),id:"QR-014",name:"Motor mounting brackets",parent:"motor",child:"mounting bracket",multiplier:2,conditions:"All brush motors",unit:"ea",active:true,notes:"Sample approved relationship"}]; generateSpecificationRows(); applySpecificationStateToUI(); saveSpecificationProject(false); }

function showSpecFormModal(title, html, onSave) { const modal=document.getElementById("specModal"); document.getElementById("specModalTitle").textContent=title; document.getElementById("specModalBody").innerHTML=html; const actions=document.getElementById("specModalActions"); actions.replaceChildren(); const save=document.createElement("button"); save.textContent="Save"; save.onclick=onSave; const cancel=document.createElement("button"); cancel.className="secondary"; cancel.textContent="Cancel"; cancel.onclick=closeSpecModal; actions.append(save,cancel); modal.classList.remove("hidden"); }
function showSpecMessage(title,message,html=false) { showSpecFormModal(title,html?`<p>${message}</p>`:`<p>${escapeSpec(message)}</p>`,closeSpecModal); document.querySelector("#specModalActions button")?.remove(); const closeButton = document.querySelector("#specModalActions .secondary"); if (closeButton) closeButton.textContent = "Close"; }
function showSpecConfirm(title,message,confirmLabel="Continue") { return new Promise(resolve => { const modal=document.getElementById("specModal"); document.getElementById("specModalTitle").textContent=title; const body=document.getElementById("specModalBody"); body.innerHTML=""; const p=document.createElement("p"); p.className="spec-confirm-copy"; p.textContent=message; body.appendChild(p); const actions=document.getElementById("specModalActions"); actions.replaceChildren(); const yes=document.createElement("button"); yes.textContent=confirmLabel; yes.onclick=()=>{closeSpecModal();resolve(true)}; const no=document.createElement("button"); no.className="secondary"; no.textContent="Cancel"; no.onclick=()=>{closeSpecModal();resolve(false)}; actions.append(yes,no); modal.classList.remove("hidden"); }); }
function closeSpecModal(){document.getElementById("specModal")?.classList.add("hidden")}
function val(id){return document.getElementById(id)?.value||""}
function escapeSpec(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}
function escapeSpecAttr(value){return escapeSpec(value)}
function statusClass(value){return String(value||"").toLowerCase().replace(/[^a-z]+/g,"-").replace(/^-|-$/g,"")}
function formatSpecBytes(bytes){return Number(bytes||0)>=1048576?`${(bytes/1048576).toFixed(1)} MB`:`${Math.max(1,Math.round(bytes/1024))} KB`}

// Privacy-first AI Phase 1. These handlers replace the original configuration placeholder.
async function handleSpecAiToggle(event){if(!event.target.checked){SpecificationAIService.disable();logSpecAiActivity("AI disabled",{suggestionStatus:"No request made"});updateSpecAiInterface();saveSpecificationProject(false);return}event.target.checked=false;openSpecAiConfiguration()}
function openSpecAiConfiguration(){const c=SpecificationAIService.getConfig(),ck=k=>c[k]?"checked":"";showSpecFormModal("AI Configuration",`<div class="spec-privacy-panel"><strong>AI is optional and starts disabled every time this page opens.</strong><p>Connection testing sends no documents. Never enter API keys here. Enterprise providers require a future company-approved server proxy.</p></div><div class="spec-form-grid"><label>Provider<select id="specAiProvider"><option value="disabled">Disabled</option><option value="ollama">Local Ollama</option><option value="openai_local">Local OpenAI-compatible server</option><option value="enterprise">Enterprise (backend required)</option><option value="custom">Custom (backend required)</option></select></label><label>Endpoint<input id="specAiEndpoint" value="${escapeSpecAttr(c.endpoint)}"></label><label>Model<input id="specAiModel" list="specAiModels" value="${escapeSpecAttr(c.model)}"><datalist id="specAiModels"></datalist></label><label>Timeout (seconds)<input id="specAiTimeout" type="number" min="2" max="60" value="${Math.round(c.requestTimeout/1000)}"></label><label>Maximum context characters<input id="specAiMaxContext" type="number" min="500" max="50000" value="${c.maxContextSize}"></label><fieldset class="spec-wide-field"><legend>Information allowed for review</legend><label><input id="specAiIncludeDocs" type="checkbox" ${ck("includeDocumentContent")}> Selected document references</label><label><input id="specAiIncludeProject" type="checkbox" ${ck("includeProjectIdentifiers")}> Project identifiers</label><label><input id="specAiIncludeCustomer" type="checkbox" ${ck("includeCustomerInformation")}> Customer information</label></fieldset><fieldset class="spec-wide-field"><legend>Automatic redaction</legend><label><input id="specAiRedactEmails" type="checkbox" ${ck("redactEmails")}> Emails</label><label><input id="specAiRedactPricing" type="checkbox" ${ck("redactPricing")}> Pricing</label><label><input id="specAiRedactParts" type="checkbox" ${ck("redactInternalParts")}> Internal part numbers</label><label><input id="specAiRedactDrawings" type="checkbox" ${ck("redactDrawingNumbers")}> Drawing numbers</label><label><input id="specAiRedactPaths" type="checkbox" ${ck("redactFilePaths")}> File paths</label></fieldset></div><div class="button-row"><button type="button" class="secondary" onclick="testSpecAiConnectionFromModal()">Test Connection</button><span id="specAiTestStatus" class="converter-muted">No project data will be sent.</span></div>`,()=>{const cfg=readSpecAiModalConfig();SpecificationAIService.saveConfig(cfg);logSpecAiActivity("AI configuration changed",{provider:cfg.providerType,suggestionStatus:"No request made"});closeSpecModal();updateSpecAiInterface();saveSpecificationProject(false)});document.getElementById("specAiProvider").value=c.providerType}
function readSpecAiModalConfig(){const ck=id=>document.getElementById(id).checked;return{providerType:val("specAiProvider"),endpoint:val("specAiEndpoint").trim(),model:val("specAiModel").trim(),requestTimeout:Math.max(2000,Number(val("specAiTimeout"))*1000||10000),maxContextSize:Math.max(500,Number(val("specAiMaxContext"))||12000),includeDocumentContent:ck("specAiIncludeDocs"),includeProjectIdentifiers:ck("specAiIncludeProject"),includeCustomerInformation:ck("specAiIncludeCustomer"),redactEmails:ck("specAiRedactEmails"),redactPricing:ck("specAiRedactPricing"),redactInternalParts:ck("specAiRedactParts"),redactDrawingNumbers:ck("specAiRedactDrawings"),redactFilePaths:ck("specAiRedactPaths")}}
async function testSpecAiConnectionFromModal(){const s=document.getElementById("specAiTestStatus");s.textContent="Testing server connection only...";try{const r=await SpecAIProviders.testConnection(readSpecAiModalConfig());s.textContent=`Connected. ${r.models.length} model(s) available.`;document.getElementById("specAiModels").innerHTML=r.models.map(m=>`<option value="${escapeSpecAttr(m)}"></option>`).join("")}catch(e){s.textContent=`Connection failed: ${e.message}. Check the server and allowed website origin.`}}
function updateSpecAiInterface(){const s=SpecificationAIService.getState(),enabled=s.config.providerType!=="disabled";const toggle=document.getElementById("specUseAi");if(toggle)toggle.checked=enabled;const label=document.getElementById("specAiState");if(label)label.textContent=s.stateLabel;document.getElementById("specAiWorkspace")?.classList.toggle("hidden",!enabled);const badge=document.getElementById("specAiConnectionBadge");if(badge)badge.textContent=enabled?`${s.provider.label} · ${s.endpoint.networkLabel}`:"AI Disabled";const selector=document.getElementById("specAiComponent");if(selector){const prior=selector.value;selector.innerHTML=`<option value="">Choose a component</option>`+specState.components.map(c=>`<option value="${c.id}">${escapeSpec(c.partNumber||c.description||"Unnamed component")}</option>`).join("");selector.value=prior}renderSpecAiSuggestions();renderSpecAiActivity()}
function buildSpecAiSections(component){const c=SpecificationAIService.getConfig(),sections=[{id:"component",label:"Selected component fields",text:[`Description: ${component.description}`,`Manufacturer: ${component.manufacturer}`,`Model: ${component.model}`,`Quantity: ${component.quantity} ${component.unit}`,`Assembly: ${component.assembly}`].join("\n"),sourceReference:{document:component.sourceDocument||"Project component",page:component.sourcePage||""}}];if(c.includeDocumentContent&&component.sourceDocument)sections.push({id:"source",label:"Selected source reference",text:`Source document: ${component.sourceDocument}\nSource location: ${component.sourcePage||"Not recorded"}`,sourceReference:{document:component.sourceDocument,page:component.sourcePage||""}});if(c.includeProjectIdentifiers)sections.push({id:"project",label:"Project identifiers",text:`Project number: ${specState.project.projectNumber}\nProject name: ${specState.project.projectName}`,sourceReference:null});if(c.includeCustomerInformation)sections.push({id:"customer",label:"Customer information",text:`Customer: ${specState.project.customer}`,sourceReference:null});return sections}
function prepareSpecAiRequest(){const cfg=SpecificationAIService.getConfig(),component=specState.components.find(c=>c.id===val("specAiComponent"));if(cfg.providerType==="disabled")return showSpecMessage("AI Disabled","Choose Configure AI and explicitly enable a provider first.");if(!component)return showSpecMessage("Choose a Component","Select exactly one component to review.");const options={emailAddresses:cfg.redactEmails,pricing:cfg.redactPricing,internalParts:cfg.redactInternalParts,drawingNumbers:cfg.redactDrawingNumbers,filePaths:cfg.redactFilePaths,projectNumbers:!cfg.includeProjectIdentifiers,literalValues:[!cfg.includeProjectIdentifiers&&specState.project.projectName,!cfg.includeCustomerInformation&&specState.project.customer].filter(Boolean)};const sections=buildSpecAiSections(component).map(s=>{const r=SpecAIPrivacy.redactText(s.text,options);return{...s,text:r.text,redactions:r.applied}}),privacy=SpecAIPrivacy.analyzeContext(sections,cfg,specState.project);showSpecFormModal("Review Information for AI Assistance",`<div class="spec-network-warning ${privacy.leavesDevice?"is-external":""}"><strong>${privacy.leavesDevice?"This endpoint may send information outside this device.":"Local endpoint detected."}</strong><p>${escapeSpec(privacy.provider)} · ${escapeSpec(privacy.hostname)} · ${escapeSpec(privacy.model)}</p></div><p>Only checked sections will be included. Document files themselves are not included.</p><div class="spec-context-review">${sections.map((s,i)=>`<label class="spec-context-item"><input type="checkbox" data-ai-section="${i}" checked><span><strong>${escapeSpec(s.label)}</strong><small>${escapeSpec(s.redactions.length?`Redacted: ${s.redactions.join(", ")}`:"No matching redactions")}</small><pre>${escapeSpec(s.text)}</pre></span></label>`).join("")}</div><p>${privacy.approximateWords} words / ${privacy.approximateCharacters} characters before removing sections.</p><p><strong>Phase 1:</strong> creates a mock structured suggestion. No information is transmitted to a model.</p>`,()=>createSpecAiMock(component,sections,privacy));document.querySelector("#specModalActions button").textContent="Create Mock Suggestion — No Data Sent"}
function createSpecAiMock(component,sections,privacy){const chosen=sections.filter((_,i)=>document.querySelector(`[data-ai-section="${i}"]`)?.checked),cfg=SpecificationAIService.getConfig();if(!chosen.length)return showSpecMessage("No Context Selected","Keep at least one context section or cancel the request.");const request=SpecificationAIService.createRequest({task:val("specAiTask"),instructions:val("specAiInstructions"),sections:chosen,expectedSchema:SpecAIPrompts.getSuggestionSchema(),privacyLevel:privacy.leavesDevice?"external_confirmation":"local_only"}),result=SpecificationAIService.createMockResult(request),validation=SpecAIValidation.validateSuggestionResult(result.data);if(!validation.valid){logSpecAiActivity("AI response validation failed",{provider:cfg.providerType,errorStatus:validation.errors.join("; ")});return showSpecMessage("Suggestion Rejected",validation.errors.join(" "))}validation.suggestions.map(SpecAIValidation.safeSuggestion).forEach(s=>specState.aiSuggestions.push({...s,componentId:component.id,task:request.task,provider:cfg.providerType,model:cfg.model||"phase-1-mock",createdAt:new Date().toISOString(),mock:true}));logSpecAiActivity("Mock suggestion created",{provider:cfg.providerType,model:cfg.model||"phase-1-mock",task:request.task,includedLabels:chosen.map(s=>s.label),redactionUsed:chosen.flatMap(s=>s.redactions),suggestionStatus:"Pending engineer review",dataSent:false});closeSpecModal();renderSpecAiSuggestions();renderSpecAiActivity();saveSpecificationProject(false)}
function renderSpecAiSuggestions(){const el=document.getElementById("specAiSuggestions");if(!el)return;const rows=(specState.aiSuggestions||[]).filter(s=>s.status==="pending");el.innerHTML=rows.length?rows.map(s=>`<article class="spec-ai-suggestion"><div><span class="status-badge ai-suggested">AI Suggested</span> <span class="status-badge">${escapeSpec(s.evidenceLevel)}</span></div><h4>${escapeSpec(s.field)}</h4><p>${escapeSpec(s.value)}</p><small>${escapeSpec(s.reasoningSummary)} · ${s.mock?"Mock; no data sent":"Provider response"}</small><div class="button-row"><button onclick="acceptSpecAiSuggestion('${s.id}')">Accept</button><button class="secondary" onclick="editSpecAiSuggestion('${s.id}')">Edit & Accept</button><button class="delete-btn" onclick="rejectSpecAiSuggestion('${s.id}')">Reject</button></div></article>`).join(""):`<p class="converter-muted">No AI suggestions awaiting engineer review.</p>`}
async function acceptSpecAiSuggestion(id,editedValue){const s=specState.aiSuggestions.find(x=>x.id===id),c=s&&specState.components.find(x=>x.id===s.componentId);if(!s||!c)return;if(!(await showSpecConfirm("Engineer Approval",`Apply this ${s.field} suggestion to the component?`,"Approve & Apply")))return;if(s.field in c)c[s.field]=editedValue??s.value;s.status=editedValue===undefined?"accepted":"accepted_edited";s.reviewedAt=new Date().toISOString();s.reviewedBy=specState.project.engineer||"Engineer";c.verificationStatus="Engineer Approved";c.approvedBy=s.reviewedBy;c.aiInvolved=true;logSpecAiActivity("AI suggestion reviewed",{provider:s.provider,model:s.model,task:s.task,suggestionStatus:s.status});renderSpecComponents();renderSpecAiSuggestions();touchSpecificationProject()}
function editSpecAiSuggestion(id){const s=specState.aiSuggestions.find(x=>x.id===id);if(!s)return;showSpecFormModal("Edit AI Suggestion",`<label>Engineer-edited value<textarea id="specAiEditedValue" rows="5">${escapeSpec(s.value)}</textarea></label>`,()=>{const value=val("specAiEditedValue");closeSpecModal();acceptSpecAiSuggestion(id,value)})}
async function rejectSpecAiSuggestion(id){const s=specState.aiSuggestions.find(x=>x.id===id);if(!s||!(await showSpecConfirm("Reject Suggestion","Reject this suggestion without changing the component?","Reject")))return;s.status="rejected";s.reviewedAt=new Date().toISOString();logSpecAiActivity("AI suggestion reviewed",{provider:s.provider,model:s.model,task:s.task,suggestionStatus:"rejected"});renderSpecAiSuggestions();renderSpecAiActivity();saveSpecificationProject(false)}
function logSpecAiActivity(action,d={}){const providerType=d.provider||SpecificationAIService.getConfig().providerType;specState.aiAudit.push({id:crypto.randomUUID(),at:new Date().toISOString(),action,user:specState.project.engineer||"Engineer",project:specState.project.projectNumber||"Unnumbered project",provider:providerType,providerLocation:SpecAIProviders.getProvider(providerType).kind,model:d.model||"",task:d.task||"",includedLabels:d.includedLabels||[],redactionUsed:Array.from(new Set(d.redactionUsed||[])),suggestionStatus:d.suggestionStatus||"",errorStatus:d.errorStatus||"",dataSent:d.dataSent===true});specState.aiAudit=specState.aiAudit.slice(-200)}
function renderSpecAiActivity(){const el=document.getElementById("specAiActivityList");if(!el)return;const rows=[...(specState.aiAudit||[])].reverse().slice(0,25);el.innerHTML=rows.length?rows.map(r=>`<div class="spec-ai-activity-row"><strong>${escapeSpec(r.action)}</strong><span>${new Date(r.at).toLocaleString()} · ${escapeSpec(r.provider||"disabled")} · ${r.dataSent?"Data sent":"No data sent"}</span><small>${escapeSpec(r.suggestionStatus||r.errorStatus||"")}</small></div>`).join(""):`<p class="converter-muted">No AI activity. Full prompts and document text are never stored here.</p>`}

// Simple temporary configuration screen until the company selects an approved AI provider.
function openSpecAiConfiguration(){
  SpecificationAIService.disable();
  updateSpecAiInterface();
  showSpecFormModal("AI Assistance", `<div class="spec-privacy-panel"><strong>AI is not configured yet.</strong><p>The Specification Sheet tool will still work normally without AI. Once N/S chooses an approved AI, we can add the settings needed to connect it here.</p></div><div class="spec-ai-simple-status"><span class="parts-save-dot" aria-hidden="true"></span><div><strong>AI Disabled</strong><p>No project information, customer information, drawings, parts, or documents will be sent to an AI service.</p></div></div>`, closeSpecModal);
  document.querySelector("#specModalActions button").textContent="Keep AI Disabled";
  document.querySelector("#specModalActions .secondary")?.remove();
}
