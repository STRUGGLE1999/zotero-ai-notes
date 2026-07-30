# Zotero AI Notes

**English** | [简体中文](README-zh.md)

An AI-powered Zotero 9 plugin for organizing scholarly annotations. It reads highlights, comments, tags, and page numbers from PDFs, combines them with the surrounding source text, and generates background-validated Markdown notes. It can also create mind maps that are viewable inside Zotero, importable into XMind, and exportable as OPML.

> Current development build and latest public preview: `0.4.1`; verified on macOS with Zotero `9.0.6`.
> Windows and Linux use the same cross-platform interfaces, but each platform still requires a complete hands-on regression test.

## Features

- Adds an **AI 整理批注** (*Organize Annotations with AI*) action to the item context menu after installation;
- Reads the selected item, all attached PDFs, and native Zotero annotations;
- Extracts highlights, comments, tags, colors, page numbers, and position data;
- Reads only PDF pages containing annotations and locates the source text surrounding each highlight;
- Builds an internal Evidence dataset to constrain generation and support background validation;
- Supports Gemini, OpenAI-compatible, DeepSeek, and custom services, including Base URL, API Key, model selection, and connection testing;
- Automatically identifies the user's focus topics, allows topics to be selected, and supports marking up to two topics as priorities;
- Derives note topics strictly from the annotations selected by the user. The model may explain, connect, and organize only those annotations and their nearby source text instead of broadly summarizing the entire paper;
- Checks whether each topic is grounded in real annotations and includes contextual explanation, while preventing mechanical repetition, fabricated user opinions, and user questions being rewritten as conclusions;
- Uses a staged workflow: **Confirm Focus Topics → Generate and Review → View and Save**;
- Builds the outline locally and performs local risk checks after note generation. It makes one model call when no explicit risk is found, and adds a review-and-correction call only when necessary, while displaying elapsed time, call count, and failure reasons;
- Supports genuine cancellation of model requests and resuming from a failed or cancelled stage without discarding completed results;
- Generates, edits, and previews natural Markdown notes;
- Checks Evidence references, missing content, and potential hallucinations in the background;
- Writes results back as Zotero child notes or exports UTF-8 Markdown;
- Generates a local SVG mind map from a validated note, with zoom, pan, and fit-to-window controls;
- Exports OPML and imports standard topic hierarchies and multiple sheets from modern `.xmind` files;
- Keeps internal Evidence IDs out of user-facing notes and mind maps.

## Workflow

```text
Select a Zotero item
→ Read PDFs and annotations
→ Locate the source text around each annotation
→ Build internal Evidence
→ Identify the user's focus topics
→ Keep only annotations and nearby source text associated with confirmed topics
→ Use the selected model to explain, connect, and generate Markdown around those annotations
→ Run local risk checks; add model-based review and correction only for topic drift, mechanical repetition, misrepresented user opinions, abnormal Evidence IDs, numbers, mappings, or low confidence
→ Preview and edit
→ Write back to Zotero / export Markdown
→ Generate an academic-style mind map / import XMind / export OPML
```

## Installation and Usage on macOS

The following instructions target the currently verified environment: macOS with Zotero `9.0.6`. The current XPI supports Zotero `9.0` through `9.0.*`.

### 1. Prerequisites

Before you begin, make sure that:

- Zotero 9 is installed and has been launched at least once;
- macOS can access the AI model service you intend to use;
- You have the corresponding API Key, Base URL, and model name;
- If you do not have a ready-made XPI, Node.js 18 or later and npm are installed so you can build it from source.

To check the Zotero version, choose **Zotero → About Zotero** from the macOS menu bar.

### 2. Get the XPI Package

#### Option A: Download from GitHub Releases (recommended)

