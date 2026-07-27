/* --------------------------------------------------------------------------
   Warranty creation
   -------------------------------------------------------------------------- */

function openWarrantyPromptModal(options = {}) {
  const modal = document.getElementById("warrantyPromptModal");
  const createCheckbox = document.getElementById("createWarrantySheet");
  const vehicleType = document.getElementById("warrantyVehicleType");
  const washType = document.getElementById("washType")?.value;
  const durationInput = document.getElementById("warrantyLaborDuration");
  const materialYearsInput = document.getElementById("warrantyMaterialYears");
  const standardCoverage = document.getElementById("useStandardWarrantyCoverage");
  const unitSelect = document.getElementById("warrantyLaborUnit");
  const commencementSelect = document.getElementById("warrantyCommencement");
  const commencementDate = document.getElementById("warrantyCommencementDate");
  const representative = document.getElementById("warrantyRepresentative");
  const representativeDate = document.getElementById("warrantyRepresentativeDate");
  const revisionPreparedBy = document.getElementById("warrantyRevisionPreparedBy");
  const status = document.getElementById("warrantyCreateStatus");
  const promptText = document.getElementById("warrantyPromptText");
  const createLabel = document.getElementById("warrantyCreatePromptText");
  const continueButton = document.getElementById("continueWarrantyButton");

  if (!modal || !createCheckbox) return;

  modal.dataset.hasIncludedWarranty = options.hasIncludedWarranty ? "true" : "false";
  createCheckbox.checked = false;
  if (promptText) {
    promptText.textContent = options.hasIncludedWarranty
      ? "A warranty PDF is included in this packet."
      : "No warranty PDF is included in this packet.";
  }
  if (createLabel) {
    createLabel.textContent = options.hasIncludedWarranty
      ? "Do you want to create a new warranty sheet instead?"
      : "Do you want to create a warranty sheet?";
  }
  if (vehicleType) {
    vehicleType.value = washType === "Car Wash" ? "car" : "transit";
  }
  if (standardCoverage) standardCoverage.checked = true;
  if (materialYearsInput) materialYearsInput.value = "1";
  if (durationInput) durationInput.value = "90";
  if (unitSelect) unitSelect.value = "days";
  if (commencementSelect) commencementSelect.value = "substantial";
  if (commencementDate) commencementDate.value = "";
  if (representative) representative.selectedIndex = 0;
  if (representativeDate) {
    representativeDate.value = getWarrantyDateInputValue(new Date());
  }
  if (revisionPreparedBy) revisionPreparedBy.value = "";
  if (status) status.textContent = "";
  renderBuildSummary("buildSummary", { createWarranty: false });

  updateWarrantyPeriodEnd();
  updateWarrantyVehicleFields();
  toggleStandardWarrantyCoverage();
  toggleWarrantyCreator();
  if (continueButton && !createCheckbox.checked) {
    continueButton.textContent = options.hasIncludedWarranty
      ? "Continue With Included Warranty"
      : "Continue Without Warranty";
  }
  modal.classList.remove("hidden");
}

function closeWarrantyPromptModal() {
  const modal = document.getElementById("warrantyPromptModal");
  if (modal) modal.classList.add("hidden");
}

function toggleWarrantyCreator() {
  const createCheckbox = document.getElementById("createWarrantySheet");
  const fields = document.getElementById("warrantyCreatorFields");
  const continueButton = document.getElementById("continueWarrantyButton");

  if (!createCheckbox || !fields || !continueButton) return;

  const hasIncludedWarranty =
    document.getElementById("warrantyPromptModal")?.dataset.hasIncludedWarranty === "true";

  fields.classList.toggle("hidden", !createCheckbox.checked);
  continueButton.textContent = createCheckbox.checked
    ? "Add Warranty & Continue"
    : hasIncludedWarranty
      ? "Continue With Included Warranty"
      : "Continue Without Warranty";

  renderBuildSummary("buildSummary", { createWarranty: createCheckbox.checked });
}

