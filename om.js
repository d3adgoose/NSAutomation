const OM_PACKET_CONFIG = {
  outputLabel: "O&M Manual",
  fileSuffix: "OM Manual",
  sections: [
    "Warranty",
    "Safety Procedures",
    "Sequence of Operations",
    "Maintenance",
    "Testing Checklist and Testing Procedures",
    "Parts List",
    "Datasheets",
    "Control Panel Components",
    "Electrical Schematics",
    "Shop Drawings",
    "Appendix"
  ]
};

const OM_SECTION_ORDER = [
  "Warranty",
  "Safety Procedures",
  "Sequence of Operations",
  "Maintenance",
  "Testing Checklist and Testing Procedures",
  "Parts List",
  "Datasheets",
  "Control Panel Components",
  "Electrical Schematics",
  "Shop Drawings",
  "Appendix"
];

const OM_SECTION_LABELS = {
  "Warranty": "Warranty",
  "Safety Procedures": "Safety Procedures",
  "Maintenance": "Maintenance",
  "Testing Checklist and Testing Procedures": "Testing Checklist and Testing Procedures",
  "Sequence of Operations": "Sequence of Operations",
  "Parts List": "Parts List",
  "Datasheets": "Equipment Datasheets",
  "Control Panel Components": "Control Panel Components",
  "Electrical Schematics": "Electrical Schematics",
  "Shop Drawings": "Shop Drawings",
  "Appendix": "Appendix"
};

function isOMPacket() {
  return true;
}

function getPacketTitle() {
  return "Operation & Maintenance Manual";
}

function getSectionLabel(section) {
  return customSectionLabels[section] || OM_SECTION_LABELS[section] || section;
}

function getPacketSubtitle() {
  const revision =
    document.getElementById("revision")?.value || "0";

  return `Revision ${revision}`;
}

async function buildOMPacket() {
  await buildPacket();
}

function getOMOutputFileName() {
  const projectNumber =
    document.getElementById("projectNumber")?.value || "Project";

  const projectName =
    document.getElementById("projectName")?.value || "OM Manual";

  const revision =
    document.getElementById("revision")?.value || "1";

  return `${projectNumber} - ${projectName} - O&M Manual Rev ${revision}.pdf`;
}