- [Download the latest public preview, version 0.4.1](https://github.com/STRUGGLE1999/zotero-ai-notes/releases/download/v0.4.1/zotero-ai-notes-0.4.1.xpi)
- [Browse and download all previous releases](https://github.com/STRUGGLE1999/zotero-ai-notes/releases)

After downloading, continue to the next step without extracting the XPI. If your browser tries to open the `.xpi` file, right-click the download link and choose **Save Link As**.

#### Option B: Build from source on macOS

Open Terminal and run:

```bash
git clone https://github.com/STRUGGLE1999/zotero-ai-notes.git
cd zotero-ai-notes
npm install
npm run build
```

After a successful build, the following file will appear in the project root:

```text
zotero-ai-notes-0.4.1.xpi
```

To fully verify the package before installation, run:

```bash
node scripts/verify-xpi.js
```

If the final terminal message is `XPI verification PASSED`, the manifest, lifecycle functions, directory structure, and Zotero 9.0.6 compatibility range have passed validation.

### 3. Install the Plugin in Zotero

1. Open Zotero 9;
2. Choose **Tools → Plugins** from the macOS menu bar;
3. Click the gear button in the upper-right corner of the plugin manager;
4. Select **Install Plugin From File…**;
5. Choose `zotero-ai-notes-0.4.1.xpi`, either built from source or downloaded from Releases;
6. Approve the installation in the confirmation dialog;
7. Confirm that the expected version of `Zotero AI Notes` appears in the plugin list and is enabled.

If the context-menu action does not appear immediately, quit Zotero completely and reopen it.

### 4. Configure an AI Model

1. Choose **Zotero → Settings** from the macOS menu bar;
2. Open the **Zotero AI Notes** settings page;
3. Enter the following information:

   - API provider: Gemini, OpenAI-compatible, DeepSeek, or a custom OpenAI-compatible service;
   - Base URL: the OpenAI-compatible endpoint supplied by the provider. The official Gemini example is `https://generativelanguage.googleapis.com/v1beta/openai/`;
   - API Key: the key issued by your selected provider;
   - Model: a model name that is available to the current API Key.

4. Click **Save**;
5. Click **Test Connection**;
6. Wait for the interface to confirm that the connection, API Key, and model are valid.

The API Key is stored only in the local Zotero/Firefox Login Manager. The settings page never displays the full key, and the plugin does not write it to logs, debug files, or exported notes.

### 5. Import a New Paper PDF

1. Drag the paper PDF into the Zotero item list;
2. If Zotero retrieves the paper metadata automatically, verify the title and authors;
3. If the PDF remains a standalone attachment, right-click it and choose **Retrieve Metadata for PDF**, or create a parent item;
4. Double-click the PDF to open it in Zotero's built-in reader.

The plugin supports both parent bibliographic items and PDF attachments. Creating a parent item first is recommended so generated notes and write-back results have a clear location.

### 6. Add Test Annotations

Use the highlight or underline tool in Zotero's PDF reader. For a first end-to-end test, prepare:

- At least five highlights or underlines;
- At least one or two comments containing your own thoughts;
- Annotations distributed across several pages where possible;
- Tags on some annotations if useful;
- Annotations covering research questions, methods, key findings, limitations, or anything you genuinely care about.

Zotero saves annotations automatically. Return to the item list when finished.

### 7. Generate AI Notes

1. Select the paper's parent item or its PDF in the Zotero item list;
2. Right-click and choose **AI 整理批注** (*Organize Annotations with AI*);
3. Wait while the plugin reads the PDFs, annotations, and nearby source text from annotated pages;
4. Review the topics identified in the **关注重点** (*Focus Topics*) section;
5. Deselect unwanted topics or mark up to two topics as priorities;
6. Optionally provide an additional instruction, such as: “Focus on explaining the research method and do not expand beyond the annotations”;
7. Click **生成笔记** (*Generate Notes*);
8. Wait for local outline construction, note generation, and risk validation. A model-based review and correction pass is added only when an explicit risk is detected.

When generation finishes, the rendered note preview is shown by default. Switch to **Markdown 编辑** (*Markdown Editor*) if changes are needed. The final content does not display internal Evidence IDs.

### 8. Review, Write Back, and Export

After generation, you can:

- **Edit Markdown**: switch to **Markdown 编辑** (*Markdown Editor*) and modify the content;
- **Validate current content**: click **校验当前内容** (*Validate Current Content*) after editing;
- **Write back to Zotero**: click **写回 Zotero** (*Write Back to Zotero*) to create a new child note under the current paper without overwriting existing notes;
- **Export Markdown**: click **导出 Markdown** (*Export Markdown*) and choose a file name and location in the macOS save dialog;
- **View the mind map**: open the **思维导图** (*Mind Map*) tab to view the local SVG map;
- **Navigate the map**: zoom, pan, or use **适应窗口** (*Fit to Window*) for a large map;
- **Import XMind**: click **导入 XMind** (*Import XMind*) to import directly without AI generation. Standard topic hierarchies in modern `.xmind` files are supported, and sheets can be switched in multi-sheet files;
- **Export OPML**: click **导出 OPML** (*Export OPML*) to save the current generated or imported sheet as a UTF-8 OPML file.

### 9. End-to-End Test Checklist

When testing with a new paper, verify each item below:

- [ ] The expected version of `Zotero AI Notes` appears in the Zotero plugin list and is enabled;
- [ ] Exactly one **AI 整理批注** (*Organize Annotations with AI*) action appears in the item context menu;
- [ ] The plugin displays the correct paper title;
- [ ] PDF and annotation counts are correct;
- [ ] Nearby source text is found for most annotations;
- [ ] Identified focus topics match your annotation intent;
- [ ] Topics can be selected and up to two can be prioritized, with no numeric priority dropdown;
- [ ] The selected model returns Markdown successfully, and stage timing and call counts update correctly;
- [ ] **取消生成** (*Cancel Generation*) stops the current request, and a failed stage can be resumed;
- [ ] Background validation passes or clearly identifies content that must be added;
- [ ] The final note contains no internal Evidence IDs such as `E-XXXX-1-01`;
- [ ] **写回 Zotero** (*Write Back to Zotero*) creates a new note without overwriting old notes, and the top status ends with **已写回 Zotero** (*Written Back to Zotero*);
- [ ] The Markdown file saves and opens correctly;
- [ ] The mind map displays nodes without a source-code panel, and zoom and fit-to-window controls work;
- [ ] The OPML file saves correctly and can be imported into XMind;
- [ ] A modern `.xmind` file can be imported without generating a note first and does not overwrite Markdown or Zotero notes.

### 10. Troubleshooting on macOS

#### “The add-on could not be installed”

- Confirm that Zotero is version 9.0.x;
- Confirm that you selected the `.xpi` file rather than an extracted directory;
- Run `npm run build` and `node scripts/verify-xpi.js` again;
- Open **Tools → Developer → Error Console**, retry the installation, and inspect the latest red error message.

#### The context-menu action is missing

- Confirm that the plugin is enabled;
- Select a bibliographic item or PDF attachment before right-clicking;
- Quit and restart Zotero completely;
- Check whether multiple older plugin versions are installed.

#### The plugin reports no annotations

- Confirm that the annotations were created natively in Zotero's PDF reader;
- Return to the item list and run the plugin again;
- Confirm that the selected item is either the relevant parent item or the PDF itself.

#### The model connection fails

- Check that the API Key was saved successfully;
- Confirm that the Base URL matches the provider's OpenAI-compatible endpoint and ends with `/`;
- Confirm that the selected model is available to the current API Key;
- Confirm that your network can reach the selected model service API.

#### The plugin window is not in front

Choose **Window → Zotero AI Notes** from the macOS menu bar to bring the existing preview window forward.

#### Nearby source text is missing for some annotations

Scanned or image-based PDFs, complex two-column layouts, formulas, and very short single-character annotations may not be located reliably. The plugin keeps the original annotation and displays a warning instead of discarding it.

#### The mind map does not display as SVG

The plugin automatically falls back to a tree view. Record the error message and report it in the project Issues. Imported files and original Markdown remain unchanged.

## Data and Privacy

- The plugin never uploads the entire PDF to the model;
- It sends only the document title, annotations, user comments, tags, page numbers, and nearby source text required by the topics the user has confirmed;
- API Keys are excluded from request logs;
- Writing back to Zotero creates a new child note and never overwrites an existing note;
- Debug JSON and intermediate Markdown files use either the system temporary directory or a save location selected by the user.

## Local Development

Requirements:

- Node.js 18 or later;
- npm;
- Zotero 9.

```bash
npm install
npm run typecheck
npm run lint
npm test
npm run build
```

After building, the following file is generated in the project root:

```text
zotero-ai-notes-0.4.1.xpi
```

Current automated validation results:

- TypeScript type checking passes;
- ESLint reports zero errors;
- All 73 tests across 14 test files pass;
- XPI structure and archive integrity checks pass.

## Project Structure

```text
addon/                  Zotero manifest, settings page, preview window, and localization resources
src/config/             Configuration and credential storage
src/zotero/             Items, attachments, annotations, and context-menu integration
src/evidence/           PDF context location and Evidence construction
src/llm/                Gemini requests, generation, and background validation
src/output/             Markdown, Zotero write-back, map tree, OPML, and XMind adapters
src/ui/                 Preview-window controller
tests/                  Automated tests
docs/                   PRD, architecture, technical, prompt, and acceptance documentation
scripts/                Build and XPI verification scripts
```

## Documentation

- [Documentation index (Chinese)](docs/README.md)
- [Product requirements document (Chinese)](docs/requirements/01_Zotero_AI批注整理插件_PRD_Zotero9版.md)
- [Product architecture design (Chinese)](docs/architecture/02_Zotero_AI插件_产品架构设计_Zotero9版.md)
- [Technical design document (Chinese)](docs/technical/03_Zotero_AI插件_技术设计文档_Zotero9版.md)
- [Prompt design document (Chinese)](docs/prompts/04_Zotero_AI插件_Prompt设计文档_Zotero9版.md)
- [Full development retrospective: July 14, 2026 (Chinese)](docs/progress/2026-07-14-development-retrospective.md)

## Version History

| Version | Highlights |
|---|---|
| `0.1.0` | Zotero 9 plugin shell, installation, lifecycle, context menu, and test prompt |
| `0.1.1` | Structured reading of bibliographic items, PDF attachments, and annotations |
| `0.1.2` | PDF context, Evidence, Gemini configuration, and Markdown output |
| `0.2.0` | Complete focus-topic, generation, validation, preview, write-back, and export workflow |
| `0.2.1`–`0.2.3` | Fixes for exposed Evidence IDs, window behavior, and Gemini numeric annotation IDs |
| `0.3.0` | Mermaid mind maps, SVG preview, source copying, and export |
| `0.3.1` | Small-window and Windows layout fixes, multiple model providers, Markdown preview, and recognition retry |
| `0.3.2`–`0.3.5` | Longer generation timeout, detailed progress, compatibility with Chat Completions and Responses API formats, and automatic fallback |
| `0.3.6` | Generation stages, elapsed time, call counts, genuine cancellation, and retry from the current stage |
| `0.3.7` | Fix for recognition failures caused by Zotero sandbox cancellation, plus improved Chinese and English numeric-unit validation |
| `0.3.8` | Staged generation UI, priority-topic interaction, local outlining, risk-based model review, second-level note timestamps, write-back protection, and XHTML paragraph preview fixes |
| `0.4.0` | Annotation-driven explanatory notes, local academic-style SVG maps, source-free interface, zoom and pan, OPML export, and modern XMind import |
| `0.4.1` | Long-annotation Evidence compression, user-question deduplication and semantic-equivalence validation, review-output limiting, and stability fixes for 101 annotations |

See [CHANGELOG.md](CHANGELOG.md) for complete release details.

## Versioning and Release Policy

The project follows Semantic Versioning. Patch versions are used for bug and compatibility fixes, minor versions for complete new capabilities, and `1.0.0` is reserved for the first stable release after cross-platform regression testing, compatibility planning, and stability acceptance. Version numbers are not decimals: for example, `0.10.0` is later than `0.9.0`.

GitHub Releases are reserved for builds worth distributing to users: new minor or major versions, significant feature milestones, critical patches for installation, startup, generation, or data-safety problems, and public previews intended for broader testing. Internal builds and routine fixes may remain in the codebase and CHANGELOG without receiving individual Releases. Before the cross-platform stable-release criteria are met, `0.x` Releases are marked as pre-releases by default.

Version `0.4.0` introduced OPML/XMind import and export and local academic-style mind maps. It also changed note generation so topics are determined by user-selected annotations and nearby source text defines the explanatory boundary. It was therefore published as a feature-milestone pre-release. See [AGENTS.md](AGENTS.md) for the complete policy.

## Roadmap

- Complete hands-on regression testing with Zotero 9 on Windows and Linux;
- Improve context location for text-free PDFs, scans, and complex layouts;
- Add configurable note templates;
- Add compatibility with legacy XMind `content.xml` files and evaluate limited support for relationships, summaries, and attachments;
- Continue validating GitHub Releases auto-update compatibility on Windows and Linux.

## License

[MIT License](LICENSE)