function getBuildSummary(options = {}) {
  const included = pdfLibrary.filter(item => item.include);
  const createWarranty = Boolean(options.createWarranty);
  const revisionRemarksCount = included.filter(
    item => item.packetSection === "Revision Remarks"
  ).length;
  const romanSections = getBuildRomanSections().map(section => {
    const count =
      included.filter(item => item.packetSection === section).length +
      (section === "Warranty" && createWarranty ? 1 : 0);

    return {
      section,
      label: getSectionLabel(section),
      count,
      included: count > 0
    };
  });

  return {
    includedPdfCount: included.length + (createWarranty ? 1 : 0),
    revisionRemarksIncluded: revisionRemarksCount > 0,
    romanSections
  };
}

function getBuildRomanSections() {
  if (typeof isOMPacket === "function" && isOMPacket()) {
    return OM_SECTION_ORDER;
  }

  return [
    "Warranty",
    "Datasheets",
    "Control Panel Components",
    "Shop Drawings",
    "Appendix"
  ];
}

function renderBuildSummary(targetId, options = {}) {
  const target = document.getElementById(targetId);
  if (!target) return;

  const summary = getBuildSummary(options);
  const romanSectionRows = summary.romanSections
    .map(item => `
      <div class="build-summary-row ${item.included ? "" : "is-missing"}">
        <span>${item.label}</span>
        <strong>${item.included ? `Yes (${item.count})` : "No"}</strong>
      </div>
    `)
    .join("");

  target.innerHTML = `
    <div class="build-summary-row">
      <span>Included PDFs</span>
      <strong>${summary.includedPdfCount}</strong>
    </div>
    <div class="build-summary-row">
      <span>Revision Remarks</span>
      <strong>${summary.revisionRemarksIncluded ? "Yes" : "No"}</strong>
    </div>
    <div class="build-summary-heading">Roman Numeral Sections</div>
    ${romanSectionRows}
  `;
}

function updateWarrantyVehicleFields() {
  const vehicleType = document.getElementById("warrantyVehicleType")?.value;
  const laborUnit = document.getElementById("warrantyLaborUnit");
  const transitFields = document.getElementById("warrantyTransitFields");
  const isCar = vehicleType === "car";

  transitFields?.classList.toggle("hidden", isCar);

  if (laborUnit) {
    const units = isCar
      ? [["days", "Days"], ["months", "Months"]]
      : [["days", "Days"], ["years", "Years"]];

    laborUnit.replaceChildren(...units.map(([value, label]) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = label;
      return option;
    }));
  }

  toggleStandardWarrantyCoverage();
}

function toggleStandardWarrantyCoverage() {
  const standardCoverage = document.getElementById("useStandardWarrantyCoverage");
  const materialDuration = document.getElementById("warrantyMaterialYears");
  const materialUnit = document.getElementById("warrantyMaterialUnit");
  const laborDuration = document.getElementById("warrantyLaborDuration");
  const laborUnit = document.getElementById("warrantyLaborUnit");

  if (!standardCoverage) return;

  const useStandard = standardCoverage.checked;
  if (useStandard) {
    if (materialDuration) materialDuration.value = "1";
    if (materialUnit) materialUnit.value = "years";
    if (laborDuration) laborDuration.value = "90";
    if (laborUnit) laborUnit.value = "days";
  }

  [materialDuration, materialUnit, laborDuration, laborUnit].forEach(control => {
    if (control) control.disabled = useStandard;
  });
}

