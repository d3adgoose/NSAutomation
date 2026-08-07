"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");
const os = require("os");
const crypto = require("crypto");
const { spawn } = require("child_process");

const ROOT = __dirname;
const PORT = Number(process.env.NS_AUTOMATION_PORT || 4173);
const OLLAMA_URL = "http://127.0.0.1:11434";
const FAST_MODEL = "qwen3-vl:8b-instruct";
const FALLBACK_MODEL = "qwen3-vl:30b-a3b-instruct";
const SUPABASE_URL = "https://yidinujmeuztqohwxfxs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LVvQQpJHxeif-zmJjIJy8w_jDV_MXX4";
const MAX_REQUEST_BYTES = 28 * 1024 * 1024;
const MAX_DWG_BYTES = 80 * 1024 * 1024;
const activeOllamaControllers = new Map();
const cadPeerProgressJobs = new Map();
const authenticatedUserCache = new Map();
const AUTHENTICATED_USER_CACHE_MS = 2 * 60 * 1000;
const SELECTED_MODEL_CACHE_MS = 30 * 1000;
let selectedModelCache = null;
let localAiWarmupPromise = null;
const ALLOWED_BROWSER_ORIGINS = new Set([
  "http://127.0.0.1:5500",
  "http://localhost:5500",
  "https://d3adgoose.github.io",
  `http://127.0.0.1:${PORT}`,
  `http://localhost:${PORT}`
]);

const MIME = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".pdf": "application/pdf", ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
};

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.jsdelivr.net/npm/ https://yidinujmeuztqohwxfxs.supabase.co; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; worker-src 'self' blob: https://cdnjs.cloudflare.com https://unpkg.com https://cdn.jsdelivr.net; connect-src 'self' data: blob: https://unpkg.com https://cdn.jsdelivr.net https://tessdata.projectnaptha.com https://yidinujmeuztqohwxfxs.supabase.co"
  });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}

async function authenticatedUser(req) {
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return null;
  const cacheKey = crypto.createHash("sha256").update(authorization).digest("hex");
  const now = Date.now();
  const cached = authenticatedUserCache.get(cacheKey);
  if (cached?.expiresAt > now) return cached.user;
  if (cached) authenticatedUserCache.delete(cacheKey);
  let response;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      headers: { authorization, apikey: SUPABASE_ANON_KEY }
    });
  } catch (cause) {
    const error = new Error("The local background service could not reach the Database login service. Check the internet connection, then restart NS Local AI Background.");
    error.status = 503;
    error.cause = cause;
    throw error;
  }
  if (!response.ok) return null;
  const user = await response.json();
  authenticatedUserCache.set(cacheKey, { user, expiresAt: now + AUTHENTICATED_USER_CACHE_MS });
  if (authenticatedUserCache.size > 24) {
    for (const [key, entry] of authenticatedUserCache) {
      if (entry.expiresAt <= now || authenticatedUserCache.size > 16) authenticatedUserCache.delete(key);
    }
  }
  return user;
}

async function selectLocalAiModel(requestedTier = "fast") {
  const now = Date.now();
  let installed;
  if (selectedModelCache?.expiresAt > now) {
    installed = selectedModelCache.value;
  } else {
    const response = await fetch(`${OLLAMA_URL}/api/tags`);
    if (!response.ok) throw new Error("Ollama is not available.");
    const data = await response.json();
    installed = new Set((data.models || []).flatMap(item => [item.name, item.model]).filter(Boolean));
    selectedModelCache = { value: installed, expiresAt: now + (installed.size ? SELECTED_MODEL_CACHE_MS : 3000) };
  }
  const wantsQuality = requestedTier === "quality";
  const qualityReady = installed.has(FALLBACK_MODEL);
  const fastReady = installed.has(FAST_MODEL);
  const model = wantsQuality && qualityReady ? FALLBACK_MODEL : fastReady ? FAST_MODEL : qualityReady ? FALLBACK_MODEL : FAST_MODEL;
  const tier = model === FALLBACK_MODEL ? "quality" : "fast";
  return {
    ready: fastReady || qualityReady,
    model,
    tier,
    requestedTier: wantsQuality ? "quality" : "fast",
    preferred: tier === "fast",
    usedFallback: wantsQuality && !qualityReady && fastReady,
    fastModel: fastReady ? FAST_MODEL : "",
    qualityModel: qualityReady ? FALLBACK_MODEL : "",
    qualityReady
  };
}

