(function () {
  "use strict";

  const SCHEMA = {
    type: "object",
    properties: {
      documentType: { type: "string" },
      discipline: { type: "string", enum: ["mechanical", "electrical", "plumbing", "general", "unknown"] },
      equipment: { type: "array", items: { type: "object", properties: {
        description: { type: "string" }, manufacturer: { type: "string" }, model: { type: "string" },
        partNumber: { type: "string" }, quantity: { type: "number" }, unit: { type: "string" },
        assembly: { type: "string" }, technicalDetails: { type: "string" }, evidence: { type: "string" },
        confidence: { type: "number" }
      }, required: ["description", "quantity", "evidence", "confidence"] } },
      fillIns: { type: "array", items: { type: "object", properties: {
        placeholder: { type: "string" }, value: { type: "string" }, part: { type: "string" }, evidence: { type: "string" }, confidence: { type: "number" }
      }, required: ["placeholder", "value", "part", "evidence", "confidence"] } },
      clauses: { type: "array", items: { type: "object", properties: {
        targetPart: { type: "string" }, targetArticle: { type: "string" }, descriptionAppliesTo: { type: "string" },
        hierarchyLevel: { type: "string" }, text: { type: "string" }, evidence: { type: "string" }, confidence: { type: "number" }
      }, required: ["targetPart", "targetArticle", "descriptionAppliesTo", "hierarchyLevel", "text", "evidence", "confidence"] } }
    }, required: ["documentType", "discipline", "equipment", "fillIns", "clauses"]
  };
  const BATCH_SCHEMA = {
    type: "object",
    properties: {
      pages: { type: "array", items: {
        type: "object",
        properties: { sourcePage: { type: "string" }, ...SCHEMA.properties },
        required: ["sourcePage", ...SCHEMA.required]
      } }
    },
    required: ["pages"]
  };
  const WRITING_SCHEMA = {
    type: "object",
    properties: {
      revisedText: { type: "string" },
      summary: { type: "string" },
      warnings: { type: "array", items: { type: "string" } }
    },
    required: ["revisedText", "summary", "warnings"]
  };

  const SYSTEM_PROMPT = `You are an engineering specification extraction assistant for N/S Corporation vehicle-wash systems. Analyze only the supplied source page or text. Extract customer-useful facts from mechanical, electrical, and plumbing drawings, schedules, O&M manuals, submittals, and specifications. Preserve exact manufacturer names, models, part numbers, ratings, dimensions, quantities, voltages, phases, amperages, flow, pressure, connection sizes, materials, controls, and included components when visible. Never infer a missing value. Evidence must be a short exact label or phrase from the source. Confidence is 0 to 1 and must reflect evidence quality. Return empty arrays for blank pages, covers, legal boilerplate, indexes, or pages without useful engineering content. Do not turn warnings, troubleshooting steps, or routine maintenance prose into construction requirements unless they state a measurable equipment requirement. Avoid duplicates within the page. Clauses must be concise enforceable requirements, not instructions to the person writing the specification. Put equipment-specific descriptions under 2.5 and use the equipment name as descriptionAppliesTo. Use hierarchyLevel equipment for an equipment heading and child for its components.

Built-in company reference distilled from Chicago Canal Spec, Section 111126 - Vehicle-Washing Equipment. Follow these placement patterns, but extract facts only from the source currently being analyzed:
- Part 2 equipment example. SOURCE PATTERN: "Acid Application Arch is made of 1 inch Schedule 40 304/304L stainless steel pipe," with minimum flow 30 GPM at 60 PSI and a multistage stainless-steel pump. EXPECTED: create one Acid Application Arch equipment record, retain the material, flow, pressure, and pump facts in technicalDetails, and create concise enforceable Part 2 Article 2.5 child clauses when useful. Evidence must quote the corresponding source phrases.
- Part 2 operation example. SOURCE PATTERN: a vehicle-wash sequence states that an overspeed vehicle bypasses application, final rinse and blowers remain available, or brushes retract one foot. EXPECTED: create concise Part 2 system-operation clauses under the closest applicable Article 2.x destination. Do not misclassify operating sequences as maintenance.
- Part 3 training and closeout example. SOURCE PATTERN: "minimum of four (4) hours" training and "three copies" of O&M manuals. EXPECTED: return TRAINING HOURS = 4 and O&M MANUAL QUANTITY = 3 as fill-ins when those template fields exist, plus a Part 3 training or closeout clause with exact evidence.
- Part 3 warranty example. SOURCE PATTERN: equipment is warranted for two years from startup and commissioning. EXPECTED: return WARRANTY PERIOD = 2 years and WARRANTY START EVENT = startup and commissioning, plus a concise Part 3 warranty clause when applicable.
- Responsibility example. SOURCE PATTERN: General Contractor provides final utility connections, field plumbing/mechanical work, or field electrical work. EXPECTED: place explicit responsibility language in the relevant Part 1 or Part 3 clause; do not turn it into a manufacturer field.
- Fill-in: return a value only when it directly answers a known template placeholder: project number, section number, project name, customer, equipment type, vehicle type, system name/model, engineer, revision, date, installation responsibility, startup requirement, acceptance-test procedure, required trouble-free cycles, training hours, O&M manual quantity, warranty period, or warranty start event.
- Manufacturer, model, part number, quantity, voltage, amperage, horsepower, flow, pressure, dimensions, and materials are equipment fields or Part 2 clauses. Do not return them as fillIns unless the page explicitly identifies a matching template placeholder.

Do not extract "clean filter monthly", troubleshooting symptom/cause tables, generic safety warnings, contact information, page navigation, parts-order instructions, or repeated marketing prose. A page with only those items must return empty arrays. The Chicago Canal reference teaches structure and placement only; never copy its facts into an unrelated source. Return only JSON matching the schema.`;
  const activeRequestControllers = new Set();
  let cancelRequested = false;

  function getConfiguredSystemPrompt() {
    const examples = String(localStorage.getItem("ns-spec-local-ai-examples-v1") || "").trim().slice(0, 12000);
    return examples ? `${SYSTEM_PROMPT}\n\nCompany-approved examples follow. Use them only as extraction and placement patterns; facts must still come from the current source page.\n\n${examples}` : SYSTEM_PROMPT;
  }

  async function sessionToken() {
    if (!window.supabaseClient) throw new Error("Database login is unavailable on this page.");
    const { data, error } = await window.supabaseClient.auth.getSession();
    if (error || !data.session?.access_token) throw new Error("Sign in on the Database page, then return here to use local AI.");
    return data.session.access_token;
  }

  async function request(path, options = {}) {
    const token = await sessionToken();
    const localDevelopment = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    const gatewayBase = localDevelopment && location.port !== "4173" ? "http://127.0.0.1:4173" : "";
    const { timeoutMs = 0, ...fetchOptions } = options;
    const controller = new AbortController();
    activeRequestControllers.add(controller);
    const timeout = timeoutMs ? setTimeout(() => controller.abort(), timeoutMs) : null;
    let response;
    try {
      response = await fetch(`${gatewayBase}${path}`, { ...fetchOptions, signal: controller?.signal, headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...(fetchOptions.headers || {}) } });
    } catch (error) {
      if (error?.name === "AbortError") throw new Error(cancelRequested ? "Analysis stopped by user." : "Visual analysis exceeded the 90-second page limit.");
      throw new Error("The Local AI background service is not running. Double-click Start NS Local AI Background.cmd, wait a few seconds, and try again.");
    } finally {
      if (timeout) clearTimeout(timeout);
      if (controller) activeRequestControllers.delete(controller);
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || `Local AI returned ${response.status}.`);
    return data;
  }

  async function status() { return request("/api/local-ai"); }

  function emitAnalysisMessage(message) {
    window.dispatchEvent(new CustomEvent("spec-local-ai-message", { detail: { message } }));
  }

  async function requestAnalysis(body, timeoutMs = 0) {
    try {
      return await request("/api/local-ai", { method: "POST", body: JSON.stringify(body), timeoutMs });
    } catch (firstError) {
      if (/stopped by user/i.test(firstError.message)) throw firstError;
      if (/90-second page limit/i.test(firstError.message)) {
        emitAnalysisMessage("Visual analysis reached the 90-second safety limit. The page will be left for manual review.");
        throw firstError;
      }
      emitAnalysisMessage(`Local AI request paused (${firstError.message}). Retrying automatically in 5 seconds.`);
      await new Promise(resolve => setTimeout(resolve, 5000));
      try {
        return await request("/api/local-ai", { method: "POST", body: JSON.stringify({ ...body, retryAttempt: Math.max(1, Number(body.retryAttempt) || 0) }), timeoutMs });
      } catch {
        emitAnalysisMessage("Automatic retry could not reach Local AI.");
        throw firstError;
      }
    }
  }

  function parseStructuredContent(content) {
    const raw = String(content || "").trim();
    const candidates = [raw];
    for (const match of raw.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)) candidates.push(match[1].trim());

    // Qwen occasionally includes a short explanation or thinking block before an
    // otherwise valid JSON object. Collect every balanced top-level object so an
    // earlier brace in that explanation cannot hide the actual response.
    for (let start = raw.indexOf("{"); start >= 0; start = raw.indexOf("{", start + 1)) {
      let depth = 0, inString = false, escaped = false;
      for (let index = start; index < raw.length; index += 1) {
        const character = raw[index];
        if (inString) {
          if (escaped) escaped = false;
          else if (character === "\\") escaped = true;
          else if (character === '"') inString = false;
          continue;
        }
        if (character === '"') inString = true;
        else if (character === "{") depth += 1;
        else if (character === "}" && --depth === 0) { candidates.push(raw.slice(start, index + 1)); break; }
      }
    }

    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          parsed.equipment = Array.isArray(parsed.equipment) ? parsed.equipment : [];
          parsed.fillIns = Array.isArray(parsed.fillIns) ? parsed.fillIns : [];
          parsed.clauses = Array.isArray(parsed.clauses) ? parsed.clauses : [];
          return parsed;
        }
      } catch { /* Try the next extracted candidate. */ }
    }
    return null;
  }

  async function analyze({ text, imageBase64, sourceName, sourcePage }) {
    cancelRequested = false;
    const systemPrompt = getConfiguredSystemPrompt();
    const content = `Source: ${sourceName}\nLocation: ${sourcePage}\n\nExtract all useful engineering information from this source.${text ? `\n\nSearchable source text:\n${text.slice(0, 16000)}` : ""}`;
    const message = { role: "user", content };
    if (imageBase64) message.images = [imageBase64];
    const messages = [{ role: "system", content: systemPrompt }, message];
    const timeoutMs = imageBase64 ? 90000 : 0;
    let response = await requestAnalysis({ messages, format: SCHEMA, numCtx: imageBase64 ? 8192 : 12288, maxTokens: imageBase64 ? 2048 : 3072 }, timeoutMs);
    let parsed = parseStructuredContent(response.content);
    if (!parsed) {
      emitAnalysisMessage(`${sourcePage} returned malformed structured data. Retrying with stricter JSON instructions.`);
      response = await requestAnalysis({
        messages: [...messages, { role: "user", content: "Your previous response was not valid JSON. Return one complete JSON object only, with equipment, fillIns, and clauses arrays. Do not use markdown fences or explanatory text." }],
        format: SCHEMA,
        numCtx: imageBase64 ? 8192 : 12288,
        maxTokens: imageBase64 ? 2048 : 3072,
        retryAttempt: 1
      }, timeoutMs);
      parsed = parseStructuredContent(response.content);
    }
    if (!parsed) throw new Error(`The local model returned incomplete structured information for ${sourcePage}. Retry the analysis; if it repeats, restart the Local AI background service.`);
    return { ...parsed, model: response.model, user: response.user };
  }

  async function analyzeBatch({ units, sourceName }) {
    cancelRequested = false;
    if (!Array.isArray(units) || !units.length) return [];
    if (units.length === 1) return [await analyze({ ...units[0], sourceName })];
    let imageNumber = 0;
    const pageSections = units.map(unit => {
      const visualLabel = unit.imageBase64 ? `Visual image ${++imageNumber} belongs to this page.\n` : "";
      return `${unit.sourcePage}:\n${visualLabel}Searchable text:\n${String(unit.text || "").slice(0, 4000)}`;
    }).join("\n\n");
    const content = `Analyze this ordered batch from ${sourceName}. Visual images, when supplied, are numbered in the same order as their labeled page sections. Return a pages array with exactly one result for every sourcePage, preserving each sourcePage label exactly. Do not combine evidence between pages.\n\n${pageSections}`;
    const message = { role: "user", content };
    const images = units.map(unit => unit.imageBase64).filter(Boolean);
    if (images.length) message.images = images;
    const messages = [{ role: "system", content: getConfiguredSystemPrompt() }, message];
    const numCtx = images.length ? 8192 : 16384;
    const maxTokens = images.length ? 2048 : 6144;
    const timeoutMs = images.length ? 90000 : 0;
    let response = await requestAnalysis({ messages, format: BATCH_SCHEMA, numCtx, maxTokens }, timeoutMs);
    let parsed = parseStructuredContent(response.content);
    const hasEveryPage = value => Array.isArray(value?.pages) && units.every(unit => value.pages.some(page => page.sourcePage === unit.sourcePage));
    if (!hasEveryPage(parsed)) {
      emitAnalysisMessage(`The batch response omitted one or more pages. Retrying the batch with exact page labels.`);
      response = await requestAnalysis({
        messages: [...messages, { role: "user", content: `Return one complete JSON object only. Its pages array must contain exactly these labels: ${units.map(unit => unit.sourcePage).join(", ")}. Include equipment, fillIns, and clauses arrays for every page, even when empty.` }],
        format: BATCH_SCHEMA,
        numCtx,
        maxTokens,
        retryAttempt: 1
      }, timeoutMs);
      parsed = parseStructuredContent(response.content);
    }
    if (!hasEveryPage(parsed)) throw new Error(`The local model could not complete the batch containing ${units.map(unit => unit.sourcePage).join(", ")}.`);
    return units.map(unit => {
      const page = parsed.pages.find(item => item.sourcePage === unit.sourcePage);
      return {
        ...page,
        equipment: Array.isArray(page.equipment) ? page.equipment : [],
        fillIns: Array.isArray(page.fillIns) ? page.fillIns : [],
        clauses: Array.isArray(page.clauses) ? page.clauses : [],
        model: response.model,
        user: response.user
      };
    });
  }

  async function improveSpecificationPart({ part = 1, text, project = {}, instruction = "" }) {
    cancelRequested = false;
    const sourceText = String(text || "").trim();
    const partNumber = [1, 2, 3].includes(Number(part)) ? Number(part) : 1;
    if (!sourceText) throw new Error(`Add or select Part ${partNumber} text before asking Local AI to improve it.`);
    const partPurpose = partNumber === 1
      ? "Part 1 - General contains administrative, quality-assurance, submittal, coordination, and general responsibility requirements. Do not move product requirements into Part 1."
      : partNumber === 2
        ? "Part 2 - Products contains equipment, materials, components, performance, controls, utilities, and operating requirements. Keep requirements organized under the applicable equipment or system article."
        : "Part 3 - Execution contains installation, field connections, startup, commissioning, testing, training, closeout, and warranty execution requirements. Do not add unsupported products or performance values.";
    const writingPrompt = `You are an engineering specification editor for N/S Corporation vehicle-wash systems. Improve the supplied Part ${partNumber} specification wording for clarity, consistency, spelling, organization, and enforceable construction-specification language. Interpret the user's intent even when their editing request contains misspellings or minor grammar errors. ${partPurpose} Preserve the existing hierarchy, article numbering, indentation, responsibilities, proper names, quantities, units, and technical meaning. Preserve every bracketed fillable placeholder exactly unless the user explicitly names that placeholder and directly requests its removal. Never invent, assume, or import a fact from the Chicago Canal reference or any other example. Do not add project details that are absent. Return the complete revised passage, a short summary of edits, and warnings for unclear or incomplete content. Return only JSON matching the schema.`;
    const projectContext = [
      ["Project number", project.projectNumber], ["Project name", project.projectName],
      ["Customer", project.customer], ["Equipment type", project.equipmentType],
      ["System name", project.systemName], ["Specification section", project.sectionNumber]
    ].filter(([, value]) => String(value || "").trim()).map(([label, value]) => `${label}: ${value}`).join("\n");
    const content = `${instruction ? `User editing request:\n${String(instruction).slice(0, 1500)}\n\n` : ""}${projectContext ? `Project context (reference only; do not add unless already supported by the passage):\n${projectContext}\n\n` : ""}Part ${partNumber} passage to improve:\n${sourceText.slice(0, 24000)}`;
    const response = await requestAnalysis({
      messages: [{ role: "system", content: writingPrompt }, { role: "user", content }],
      format: WRITING_SCHEMA,
      numCtx: 16384,
      maxTokens: 6144
    });
    const parsed = parseStructuredContent(response.content);
    if (!parsed?.revisedText) throw new Error("Local AI did not return a usable writing revision. Try a smaller selection.");
    return { ...parsed, model: response.model, user: response.user };
  }

  function cancel() {
    cancelRequested = true;
    activeRequestControllers.forEach(controller => controller.abort());
    emitAnalysisMessage("Stop requested. Canceling the active Local AI page safely.");
  }

  window.SpecificationLocalAI = { status, analyze, analyzeBatch, improveSpecificationPart, cancel, model: "qwen3-vl:8b-instruct" };
})();