async function continueWarrantyPrompt() {
  const createCheckbox = document.getElementById("createWarrantySheet");
  let warrantyAdded = false;

  if (!createCheckbox?.checked) {
    warrantyPromptHandled = true;
    closeWarrantyPromptModal();
    buildPacket();
    return;
  }

  const duration = Number(
    document.getElementById("warrantyLaborDuration")?.value
  );
  const materialYears = Number(
    document.getElementById("warrantyMaterialYears")?.value
  );
  const vehicleType =
    document.getElementById("warrantyVehicleType")?.value || "transit";
  const unit = document.getElementById("warrantyLaborUnit")?.value;
  const commencement = document.getElementById("warrantyCommencement")?.value;
  const commencementDate =
    document.getElementById("warrantyCommencementDate")?.value || "";
  const periodEndDate =
    document.getElementById("warrantyPeriodEndDate")?.value ||
    getWarrantyPeriodEndDate(commencementDate);
  const representative =
    document.getElementById("warrantyRepresentative")?.value || "";
  const representativeDate =
    document.getElementById("warrantyRepresentativeDate")?.value || "";
  const revisionPreparedBy =
    document.getElementById("warrantyRevisionPreparedBy")?.value.trim() || "";
  const status = document.getElementById("warrantyCreateStatus");
  const continueButton = document.getElementById("continueWarrantyButton");
  const buildLabel = getPacketBuildLabel();

  if (!Number.isInteger(materialYears) || materialYears < 1) {
    if (status) status.textContent = "Enter the material warranty years.";
    updatePacketBuildStatus("Warranty build paused: enter the material warranty years.");
    return;
  }

  if (!Number.isInteger(duration) || duration < 1) {
    if (status) status.textContent = "Enter a whole number greater than zero.";
    updatePacketBuildStatus("Warranty build paused: enter a whole number greater than zero.");
    return;
  }

  if (vehicleType === "transit" && (!commencementDate || !periodEndDate)) {
    if (status) status.textContent = "Select the warranty commencement date.";
    updatePacketBuildStatus("Warranty build paused: select the warranty commencement date.");
    return;
  }

  if (continueButton) continueButton.disabled = true;
  if (status) status.textContent = "Creating warranty sheet...";
  updatePacketBuildStatus("Creating warranty sheet...");

  try {
    const warrantyFile = vehicleType === "car"
      ? await createCarWarrantyFile({
          materialYears,
          duration,
          unit,
          revisionPreparedBy
        })
      : await createTransitWarrantyFile({
          materialYears,
          duration,
          unit,
          commencement,
          commencementDate,
          periodEndDate,
          representative,
          representativeDate,
          revisionPreparedBy
        });

    pdfLibrary.push({
      id: crypto.randomUUID(),
      file: warrantyFile,
      fileName: warrantyFile.name,
      uploadDate: new Date().toLocaleDateString(),
      displayTitle: "Manufacturer's Limited Warranty",
      documentType: "Warranty",
      packetSection: "Warranty",
      include: true,
      hideParentTOC: true,
      tocEntriesReviewed: false,
      notes:
        `Materials: ${materialYears} year(s); ` +
        `Labor: ${duration} ${unit}`,
      datasheetOrder: null,
      tocEntries: []
    });
    warrantyAdded = true;

    warrantyPromptHandled = true;
    sortLibraryBySection();
    renderUploadedPdfList();
    if (status) status.textContent = "Warranty sheet added.";
    updatePacketBuildStatus("Warranty sheet added. Continuing build...");
    closeWarrantyPromptModal();
    await buildPacket();
  } catch (error) {
    console.error("Could not continue warranty build:", error);
    const reason = error?.message || "Please try again.";

    if (warrantyAdded) {
      const message =
        `The warranty sheet was added, but the ${buildLabel} could not be built. ${reason}`;
      updatePacketBuildStatus(message);
      await showMessageModal("Build Paused", message);
    } else if (status) {
      const message = `The warranty sheet could not be created. ${reason}`;
      status.textContent = message;
      updatePacketBuildStatus(message);
    }
  } finally {
    if (continueButton) continueButton.disabled = false;
  }
}

