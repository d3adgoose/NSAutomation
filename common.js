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
  "Parts List",
  "Datasheets",
  "Control Panel Components",
  "Electrical Schematics",
  "Shop Drawings",
  "Manuals",
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
  "Parts List": 8,
  "Datasheets": 9,
  "Control Panel Components": 10,
  "Electrical Schematics": 11,
  "Shop Drawings": 12,
  "Manuals": 13,
  "Appendix": 14
};

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