import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

/**
 * The editor toolbar is a contract with the author: every button on it promises
 * that what it produces will still be there after the body is stored as
 * markdown. Nine commands could not keep that promise — colspan/rowspan have no
 * GFM syntax, media sources were deleted, anchor ids dropped, and pagebreak,
 * lineheight, accordion and emoticons vanished outright — so they were removed
 * rather than left in place to quietly eat clinical content.
 *
 * This file holds that removal in place, and pins the two companions to it: the
 * Word-paste scrub, and the label that used to point at an element TinyMCE never
 * renders.
 *
 * The article section builder is the same kind of promise as a toolbar button —
 * what the author types has to survive the save — so its author-facing copy is
 * pinned here too, against the backend rule it describes.
 */

const editorSource = await readFile(
  new URL("../components/editor/RichTextEditor.tsx", import.meta.url),
  "utf8",
);

/** The toolbar template literal, anchored at its own line so the quickbars
 * toolbars above and below it cannot be mistaken for it. */
function toolbarTokens() {
  const match = editorSource.match(/^\s*toolbar:\s*`([\s\S]*?)`/m);
  assert.ok(match, "the toolbar template literal must be present");
  return new Set(
    match[1]
      // Interpolations are removed whole, so a gated token is asserted through
      // its own pattern instead of through its name.
      .replace(/\$\{[^}]*\}/g, " ")
      .split(/[\s|]+/)
      .filter(Boolean),
  );
}

function registeredPlugins() {
  const match = editorSource.match(/plugins:\s*\[([\s\S]*?)\]/);
  assert.ok(match, "the plugins array must be present");
  return match[1].matchAll(/"([a-z]+)"/g).map((m) => m[1]);
}

/** Copy one top-level function out of a module by name. */
function grabFunction(source, name) {
  const start = source.indexOf(`export function ${name}(`);
  assert.ok(start > 0, `${name} not found`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    else if (source[i] === "}") {
      depth -= 1;
      if (depth === 0) {
        return source.slice(start, i + 1);
      }
    }
  }
  throw new Error(`${name} is unbalanced`);
}

// -- toolbar honesty ------------------------------------------------------------

test("the toolbar no longer advertises commands the markdown pipeline loses", () => {
  const tokens = toolbarTokens();

  // Each of these was verified lossy on the editor -> markdown -> render round
  // trip: table cell props drop colspan/rowspan (and shifted a rowspan into the
  // wrong dosage-table column), media deletes the source, anchor drops the id,
  // and the rest are discarded whole.
  const lossy = [
    "tablemergecells",
    "tablesplitcells",
    "tablecellprops",
    "media",
    "anchor",
    "pagebreak",
    "accordion",
    "lineheight",
    "emoticons",
  ];
  for (const token of lossy) {
    assert.ok(!tokens.has(token), `"${token}" cannot survive the pipeline and must not be offered`);
  }
});

test("the table commands that do survive stay on the toolbar", () => {
  const tokens = toolbarTokens();

  // GFM tables keep their rows, columns and inline markup, so inserting and
  // resizing a table remains an honest button. Removing the cell-property
  // commands must not have taken these with it.
  for (const token of [
    "table",
    "tableinsertrowbefore",
    "tableinsertrowafter",
    "tabledeleterow",
    "tableinsertcolbefore",
    "tableinsertcolafter",
    "tabledeletecol",
  ]) {
    assert.ok(tokens.has(token), `"${token}" survives the round trip and must stay reachable`);
  }

  // The clinical callouts round-trip through ::: fences and the rest of the
  // toolbar is untouched by this decision.
  for (const token of ["clinical_warning", "doctor_note", "dosage_guide", "emergency_box"]) {
    assert.ok(tokens.has(token), `callout button "${token}" missing from the toolbar`);
  }
  for (const token of ["undo", "redo", "blocks", "bullist", "numlist", "outdent", "indent", "code", "preview", "fullscreen", "hr", "charmap", "insertdatetime", "searchreplace", "visualblocks", "nonbreaking", "removeformat"]) {
    assert.ok(tokens.has(token), `"${token}" is not lossy and must not have been dropped`);
  }
});

test("image insertion stays behind the upload posture", () => {
  // `media` is gone, but the image control that does survive is still gated:
  // with storage disabled it would only ever end in a 503.
  assert.match(editorSource, /MEDIA_UPLOADS_ENABLED \? "image " : ""/);
  assert.match(editorSource, /automatic_uploads: MEDIA_UPLOADS_ENABLED/);
  assert.match(editorSource, /paste_data_images: MEDIA_UPLOADS_ENABLED/);
  assert.doesNotMatch(editorSource, /"image media "/, "the media plugin is no longer offered");
});