async function createTransitWarrantyFile({
  materialYears,
  duration,
  unit,
  commencement,
  commencementDate,
  periodEndDate,
  representative,
  representativeDate,
  revisionPreparedBy
}) {
  const commencementCode = commencement === "testing" ? "TC" : "SC";
  const durationCode = unit === "years" ? "Y" : "D";
  const templateFileName =
    `Transit${commencementCode}${durationCode}Warranty.pdf`;
  const templateBytes = await loadTransitWarrantyTemplate(templateFileName);
  const warrantyPdf = await PDFDocument.load(templateBytes);
  const pages = warrantyPdf.getPages();
  const detailsPage = pages[pages.length - 1];
  const PDFName = window.PDFLib.PDFName;

  if (!detailsPage || !PDFName) {
    throw new Error("The transit warranty template could not be loaded.");
  }

  const annotationsKey = PDFName.of("Annots");
  pages.forEach(page => page.node.delete(annotationsKey));
  warrantyPdf.catalog.delete(PDFName.of("AcroForm"));

  const font = await warrantyPdf.embedFont(StandardFonts.Helvetica);
  const projectNumber = document.getElementById("projectNumber")?.value || "";
  const projectName = document.getElementById("projectName")?.value || "";
  const projectAddress = document.getElementById("projectAddress")?.value || "";
  const unitLabel = unit === "years" ? "year(s)" : "days";
  const commencementLabel = commencement === "testing"
    ? "Testing and Completion."
    : "Substantial Completion.";

  drawWarrantyFieldText(detailsPage, projectNumber, 216, 660, 8, 242, font);
  drawWarrantyFieldText(detailsPage, projectName, 216, 648, 8, 242, font);
  drawWarrantyFieldText(detailsPage, projectAddress, 216, 635, 8, 242, font);
  drawWarrantyFieldText(detailsPage, String(materialYears), 37, 581, 9, 15, font);
  drawWarrantyFieldText(detailsPage, String(duration), 399, 581, 9, 19, font);
  drawWarrantyFieldText(detailsPage, unitLabel, 420, 581, 8, 36, font);
  drawWarrantyFieldText(detailsPage, commencementLabel, 36, 566, 8, 116, font);
  drawWarrantyFieldText(
    detailsPage,
    formatWarrantyDateForPdf(commencementDate),
    203,
    520,
    8,
    65,
    font
  );
  drawWarrantyFieldText(
    detailsPage,
    formatWarrantyDateForPdf(periodEndDate),
    475,
    520,
    8,
    59,
    font
  );
  drawWarrantyFieldText(detailsPage, representative, 178, 178, 8, 180, font);
  drawWarrantyFieldText(
    detailsPage,
    formatWarrantyDateForPdf(representativeDate),
    390,
    178,
    8,
    145,
    font
  );
  drawWarrantyFieldText(detailsPage, revisionPreparedBy, 129, 97, 8, 157, font);

  const warrantyBytes = await warrantyPdf.save();

  return new File(
    [warrantyBytes],
    templateFileName,
    { type: "application/pdf" }
  );
}

async function createCarWarrantyFile({
  materialYears,
  duration,
  unit,
  revisionPreparedBy
}) {
  const templateFileName = "CarWarranty.pdf";
  const templateBytes = await loadCarWarrantyTemplate(templateFileName);
  const warrantyPdf = await PDFDocument.load(templateBytes);
  const pages = warrantyPdf.getPages();
  const detailsPage = pages[pages.length - 1];
  const PDFName = window.PDFLib.PDFName;

  if (!detailsPage || !PDFName) {
    throw new Error("The car warranty template could not be loaded.");
  }

  const annotationsKey = PDFName.of("Annots");
  pages.forEach(page => page.node.delete(annotationsKey));
  warrantyPdf.catalog.delete(PDFName.of("AcroForm"));

  const font = await warrantyPdf.embedFont(StandardFonts.Helvetica);
  const projectNumber =
    document.getElementById("projectNumber")?.value.trim() || "";
  const materialLabel = `${materialYears} year(s)`;
  const laborLabel = unit === "months"
    ? `${duration} month(s)`
    : `${duration} days`;

  drawWarrantyFieldText(detailsPage, projectNumber, 213, 651, 9, 56, font);
  drawWarrantyFieldText(detailsPage, materialLabel, 182, 594, 8, 43, font);
  drawWarrantyFieldText(detailsPage, laborLabel, 250, 572, 8, 38, font);
  drawWarrantyFieldText(detailsPage, revisionPreparedBy, 139, 86, 8, 157, font);

  const warrantyBytes = await warrantyPdf.save();

  return new File(
    [warrantyBytes],
    templateFileName,
    { type: "application/pdf" }
  );
}

function updateWarrantyPeriodEnd() {
  const commencementDate =
    document.getElementById("warrantyCommencementDate")?.value || "";
  const periodEndInput = document.getElementById("warrantyPeriodEndDate");

  if (periodEndInput) {
    periodEndInput.value = getWarrantyPeriodEndDate(commencementDate);
  }
}

function getWarrantyPeriodEndDate(commencementDate) {
  const date = parseWarrantyDateInput(commencementDate);

  if (!date) return "";

  date.setDate(date.getDate() + 365);
  return getWarrantyDateInputValue(date);
}

