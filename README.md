# N/S Automation

N/S Automation is a browser-based workspace for preparing submittals, O&M manuals, specifications, PDF conversions, and shared document records.

## Main tools

- **Database:** Store, find, and combine shared PDF records.
- **Parts Library:** Work with drawing and part information.
- **Converter:** Compare or update PDF content with supporting Excel data.
- **Peer Review:** Review DWG or PDF drawing packages for visible coordination, equipment, naming, dimension, and title-block issues.
- **Submittal:** Organize product files and build a submittal PDF.
- **O&M:** Organize files and build an operation and maintenance manual.
- **Spec:** Prepare a three-part vehicle-wash specification from project information and supporting documents.

## Building a specification

### 1. Project

Enter the project information and review Parts 1, 2, and 3. Complete the bracketed fields before export. Use **Improve with AI** only when wording needs revision; proposed changes are never applied automatically.

### 2. Sources

Drop in PDF, Word, or text files. The initial import performs a fast built-in text review. Select **Analyze with AI** for a deeper review of searchable text, scanned pages, drawings, schedules, and equipment details.

Focused analysis:

- Screens blank, duplicate, and unlikely engineering pages.
- Uses size-aware text batches so dense pages do not overload a large batch.
- Uses visual review for scanned or image-based pages.
- Retries difficult batches in smaller groups before trying individual pages.
- Runs a targeted equipment-detail pass after the main review.
- Requires exact source evidence and a confidence value for every saved result.

The analysis can produce equipment records, project and template fill-ins, Part 2 or Part 3 clauses, responsibilities, utilities, performance values, warranty requirements, training, testing, and closeout information. Results remain pending until reviewed.

### 3. Source Review

Compare every finding with its source page. Accept, edit, or reject each equipment item, fill-in, and clause. Low-confidence findings remain available under **Possible Findings**.

### 4. Review & Export

Resolve incomplete fields and warnings, read the complete Parts 1–3 specification, and create the Word or PDF file. Reviewed corrections can be saved as company-specific examples for future projects.

## Local document analysis

Local analysis requires:

- [Ollama for Windows](https://ollama.com/download/windows)
- Node.js LTS
- The approved `qwen3-vl:8b-instruct` model
- An active N/S Automation Database login
- The one-time **Set Up NS Local AI.cmd** setup

The browser sends selected source-page content only to the protected gateway on the same computer. The gateway validates the active Database session before sending work to Ollama. Extracted results still require user review.

### One-time setup

1. Open the [Ollama for Windows download](https://ollama.com/download/windows), select **Download for Windows**, and run `OllamaSetup.exe`. Use the normal installer; the standalone ZIP is not needed.
2. Install [Node.js LTS](https://nodejs.org/en/download) with the normal installation choices.
3. Download this repository as a ZIP and extract it to a permanent folder.
4. Double-click **Set Up NS Local AI.cmd**.
5. Leave the setup window open while it automatically downloads the approved `qwen3-vl:8b-instruct` model. The model is several GB, so the first setup can take a while.
6. Close and reopen Chrome.
7. Open N/S Automation and sign in through Database.
8. Open Spec, select the Local AI status button, and choose **Try Reconnecting**.
9. Allow Chrome local-network access if requested.

Setup creates a Windows Startup shortcut, so the local gateway starts automatically when the user signs in. If the repository folder is moved, run setup again from the new location.

On Windows, Ollama normally stores downloaded models in `C:\Users\<username>\.ollama\models`, outside this repository. Do not copy that folder into N/S Automation or upload it to GitHub. To confirm the approved model is installed, open Command Prompt and run `ollama list`; the list should include `qwen3-vl:8b-instruct`.

If setup reports that Ollama is missing, finish running `OllamaSetup.exe`, then close and reopen the setup window. If a model download is interrupted, run **Set Up NS Local AI.cmd** again; Ollama will reuse completed model data.

### Performance guidance

The approved 8B model handles both text and images. Adding a second model on the same computer does not guarantee a faster run; loading or switching between two models can be slower when they share one GPU or system memory.

For the best speed:

- Use the 8B model rather than the 30B fallback.
- Keep focused analysis enabled.
- Close other GPU-heavy programs during a large document run.
- Store the source PDF on a local SSD.
- Use a supported GPU with enough memory to keep the model loaded.
- Compare runs using the same PDF and record normal-pass, recovery, and detailed-pass times separately.

A separate text model should be added only after a controlled benchmark proves it is faster without reducing equipment, fill-in, clause, evidence, or confidence coverage. Two independent computers or GPUs can provide real parallelism; two models competing for one GPU usually do not.

## Submittal and O&M workflow

1. Add the PDFs for the packet.
2. Review each assigned section.
3. Rename files when the Table of Contents needs a clearer title.
4. Use **Format TOC** for page-level organization.
5. Enter the project information.
6. Build and review the PDF before downloading.

Standard warranty coverage defaults to 90 days for labor and one year for materials unless the user changes it.

## Development

The website has no production build step. Node.js is used for validation and the optional local gateway.

- `npm run check` checks JavaScript syntax.
- `npm test` runs regression and website-integration tests.
- `npm run validate` runs both.
- `ARCHITECTURE.md` documents file ownership and safe refactoring order.

Root HTML and JavaScript files contain the website pages and workflows. `tests/` contains dependency-free regression checks, and `Files/` contains application assets.

### Repository hygiene

The repository `.gitignore` excludes dependencies, environment secrets, runtime logs, generated review output under `tmp/`, AutoCAD recovery files, and local Ollama stores if one is accidentally created inside the repository. Ollama's normal Windows model directory is already outside the repository.

Do not commit Ollama models, local runtime logs, environment secrets, temporary document renders, AutoCAD recovery files, or local agent workspaces. Keep source files such as `cad-peer-extract.lsp`, application code, tests, and intentional test fixtures under version control.
