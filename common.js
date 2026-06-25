const PDFDocument = window.PDFLib ? window.PDFLib.PDFDocument : null;
const StandardFonts = window.PDFLib ? window.PDFLib.StandardFonts : null;
const rgb = window.PDFLib ? window.PDFLib.rgb : null;

const documentTypes = [
  "Revision Remarks",
  "Cover Page",
  "Table of Contents",
  "Warranty",
  "Safety Procedure",
  "Sequence of Operations",
  "Maintenance",
  "Testing Checklist and Testing Procedures",
  "Parts List",
  "Datasheet",
  "Control Panel Components",
  "Electrical Schematic",
  "Shop Drawing",
  "Drawing",
  "Manual",
  "Certification",
  "Spec Sheet",
  "Test Report",
  "Appendix",
  "Other"
];

const packetSections = [
  "Revision Remarks",
  "Cover Page",
  "Table of Contents",
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

const sectionOrder = {
  "Revision Remarks": 1,
  "Cover Page": 2,
  "Table of Contents": 3,
  "Warranty": 4,
  "Safety Procedures": 5,
  "Sequence of Operations": 6,
  "Maintenance": 7,
  "Testing Checklist and Testing Procedures": 8,
  "Parts List": 9,
  "Datasheets": 10,
  "Control Panel Components": 11,
  "Electrical Schematics": 12,
  "Shop Drawings": 13,
  "Appendix": 14
};

const fileTypeRules = [
  {
    documentType: "Revision Remarks",
    packetSection: "Revision Remarks",
    patterns: ["revision remarks"]
  },
  {
    documentType: "Cover Page",
    packetSection: "Cover Page",
    patterns: ["cover page"]
  },
  {
    documentType: "Table of Contents",
    packetSection: "Table of Contents",
    patterns: ["table of contents", "toc"]
  },
  {
    documentType: "Warranty",
    packetSection: "Warranty",
    patterns: ["warranty"]
  },
  {
    documentType: "Safety Procedure",
    packetSection: "Safety Procedures",
    patterns: [
      "warning / safety / emergency shutdown",
      "safety procedures",
      "safety procedure",
      "emergency shutdown",
      "warning"
    ]
  },
  {
    documentType: "Sequence of Operations",
    packetSection: "Sequence of Operations",
    patterns: [
      "sequence of operations",
      "sequence of operation"
    ]
  },
  {
    documentType: "Maintenance",
    packetSection: "Maintenance",
    patterns: ["maintenance"]
  },
  {
    documentType: "Testing Checklist and Testing Procedures",
    packetSection: "Testing Checklist and Testing Procedures",
    patterns: [
      "testing checklist and testing procedures",
      "testing checklist",
      "testing procedures",
      "testing procedure"
    ]
  },
  {
    documentType: "Parts List",
    packetSection: "Parts List",
    patterns: [
      "parts list",
      "part list"
    ]
  },
  {
    documentType: "Datasheet",
    packetSection: "Datasheets",
    patterns: [
      "equipment datasheet",
      "equipment datasheets",
      "datasheet",
      "datasheets",
      "spec sheet",
      "specification",
      "manual"
    ]
  },
  {
    documentType: "Control Panel Components",
    packetSection: "Control Panel Components",
    patterns: [
      "control panel components",
      "control panel"
    ]
  },
  {
    documentType: "Electrical Schematic",
    packetSection: "Electrical Schematics",
    patterns: [
      "electrical schematics",
      "electrical schematic"
    ]
  },
  {
    documentType: "Shop Drawing",
    packetSection: "Shop Drawings",
    patterns: [
      "shop drawings",
      "shop drawing"
    ]
  },
  {
    documentType: "Appendix",
    packetSection: "Appendix",
    patterns: ["appendix"]
  },
  {
    documentType: "Other",
    packetSection: "Datasheets",
    patterns: []
  }
];

function getMatchedFileRule(fileName = "") {
  const name = String(fileName).toLowerCase();
  return fileTypeRules.find(rule =>
    rule.patterns.some(pattern => name.includes(pattern))
  );
}

function guessDocumentTypeFromName(fileName = "") {
  return getMatchedFileRule(fileName)?.documentType || "Datasheets";
}

function guessPacketSectionFromName(fileName = "") {
  return getMatchedFileRule(fileName)?.packetSection || "Datasheets";
}

function downloadFile(data, fileName, type) {
  const blob = new Blob([data], { type });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}
