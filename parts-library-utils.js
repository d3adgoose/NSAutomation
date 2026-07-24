/* Shared display, identity, and scheduling helpers for the Parts Library. */
function uniqueValues(values) {
  return [...new Set(values.map(value => String(value || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}
function setPartsStatus(message) { setText("partsStatusMessage", message); }
function setText(id, value) {
  const element = document.getElementById(id);
  if (element) element.textContent = String(value ?? "");
}
function formatValue(value) {
  if (value == null) return "";
  if (typeof value === "number" && value <= 1 && value >= 0) return `${Math.round(value * 100)}%`;
  return String(value);
}
function labelize(value) { return String(value || "").replace(/_/g, " ").replace(/\b\w/g, character => character.toUpperCase()); }
function getBadgeClass(value) {
  const normalized = normalizeSearch(value).replace(/\s+/g, "-");
  if (normalized.includes("conflict")) return "conflict";
  if (normalized.includes("review") || normalized.includes("suggested")) return "needs-review";
  if (normalized.includes("exact") || normalized.includes("active") || normalized.includes("old") || normalized.includes("same-number")) return "exact";
  if (normalized.includes("new")) return "new-part";
  return "";
}
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;"
  }[character]));
}
function escapeAttr(value) { return escapeHTML(value).replace(/`/g, "&#96;"); }
function makeId(prefix) {
  const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${uuid}`;
}
function nowISO() { return new Date().toISOString(); }
function waitForBrowser() { return new Promise(resolve => setTimeout(resolve, 0)); }