test("the toolbar is backed by plugins that are registered and bundled", async () => {
  const plugins = [...registeredPlugins()];

  // Every token whose command needs a plugin maps to one that is registered;
  // this is the check that keeps a toolbar rewrite from leaving a button that
  // silently never appears.
  const needsPlugin = {
    table: "table",
    tableinsertrowbefore: "table",
    tableinsertrowafter: "table",
    tabledeleterow: "table",
    tableinsertcolbefore: "table",
    tableinsertcolafter: "table",
    tabledeletecol: "table",
    link: "link",
    code: "code",
    preview: "preview",
    fullscreen: "fullscreen",
    charmap: "charmap",
    insertdatetime: "insertdatetime",
    searchreplace: "searchreplace",
    visualblocks: "visualblocks",
    nonbreaking: "nonbreaking",
  };
  const tokens = toolbarTokens();
  for (const [token, plugin] of Object.entries(needsPlugin)) {
    if (!tokens.has(token)) continue;
    assert.ok(plugins.includes(plugin), `"${token}" needs plugin "${plugin}", which is not registered`);
  }

  // The removed commands must not leave their plugins behind either: an unused
  // registration still loads a script on every editor mount.
  for (const plugin of ["media", "accordion", "anchor", "pagebreak", "emoticons"]) {
    assert.ok(!plugins.includes(plugin), `plugin "${plugin}" only existed for a removed command`);
  }

  // Dead registrations that no toolbar token or verified behaviour used.
  for (const plugin of ["codesample", "visualchars", "directionality"]) {
    assert.ok(!plugins.includes(plugin), `plugin "${plugin}" is unreachable and must not ship`);
  }

  const { readdir } = await import("node:fs/promises");
  const bundled = new Set(await readdir(new URL("../public/tinymce/plugins", import.meta.url)));
  for (const plugin of plugins) {
    assert.ok(bundled.has(plugin), `plugin "${plugin}" is registered but not vendored`);
  }
});

test("the unreachable font format options are gone", () => {
  // The menubar is off and no toolbar token exposed the font family or size
  // lists, so these settings could not be reached by an author. The names may
  // survive in a comment explaining the removal; the options may not come back.
  assert.doesNotMatch(editorSource, /^\s*font_family_formats\s*:/m);
  assert.doesNotMatch(editorSource, /^\s*font_size_formats\s*:/m);
});

// -- Word paste hygiene ---------------------------------------------------------

const stripWordPasteArtifacts = (() => {
  const body = grabFunction(editorSource, "stripWordPasteArtifacts");
  const { outputText } = ts.transpileModule(body, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  });
  const factory = new Function("exports", "module", `${outputText}\nreturn stripWordPasteArtifacts;`);
  return factory({}, { exports: {} });
})();

