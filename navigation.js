document.addEventListener("DOMContentLoaded", () => {
  enableAppWideSpellcheck(document);
  observeDynamicSpellcheckFields();
  initializeRecentToolHistory();

  const btn = document.getElementById("hamburgerBtn");
  const menu = document.getElementById("sideMenu");

  if (!btn || !menu) return;

  const currentPage = window.location.pathname.split("/").pop() || "index.html";
  menu.querySelectorAll("a").forEach(link => {
    const linkPage = link.getAttribute("href");
    if (linkPage === currentPage) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
  });

  btn.addEventListener("click", () => {
    const isOpen = menu.classList.toggle("open");
    btn.classList.toggle("open", isOpen);
    btn.setAttribute("aria-expanded", String(isOpen));
  });

  menu.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", event => {
      if (typeof window.handleSpecNavigationDuringAnalysis === "function" &&
          window.handleSpecNavigationDuringAnalysis(link.href)) {
        event.preventDefault();
        return;
      }
      menu.classList.remove("open");
      btn.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    });
  });

  document.addEventListener("click", e => {
    if (
      !menu.contains(e.target) &&
      !btn.contains(e.target)
    ) {
      menu.classList.remove("open");
      btn.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });

  initializeSpecAnalysisMenuStatus(menu);
});

const RECENT_TOOL_HISTORY_KEY = "ns-recent-tool-history-v1";
const SPEC_ANALYSIS_STATUS_KEY = "ns-spec-analysis-status-v1";
const RECENT_TOOL_LABELS = {
  "database.html": "PDF Datasheet Library",
  "parts-library.html": "Drawing & Parts Library",
  "converter.html": "Part Number Converter",
  "specification.html": "Spec Automation",
  "submittal.html": "Submittal Builder",
  "om.html": "O&M Manual Builder"
};

function readSpecAnalysisStatus() {
  try {
    const status = JSON.parse(localStorage.getItem(SPEC_ANALYSIS_STATUS_KEY) || "null");
    return status && typeof status === "object" ? status : null;
  } catch {
    return null;
  }
}

function formatSpecAnalysisElapsed(startedAt, finishedAt = 0) {
  const seconds = Math.max(0, Math.floor(((finishedAt || Date.now()) - Number(startedAt || Date.now())) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds % 3600 / 60);
  const remainder = String(seconds % 60).padStart(2, "0");
  return hours ? `${hours}:${String(minutes).padStart(2, "0")}:${remainder}` : `${minutes}:${remainder}`;
}

function initializeSpecAnalysisMenuStatus(menu) {
  const link = Array.from(menu.querySelectorAll("a")).find(item => (item.getAttribute("href") || "").split("?")[0] === "specification.html");
  if (!link) return;
  let badge = link.querySelector(".spec-menu-analysis-status");
  if (!badge) {
    badge = document.createElement("small");
    badge.className = "spec-menu-analysis-status";
    link.appendChild(badge);
  }
  const render = () => {
    const status = readSpecAnalysisStatus();
    const running = status?.state === "running" && Date.now() - Number(status.updatedAt || 0) < 120000;
    const isReanalysis = status?.activity === "reanalyze" ||
      /\b(?:reanalyz|regular analysis|automatic .*analysis)\b/i.test(String(status?.message || ""));
    badge.classList.toggle("is-running", running);
    badge.classList.toggle("is-done", Boolean(status) && !running);
    badge.textContent = running
      ? `${isReanalysis ? "Reanalyzing" : "AI in progress"} · ${formatSpecAnalysisElapsed(status.startedAt)}`
      : status
        ? "Done"
        : "Analyze with AI";
  };
  render();
  setInterval(render, 1000);
  window.addEventListener("storage", event => {
    if (event.key === SPEC_ANALYSIS_STATUS_KEY) render();
  });
}

function getRecentToolHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(RECENT_TOOL_HISTORY_KEY) || "[]");
    return Array.isArray(history) ? history : [];
  } catch (error) {
    console.warn("Could not read recent tool history:", error);
    return [];
  }
}

