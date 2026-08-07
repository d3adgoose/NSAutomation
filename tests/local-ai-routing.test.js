const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "specification.html"), "utf8");
const peerHtml = fs.readFileSync(path.join(root, "peer-review.html"), "utf8");
const sharedClient = fs.readFileSync(path.join(root, "local-ai-client.js"), "utf8");
const specificationAi = fs.readFileSync(path.join(root, "specification-ai.js"), "utf8");
const peerReview = fs.readFileSync(path.join(root, "peer-review.js"), "utf8");
const localAiServer = fs.readFileSync(path.join(root, "local-ai-server.js"), "utf8");
const localAiSetup = fs.readFileSync(path.join(root, "Set Up NS Local AI.cmd"), "utf8");
const gitignore = fs.readFileSync(path.join(root, ".gitignore"), "utf8");
const redirectIndex = html.indexOf('location.port !== "4173"');
const firstExternalScriptIndex = html.indexOf('src="https://');
const peerRedirectIndex = peerHtml.indexOf('location.port !== "4173"');
const peerFirstExternalScriptIndex = peerHtml.indexOf('src="https://');

assert(redirectIndex >= 0, "Specification must route local development to the Local AI gateway.");
assert(
  redirectIndex < firstExternalScriptIndex,
  "Local AI routing must run before Specification libraries and project data initialize."
);
assert(peerRedirectIndex >= 0 && peerRedirectIndex < peerFirstExternalScriptIndex,
  "Peer Review must route local development through the no-cache Local AI gateway before loading libraries.");
assert(peerHtml.includes("OllamaSetup.exe") && peerHtml.includes("qwen3-vl:8b-instruct") && peerHtml.includes(".gitignore"),
  "Peer Review setup guidance must identify the Windows installer, approved model, and repository-safety rules.");
assert(localAiSetup.includes("OllamaSetup.exe") && localAiSetup.includes("%USERPROFILE%\\.ollama\\models"),
  "Local AI setup must explain the supported Ollama installer and default Windows model location.");
assert(gitignore.includes(".ollama/") && gitignore.includes("ollama-models/") && gitignore.includes("tmp/") && gitignore.includes("acad.err"),
  "Git ignore rules must protect local models, generated reviews, and AutoCAD runtime errors.");
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
assert(localAiServer.includes("warmLocalAiModel") && localAiServer.includes('`${OLLAMA_URL}/api/generate`') && localAiServer.includes('prompt: ""'),
  "The Local AI readiness check must warm the selected model before the user starts a review.");
assert(localAiServer.includes("authenticatedUserCache") && localAiServer.includes("selectedModelCache"),
  "Repeated review requests must reuse short-lived authentication and installed-model checks.");
assert(localAiServer.includes('requestedTier === "quality"') && localAiServer.includes('body.modelTier === "quality"'),
  "The Local AI gateway must support explicit fast-versus-quality model routing.");
assert(localAiServer.includes('selected.tier === "quality" ? 12288 : 24576') && localAiServer.includes("usedModelFallback"),
  "Quality requests must use a GPU-safe context cap and report automatic fallback behavior.");
assert(localAiServer.includes('/api/cad-peer-review') && localAiServer.includes('handleCadPeerReview(req, res)'),
  "The local gateway must expose native DWG conversion for Peer Review.");
assert(localAiServer.includes('searchParams.get("filename")') && localAiServer.includes('accoreconsole.exe'),
  "DWG conversion must accept the source filename and use the installed AutoCAD Core Console.");
assert(!localAiServer.includes('X-File-Name'),
  "DWG conversion must avoid unnecessary custom request headers that trigger stricter CORS preflights.");
assert(localAiServer.includes("parseCadRecord") && localAiServer.includes("buildCadModelSheetTargets"),
  "DWG conversion must tolerate AutoCAD formatting escapes and detect stacked Model-space sheets.");
assert(localAiServer.includes("repairCadJsonEscapes") && localAiServer.includes("slashes.length % 2"),
  "DWG parsing must preserve valid doubled AutoCAD formatting slashes while repairing invalid single escapes.");
assert(localAiServer.includes('searchParams.get("reference") === "1"') && localAiServer.includes("referenceOnly: true"),
  "Knowledge Library DWGs must stop after native extraction instead of spending time plotting review PDFs.");
