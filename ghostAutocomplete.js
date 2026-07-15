(function () {
  "use strict";

  const STORAGE_KEY = "nsautomation.ghostAutocomplete.acceptedSuggestions";
  const MAX_SAVED_SUGGESTIONS = 80;

  const FALLBACK_SUGGESTIONS = [
    "Add Part",
    "Build PDF",
    "Change Mapping",
    "Clear Filters",
    "Clear Local Copy",
    "Current Parts",
    "Current Part Number",
    "Delete Selected",
    "Detected Columns",
    "Drawing Number",
    "Drawing Package",
    "Drawing PDF",
    "Drawing Usage",
    "Drawing Usage Records",
    "Excel Part List",
    "Export CSV",
    "Export Library",
    "File Name",
    "File Names",
    "Import History",
    "Import Selected Rows",
    "Items to Check",
    "Last Updated",
    "Local Copy",
    "Manual PDF",
    "Needs Review",
    "Normal PDF",
    "NS Automation",
    "Old Part Numbers",
    "Old Part Number",
    "Operation Manual",
    "Operating Instructions",
    "Page Number Format",
    "Part List",
    "Part Description",
    "Part Number",
    "Parts Library",
    "PDF Page",
    "Review Excel Import",
    "Review PDF Import",
    "Save Library",
    "Search",
    "Select All",
    "Shared Parts Library",
    "Sort",
    "Source File",
    "Submittal",
    "Submittal Package",
    "Suggested Match",
    "Warranty",
    "Warranty Prompt"
  ];

  const DEFAULT_SELECTORS = [
    "#appPromptInput",
    "#subsectionTitle",
    "#projectName",
    "#systemName",
    "#warrantyRevisionPreparedBy",
    "#libFileName",
    "#libDisplayTitle",
    "#mergedLibraryFileName",
    "#librarySearch",
    "#databaseSearch",
    "#converterSearch",
    "#partsSearchInput",
    "input[data-ghost-autocomplete]",
    "input.ghost-autocomplete-input"
  ];

  const activeInputs = new WeakMap();
  const customSuggestionSources = [];
  let observerStarted = false;

  function normalizeGhostSuggestion(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeForMatch(value) {
    return normalizeGhostSuggestion(value).toLowerCase();
  }

  function normalizeLooseMatch(value) {
    return normalizeForMatch(value).replace(/[^a-z0-9]+/g, "");
  }

  function registerGhostAutocompleteSource(source) {
    if (typeof source !== "function" || customSuggestionSources.includes(source)) return;
    customSuggestionSources.push(source);
  }

  function getSavedGhostSuggestions() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (error) {
      return [];
    }
  }

  function saveGhostAutocompleteSuggestion(value) {
    const clean = normalizeGhostSuggestion(value);
    if (!clean) return;

    const normalized = normalizeForMatch(clean);
    const suggestions = getSavedGhostSuggestions()
      .filter(item => normalizeForMatch(item) !== normalized);

    suggestions.unshift(clean);
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(suggestions.slice(0, MAX_SAVED_SUGGESTIONS))
    );
  }

  function addSuggestion(values, value) {
    const clean = normalizeGhostSuggestion(value);
    if (!clean) return;
    values.push(clean);
  }

  function addSuggestions(values, items) {
    (items || []).forEach(item => addSuggestion(values, item));
  }

  function getGlobalValue(name) {
    try {
      return Function("return typeof " + name + " !== 'undefined' ? " + name + " : undefined")();
    } catch (error) {
      return undefined;
    }
  }

  function collectGhostAutocompleteSuggestions() {
    const values = [];

    // Add more app-specific sources here later. Keep this function read-only.
    const pdfLibrary = getGlobalValue("pdfLibrary");
    if (Array.isArray(pdfLibrary)) {
      pdfLibrary.forEach(item => {
        addSuggestion(values, item.fileName);
        addSuggestion(values, item.displayTitle);
        addSuggestion(values, item.packetSection);
        addSuggestions(values, (item.tocEntries || []).map(entry => entry.title));
      });
    }

    const customSectionLabels = getGlobalValue("customSectionLabels");
    if (customSectionLabels && typeof customSectionLabels === "object") {
      addSuggestions(values, Object.values(customSectionLabels));
    }

    const templates = getGlobalValue("TOC_ENTRY_TEMPLATES");
    if (Array.isArray(templates)) {
      templates.forEach(template => {
        addSuggestion(values, template.name);
        addSuggestions(values, (template.entries || []).map(entry => entry.title));
      });
    }

    document.querySelectorAll("nav a, h1, h2, h3, summary, .uploaded-pdf-name, .uploaded-pdf-title, .toc-tree-title, .toc-template-level-name, .library-file-name, .library-display-title, .database-file-name, .database-display-title").forEach(el => {
      addSuggestion(values, el.textContent.replace(/^TOC Name:\s*/i, ""));
    });

    customSuggestionSources.forEach(source => {
      try {
        addSuggestions(values, source());
      } catch (error) {
        console.warn("Ghost autocomplete suggestion source skipped:", error);
      }
    });

    addSuggestions(values, getSavedGhostSuggestions());
    addSuggestions(values, FALLBACK_SUGGESTIONS);

    const seen = new Set();
    return values.filter(value => {
      const key = normalizeForMatch(value);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function fuzzyScore(typed, candidate) {
    let index = 0;
    let score = 0;

    for (const char of typed) {
      const found = candidate.indexOf(char, index);
      if (found === -1) return 0;
      score += Math.max(1, 12 - (found - index));
      index = found + 1;
    }

    return score - Math.max(0, candidate.length - typed.length) * 0.03;
  }

  function tokenScore(typed, candidate) {
    const typedTokens = normalizeForMatch(typed).split(" ").filter(Boolean);
    const candidateTokens = normalizeForMatch(candidate).split(" ").filter(Boolean);
    if (!typedTokens.length || !candidateTokens.length) return 0;

    const matched = typedTokens.filter(token =>
      candidateTokens.some(candidateToken => candidateToken.startsWith(token))
    ).length;
    return matched === typedTokens.length ? matched * 20 - candidateTokens.length : 0;
  }

  function getBestGhostSuggestion(value, suggestions) {
    const typed = normalizeGhostSuggestion(value);
    const typedMatch = normalizeForMatch(typed);
    if (typedMatch.length < 2) return "";

    const candidates = (suggestions || [])
      .map(normalizeGhostSuggestion)
      .filter(Boolean)
      .filter(candidate => normalizeForMatch(candidate) !== typedMatch);

    const prefixMatches = candidates
      .filter(candidate => normalizeForMatch(candidate).startsWith(typedMatch))
      .sort((a, b) => a.length - b.length || a.localeCompare(b));

    if (prefixMatches.length > 0) return prefixMatches[0];

    const containsMatches = candidates
      .filter(candidate => normalizeForMatch(candidate).includes(typedMatch))
      .sort((a, b) => normalizeForMatch(a).indexOf(typedMatch) - normalizeForMatch(b).indexOf(typedMatch) || a.length - b.length);

    if (containsMatches.length > 0) return containsMatches[0];

    const typedLoose = normalizeLooseMatch(typed);
    const looseMatches = candidates
      .filter(candidate => typedLoose.length >= 3 && normalizeLooseMatch(candidate).startsWith(typedLoose))
      .sort((a, b) => a.length - b.length || a.localeCompare(b));

    if (looseMatches.length > 0) return looseMatches[0];

    const tokenMatches = candidates
      .map(candidate => ({ candidate, score: tokenScore(typedMatch, candidate) }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score || a.candidate.length - b.candidate.length);

    if (tokenMatches.length > 0) return tokenMatches[0].candidate;

    const fuzzyMatches = candidates
      .map(candidate => ({ candidate, score: fuzzyScore(typedMatch, normalizeForMatch(candidate)) }))
      .filter(item => item.score > Math.max(1, typedMatch.length * 3))
      .sort((a, b) => b.score - a.score || a.candidate.length - b.candidate.length);

    return fuzzyMatches[0]?.candidate || "";
  }

  function isTextInput(input) {
    if (!(input instanceof HTMLInputElement)) return false;
    const type = (input.getAttribute("type") || "text").toLowerCase();
    return ["", "text", "search", "email", "url", "tel"].includes(type);
  }

  function getInputTextBeforeCaret(input) {
    const selectionStart = input.selectionStart ?? input.value.length;
    return input.value.slice(0, selectionStart);
  }

  function hasMiddleSelection(input) {
    return input.selectionStart !== input.selectionEnd;
  }

  function isCaretAtEnd(input) {
    return (input.selectionStart ?? input.value.length) === input.value.length;
  }

  function createOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "ghost-autocomplete-overlay";
    overlay.setAttribute("aria-hidden", "true");

    const prefix = document.createElement("span");
    prefix.className = "ghost-autocomplete-prefix";

    const suffix = document.createElement("span");
    suffix.className = "ghost-autocomplete-suffix";

    overlay.append(prefix, suffix);
    document.body.appendChild(overlay);
    return { overlay, prefix, suffix };
  }

  function copyInputTextStyles(input, overlay) {
    const computed = window.getComputedStyle(input);
    [
      "fontFamily",
      "fontSize",
      "fontStyle",
      "fontWeight",
      "letterSpacing",
      "lineHeight",
      "textTransform",
      "textAlign"
    ].forEach(prop => {
      overlay.style[prop] = computed[prop];
    });

    overlay.style.paddingTop = computed.paddingTop;
    overlay.style.paddingRight = computed.paddingRight;
    overlay.style.paddingBottom = computed.paddingBottom;
    overlay.style.paddingLeft = computed.paddingLeft;
  }

  function positionOverlay(input, state) {
    const rect = input.getBoundingClientRect();
    if (rect.bottom <= 0 || rect.top >= window.innerHeight || rect.right <= 0 || rect.left >= window.innerWidth) {
      state.overlay.classList.remove("is-visible");
      return;
    }
    state.overlay.style.left = rect.left + "px";
    state.overlay.style.top = rect.top + "px";
    state.overlay.style.width = rect.width + "px";
    state.overlay.style.height = rect.height + "px";
    state.overlay.style.transform = "translateX(" + (-input.scrollLeft) + "px)";
    copyInputTextStyles(input, state.overlay);
  }

  function getGhostSuggestionSuffix(typed, suggestion) {
    const typedMatch = normalizeForMatch(typed);
    const suggestionMatch = normalizeForMatch(suggestion);

    if (suggestion.toLowerCase().startsWith(String(typed || "").toLowerCase())) {
      return suggestion.slice(String(typed || "").length);
    }

    if (suggestionMatch.startsWith(typedMatch)) {
      const normalizedTypedLength = typedMatch.length;
      let seen = 0;

      for (let index = 0; index < suggestion.length; index += 1) {
        if (/\s/.test(suggestion[index])) {
          if (seen < normalizedTypedLength && typedMatch[seen] === " ") seen += 1;
          continue;
        }

        seen += 1;
        if (seen >= normalizedTypedLength) return suggestion.slice(index + 1);
      }
    }

    return "  " + suggestion;
  }

  function hideSuggestion(state) {
    state.suggestion = "";
    state.overlay.classList.remove("is-visible");
    state.prefix.textContent = "";
    state.suffix.textContent = "";
  }

  function updateSuggestion(input, state) {
    if (document.activeElement !== input || input.dataset.ghostAutocompleteDismissed === "true") {
      hideSuggestion(state);
      return;
    }

    if (hasMiddleSelection(input)) {
      hideSuggestion(state);
      return;
    }

    const typed = getInputTextBeforeCaret(input);
    const fullValue = input.value;
    if (typed !== fullValue) {
      hideSuggestion(state);
      return;
    }

    const suggestion = getBestGhostSuggestion(
      typed,
      (state.options.getSuggestions || collectGhostAutocompleteSuggestions)()
    );

    if (!suggestion) {
      hideSuggestion(state);
      return;
    }

    const suffix = getGhostSuggestionSuffix(typed, suggestion);
    if (!suffix) {
      hideSuggestion(state);
      return;
    }

    state.suggestion = suggestion;
    state.prefix.textContent = typed;
    state.suffix.textContent = suffix;
    positionOverlay(input, state);
    state.overlay.classList.add("is-visible");
  }

  function scheduleUpdate(input, state) {
    window.requestAnimationFrame(() => updateSuggestion(input, state));
  }

  function acceptSuggestion(input, state) {
    if (!state.suggestion) return false;

    input.value = state.suggestion;
    input.selectionStart = input.value.length;
    input.selectionEnd = input.value.length;
    saveGhostAutocompleteSuggestion(input.value);
    hideSuggestion(state);

    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  function enableGhostAutocomplete(input, options = {}) {
    if (!isTextInput(input) || activeInputs.has(input)) return input;

    const state = {
      options,
      suggestion: "",
      ...createOverlay()
    };

    activeInputs.set(input, state);
    input.dataset.ghostAutocomplete = "enabled";

    input.addEventListener("input", () => {
      input.dataset.ghostAutocompleteDismissed = "false";
      scheduleUpdate(input, state);
    });

    input.addEventListener("focus", () => {
      input.dataset.ghostAutocompleteDismissed = "false";
      scheduleUpdate(input, state);
    });

    input.addEventListener("blur", () => hideSuggestion(state));
    input.addEventListener("click", () => scheduleUpdate(input, state));
    input.addEventListener("scroll", () => positionOverlay(input, state));

    input.addEventListener("keydown", event => {
      if ((event.key === "Tab" || event.key === "ArrowRight") && state.suggestion && isCaretAtEnd(input)) {
        event.preventDefault();
        acceptSuggestion(input, state);
        return;
      }

      if (event.key === "Escape" && state.suggestion) {
        event.preventDefault();
        input.dataset.ghostAutocompleteDismissed = "true";
        hideSuggestion(state);
      }
    });

    window.addEventListener("resize", () => {
      if (document.activeElement === input) scheduleUpdate(input, state);
    });

    // Scroll events do not bubble, so capture them to follow both the page and
    // any scrolling panel that contains the input.
    window.addEventListener("scroll", () => {
      if (document.activeElement === input && state.suggestion) {
        positionOverlay(input, state);
      }
    }, { capture: true, passive: true });

    scheduleUpdate(input, state);
    return input;
  }

  function shouldAutoEnable(input, selectors = DEFAULT_SELECTORS) {
    if (!isTextInput(input)) return false;
    return selectors.some(selector => {
      try {
        return input.matches(selector);
      } catch (error) {
        return false;
      }
    });
  }

  function enableGhostAutocompleteFor(root = document, options = {}) {
    const selectors = options.selectors || DEFAULT_SELECTORS;
    root.querySelectorAll?.("input").forEach(input => {
      if (shouldAutoEnable(input, selectors)) {
        enableGhostAutocomplete(input, options);
      }
    });
  }

  function startGhostAutocompleteObserver(options = {}) {
    if (observerStarted) return;
    observerStarted = true;

    enableGhostAutocompleteFor(document, options);

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType !== Node.ELEMENT_NODE) return;

          if (node.matches?.("input") && shouldAutoEnable(node, options.selectors || DEFAULT_SELECTORS)) {
            enableGhostAutocomplete(node, options);
          }

          enableGhostAutocompleteFor(node, options);
        });
      });
    });

    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  window.enableGhostAutocomplete = enableGhostAutocomplete;
  window.collectGhostAutocompleteSuggestions = collectGhostAutocompleteSuggestions;
  window.saveGhostAutocompleteSuggestion = saveGhostAutocompleteSuggestion;
  window.registerGhostAutocompleteSource = registerGhostAutocompleteSource;
  window.normalizeGhostSuggestion = normalizeGhostSuggestion;
  window.getBestGhostSuggestion = getBestGhostSuggestion;
  window.enableGhostAutocompleteFor = enableGhostAutocompleteFor;
  window.startGhostAutocompleteObserver = startGhostAutocompleteObserver;

  document.addEventListener("DOMContentLoaded", () => {
    startGhostAutocompleteObserver();
  });
})();