test("Word paste artifacts are removed before insertion", () => {
  const pasted = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">',
    "<head>",
    '<meta name=Generator content="Microsoft Word 15">',
    "<!--[if gte mso 9]><xml><w:WordDocument><w:View>Normal</w:View></w:WordDocument></xml><![endif]-->",
    "<style><!-- p.MsoNormal {mso-style-unhide:no; font-size:11.0pt;} --></style>",
    "</head>",
    "<body lang=VI>",
    "<p class=MsoNormal style='margin:0cm;mso-pagination:widow-orphan'>Liều dùng: <b>Paracetamol 500mg</b><o:p></o:p></p>",
    "<p class=MsoListParagraph style='mso-list:l0 level1 lfo1'><![if !supportLists]><span style='mso-list:Ignore'>&#8226;<span>&nbsp;</span></span><![endif]>Uống sau ăn<o:p></o:p></p>",
    "</body></html>",
  ].join("\n");

  const cleaned = stripWordPasteArtifacts(pasted);

  assert.doesNotMatch(cleaned, /\[if\b/i, "conditional comment survived as text");
  assert.doesNotMatch(cleaned, /\[endif\]/i, "conditional comment marker survived as text");
  assert.doesNotMatch(cleaned, /mso-/i, "an mso- declaration or attribute survived");
  assert.doesNotMatch(cleaned, /WordDocument|<\/?w:/i, "Office namespace XML survived");
  assert.doesNotMatch(cleaned, /<o:p/i, "an empty o:p remnant survived");
  assert.doesNotMatch(cleaned, /Mso[A-Za-z]+/, "a Word paragraph class survived");

  // The authored text is untouched, including the bullet Word writes inside a
  // downlevel-revealed block, which is real content rather than scaffolding.
  assert.ok(cleaned.includes("Liều dùng"), "authored text lost");
  assert.ok(cleaned.includes("Paracetamol 500mg"), "authored emphasis lost");
  assert.ok(cleaned.includes("Uống sau ăn"), "the list item's text lost");
  // Word writes the list bullet inside that downlevel-revealed block, as an
  // entity or as the character; either way it is content, not scaffolding.
  assert.match(cleaned, /&#8226;|•/, "the Word list bullet was discarded with its markers");
});

test("the paste scrub leaves ordinary content alone", () => {
  const clinical = '<p>Huyết áp mục tiêu &lt; 140/90 mmHg</p><table><tr><td style="text-align: center;">5 mg</td></tr></table>';

  assert.equal(stripWordPasteArtifacts(clinical), clinical);
  // Only a style block that is Office scaffolding is dropped.
  const ownStyle = "<style>.clinical-warning { border-left: 4px solid #f59e0b; }</style>";
  assert.equal(stripWordPasteArtifacts(ownStyle), ownStyle);
});

test("the scrub is wired into the paste pipeline", () => {
  assert.match(editorSource, /paste_preprocess:\s*\(/);
  assert.match(editorSource, /args\.content = stripWordPasteArtifacts\(args\.content\)/);
});

// -- label association ----------------------------------------------------------

test("the visible label points at the control that is mounted", () => {
  // TinyMCE does not use the caller's id: tinymce-react renders its own
  // textarea and replaces it with an iframe. The label pointed at the caller's
  // id, which named nothing in the default mode.
  assert.match(editorSource, /const tinyEditorId = id \? `\$\{id\}-tinymce` : "healthcare-tinymce-editor"/);
  assert.match(editorSource, /const editorControlId = viewMode === "tinymce" \? tinyEditorId : id/);
  assert.match(editorSource, /htmlFor=\{editorControlId\}/);
  assert.doesNotMatch(editorSource, /htmlFor=\{id\}/, "the label still points at the unmounted id");
  assert.match(editorSource, /id=\{tinyEditorId\}/, "the editor and the label must share one id expression");
});

// -- section builder ------------------------------------------------------------

/**
 * The article section rows promise that the outline the admin typed is the
 * outline a reader sees. For a while that was false: the save path discarded
 * submitted sections and re-derived the outline from the markdown body on every
 * write, which also made the medical "blueprint" presets inert. The hint beside
 * the section list is the only place that rule is stated to the author, so it is
 * pinned here together with the backend behaviour it describes.
 */
test("the section builder tells the author which outline actually wins", async () => {
  const [catalog, adminArticleService] = await Promise.all([
    readFile(new URL("../app/admin/catalog/page.tsx", import.meta.url), "utf8"),
    readFile(
      new URL("../../backend/src/main/java/com/healthcare/hospital/service/AdminArticleService.java", import.meta.url),
      "utf8",
    ),
  ]);

  // The builder is real, so the hint is not describing a feature that is gone.
  assert.match(catalog, /Cấu trúc các Section bài viết/);
  assert.match(catalog, /handleCloneSection/);
  assert.match(catalog, /articleSectionAt\(current, index, \{ heading: event\.target\.value \}\)/);

  // Authored sections win...
  assert.match(catalog, /Nội dung bạn điền cho từng mục bên dưới sẽ là dàn ý người đọc nhìn thấy/);
  // ...and body-derivation is stated as the empty-only fallback, never as the rule.
  assert.match(catalog, /chỉ khi không mục nào có nội dung, dàn ý mới được tách tự động từ bài viết/);
  assert.doesNotMatch(catalog, /hệ thống (?:sẽ )?tự tách dàn ý[^.]*\./, "the hint must not present derivation as the default");
  // The heading-only scaffold a blueprint applies must not be able to publish as
  // content, so the hint cannot promise that headings alone are enough.
  assert.match(catalog, /Khung tiêu đề có sẵn chỉ để gợi ý/);

  // The copy describes the backend, so the backend has to keep doing it.
  assert.match(adminArticleService, /hasAuthorSections/);
  // Requiring a non-blank body is what keeps a blueprint scaffold from winning.
  assert.match(adminArticleService, /section\.body\(\) != null && !section\.body\(\)\.isBlank\(\)/);
  assert.match(adminArticleService, /ArticleSectionsDeriver\.derive/);
});
