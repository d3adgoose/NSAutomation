document.addEventListener("DOMContentLoaded", () => {
  enableAppWideSpellcheck(document);
  observeDynamicSpellcheckFields();

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
    link.addEventListener("click", () => {
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
});

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
