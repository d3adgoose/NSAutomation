const TOC_DETECTION_RULES = {
  Warranty: [
    {
      title: "Manufacturer's Limited Warranty",
      tocLevel: 0,
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
const tocDetectionCache = new WeakMap();

async function detectTOCSubsections(
  file,
  section,
  baseStartPage,
  baseTargetPageIndex = baseStartPage - 1
) {
  const rules = TOC_DETECTION_RULES[section];

  if (!rules || rules.length === 0) {
    return [];
  }

  const cachedBySection = tocDetectionCache.get(file);
  if (cachedBySection?.has(section)) {
    return cachedBySection.get(section).map(item => ({
      ...item,
      startPage: baseStartPage + item.sourcePage - 1,
      targetPageIndex: baseTargetPageIndex + item.sourcePage - 1
    }));
  }

  const detectedItems = [];

  try {
    const bytes = await file.arrayBuffer();

    const pdf = await pdfjsLib.getDocument({
      data: bytes
    }).promise;

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
      if (detectedItems.length === rules.length) {
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
        pageText = await OCRPdfPage(page);
      }

      for (const rule of remainingRules) {
        const found = rule.patterns.some(pattern =>
          pageText.includes(normalizeTOCText(pattern))
        );

        if (found) {
          detectedItems.push({
            title: rule.title,
            section,
            sourcePage: pageNumber,
            startPage: baseStartPage + pageNumber - 1,
            targetPageIndex: baseTargetPageIndex + pageNumber - 1,
            tocLevel: rule.tocLevel ?? 1
          });
        }
      }
    }
  } catch (error) {
    console.error("TOC subsection detection failed:", error);
  }

  const normalizedItems = detectedItems.map(item => ({
    title: item.title,
    section: item.section,
    sourcePage: item.sourcePage,
    tocLevel: item.tocLevel
  }));
  const nextCache = cachedBySection || new Map();
  nextCache.set(section, normalizedItems);
  tocDetectionCache.set(file, nextCache);

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
