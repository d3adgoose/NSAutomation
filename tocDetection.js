const TOC_DETECTION_RULES = {
  Warranty: [
    {
      title: "Manufacturer's Limited Warranty",
      patterns: [
        "manufacturer’s limited warranty",
        "manufacturer's limited warranty",
        "manufacturers limited warranty",
        "manufacturer limited warranty",
        "limited warranty-transit",
        "warranty-transit",
        "expressed warranty"
      ]
    },
    {
      title: "Warranty Procedures",
      patterns: [
        "warranty procedures",
        "warranty procedure"
      ]
    }
  ],

  Maintenance: [
    {
      title: "Daily Maintenance",
      patterns: [
        "daily maintenance",
        "maintenance-daily",
        "maintenance daily"
      ]
    },
    {
      title: "Weekly Maintenance",
      patterns: [
        "weekly maintenance",
        "maintenance-weekly",
        "maintenance weekly"
      ]
    },
    {
      title: "Monthly Maintenance",
      patterns: [
        "monthly maintenance",
        "maintenance-monthly",
        "maintenance monthly"
      ]
    },
    {
      title: "Yearly Maintenance",
      patterns: [
        "yearly maintenance",
        "annual maintenance",
        "maintenance-yearly",
        "maintenance yearly"
      ]
    }
  ]
};

async function detectTOCSubsections(file, section, baseStartPage) {
  const rules = TOC_DETECTION_RULES[section];

  console.log("Detecting section:", section, "Rules:", rules);

  if (!rules || rules.length === 0) {
    return [];
  }

  const detectedItems = [];

  try {
    const bytes = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: bytes
    }).promise;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (detectedItems.length === rules.length) {
        console.log("All TOC subsections found. Stopping scan.");
        break;
      }

      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      let pageText = normalizeTOCText(
        textContent.items
          .map(item => item.str)
          .join(" ")
      );

      const remainingRules = rules.filter(rule =>
        !detectedItems.some(item => item.title === rule.title)
      );

      if (!pageText && remainingRules.length > 0) {
        console.log(`No selectable text on page ${pageNumber}. Running OCR...`);
        pageText = await OCRPdfPage(page);
      }

      console.log("TOC detection page:", pageNumber, `"${pageText}"`);

      for (const rule of remainingRules) {
        const found = rule.patterns.some(pattern =>
          pageText.includes(normalizeTOCText(pattern))
        );

        if (found) {
          detectedItems.push({
            title: rule.title,
            section,
            startPage: baseStartPage + pageNumber - 1,
            targetPageIndex: baseStartPage + pageNumber - 2,
            tocLevel: 1
          });

          console.log(`Detected "${rule.title}" on PDF page ${pageNumber}`);
        }
      }
    }
  } catch (error) {
    console.error("TOC subsection detection failed:", error);
  }

  return detectedItems;
}

function normalizeTOCText(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

async function OCRPdfPage(page) {
  const viewport = page.getViewport({ scale: 2 });

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  await page.render({
    canvasContext: context,
    viewport
  }).promise;

  const result = await Tesseract.recognize(canvas, "eng");

  return normalizeTOCText(result.data.text);
}