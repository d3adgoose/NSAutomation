# NS Automation

NS Automation is a browser-based website for common N/S Corporation PDF workflows. Use the navigation tabs to move between the main tools.

## Home

The Home tab is the starting point for the website. Use it to navigate to the available tools.

## Submittal Automation

Use the Submittal Automation tab to build a product submittal PDF.

Basic workflow:

1. Upload the PDFs that belong in the submittal.
2. Review the section assigned to each PDF.
3. Rename files if you want different names shown in the Table of Contents.
4. Use Format TOC when a PDF needs custom TOC entries or page-level organization.
5. Enter the project information.
6. Build the PDF and review the preview before downloading.

## O&M Automation

Use the O&M Automation tab to build an operation and maintenance manual PDF.

Basic workflow:

1. Upload the PDFs that belong in the manual.
2. Review the section assigned to each PDF.
3. Rename files if you want different names shown in the Table of Contents.
4. Use Format TOC when a PDF needs custom TOC entries or page-level organization.
5. Enter the project information.
6. Build the PDF and review the preview before downloading.

## Converter

Use the Converter tab for PDF conversion workflows that compare or update PDF content using supporting files such as Excel data.

Basic workflow:

1. Upload the source PDF.
2. Upload any required supporting file, such as an Excel file.
3. Review the detected results in the preview.
4. Apply the conversion and download the finished PDF.

## Database

Use the Database tab to manage PDF library records and create merged PDFs from library files.

Basic workflow:

1. Sign in if required.
2. Upload or search for library PDFs.
3. Review or update the file information.
4. Select files when creating a merged PDF.
5. Build and download the merged PDF.

## Spec Automation

Use Spec Automation to create and review a three-part vehicle-wash specification from project information, reusable N/S starters, and supporting source documents.

### Recommended workflow

1. **Project:** Enter the project information and complete the bracketed fillable fields in Part 1, Part 2, and Part 3. Use **Improve with AI** when wording needs help. Every proposed change must be reviewed before it is accepted.
2. **Sources + Local AI:** Add searchable PDFs, scanned manuals, drawings, submittals, specifications, datasheets, Word files, or text files. Select **Analyze** for fast text extraction or **Analyze with AI** for visual engineering review.
3. **Source Review:** Review equipment, fill-ins, clauses, source evidence, and the suggested destination. Accept only information verified against the source. AI-originated results remain marked for review.
4. **Review & Export:** Resolve incomplete fill-ins and review warnings, confirm the Part 1–3 wording, and export the automatically numbered Word or PDF specification.

### AI writing assistance

Each Part editor has its own **Improve with AI** button. Enter a specific request in the chat-style box and use the arrow or press Enter. Shift+Enter adds a new line. The review follows a GitHub-style red/green line comparison with an Accept/Revert decision for each change. The overall **Accept Changes** button applies only the selected decisions.

Bracketed fillable fields such as `[EQUIPMENT TYPE]` and `[SYSTEM NAME / MODEL]` are protected. Local AI must keep them unless the request explicitly names the placeholder and asks to remove it. Writing History retains the three most recent revisions for the current project in that browser.

### Local AI requirements

Local AI requires all of the following on the computer providing AI analysis:

- Ollama installed and running.
- The approved Qwen3-VL model installed.
- **Start NS Local AI Background.cmd** running the protected local gateway.
- An active N/S Automation Database login.

The website address does not authorize Local AI. The signed-in Database session controls access, while the green or red Local AI status circle shows whether the local background service is available.

## General Use

- Use the navigation tabs to switch tools.
- Review previews before downloading final PDFs.
- Keep source PDFs organized and clearly named for best results.

## Repository Files

Commit the website source, shared assets, tests, Local AI gateway, and Windows start scripts. Do not commit local agent workspaces, document-rendering scratch files, runtime logs, environment secrets, Ollama, or downloaded AI models. These local-only items are excluded by `.gitignore`.

## Local AI Pilot

Local AI is optional and access is controlled by the existing Database login. Opening a local website address does not authorize Local AI. The AI gateway validates the signed-in user's active Supabase session before accepting every status or analysis request. Selected source pages are sent only to Ollama on the same computer, and results are always added as pending review.

The address `http://127.0.0.1:5500/specification.html?continue=1` only opens Spec Automation and restores the user's place in the website. The `continue=1` setting must never enable, unlock, or bypass Local AI. A user who is not signed in cannot run Local AI, even when that address is opened directly.

Ollama and the configured Qwen3-VL model are installed on the pilot computer.

1. Open N/S Automation.
2. Sign in with the normal Database login. This login—not the page address—authorizes Local AI.
3. Open Spec Automation and add the O&amp;M manual, submittal, drawing, specification, or datasheet.
4. After login, select **Analyze with Local AI** beside the source. Use **Reanalyze** when only the faster built-in text extraction is needed.
5. Review every extracted equipment item, fill-in, and clause before accepting it.

In Step 1, each Part editor has its own **Improve with AI** button and chat-style request composer. The unified review follows GitHub's familiar format: unchanged lines remain normal, each original changed line appears as a red minus row, and its replacement appears directly below as a green plus row. Every change has a green Accept action and red Revert action in the decision gutter. Fillable placeholders remain protected unless explicitly removed by request.

The configured pilot computer starts the Local AI background services automatically at Windows login. If Local AI reports that it is not ready, double-click **Start NS Local AI Background.cmd**, wait several seconds, and select the Local AI status button again to open the current status popup.

The first time a signed-in user selects **Analyze with Local AI**, the website shows the official [Ollama for Windows download](https://ollama.com/download/windows). Users can select **Don't show this message again** to remember the choice for their database login on that computer.

On the local pilot, the website remains on port 5500 while the browser contacts the protected AI gateway on port 4173 in the background. Approved local website addresses are a network safety restriction, not proof that a user is authorized. The gateway also requires and validates the existing Supabase login session and is the only route allowed to contact Ollama. Do not expose Ollama port 11434 to the public internet.
