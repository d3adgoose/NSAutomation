const TOC_DETECTION_RULES = {
  Warranty: [
  {
    title: "Manufacturer's Limited Warranty",
    patterns: [
      "manufacturer's limited warranty",
      "manufacturers limited warranty",
      "manufacturer limited warranty",
      "standard manufacturer's limited warranty"
    ]
  },
  {
    title: "Warranty Procedures",
    patterns: [
      "warranty procedures",
      "warranty procedure"
    ]
  }
]
};

async function detectTOCSubsections(file, section, baseStartPage) {
  const rules = TOC_DETECTION_RULES[section];

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
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map(item => item.str)
        .join(" ")
        .toLowerCase();

      console.log("TOC detection page:", pageNumber, pageText);

      for (const rule of rules) {
        const alreadyFound = detectedItems.some(
          item => item.title === rule.title
        );

        if (alreadyFound) continue;

        const found = rule.patterns.some(pattern =>
          pageText.includes(pattern.toLowerCase())
        );

        if (found) {
          detectedItems.push({
            title: rule.title,
            section,
            startPage: baseStartPage + pageNumber - 1,
            tocLevel: 1
          });

          console.log(
            `Detected "${rule.title}" on PDF page ${pageNumber}`
          );
        }
      }
    }
  } catch (error) {
    console.error("TOC subsection detection failed:", error);
  }

  return detectedItems;
}