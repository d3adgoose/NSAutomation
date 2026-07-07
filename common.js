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
      "safety procedurs",
      "safety procedur",
      "emergency shutdown",
      "emergency shut down",
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
    patterns: [
      "maintenance",
      "maintenace",
      "maintenence",
      "matienance",
      "matinence",
      "maint",
      "maintenance and safety procedures",
      "safety procedures and maintenance",
      "safety maintenance"
    ]
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

function normalizeFileRuleText(value = "") {
  return String(value)
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isMaintenanceName(fileName = "") {
  const name = normalizeFileRuleText(fileName);

  return (
    name.includes("maintenance") ||
    name.includes("maintenace") ||
    name.includes("maintenence") ||
    name.includes("matienance") ||
    name.includes("matinence") ||
    name.includes("maint ") ||
    name.includes("safety procedures and maintenance") ||
    name.includes("maintenance and safety procedures") ||
    name.includes("safety maintenance")
  );
}

function guessDocumentTypeFromName(fileName = "") {
  if (isMaintenanceName(fileName)) {
    return "Maintenance";
  }
  return getMatchedFileRule(fileName)?.documentType || "Datasheets";
}

function guessPacketSectionFromName(fileName = "") {
  if (isMaintenanceName(fileName)) {
    return "Maintenance";
  }
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

const BUILDER_HANDOFF_DB_NAME = "ns-builder-handoff";
const BUILDER_HANDOFF_STORE_NAME = "pdfs";

function openBuilderHandoffDB() {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("Local browser handoff is not supported in this browser."));
      return;
    }

    const request = indexedDB.open(BUILDER_HANDOFF_DB_NAME, 1);

    request.onupgradeneeded = event => {
      const db = event.target.result;

      if (!db.objectStoreNames.contains(BUILDER_HANDOFF_STORE_NAME)) {
        const store = db.createObjectStore(BUILDER_HANDOFF_STORE_NAME, {
          keyPath: "id"
        });
        store.createIndex("target", "target", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runBuilderHandoffTransaction(mode, callback) {
  const db = await openBuilderHandoffDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BUILDER_HANDOFF_STORE_NAME, mode);
    const store = transaction.objectStore(BUILDER_HANDOFF_STORE_NAME);
    const result = callback(store);

    transaction.oncomplete = () => {
      db.close();
      resolve(result);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error);
    };
  });
}

async function saveBuilderHandoffItem(target, metadata, blob) {
  const id = crypto.randomUUID();
  const record = {
    ...metadata,
    id,
    target,
    blob,
    createdAt: Date.now()
  };

  await runBuilderHandoffTransaction("readwrite", store => store.put(record));
  return id;
}

async function getBuilderHandoffItems(target) {
  const db = await openBuilderHandoffDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BUILDER_HANDOFF_STORE_NAME, "readonly");
    const store = transaction.objectStore(BUILDER_HANDOFF_STORE_NAME);
    const request = store.index("target").getAll(target);

    request.onsuccess = () => {
      db.close();
      resolve(
        (request.result || [])
          .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0))
      );
    };
    request.onerror = () => {
      db.close();
      reject(request.error);
    };
  });
}

async function removeBuilderHandoffItems(ids = []) {
  if (!ids.length) return;

  await runBuilderHandoffTransaction("readwrite", store => {
    ids.forEach(id => store.delete(id));
  });
}
