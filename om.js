const OM_PACKET_CONFIG = {
  outputLabel: "O&M Manual",
  fileSuffix: "OM Manual",
  sections: [
    "Warranty",
    "Safety Procedures",
    "Maintenance",
    "Sequence of Operations",
    "Parts List",
    "Datasheets",
    "Control Panel Components",
    "Electrical Schematics",
    "Shop Drawings",
    "Manuals",
    "Appendix"
  ]
};

function isOMPacket() {
  return true;
}

function getPacketTitle() {
  return "Operation & Maintenance Manual";
}

function getPacketSubtitle() {
  const revision =
    document.getElementById("revision")?.value || "0";

  return `Revision ${revision}`;
}

function getOMOutputFileName() {
  const projectNumber = document.getElementById("projectNumber").value || "Project";
  const projectName = document.getElementById("projectName").value || "OM Manual";
  const revision = document.getElementById("revision").value || "1";

  return `${projectNumber} - ${projectName} - O&M Manual Rev ${revision}.pdf`;
}

async function buildOMPacket() {
  await buildPacket();
}