/* Shared DOM and display helpers for Specification Automation. */
function val(id) { return document.getElementById(id)?.value || ""; }
function escapeSpec(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escapeSpecAttr(value) { return escapeSpec(value); }
function statusClass(value) { return String(value || "").toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, ""); }
function formatSpecBytes(bytes) { return Number(bytes || 0) >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`; }