function warmLocalAiModel(model) {
  if (!model || localAiWarmupPromise) return localAiWarmupPromise;
  localAiWarmupPromise = fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt: "", stream: false, keep_alive: "30m" })
  }).then(response => {
    if (!response.ok) throw new Error(`Ollama warmup returned ${response.status}.`);
    return response.json();
  }).catch(error => {
    console.warn(`Local AI model warmup did not finish: ${error.message}`);
    return null;
  }).finally(() => { localAiWarmupPromise = null; });
  return localAiWarmupPromise;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > MAX_REQUEST_BYTES) {
        reject(Object.assign(new Error("AI request is too large."), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { reject(Object.assign(new Error("Invalid request."), { status: 400 })); }
    });
    req.on("error", reject);
  });
}

function readBinary(req, maximumBytes = MAX_DWG_BYTES) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", chunk => {
      size += chunk.length;
      if (size > maximumBytes) { reject(Object.assign(new Error("The DWG exceeds the 80 MB local conversion limit."), { status: 413 })); req.destroy(); return; }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function findAutoCadCoreConsole() {
  const autodeskRoot = "C:\\Program Files\\Autodesk";
  const discovered = fs.existsSync(autodeskRoot) ? fs.readdirSync(autodeskRoot, { withFileTypes: true })
    .filter(entry => entry.isDirectory() && /^AutoCAD 20\d{2}$/i.test(entry.name))
    .sort((left, right) => right.name.localeCompare(left.name, undefined, { numeric: true }))
    .map(entry => path.join(autodeskRoot, entry.name, "accoreconsole.exe")) : [];
  const candidates = [...discovered,
    "C:\\Program Files\\Autodesk\\AutoCAD 2025\\accoreconsole.exe",
    "C:\\Program Files\\Autodesk\\AutoCAD 2023\\accoreconsole.exe"
  ];
  return candidates.find(candidate => fs.existsSync(candidate)) || "";
}

function runCadConsole(executable, drawingPath, scriptPath, environment, timeoutMs = 240000, onHeartbeat = null) {
  return new Promise((resolve, reject) => {
    const child = spawn(executable, ["/i", drawingPath, "/s", scriptPath, "/l", "en-US"], {
      cwd: path.dirname(scriptPath), windowsHide: true, env: { ...process.env, ...environment }, stdio: ["ignore", "pipe", "pipe"]
    });
    let output = "", errorOutput = "", finished = false, timedOut = false;
    const startedAt = Date.now();
    const timer = setTimeout(() => { if (!finished) { timedOut = true; child.kill(); } }, timeoutMs);
    const heartbeat = onHeartbeat ? setInterval(() => {
      try { onHeartbeat(Math.max(1, Math.round((Date.now() - startedAt) / 1000))); } catch {}
    }, 15000) : null;
    child.stdout.on("data", chunk => { output = `${output}${chunk.toString("utf16le")}`.slice(-12000); });
    child.stderr.on("data", chunk => { errorOutput = `${errorOutput}${chunk.toString()}`.slice(-6000); });
    child.on("error", error => { clearTimeout(timer); if (heartbeat) clearInterval(heartbeat); finished = true; reject(error); });
    child.on("close", code => {
      clearTimeout(timer); if (heartbeat) clearInterval(heartbeat); finished = true;
      if (timedOut) return reject(new Error(`AutoCAD conversion exceeded ${Math.round(timeoutMs / 1000)} seconds.`));
      if (code === 0) resolve(output);
      else reject(new Error(`AutoCAD Core Console stopped with code ${code}. ${errorOutput || output}`.replace(/\0/g, "").slice(-1200)));
    });
  });
}

function safeCadScriptValue(value) { return String(value || "").replace(/[\r\n]/g, " ").trim(); }
function cadScriptPath(value) { return path.resolve(value).replace(/\\/g, "/"); }

