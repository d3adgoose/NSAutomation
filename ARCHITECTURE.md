# NS Automation Architecture

NS Automation is a static, browser-first application. Each main workflow has an
HTML entry page and a classic JavaScript file. Shared browser behavior remains in
root-level shared scripts so GitHub Pages can serve the repository without a
build step.

## Main workflows

| Workflow | Page | Primary code |
| --- | --- | --- |
| Home | `index.html` | `navigation.js`, `global-auth.js` |
| Submittals | `submittal.html` | `submittal.js` |
| O&M manuals | `om.html` | `om.js`, shared submittal behavior |
| Converter | `converter.html` | `converter.js` |
| PDF database | `database.html` | `database.js` |
| Parts library | `parts-library.html` | `partsLibrary.js` |
| Specifications | `specification.html` | `specification.js`, `specification-ai.js` |

## Shared code

- `common.js` contains cross-workflow browser helpers.
- `navigation.js` and `global-auth.js` provide site-wide navigation and login UI.
- `supabaseClient.js` owns the shared Supabase client configuration.
- `pdfStorage.js` and `tocDetection.js` contain focused PDF utilities.
- `style.css` is the shared stylesheet.
- `local-ai-server.js` is the protected local gateway used by Spec Automation.

## Safe refactoring rules

1. Keep browser globals available to existing inline HTML event handlers.
2. Preserve script order in each HTML page when extracting code.
3. Move one cohesive area at a time and run `npm run validate` after every move.
4. Add a focused regression test before changing extraction, numbering, export,
   persistence, or AI-review behavior.
5. Do not combine encoding cleanup with behavior changes; review those separately.

## Current refactor status

The `bigrefactor` branch contains the first behavior-preserving organization pass.
It adds a single validation command, detects duplicate top-level declarations,
labels the major Specification workflow boundaries, and expands dense mutation
handlers for reviewability.

Previously duplicated functions have not been discarded. Inactive implementations
have explicit `Legacy` or `Advanced` names, while the function names used by the
HTML continue to point to the same active implementations as before this cleanup.
No application files have been relocated and no script-loading order has changed.

The Submittal and O&M builders load `submittal-page-selection.js` and
`submittal-page-manager.js` immediately before `submittal.js`. These extracted
files own selection state transitions plus PDF page rendering, extraction, and
deletion. The main file retains packet state, imports, persistence, TOC assembly,
warranties, and final PDF composition. A focused regression test verifies script
order and the original HTML-facing selection functions.

Specification, Converter, Database, and Parts Library now each load a focused
utility script immediately before their main workflow script. These files contain
only existing global helpers moved without changing their public names. Automated
checks enforce utility-before-main loading and reject duplicate function names
across each script family.

## Recommended extraction order

`specification.js` is the largest maintenance risk. Extract its cohesive areas in
this order: starter templates, source-text extraction, editor numbering, exports,
then optional/legacy AI UI. Keep each extracted file as a classic script initially;
moving to ES modules should be a separate project because the HTML currently relies
on global functions.
