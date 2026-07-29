const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "specification.html"), "utf8");
const localAiServer = fs.readFileSync(path.join(root, "local-ai-server.js"), "utf8");
const redirectIndex = html.indexOf('location.port !== "4173"');
const firstExternalScriptIndex = html.indexOf('src="https://');

assert(redirectIndex >= 0, "Specification must route local development to the Local AI gateway.");
assert(
  redirectIndex < firstExternalScriptIndex,
  "Local AI routing must run before Specification libraries and project data initialize."
);
assert(
  html.includes("location.pathname") &&
  html.includes("location.search") &&
  html.includes("location.hash"),
  "Local AI routing must preserve the current Specification URL."
);
assert(localAiServer.includes("worker-src 'self' blob: https://cdnjs.cloudflare.com"),
  "The local gateway CSP must allow the configured PDF.js worker.");
assert(localAiServer.includes('req.method === "DELETE"') && localAiServer.includes("activeOllamaControllers"),
  "Canceling Local AI must abort the active Ollama request on the local gateway.");
assert(html.includes('pdfjsLib.GlobalWorkerOptions.workerSrc = "vendor-pdf.worker.min.js?v=3.11.174"'),
  "Specification PDF.js must use the same-origin worker to avoid CSP blob-worker failures.");
assert(fs.existsSync(path.join(root, "vendor-pdf.worker.min.js")),
  "The same-origin PDF.js worker asset must exist.");
const progressIndex = html.indexOf('id="specAiProgress"');
const projectPanelIndex = html.indexOf('id="specTab-project"');
assert(progressIndex >= 0 && progressIndex < projectPanelIndex,
  "Local AI progress must remain outside the numbered tab panels so it stays visible while users work in steps 1, 3, or 4.");

const inlineScript = html.match(/<script>\s*([\s\S]*?)\s*<\/script>/)?.[1] || "";

function runRouting(location) {
  let redirectedTo = "";
  const context = {
    location: {
      ...location,
      replace(url) { redirectedTo = url; }
    }
  };
  vm.runInNewContext(inlineScript, context);
  return redirectedTo;
}

assert.strictEqual(
  runRouting({
    hostname: "127.0.0.1",
    port: "5500",
    pathname: "/specification.html",
    search: "?continue=1",
    hash: "#sources"
  }),
  "http://127.0.0.1:4173/specification.html?continue=1#sources"
);
assert.strictEqual(
  runRouting({
    hostname: "127.0.0.1",
    port: "4173",
    pathname: "/specification.html",
    search: "",
    hash: ""
  }),
  ""
);
assert.strictEqual(
  runRouting({
    hostname: "d3adgoose.github.io",
    port: "",
    pathname: "/NSAutomation/specification.html",
    search: "",
    hash: ""
  }),
  ""
);

console.log("Local AI same-origin routing checks passed.");