function parseWarrantyDateInput(value) {
  const parts = String(value || "").split("-").map(Number);

  if (parts.length !== 3 || parts.some(part => !Number.isFinite(part))) {
    return null;
  }

  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function getWarrantyDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatWarrantyDateForPdf(value) {
  const date = parseWarrantyDateInput(value);

  if (!date) return "";

  return [
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
    date.getFullYear()
  ].join("/");
}

function drawWarrantyFieldText(page, text, x, y, size, maxWidth, font) {
  const value = String(text || "");
  let fontSize = size;

  while (fontSize > 6 && font.widthOfTextAtSize(value, fontSize) > maxWidth) {
    fontSize -= 0.5;
  }

  page.drawText(value, {
    x,
    y,
    size: fontSize,
    font,
    color: rgb(0, 0, 0),
    maxWidth
  });
}

async function loadTransitWarrantyTemplate(templateFileName) {
  const templatePath = `Files/Warranty/Transit/${templateFileName}`;

  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch(templatePath);

      if (response.ok) {
        return response.arrayBuffer();
      }
    } catch (error) {
      console.warn("Direct warranty template loading failed.", error);
    }
  }

  const base64 = await loadEmbeddedWarrantyTemplate(templateFileName);
  return decodeBase64Bytes(base64);
}

async function loadCarWarrantyTemplate(templateFileName) {
  const templatePath = `Files/Warranty/Car/${templateFileName}`;

  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch(templatePath);

      if (response.ok) {
        return response.arrayBuffer();
      }
    } catch (error) {
      console.warn("Direct car warranty loading failed.", error);
    }
  }

  const existingTemplate =
    window.CAR_WARRANTY_TEMPLATES?.[templateFileName];

  if (existingTemplate) {
    return decodeBase64Bytes(existingTemplate);
  }

  const base64 = await new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const dataFileName = templateFileName.replace(/\.pdf$/i, ".data.js");

    script.src = `Files/Warranty/Car/${dataFileName}`;
    script.async = true;
    script.onload = () => {
      const loadedTemplate =
        window.CAR_WARRANTY_TEMPLATES?.[templateFileName];

      script.remove();

      if (loadedTemplate) {
        resolve(loadedTemplate);
      } else {
        reject(new Error(`Car warranty data is missing: ${dataFileName}`));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Car warranty template not found: ${templateFileName}`));
    };

    document.head.appendChild(script);
  });

  return decodeBase64Bytes(base64);
}

function loadEmbeddedWarrantyTemplate(templateFileName) {
  const existingTemplate =
    window.TRANSIT_WARRANTY_TEMPLATES?.[templateFileName];

  if (existingTemplate) {
    return Promise.resolve(existingTemplate);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const dataFileName = templateFileName.replace(/\.pdf$/i, ".data.js");

    script.src = `Files/Warranty/Transit/${dataFileName}`;
    script.async = true;
    script.onload = () => {
      const loadedTemplate =
        window.TRANSIT_WARRANTY_TEMPLATES?.[templateFileName];

      script.remove();

      if (loadedTemplate) {
        resolve(loadedTemplate);
      } else {
        reject(new Error(`Warranty data is missing: ${dataFileName}`));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Warranty template not found: ${templateFileName}`));
    };

    document.head.appendChild(script);
  });
}

async function loadCoverPageAsset(fileName) {
  const assetPath = `Files/CoverPage/${fileName}`;

  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch(assetPath);

      if (response.ok) {
        return response.arrayBuffer();
      }
    } catch (error) {
      console.warn("Direct cover asset loading failed.", error);
    }
  }

  const base64 = await loadEmbeddedCoverPageAsset(fileName);
  return decodeBase64Bytes(base64);
}

function loadEmbeddedCoverPageAsset(fileName) {
  const existingAsset = window.COVER_PAGE_ASSETS?.[fileName];

  if (existingAsset) {
    return Promise.resolve(existingAsset);
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const dataFileName = fileName.replace(/\.[^.]+$/i, ".data.js");

    script.src = `Files/CoverPage/${dataFileName}`;
    script.async = true;
    script.onload = () => {
      const loadedAsset = window.COVER_PAGE_ASSETS?.[fileName];

      script.remove();

      if (loadedAsset) {
        resolve(loadedAsset);
      } else {
        reject(new Error(`Cover asset data is missing: ${dataFileName}`));
      }
    };
    script.onerror = () => {
      script.remove();
      reject(new Error(`Cover asset not found: ${fileName}`));
    };

    document.head.appendChild(script);
  });
}

function decodeBase64Bytes(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index++) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}
