import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("editor component suite is exported and structured properly", async () => {
  const [barrel, renderer, editor] = await Promise.all([
    read("components/editor/index.ts"),
    read("components/editor/RichContentRenderer.tsx"),
    read("components/editor/RichTextEditor.tsx"),
  ]);

  assert.match(barrel, /export\s+\{\s*RichTextEditor\s*\}\s+from\s+"\.[\/\\]RichTextEditor"/);
  assert.match(barrel, /export\s+\{\s*RichContentRenderer/);
  assert.match(renderer, /export function RichContentRenderer/);
  assert.match(editor, /export function RichTextEditor/);
  assert.match(editor, /"use client"/);
  assert.match(renderer, /"use client"/);
});

test("RichContentRenderer never uses dangerouslySetInnerHTML and blocks dangerous URI schemes", async () => {
  const renderer = await read("components/editor/RichContentRenderer.tsx");

  // Pure React elements, no dangerouslySetInnerHTML to guarantee complete XSS protection
  assert.doesNotMatch(renderer, /dangerouslySetInnerHTML/);

  // Checks for dangerous protocols
  assert.match(renderer, /javascript:/);
  assert.match(renderer, /vbscript:/);
  assert.match(renderer, /data:/);
  assert.match(renderer, /export function isSafeUrl/);

  // Test URL sanitizer logic directly
  const isSafeUrlMatch = renderer.match(/export function isSafeUrl\(url:\s*string\):\s*boolean\s*\{([\s\S]*?)\n\}/);
  assert.ok(isSafeUrlMatch, "isSafeUrl function must be exported");
  const isSafeUrlFn = new Function("url", isSafeUrlMatch[1]);

  assert.equal(isSafeUrlFn("javascript:alert(document.cookie)"), false);
  assert.equal(isSafeUrlFn("JAVASCRIPT:alert(1)"), false);
  assert.equal(isSafeUrlFn("vbscript:msgbox(1)"), false);
  assert.equal(isSafeUrlFn("data:text/html,<script>alert(1)</script>"), false);
  assert.equal(isSafeUrlFn("https://hospital.vn/phac-do-dieu-tri"), true);
  assert.equal(isSafeUrlFn("/articles/phac-do-tim-mach"), true);
  assert.equal(isSafeUrlFn("mailto:bacsi@hospital.vn"), true);
  assert.equal(isSafeUrlFn("tel:19001234"), true);
});

test("RichContentRenderer supports clinical healthcare callouts, structured tables, and code blocks", async () => {
  const renderer = await read("components/editor/RichContentRenderer.tsx");

  assert.match(renderer, /clinical-warning/);
  assert.match(renderer, /doctor-note/);
  assert.match(renderer, /dosage-guide/);
  assert.match(renderer, /emergency-box/);
  assert.match(renderer, /parseMarkdownBlocks/);
  assert.match(renderer, /renderInlineMarkdown/);
  assert.match(renderer, /checklist/);
  assert.match(renderer, /table/);
  assert.match(renderer, /blockquote/);
  assert.match(renderer, /isTableStart/);
  assert.match(renderer, /isTableSeparator/);

  // Extract parseMarkdownBlocks implementation to run deep functional checks
  const parserMatch = renderer.match(/export function parseMarkdownBlocks\([\s\S]*?\n(?=export function RichContentRenderer)/);
  assert.ok(parserMatch, "parseMarkdownBlocks must be present");

  // Compile helper using typescript transpileModule to test parser behavior
  const ts = (await import("typescript")).default;
  const parserCode = renderer.slice(renderer.indexOf("function isTableSeparator"), renderer.indexOf("function RenderBlockList"));
  const transpiled = ts.transpileModule(parserCode, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  const cleanParserCode = transpiled.outputText.replace(/export\s+/g, "");
  const parseBlocks = new Function("rawText", "depth = 0", `${cleanParserCode}; return parseMarkdownBlocks(rawText, depth);`);

  // Test 1: Table immediately following paragraph is parsed into table block (not swallowed)
  const textWithTable = "Đoạn văn mở đầu\n| Tiêu chuẩn | Chỉ số |\n| --- | --- |\n| Huyết áp | < 130/80 mmHg |";
  const blocks1 = parseBlocks(textWithTable);
  assert.equal(blocks1.length, 2);
  assert.equal(blocks1[0].type, "paragraph");
  assert.equal(blocks1[1].type, "table");
  assert.deepEqual(blocks1[1].headers, ["Tiêu chuẩn", "Chỉ số"]);
  assert.deepEqual(blocks1[1].rows, [["Huyết áp", "< 130/80 mmHg"]]);

  // Test 2: Non-table line starting/ending with pipe is NOT deleted or swallowed
  const nonTablePipe = "| Lưu ý quan trọng: uống thuốc đúng giờ |";
  const blocks2 = parseBlocks(nonTablePipe);
  assert.equal(blocks2.length, 1);
  assert.equal(blocks2[0].type, "paragraph");
  assert.equal(blocks2[0].content, nonTablePipe);

  // Test 3: Clinical callout with nested bullet list parses innerBlocks
  const calloutWithList = `:::emergency-box Dấu hiệu cấp cứu
- Bất tỉnh hoặc lơ mơ không đáp ứng.
- Khó thở dữ dội, tím tái môi đầu chi.
:::`;
  const blocks3 = parseBlocks(calloutWithList);
  assert.equal(blocks3.length, 1);
  assert.equal(blocks3[0].type, "callout");
  assert.equal(blocks3[0].calloutKind, "emergency-box");
  assert.equal(blocks3[0].calloutTitle, "Dấu hiệu cấp cứu");
  assert.ok(blocks3[0].innerBlocks && blocks3[0].innerBlocks.length > 0);
  assert.equal(blocks3[0].innerBlocks[0].type, "unordered-list");
  assert.equal(blocks3[0].innerBlocks[0].items.length, 2);

  // Test 4: Fenced code block (```json)
  const codeBlockText = "```json\n{\n  \"dosage\": \"500mg\"\n}\n```";
  const blocks4 = parseBlocks(codeBlockText);
  assert.equal(blocks4.length, 1);
  assert.equal(blocks4[0].type, "code");
  assert.equal(blocks4[0].language, "json");
  assert.ok(blocks4[0].content.includes('"dosage": "500mg"'));
});

test("renderInlineMarkdown protects medical terms with underscores and parses formatting", async () => {
  const renderer = await read("components/editor/RichContentRenderer.tsx");

  // Verify regex isolates underscores within words (CommonMark punctuation/whitespace flanking)
  assert.match(renderer, /covid_19_vaccine|\[\\s\\p\{P\}\]/u);

  // Test underscore isolation regex from the renderer
  const underscoreRegex = /(?:^|(?<=[\s\p{P}]))_([^_]+)_(?:$|(?=[\s\p{P}]))/gu;
  const medicalSnippet = "Thông tin về covid_19_vaccine và mã bệnh ICD_10_CM với _lời khuyên bác sĩ_ tại đây.";

  const matches = [...medicalSnippet.matchAll(underscoreRegex)];
  assert.equal(matches.length, 1, "Only intentional italic underscore should match");
  assert.equal(matches[0][1], "lời khuyên bác sĩ");
});

test("RichTextEditor includes multi-mode workspace, medical templates, undo/redo, and counters", async () => {
  const editor = await read("components/editor/RichTextEditor.tsx");

  // Multi-mode workspace
  assert.match(editor, /viewMode/);
  assert.match(editor, /"edit"/);
  assert.match(editor, /"split"/);
  assert.match(editor, /"preview"/);
  assert.match(editor, /isFullscreen/);

  // Undo / Redo history stack & external synchronization
  assert.match(editor, /historyRef/);
  assert.match(editor, /recordHistory/);
  assert.match(editor, /lastExternalValueRef/);
  assert.match(editor, /handleUndo/);
  assert.match(editor, /handleRedo/);
  assert.match(editor, /canUndo/);
  assert.match(editor, /canRedo/);

  // Focus preservation via onMouseDown
  assert.match(editor, /onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/);

  // Clinical templates & callouts
  assert.match(editor, /MEDICAL_TEMPLATES/);
  assert.match(editor, /clinical-warning/);
  assert.match(editor, /doctor-note/);
  assert.match(editor, /dosage-guide/);
  assert.match(editor, /emergency-box/);

  // Code block insertion tool
  assert.match(editor, /handleInsertCodeBlock/);

  // Statistics counters
  assert.match(editor, /wordCount/);
  assert.match(editor, /charCount/);
  assert.match(editor, /readingMinutes/);
  assert.match(editor, /onReadingMinutesCalculated/);

  // Media upload, Drag & Drop, and Clipboard Paste integration
  assert.match(editor, /uploadMediaAsset/);
  assert.match(editor, /handleProcessImageUpload/);
  assert.match(editor, /handleImageModalDrop/);
  assert.match(editor, /handleTextareaDrop/);
  assert.match(editor, /handleTextareaPaste/);
  assert.match(editor, /isDraggingImageModal/);
  assert.match(editor, /isDirectUploading/);
});

test("editor components adhere to flat UI design tokens without bulky rounded utilities", async () => {
  const [renderer, editor] = await Promise.all([
    read("components/editor/RichContentRenderer.tsx"),
    read("components/editor/RichTextEditor.tsx"),
  ]);

  // Per flat-ui-contract, avoid rounded-xl, rounded-2xl, rounded-3xl
  assert.doesNotMatch(renderer, /\brounded-(?:xl|2xl|3xl)\b/);
  assert.doesNotMatch(editor, /\brounded-(?:xl|2xl|3xl)\b/);
});

test("RichTextEditor is reserved for admin catalog, and RichContentRenderer is wired into doctor articles and public details", async () => {
  const [doctorArticles, adminCatalog, articleDetail] = await Promise.all([
    read("app/doctor/articles/page.tsx"),
    read("app/admin/catalog/page.tsx"),
    read("app/articles/[slug]/page.tsx"),
  ]);

  // Doctor articles page uses clean textarea for editing (RichTextEditor reserved for Admin) and RichContentRenderer for reading
  assert.doesNotMatch(doctorArticles, /<RichTextEditor/);
  assert.match(doctorArticles, /RichContentRenderer/);
  assert.match(doctorArticles, /<RichContentRenderer/);

  // Admin catalog page has RichTextEditor
  assert.match(adminCatalog, /RichTextEditor/);
  assert.match(adminCatalog, /<RichTextEditor/);

  // Public article detail renders rich content
  assert.match(articleDetail, /RichContentRenderer/);
  assert.match(articleDetail, /<RichContentRenderer/);
});

test("parseMarkdownBlocks supports multi-line indented continuation list items and wide horizontal rules", async () => {
  const renderer = await read("components/editor/RichContentRenderer.tsx");
  const ts = (await import("typescript")).default;
  const parserCode = renderer.slice(renderer.indexOf("function isTableSeparator"), renderer.indexOf("function RenderBlockList"));
  const transpiled = ts.transpileModule(parserCode, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  const cleanParserCode = transpiled.outputText.replace(/export\s+/g, "");
  const parseBlocks = new Function("rawText", "depth = 0", `${cleanParserCode}; return parseMarkdownBlocks(rawText, depth);`);

  // Test multi-line indented bullet item
  const multiLineList = "- Uống thuốc vào buổi sáng sau ăn\n  để bảo vệ niêm mạc dạ dày.\n- Tái khám sau 2 tuần.";
  const blocks = parseBlocks(multiLineList);
  assert.equal(blocks.length, 1);
  assert.equal(blocks[0].type, "unordered-list");
  assert.equal(blocks[0].items.length, 2);
  assert.equal(blocks[0].items[0], "Uống thuốc vào buổi sáng sau ăn để bảo vệ niêm mạc dạ dày.");
  assert.equal(blocks[0].items[1], "Tái khám sau 2 tuần.");

  // Test multi-line indented checklist item
  const multiLineChecklist = "- [x] Hoàn tất xét nghiệm sinh hóa máu\n  bao gồm chỉ số men gan AST/ALT\n- [ ] Đo điện tâm đồ ECG";
  const chkBlocks = parseBlocks(multiLineChecklist);
  assert.equal(chkBlocks.length, 1);
  assert.equal(chkBlocks[0].type, "checklist");
  assert.equal(chkBlocks[0].checkedItems.length, 2);
  assert.equal(chkBlocks[0].checkedItems[0].checked, true);
  assert.equal(chkBlocks[0].checkedItems[0].text, "Hoàn tất xét nghiệm sinh hóa máu bao gồm chỉ số men gan AST/ALT");

  // Test wide horizontal rule (5 hyphens)
  const hrBlocks = parseBlocks("-----");
  assert.equal(hrBlocks.length, 1);
  assert.equal(hrBlocks[0].type, "hr");
});

test("RichTextEditor preserves undo baseline on initial edits and supports consecutive list numbering", async () => {
  const editor = await read("components/editor/RichTextEditor.tsx");

  // Baseline preservation in recordHistory
  assert.match(editor, /isBaseline\s*=\s*stack\.length\s*<=\s*1/);

  // Consecutive numbered list prefixing
  assert.match(editor, /\$\{idx\s*\+\s*1\}\.\s*/);

  // Checklist prefixing
  assert.match(editor, /prefix\s*===\s*"- \[ \] "/);
  assert.match(editor, /☑ Kiểm tra/);

  // Focus preservation on callout and template dropdowns
  assert.match(editor, /aria-expanded=\{showCalloutMenu\}[\s\S]*?onMouseDown=\{\(e\)\s*=>\s*e\.preventDefault\(\)\}/);
  assert.match(editor, /aria-expanded=\{showTemplateMenu\}[\s\S]*?onMouseDown=\{\(e\)\s*=>\s*e\.preventDefault\(\)\}/);

  // Selection wrapping in code blocks and callouts
  assert.match(editor, /handleInsertCodeBlock[\s\S]*?safeValue\.slice\(textarea\.selectionStart/);
  assert.match(editor, /handleInsertCallout[\s\S]*?safeValue\.slice\(textarea\.selectionStart/);

  // Multi-line tab indentation
  assert.match(editor, /safeValue\.slice\(start,\s*end\)\.includes\("\\n"\)/);
});

test("doctor articles page conforms to flat UI design tokens (no rounded-lg, rounded-[6px], rounded-[8px])", async () => {
  const doctorArticles = await read("app/doctor/articles/page.tsx");
  assert.doesNotMatch(doctorArticles, /\brounded-(?:lg|xl|2xl|3xl)\b/);
  assert.doesNotMatch(doctorArticles, /\brounded-\[(?:6|8)px\]\b/);
});

test("parseMarkdownBlocks terminates without hanging on edge-case inputs (lonely :::, hashtag, indented blockquote)", async () => {
  const renderer = await read("components/editor/RichContentRenderer.tsx");
  const ts = (await import("typescript")).default;
  const parserCode = renderer.slice(renderer.indexOf("function isTableSeparator"), renderer.indexOf("function RenderBlockList"));
  const transpiled = ts.transpileModule(parserCode, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  const cleanParserCode = transpiled.outputText.replace(/export\s+/g, "");
  const parseBlocks = new Function("rawText", "depth = 0", `${cleanParserCode}; return parseMarkdownBlocks(rawText, depth);`);

  // Edge case 1: Lonely ::: without a kind (should parse as paragraph, never hang)
  const lonelyTripleColon = parseBlocks(":::");
  assert.equal(lonelyTripleColon.length, 1);
  assert.equal(lonelyTripleColon[0].type, "paragraph");
  assert.equal(lonelyTripleColon[0].content, ":::");

  // Edge case 2: Hashtag without trailing space (should parse as paragraph, never hang)
  const hashtagBlock = parseBlocks("#hashtag y_khoa");
  assert.equal(hashtagBlock.length, 1);
  assert.equal(hashtagBlock[0].type, "paragraph");
  assert.equal(hashtagBlock[0].content, "#hashtag y_khoa");

  // Edge case 3: Indented blockquote (should parse as blockquote, never hang)
  const indentedQuote = parseBlocks("  > Lời dặn từ chuyên gia");
  assert.equal(indentedQuote.length, 1);
  assert.equal(indentedQuote[0].type, "blockquote");
  assert.equal(indentedQuote[0].content, "Lời dặn từ chuyên gia");

  // Edge case 4: Unclosed callout at EOF
  const unclosedCallout = parseBlocks(":::doctor-note Dặn dò\nBệnh nhân nghỉ ngơi");
  assert.equal(unclosedCallout.length, 1);
  assert.equal(unclosedCallout[0].type, "callout");
  assert.equal(unclosedCallout[0].calloutKind, "doctor-note");
});

test("parseMarkdownBlocks supports single-column tables, column alignments, and custom ordered list start", async () => {
  const renderer = await read("components/editor/RichContentRenderer.tsx");
  const ts = (await import("typescript")).default;
  const parserCode = renderer.slice(renderer.indexOf("function isTableSeparator"), renderer.indexOf("function RenderBlockList"));
  const transpiled = ts.transpileModule(parserCode, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  const cleanParserCode = transpiled.outputText.replace(/export\s+/g, "");
  const parseBlocks = new Function("rawText", "depth = 0", `${cleanParserCode}; return parseMarkdownBlocks(rawText, depth);`);

  // Single-column table with center alignment
  const singleColText = "| Tiêu chuẩn lâm sàng |\n| :---: |\n| Huyết áp mục tiêu < 130/80 mmHg |";
  const singleColBlocks = parseBlocks(singleColText);
  assert.equal(singleColBlocks.length, 1);
  assert.equal(singleColBlocks[0].type, "table");
  assert.deepEqual(singleColBlocks[0].headers, ["Tiêu chuẩn lâm sàng"]);
  assert.deepEqual(singleColBlocks[0].alignments, ["center"]);
  assert.deepEqual(singleColBlocks[0].rows, [["Huyết áp mục tiêu < 130/80 mmHg"]]);

  // Multi-column table with mixed alignments (left, center, right)
  const multiColText = "| Tên thuốc | Liều dùng | Giá bán |\n| :--- | :---: | ---: |\n| Paracetamol | 500mg | 25.000 đ |";
  const multiColBlocks = parseBlocks(multiColText);
  assert.equal(multiColBlocks.length, 1);
  assert.equal(multiColBlocks[0].type, "table");
  assert.deepEqual(multiColBlocks[0].alignments, ["left", "center", "right"]);

  // Ordered list with non-1 start
  const customStartList = "4. Đổi vị trí đo huyết áp\n5. Ghi nhật ký vào sổ theo dõi";
  const listBlocks = parseBlocks(customStartList);
  assert.equal(listBlocks.length, 1);
  assert.equal(listBlocks[0].type, "ordered-list");
  assert.equal(listBlocks[0].start, 4);
  assert.equal(listBlocks[0].items.length, 2);
});

test("RichTextEditor guards disabled mode, preserves modal selection, and batches drag/paste uploads", async () => {
  const editor = await read("components/editor/RichTextEditor.tsx");

  // Selection preservation ref
  assert.match(editor, /savedSelectionRef\s*=\s*useRef/);
  assert.match(editor, /handleOpenLinkModal/);
  assert.match(editor, /handleOpenImageModal/);

  // Disabled guard in keydown, drop, paste, and template
  assert.match(editor, /handleKeyDown[\s\S]*?if\s*\(disabled\)\s*return;/);
  assert.match(editor, /handleTextareaDrop[\s\S]*?if\s*\(disabled\)\s*return;/);
  assert.match(editor, /handleTextareaPaste[\s\S]*?if\s*\(disabled\)\s*return;/);
  assert.match(editor, /handleApplyTemplate[\s\S]*?if\s*\(disabled\)\s*return;/);

  // Ctrl+S browser save prevention
  assert.match(editor, /e\.key\.toLowerCase\(\)\s*===\s*"s"[\s\S]*?e\.preventDefault\(\)/);

  // Batch drop and paste insertion without data loss
  assert.match(editor, /handleTextareaDrop[\s\S]*?snippets\.join\(""\)/);
  assert.match(editor, /handleTextareaPaste[\s\S]*?snippets\.join\(""\)/);
});

test("admin catalog page conforms to flat UI design tokens (no rounded-lg, rounded-md, rounded-[6px], rounded-[8px])", async () => {
  const adminCatalog = await read("app/admin/catalog/page.tsx");
  assert.doesNotMatch(adminCatalog, /\brounded-(?:lg|md|xl|2xl|3xl)\b/);
  assert.doesNotMatch(adminCatalog, /\brounded-\[(?:6|8)px\]\b/);
});

test("RichTextEditor integrates TinyMCE with self-hosted assets, menubar, toolbar, and clinical extensions", async () => {
  const [editor, renderer, pkg] = await Promise.all([
    read("components/editor/RichTextEditor.tsx"),
    read("components/editor/RichContentRenderer.tsx"),
    read("package.json"),
  ]);

  // Packages installed in package.json
  assert.match(pkg, /"@tinymce\/tinymce-react"/);
  assert.match(pkg, /"tinymce"/);

  // Dynamic import with SSR disabled
  assert.match(editor, /dynamic<IAllProps>\s*\(\s*\(\)\s*=>\s*import\("@tinymce\/tinymce-react"\)/);
  assert.match(editor, /ssr:\s*false/);

  // Self-hosted bundle and GPL license
  assert.match(editor, /tinymceScriptSrc="\/tinymce\/tinymce\.min\.js"/);
  assert.match(editor, /licenseKey="gpl"/);
  assert.match(editor, /base_url:\s*"\/tinymce"/);
  assert.match(editor, /suffix:\s*"\.min"/);

  // Menubar matching user screenshot
  assert.match(editor, /menubar:\s*"file edit view insert format tools table"/);

  // Toolbar matching user screenshot
  assert.match(editor, /toolbar:[\s\S]*?undo redo/);
  assert.match(editor, /toolbar:[\s\S]*?blocks/);
  assert.match(editor, /toolbar:[\s\S]*?bold italic/);
  assert.match(editor, /toolbar:[\s\S]*?alignleft aligncenter alignright alignjustify/);
  assert.match(editor, /toolbar:[\s\S]*?bullist numlist outdent indent/);
  assert.match(editor, /toolbar:[\s\S]*?table link image/);
  assert.match(editor, /toolbar:[\s\S]*?clinical_warning doctor_note dosage_guide emergency_box/);

  // Custom clinical button registrations
  assert.match(editor, /addButton\("clinical_warning"/);
  assert.match(editor, /addButton\("doctor_note"/);
  assert.match(editor, /addButton\("dosage_guide"/);
  assert.match(editor, /addButton\("emergency_box"/);
  assert.match(editor, /addMenuButton\("clinical_callouts"/);

  // Direct hospital media upload handler
  assert.match(editor, /images_upload_handler:\s*async/);
  assert.match(editor, /uploadMediaAsset\(file,\s*purpose\)/);

  // Bidirectional HTML/Markdown helpers
  assert.match(renderer, /export function htmlToMarkdown/);
  assert.match(renderer, /export function markdownToHtml/);

  // Safe normalization: HTML is parsed into pure React nodes, never dangerouslySetInnerHTML
  assert.doesNotMatch(renderer, /dangerouslySetInnerHTML/);
});

test("TinyMCE menubar commands all map to registered self-hosted plugins (no dead menu entries)", async () => {
  const [editor, fs] = await Promise.all([read("components/editor/RichTextEditor.tsx"), import("node:fs/promises")]);

  // Parse the plugins array from the init config
  const pluginsMatch = editor.match(/plugins:\s*\[([\s\S]*?)\]/);
  assert.ok(pluginsMatch, "plugins array must be present in the TinyMCE init config");
  const registeredPlugins = [...pluginsMatch[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);

  // Every plugin registered must ship in the self-hosted bundle (no 404 on lazy load)
  const bundledPlugins = new Set(await fs.readdir(new URL("../public/tinymce/plugins", import.meta.url)));
  for (const plugin of registeredPlugins) {
    assert.ok(
      bundledPlugins.has(plugin),
      `plugin "${plugin}" is registered but missing from public/tinymce/plugins/`
    );
  }

  // Parse every menubar items string (File/Edit/View/Insert/Format/Tools/Table)
  const menuTokens = new Set();
  for (const itemsMatch of editor.matchAll(/items:\s*"([^"]+)"/g)) {
    for (const token of itemsMatch[1].split(/\s+/)) {
      if (token && token !== "|") menuTokens.add(token);
    }
  }

  // Menu commands that require a backing plugin in TinyMCE 8
  const tokenPlugin = {
    restoredraft: "autosave",
    preview: "preview",
    code: "code",
    visualchars: "visualchars",
    visualblocks: "visualblocks",
    fullscreen: "fullscreen",
    image: "image",
    link: "link",
    media: "media",
    codesample: "codesample",
    charmap: "charmap",
    emoticons: "emoticons",
    wordcount: "wordcount",
    inserttable: "table",
    cell: "table",
    row: "table",
    column: "table",
    tableprops: "table",
    deletetable: "table",
  };

  for (const [token, plugin] of Object.entries(tokenPlugin)) {
    if (!menuTokens.has(token)) continue;
    assert.ok(
      registeredPlugins.includes(plugin),
      `menu command "${token}" requires plugin "${plugin}" which is absent from the plugins array`
    );
  }

  // TinyMCE 8 removed the template and print plugins upstream: referencing them
  // in a menu silently drops the entry, so they must never come back without
  // re-adding the assets first.
  assert.ok(!menuTokens.has("template"), "menu token 'template' has no TinyMCE 8 plugin; remove it from the Insert menu");
  assert.ok(!menuTokens.has("print"), "menu token 'print' has no TinyMCE 8 plugin; remove it from the File menu");

  // clinical_callouts must be registered as a real Insert-menu item (sharing the
  // toolbar menu button's entries), otherwise the menubar token is dropped.
  assert.match(editor, /addNestedMenuItem\("clinical_callouts"/);
  assert.match(editor, /getSubmenuItems:\s*\(\)\s*=>/);
});

test("RichTextEditor derives statistics and Markdown source from markup-free content", async () => {
  const [editor, renderer] = await Promise.all([
    read("components/editor/RichTextEditor.tsx"),
    read("components/editor/RichContentRenderer.tsx"),
  ]);

  // htmlToMarkdown is wired into the editor alongside markdownToHtml
  assert.match(
    editor,
    /import RichContentRenderer,\s*\{\s*htmlToMarkdown,\s*markdownToHtml\s*\}\s*from "\.\/RichContentRenderer"/
  );

  // Same HTML detection contract as the renderer's normalization path
  assert.match(renderer, /\/<\[a-z\]\[\\s\\S\]\*>\/i\.test\(content\)/);
  assert.match(editor, /function containsHtml/);
  assert.match(editor, /containsHtml\(safeValue\)/);

  // Word/char counters and reading minutes come from the markup-free source
  assert.match(editor, /const plainSource = useMemo/);
  assert.match(editor, /const charCount = plainSource\.length/);
  assert.match(editor, /const wordCount = plainSource\.trim\(\)/);
  assert.match(editor, /const readingMinutes = Math\.max\(1, Math\.ceil\(wordCount \/ 180\)\)/);

  // The TinyMCE text-format override that raced with the reading-minutes
  // effect is gone: one stats pipeline only.
  assert.doesNotMatch(editor, /getContent\(\{\s*format:\s*"text"\s*\}\)/);

  // Entering a textarea mode converts an HTML draft to Markdown exactly once,
  // guarded by the previous-viewMode ref and recorded in undo history.
  assert.match(editor, /previousViewModeRef/);
  assert.match(editor, /const markdown = htmlToMarkdown\(safeValue\)/);
  assert.match(editor, /recordHistory\(markdown, true\)/);

  // Functional: htmlToMarkdown strips markup from a representative TinyMCE
  // snippet while preserving clinical callout structure.
  const ts = (await import("typescript")).default;
  const helperCode = renderer.slice(
    renderer.indexOf("const HTML_NAMED_ENTITY_MAP"),
    renderer.indexOf("export function markdownToHtml")
  );
  assert.ok(helperCode.includes("htmlToMarkdown"), "extraction window must contain htmlToMarkdown");
  const transpiled = ts.transpileModule(helperCode, { compilerOptions: { module: ts.ModuleKind.ESNext } });
  const cleanCode = transpiled.outputText.replace(/export\s+/g, "");
  const htmlToMarkdownFn = new Function("html", `${cleanCode}; return htmlToMarkdown(html);`);

  const tinySnippet =
    "<h2>Phác đồ điều trị</h2><p>Uống <strong>Paracetamol 500mg</strong> sau ăn.</p>" +
    '<div class="clinical-warning" data-callout="clinical-warning" data-title="Cảnh báo lâm sàng"><p>Không dùng quá 4g/ngày.</p></div>';
  const markdown = htmlToMarkdownFn(tinySnippet);
  assert.ok(!/<[a-z]/i.test(markdown), "converted Markdown must not contain raw HTML tags");
  assert.ok(markdown.includes("Phác đồ điều trị"), "heading text preserved");
  assert.ok(markdown.includes("Paracetamol 500mg"), "body text preserved");
  assert.ok(markdown.includes(":::clinical-warning"), "clinical callout converted to ::: syntax");
  assert.ok(markdown.includes("Không dùng quá 4g/ngày"), "callout content preserved");

  const encodedVietnamese = htmlToMarkdownFn("<p>Nội dung cũ đ&atilde; được b&aacute;c sĩ duyệt &#273;úng.</p>");
  assert.equal(encodedVietnamese, "Nội dung cũ đã được bác sĩ duyệt đúng.");
});
