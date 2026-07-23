"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.NS_AUTOMATION_PORT || 4173);
const OLLAMA_URL = "http://127.0.0.1:11434";
const FAST_MODEL = "qwen3-vl:8b-instruct";
const FALLBACK_MODEL = "qwen3-vl:30b-a3b-instruct";
const SUPABASE_URL = "https://yidinujmeuztqohwxfxs.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_LVvQQpJHxeif-zmJjIJy8w_jDV_MXX4";
const MAX_REQUEST_BYTES = 28 * 1024 * 1024;
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
    "Content-Security-Policy": "default-src 'self' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com https://cdn.jsdelivr.net/npm/ https://yidinujmeuztqohwxfxs.supabase.co; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net https://cdnjs.cloudflare.com; connect-src 'self' https://yidinujmeuztqohwxfxs.supabase.co"
  });
  res.end(type.startsWith("application/json") ? JSON.stringify(body) : body);
}

async function authenticatedUser(req) {
  const authorization = String(req.headers.authorization || "");
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { authorization, apikey: SUPABASE_ANON_KEY }
  });
  if (!response.ok) return null;
  return response.json();
}

async function selectLocalAiModel() {
  const response = await fetch(`${OLLAMA_URL}/api/tags`);
  if (!response.ok) throw new Error("Ollama is not available.");
  const data = await response.json();
  const installed = new Set((data.models || []).flatMap(item => [item.name, item.model]).filter(Boolean));
  if (installed.has(FAST_MODEL)) return { ready: true, model: FAST_MODEL, preferred: true };
  if (installed.has(FALLBACK_MODEL)) return { ready: true, model: FALLBACK_MODEL, preferred: false };
  return { ready: false, model: FAST_MODEL, preferred: true };
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

async function handleAi(req, res) {
  const user = await authenticatedUser(req);
  if (!user) return send(res, 401, { error: "Sign in with the Database login before using local AI." });

  if (req.method === "GET") {
    const selected = await selectLocalAiModel();
    let loaded = false;
    try {
      const runningResponse = await fetch(`${OLLAMA_URL}/api/ps`);
      const running = runningResponse.ok ? await runningResponse.json() : {};
      loaded = (running.models || []).some(item => item.name === selected.model || item.model === selected.model);
    } catch { /* Installed status remains useful if the running-model check fails. */ }
    return send(res, 200, { ...selected, loaded, user: user.email || user.id });
  }

  if (req.method !== "POST") return send(res, 405, { error: "Method not allowed." });
  const body = await readJson(req);
  if (!Array.isArray(body.messages) || !body.messages.length) return send(res, 400, { error: "No analysis content was provided." });
  const selected = await selectLocalAiModel();
  if (!selected.ready) return send(res, 503, { error: `Install ${FAST_MODEL} in Ollama before using Local AI.` });

  const ollamaController = new AbortController();
  const cancelOllamaIfBrowserLeft = () => {
    if (!res.writableEnded) ollamaController.abort();
  };
  res.once("close", cancelOllamaIfBrowserLeft);
  let response;
  try {
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
          num_ctx: Math.min(24576, Math.max(8192, Number(body.numCtx) || 16384)),
          num_predict: Math.min(8192, Math.max(1024, Number(body.maxTokens) || 4096))
        }
      })
    });
  } catch (error) {
    if (error?.name === "AbortError") return;
    throw Object.assign(new Error("Ollama stopped responding. Restart Ollama and the NS Local AI Background service, then resume this source."), { status: 503 });
  } finally {
    res.removeListener("close", cancelOllamaIfBrowserLeft);
  }
  if (!response.ok) throw new Error(`Ollama returned ${response.status}.`);
  const result = await response.json();
  send(res, 200, { model: selected.model, user: user.email || user.id, content: result.message?.content || "" });
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
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Private-Network", "true");
    }
    if (req.method === "OPTIONS") return send(res, 204, "", "text/plain; charset=utf-8");
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
  console.log(`Preferred Local AI model: ${FAST_MODEL}`);
  console.log(`Fallback Local AI model: ${FALLBACK_MODEL}`);
});