function repairCadJsonEscapes(line = "") {
  // Preserve valid doubled AutoCAD formatting slashes and only repair invalid
  // odd-length runs. The former per-slash replacement discarded large tables.
  return String(line).replace(/\\+(?=[^"\\/bfnrtu])/g, slashes => slashes.length % 2 ? slashes + "\\" : slashes);
}

function parseCadRecord(line) {
  try { return JSON.parse(line); }
  catch {
    try { return JSON.parse(repairCadJsonEscapes(line)); }
    catch { return null; }
  }
}

function buildCadModelSheetTargets(records) {
  const attributesByHandle = new Map();
  records.filter(item => item.record === "block_attribute").forEach(attribute => {
    if (!attributesByHandle.has(attribute.handle)) attributesByHandle.set(attribute.handle, new Map());
    const attributes = attributesByHandle.get(attribute.handle), tag = String(attribute.tag || "").toUpperCase();
    if (tag && !attributes.has(tag)) attributes.set(tag, safeCadScriptValue(attribute.value));
  });
  return records.filter(item => item.record === "entity" && item.type === "INSERT" && /TITLE\s*BLOCK|DRAWING\s*BORDER/i.test(item.name || "") && Array.isArray(item.bounds) && item.bounds.length === 4)
    .map((entity, index) => {
      const attributes = attributesByHandle.get(entity.handle) || new Map(), sheetText = attributes.get("#_OF_#") || "", sheetNumber = Number(sheetText.match(/^\s*(\d+)/)?.[1] || 0);
      const drawingNumber = attributes.get("WS-#.#") || "", title = attributes.get("TYPE_OF_LAYOUT") || "";
      const name = [sheetNumber ? `Sheet ${sheetNumber}` : `Model sheet ${index + 1}`, drawingNumber, title].filter(Boolean).join(" - ");
      return { kind: "model-window", name, bounds: entity.bounds.map(Number), sheetNumber, drawingNumber, title, handle: entity.handle };
    })
    .filter(item => item.bounds.every(Number.isFinite) && item.bounds[2] > item.bounds[0] && item.bounds[3] > item.bounds[1])
    .sort((left, right) => (left.sheetNumber || 9999) - (right.sheetNumber || 9999) || right.bounds[1] - left.bounds[1]);
}

function getCadPeerUserKey(user = {}) {
  return String(user.id || user.email || "signed-in-user");
}

function scheduleCadPeerProgressCleanup(requestId) {
  if (!requestId) return;
  const timer = setTimeout(() => cadPeerProgressJobs.delete(requestId), 5 * 60 * 1000);
  timer.unref?.();
}

async function handleCadPeerProgress(req, res) {
  if (req.method !== "GET") return send(res, 405, { error: "Method not allowed." });
  const user = await authenticatedUser(req);
  if (!user) return send(res, 401, { error: "Sign in with the Database login before reading DWG progress." });
  const requestId = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`).searchParams.get("requestId") || "";
  const job = cadPeerProgressJobs.get(requestId);
  // The browser begins polling immediately after starting the POST. On a busy
  // machine the first GET can reach Node before the POST has registered its
  // progress record; report a pending state instead of a noisy false 404.
  if (!job) return send(res, 200, { status: "pending", messages: [], error: "", updatedAt: new Date().toISOString() });
  if (job.userKey !== getCadPeerUserKey(user)) return send(res, 404, { error: "DWG progress is not available." });
  send(res, 200, { status: job.status, messages: job.messages, error: job.error || "", updatedAt: job.updatedAt });
}

async function handleCadPeerReview(req, res) {
  const user = await authenticatedUser(req);
  if (!user) return send(res, 401, { error: "Sign in with the Database login before converting a DWG." });
  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
  const executable = findAutoCadCoreConsole();
  if (!executable) return send(res, 503, { error: "AutoCAD Core Console 2023 or newer is required for local DWG peer review." });
  const requestUrl = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);
  const requestId = requestUrl.searchParams.get("requestId") || "";
  const progressJob = requestId ? { userKey: getCadPeerUserKey(user), status: "running", messages: [], error: "", updatedAt: new Date().toISOString() } : null;
  if (progressJob) cadPeerProgressJobs.set(requestId, progressJob);
  const bytes = await readBinary(req);
  if (bytes.length < 6 || !bytes.subarray(0, 6).toString("ascii").startsWith("AC10")) {
    if (progressJob) { progressJob.status = "error"; progressJob.error = "The uploaded file is not a readable AutoCAD DWG."; scheduleCadPeerProgressCleanup(requestId); }
    return send(res, 400, { error: "The uploaded file is not a readable AutoCAD DWG." });
  }
  const streamProgress = requestUrl.searchParams.get("progress") === "1";
  const writeProgress = (type, value) => {
    if (progressJob) {
      progressJob.updatedAt = new Date().toISOString();
      if (type === "progress") progressJob.messages.push(String(value || "").slice(0, 500));
      else if (type === "error") { progressJob.status = "error"; progressJob.error = String(value || "").slice(0, 1000); scheduleCadPeerProgressCleanup(requestId); }
      else if (type === "result") { progressJob.status = "complete"; scheduleCadPeerProgressCleanup(requestId); }
      if (progressJob.messages.length > 100) progressJob.messages.splice(0, progressJob.messages.length - 100);
    }
    if (!streamProgress || res.writableEnded) return;
    const padding = type === "progress" ? `${" ".repeat(1024)}\n` : "";
    res.write(`${JSON.stringify(type === "result" ? { type, payload: value } : type === "error" ? { type, error: value } : { type, message: value })}\n${padding}`);
  };
  if (streamProgress) {
    res.socket?.setNoDelay(true);
    res.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Accel-Buffering": "no"
    });
    res.flushHeaders();
  }
  writeProgress("progress", `DWG upload received (${(bytes.length / 1024 / 1024).toFixed(1)} MB). Starting AutoCAD native-object extraction.`);
  const cadWorkspaceRoot = path.join(process.env.LOCALAPPDATA || os.homedir(), "NSAutomation", "cad-work");
  fs.mkdirSync(cadWorkspaceRoot, { recursive: true });
  const workspace = fs.mkdtempSync(path.join(cadWorkspaceRoot, "job-"));
  const drawingPath = path.join(workspace, "drawing.dwg"), outputPath = path.join(workspace, "cad.ndjson"), plotsPath = path.join(workspace, "plots");
  try {
    fs.writeFileSync(drawingPath, bytes); fs.mkdirSync(plotsPath, { recursive: true });
    const extractionScript = path.join(workspace, "extract.scr");
    fs.writeFileSync(extractionScript, `(setvar "SECURELOAD" 0)\r\n(load "${cadScriptPath(path.join(ROOT, "cad-peer-extract.lsp"))}")\r\n_.QUIT\r\n_Y\r\n`);
    await runCadConsole(executable, drawingPath, extractionScript, { NS_CAD_OUTPUT: outputPath, NS_CAD_PLOT_DIR: plotsPath }, 120000,
      seconds => writeProgress("progress", `AutoCAD is still reading native objects (${seconds} seconds elapsed).`));
    if (!fs.existsSync(outputPath)) throw new Error("AutoCAD did not produce structured drawing data.");
    const records = fs.readFileSync(outputPath, "utf8").split(/\r?\n/).filter(Boolean).map(parseCadRecord).filter(Boolean);
    writeProgress("progress", `Native CAD extraction complete. ${records.length.toLocaleString()} objects read; locating drawing sheets and title blocks.`);
    const paperLayouts = Array.from(new Set(records.filter(item => item.record === "layout").map(item => safeCadScriptValue(item.name)).filter(name => name && name.toUpperCase() !== "MODEL")));
    const modelSheets = paperLayouts.length ? [] : buildCadModelSheetTargets(records);
    const targets = paperLayouts.length ? paperLayouts.map(name => ({ kind: "layout", name })) : modelSheets;
    if (!targets.length) throw new Error("The DWG has no paper-space layouts or identifiable Model-space title blocks to review.");
    if (requestUrl.searchParams.get("reference") === "1") {
      const payload = {
        filename: safeCadScriptValue(requestUrl.searchParams.get("filename") || "reference.dwg"),
        fingerprint: crypto.createHash("sha256").update(bytes).digest("hex"), records,
        layouts: targets.map(target => target.name), sheets: modelSheets, pdfs: [],
        converter: path.basename(path.dirname(executable)), referenceOnly: true
      };
      writeProgress("result", payload);
      if (!streamProgress) send(res, 200, payload); else res.end();
      return;
    }
    writeProgress("progress", `${targets.length} drawing sheet${targets.length === 1 ? "" : "s"} found. AutoCAD is plotting review PDFs.`);
    const plotScript = path.join(workspace, "plot.scr");
    const plotCommands = targets.map((target, index) => {
      target.fileName = `sheet-${String(index + 1).padStart(2, "0")}.pdf`;
      const outputFile = cadScriptPath(path.join(plotsPath, target.fileName));
      if (target.kind === "layout") return `_.-PLOT\r\n_N\r\n${target.name}\r\n\r\nAutoCAD PDF (Smallest File).pc3\r\n${outputFile}\r\n_N\r\n_Y`;
      const [minimumX, minimumY, maximumX, maximumY] = target.bounds;
      return `_.-PLOT\r\n_Y\r\nModel\r\nAutoCAD PDF (Smallest File).pc3\r\nARCH full bleed D (36.00 x 24.00 Inches)\r\nInches\r\nLandscape\r\n_N\r\nWindow\r\n${minimumX},${minimumY}\r\n${maximumX},${maximumY}\r\nFit\r\nCenter\r\n_Y\r\nmonochrome.ctb\r\n_Y\r\n\r\n${outputFile}\r\n_N\r\n_Y`;
    }).join("\r\n");
    fs.writeFileSync(plotScript, `(setvar "FILEDIA" 0)\r\n${plotCommands}\r\n_.QUIT\r\n_Y\r\n`);
    await runCadConsole(executable, drawingPath, plotScript, {}, Math.max(90000, targets.length * 18000), seconds => {
      let plotted = 0;
      try { plotted = fs.readdirSync(plotsPath).filter(name => /\.pdf$/i.test(name)).length; } catch {}
      writeProgress("progress", `AutoCAD is still plotting (${seconds} seconds elapsed${plotted ? `; ${plotted} of ${targets.length} PDF files created` : "; preparing the first sheet"}).`);
    });
    writeProgress("progress", `AutoCAD plotting complete. Packaging ${targets.length} plotted sheet${targets.length === 1 ? "" : "s"} for the browser.`);
    const pdfs = targets.flatMap(target => {
      const pdfPath = path.join(plotsPath, target.fileName);
      return fs.existsSync(pdfPath) && fs.statSync(pdfPath).size ? [{ layout: target.name, data: fs.readFileSync(pdfPath).toString("base64") }] : [];
    });
    if (!pdfs.length) throw new Error("AutoCAD extracted the CAD entities but could not plot the layouts to PDF.");
    const requestedFilename = requestUrl.searchParams.get("filename");
    const payload = {
      filename: safeCadScriptValue(requestedFilename || "drawing.dwg"),
      fingerprint: crypto.createHash("sha256").update(bytes).digest("hex"), records, layouts: targets.map(target => target.name), sheets: modelSheets, pdfs,
      converter: path.basename(path.dirname(executable))
    };
    if (streamProgress) {
      writeProgress("progress", `Sending ${pdfs.length} plotted sheet${pdfs.length === 1 ? "" : "s"} and the native CAD index to Peer Review.`);
      writeProgress("result", payload);
      res.end();
    } else {
      writeProgress("result", payload);
      send(res, 200, payload);
    }
  } catch (error) {
    writeProgress("error", error.message || "The DWG conversion could not be completed.");
    if (!streamProgress) throw error;
    res.end();
  } finally {
    try { fs.rmSync(workspace, { recursive: true, force: true }); } catch {}
  }
}

async function handleAi(req, res) {
  const user = await authenticatedUser(req);
  if (!user) return send(res, 401, { error: "Sign in with the Database login before using local AI." });
  const userKey = String(user.id || user.email || "signed-in-user");

  if (req.method === "DELETE") {
    const controllers = activeOllamaControllers.get(userKey) || new Set();
    controllers.forEach(controller => controller.abort());
    activeOllamaControllers.delete(userKey);
    return send(res, 200, { canceled: controllers.size });
  }

  if (req.method === "GET") {
    const selected = await selectLocalAiModel("fast");
    let loaded = false;
    try {
      const runningResponse = await fetch(`${OLLAMA_URL}/api/ps`);
      const running = runningResponse.ok ? await runningResponse.json() : {};
      loaded = (running.models || []).some(item => item.name === selected.model || item.model === selected.model);
    } catch { /* Installed status remains useful if the running-model check fails. */ }
    if (selected.ready && !loaded) void warmLocalAiModel(selected.model);
    return send(res, 200, { ...selected, loaded, user: user.email || user.id });
  }

  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
  const body = await readJson(req);
  if (!Array.isArray(body.messages) || !body.messages.length) return send(res, 400, { error: "No analysis content was provided." });
  const requestedTier = body.modelTier === "quality" ? "quality" : "fast";
  const selected = await selectLocalAiModel(requestedTier);
  if (!selected.ready) return send(res, 503, { error: `Install ${FAST_MODEL} in Ollama before using Local AI.` });

  const ollamaController = new AbortController();
  if (!activeOllamaControllers.has(userKey)) activeOllamaControllers.set(userKey, new Set());
  activeOllamaControllers.get(userKey).add(ollamaController);
  const cancelOllamaIfBrowserLeft = () => {
    if (!res.writableEnded) ollamaController.abort();
  };
  res.once("close", cancelOllamaIfBrowserLeft);
  let response;
  try {
    const maximumContext = selected.tier === "quality" ? 12288 : 24576;
    const maximumPrediction = selected.tier === "quality" ? 5000 : 8192;
    response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      signal: ollamaController.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: selected.model,
        messages: body.messages,
        format: body.format || "json",
        stream: false,
        think: false,
        keep_alive: "30m",
        options: {
          temperature: 0.1,
          seed: 7 + Math.max(0, Number(body.retryAttempt) || 0),
          num_ctx: Math.min(maximumContext, Math.max(8192, Number(body.numCtx) || (selected.tier === "quality" ? 12288 : 16384))),
          num_predict: Math.min(maximumPrediction, Math.max(1024, Number(body.maxTokens) || 4096))
        }
      })
    });
  } catch (error) {
    if (error?.name === "AbortError") return;
    throw Object.assign(new Error("Ollama stopped responding. Restart Ollama and the NS Local AI Background service, then resume this source."), { status: 503 });
  } finally {
    res.removeListener("close", cancelOllamaIfBrowserLeft);
    const controllers = activeOllamaControllers.get(userKey);
    controllers?.delete(ollamaController);
    if (!controllers?.size) activeOllamaControllers.delete(userKey);
  }
  if (!response.ok) {
    const responseText = await response.text().catch(() => "");
    let ollamaMessage = responseText;
    try {
      const parsed = JSON.parse(responseText);
      ollamaMessage = parsed.error || parsed.message || responseText;
    } catch { /* Ollama may return plain text. */ }
    const detail = String(ollamaMessage || "").replace(/\s+/g, " ").trim().slice(0, 600);
    throw Object.assign(new Error(`Ollama returned ${response.status}${detail ? `: ${detail}` : "."}`), { status: 502 });
  }
  const result = await response.json();
  send(res, 200, {
    model: selected.model,
    modelTier: selected.tier,
    requestedModelTier: selected.requestedTier,
    usedModelFallback: selected.usedFallback,
    user: user.email || user.id,
    content: result.message?.content || ""
  });
}

function serveFile(req, res) {
  const pathname = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const requested = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.resolve(ROOT, `.${requested}`);
  if (!filePath.startsWith(`${ROOT}${path.sep}`) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    return send(res, 404, "Not found", "text/plain; charset=utf-8");
  }
  send(res, 200, fs.readFileSync(filePath), MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream");
}

const server = http.createServer(async (req, res) => {
  try {
    const origin = String(req.headers.origin || "");
    if (ALLOWED_BROWSER_ORIGINS.has(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    if (req.method === "OPTIONS") return send(res, 204, "", "text/plain; charset=utf-8");
    if (req.url.startsWith("/api/cad-peer-progress")) return await handleCadPeerProgress(req, res);
    if (req.url.startsWith("/api/cad-peer-review")) return await handleCadPeerReview(req, res);
    if (req.url.startsWith("/api/local-ai")) return await handleAi(req, res);
    if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method not allowed", "text/plain; charset=utf-8");
    serveFile(req, res);
  } catch (error) {
    console.error(error);
    send(res, error.status || 502, { error: error.message || "Local AI request failed." });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`N/S Automation is available at http://127.0.0.1:${PORT}`);
  console.log(`Fast Local AI model: ${FAST_MODEL}`);
  console.log(`Quality Local AI model: ${FALLBACK_MODEL}`);
});