assert(localAiServer.includes("application/x-ndjson") && localAiServer.includes('writeProgress("progress"'),
  "DWG conversion must stream extraction and plotting progress instead of appearing stalled.");
assert(localAiServer.includes("AutoCAD PDF (Smallest File).pc3") && localAiServer.includes("preparing the first sheet") && localAiServer.includes("res.flushHeaders()"),
  "DWG plotting must use the verified fast PDF preset and flush live AutoCAD heartbeat messages.");
assert(localAiServer.includes('target.fileName = `sheet-${String(index + 1).padStart(2, "0")}.pdf`'),
  "AutoCAD plot output must use short filenames because long descriptive sheet filenames can stall the PDF driver.");
assert(localAiServer.includes("handleCadPeerProgress") && localAiServer.includes("cadPeerProgressJobs") && localAiServer.includes('process.env.LOCALAPPDATA'),
  "DWG conversion must expose separately polled progress and avoid AutoCAD's short temporary path.");
assert(localAiServer.includes('status: "pending"') && localAiServer.includes("if (!job) return send(res, 200"),
  "The first progress poll must tolerate arriving before the DWG POST creates its progress record.");
assert(sharedClient.includes('const GATEWAY_ORIGIN = "http://127.0.0.1:4173"'),
  "The shared Local AI connector must route deployed pages to the local gateway.");
assert(sharedClient.includes('["loopback", "local"]') && sharedClient.includes("detectTargetAddressSpace"),
  "The shared connector must support Chrome's loopback/local address-space naming across versions.");
assert(sharedClient.includes("getSessionToken") && sharedClient.includes('headers.set("Authorization"'),
  "The shared connector must apply the Database session to every Local AI request.");
assert(html.indexOf("local-ai-client.js") >= 0 && html.indexOf("local-ai-client.js") < html.indexOf("specification-ai.js"),
  "Specification must load the shared Local AI connector before its AI workflow.");
assert(peerHtml.indexOf("local-ai-client.js") >= 0 && peerHtml.indexOf("local-ai-client.js") < peerHtml.indexOf("peer-review.js"),
  "Peer Review must load the shared Local AI connector before its AI workflow.");
assert(peerHtml.includes('.dwg') && peerReview.includes('handlePeerDwg') && peerReview.includes('runPeerCadRules'),
  "Peer Review must accept DWG drawings and run native CAD tag/table checks.");
assert(peerHtml.includes("Reference Drawing Context") && peerReview.includes("prior-drawing-context") && peerReview.includes("never a requirement"),
  "Prior DWGs in the Knowledge Library must be labeled as context, not requirement proof.");
assert(peerReview.includes("extractPeerStructuredRequirements") && peerReview.includes("STRUCTURED APPROVED REQUIREMENTS"),
  "Datasheets must be pre-indexed into explicit requirements before visual AI review.");
assert(peerReview.includes("readPeerCadProgressResponse") && peerReview.includes("reportPeerDrawingRead") && peerReview.includes("Reading ${sourceLabel.toLowerCase()} page"),
  "Peer Review must display live read progress for both streamed DWG conversion and PDF pages.");
assert(peerReview.includes("pollPeerCadProgress") && peerReview.includes("/api/cad-peer-progress?requestId="),
  "Peer Review must poll DWG progress independently so browser response buffering cannot hide activity updates.");
assert(peerReview.includes("[401, 403, 503].includes(response.status)"),
  "DWG progress polling must stop after an authentication or gateway failure instead of flooding the console.");
assert(specificationAi.includes("window.NSLocalAIClient.fetch") && peerReview.includes("fetchPeerLocalAi"),
  "Specification and Peer Review must both use the shared Local AI connector.");
assert(peerReview.includes('modelTier: "quality"') && peerReview.includes("recordPeerAiModelUsage"),
  "Peer Review must route difficult visual passes to the quality model and report the model used.");
assert(localAiSetup.includes("qwen3-vl:30b-a3b-instruct") && peerHtml.includes("qwen3-vl:30b-a3b-instruct"),
  "Local AI setup and Peer Review guidance must include the optional quality model.");
assert(!specificationAi.includes("targetAddressSpace") && !peerReview.includes("targetAddressSpace"),
  "Feature pages must not maintain separate deployed-to-local address-space logic.");
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
