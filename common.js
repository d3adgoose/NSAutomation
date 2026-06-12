const PDFDocument = window.PDFLib ? window.PDFLib.PDFDocument : null;
const StandardFonts = window.PDFLib ? window.PDFLib.StandardFonts : null;
const rgb = window.PDFLib ? window.PDFLib.rgb : null;

const documentTypes = [
  "Revision Remarks",
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
  "Revision Remarks",
  "Cover Page",
  "Table of Contents",
  "Warranty",
  "Datasheets",
  "Control Panel Components",
  "Shop Drawings",
  "Appendix"
];

const sectionOrder = {
  "Revision Remarks": 1,
  "Cover Page": 2,
  "Table of Contents": 3,
  "Warranty": 4,
  "Datasheets": 5,
  "Control Panel Components": 6,
  "Shop Drawings": 7,
  "Appendix": 8
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