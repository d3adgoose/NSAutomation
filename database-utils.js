/* Shared normalization, formatting, and escaping helpers for the PDF database. */
function normalizeLibraryTOCLevel(value) {
  const level = Number(value);
  return [0, 1, 2].includes(level) ? level : 0;
}

function normalizeLibraryCategory(value = "") {
  return DATABASE_CATEGORIES.includes(value) ? value : "Generic";
}

function formatStorageBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const precision = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[unitIndex]}`;
}

function escapeHTML(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