function saveRecentToolHistory(history) {
  try {
    localStorage.setItem(RECENT_TOOL_HISTORY_KEY, JSON.stringify(history.slice(0, 5)));
  } catch (error) {
    console.warn("Could not save recent tool history:", error);
  }
}

function initializeRecentToolHistory() {
  const page = window.location.pathname.split("/").pop() || "index.html";
  if (page === "index.html") {
    renderRecentToolHistory();
    return;
  }
  if (!RECENT_TOOL_LABELS[page]) return;

  const saveCurrentPosition = () => {
    const history = getRecentToolHistory().filter(item => item.page !== page);
    history.unshift({
      page,
      label: RECENT_TOOL_LABELS[page],
      lastVisited: Date.now(),
      scrollY: Math.max(0, Math.round(window.scrollY || 0))
    });
    saveRecentToolHistory(history);
  };

  const savedPosition = getRecentToolHistory().find(item => item.page === page)?.scrollY || 0;
  saveCurrentPosition();
  let scrollSaveTimer = null;
  window.addEventListener("scroll", () => {
    clearTimeout(scrollSaveTimer);
    scrollSaveTimer = setTimeout(saveCurrentPosition, 250);
  }, { passive: true });
  window.addEventListener("pagehide", saveCurrentPosition);

  if (new URLSearchParams(window.location.search).get("continue") === "1") {
    const restorePosition = () => window.scrollTo({ top: Number(savedPosition), behavior: "auto" });
    requestAnimationFrame(restorePosition);
    setTimeout(restorePosition, 500);
    setTimeout(restorePosition, 1200);
  }
}

function formatRecentToolTime(timestamp) {
  const date = new Date(Number(timestamp || 0));
  if (!Number.isFinite(date.getTime())) return "Recently used";
  const elapsedMinutes = Math.floor((Date.now() - date.getTime()) / 60000);
  if (elapsedMinutes < 1) return "Just now";
  if (elapsedMinutes < 60) return `${elapsedMinutes} minute${elapsedMinutes === 1 ? "" : "s"} ago`;
  if (elapsedMinutes < 1440) {
    const hours = Math.floor(elapsedMinutes / 60);
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function renderRecentToolHistory() {
  const section = document.getElementById("continueWorkSection");
  const list = document.getElementById("continueWorkList");
  if (!section || !list) return;
  const history = getRecentToolHistory().filter(item => RECENT_TOOL_LABELS[item.page]).slice(0, 1);
  section.classList.toggle("hidden", !history.length);
  list.replaceChildren();

  history.forEach((item, index) => {
    const link = document.createElement("a");
    link.className = `continue-work-item${index === 0 ? " most-recent" : ""}`;
    link.href = `${item.page}?continue=1`;
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const time = document.createElement("small");
    const action = document.createElement("span");
    title.textContent = item.label || RECENT_TOOL_LABELS[item.page];
    time.textContent = formatRecentToolTime(item.lastVisited);
    action.className = "continue-work-action";
    action.textContent = index === 0 ? "Continue" : "Open";
    copy.append(title, time);
    link.append(copy, action);
    list.appendChild(link);
  });
}

function clearRecentToolHistory() {
  localStorage.removeItem(RECENT_TOOL_HISTORY_KEY);
  renderRecentToolHistory();
}

function enableAppWideSpellcheck(root = document) {
  const fields = [];
  if (root.matches?.('input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable="true"]')) {
    fields.push(root);
  }
  root.querySelectorAll?.('input[type="text"], input[type="search"], input:not([type]), textarea, [contenteditable="true"]')
    .forEach(field => fields.push(field));

  fields.forEach(field => {
    field.spellcheck = true;
    field.setAttribute("spellcheck", "true");
    if (!field.hasAttribute("lang")) field.setAttribute("lang", "en-US");
  });
}

function observeDynamicSpellcheckFields() {
  const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
      mutation.addedNodes.forEach(node => {
        if (node.nodeType === Node.ELEMENT_NODE) enableAppWideSpellcheck(node);
      });
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
}
