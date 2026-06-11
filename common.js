const { PDFDocument, StandardFonts, rgb } = PDFLib;

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
  "Shop Drawings",
  "Appendix"
];

const sectionOrder = {
  "Cover Page": 1,
  "Table of Contents": 2,
  "Warranty": 3,
  "Datasheets": 4,
  "Shop Drawings": 5,
  "Appendix": 6
};

function downloadFile(data, fileName, type) {
  const blob = new Blob([data], { type });
  const link = document.createElement("a");

  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  link.click();

  URL.revokeObjectURL(link.href);
}