const PDFDocument = window.PDFLib ? window.PDFLib.PDFDocument : null;
const StandardFonts = window.PDFLib ? window.PDFLib.StandardFonts : null;
const rgb = window.PDFLib ? window.PDFLib.rgb : null;

const documentTypes = [
  "Cover Page",
  "Table of Contents",
  "Warranty",
  "Datasheet",
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
  "Cover Page",
  "Table of Contents",
  "Warranty",
  "Datasheets",
  "Control Panel Components",
  "Shop Drawings",
  "Appendix"
];

const sectionOrder = {
  "Cover Page": 1,
  "Table of Contents": 2,
  "Warranty": 3,
  "Datasheets": 4,
  "Control Panel Components": 5,
  "Shop Drawings": 6,
  "Appendix": 7
};

function downloadFile(data, fileName, type) {
  const blob = new Blob([data], { type });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(link.href);
}