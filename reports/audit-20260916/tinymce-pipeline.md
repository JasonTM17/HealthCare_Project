# TinyMCE / Article Rich-Text Pipeline Audit

Date: 2026-09-16
Scope: `apps/frontend`, `apps/backend/src/main/java/com/healthcare`, `apps/backend/src/main/resources/db/migration`
Method: targeted grep/context-window audit only; no broad rewrites. Existing working-tree changes outside this report were preserved.

## Incremental findings log

### 1) TinyMCE install/load/config evidence

- Frontend dependency declares `@tinymce/tinymce-react` and `tinymce`: `apps/frontend/package.json:22`, `apps/frontend/package.json:28`; lockfile resolves `@tinymce/tinymce-react@6.3.0` with `tinymce@8.9.1`: `apps/frontend/pnpm-lock.yaml:11-13`, `apps/frontend/pnpm-lock.yaml:1955`, `apps/frontend/pnpm-lock.yaml:2474-2480`. The copied public TinyMCE bundle reports `8.9.0`: `apps/frontend/public/tinymce/package.json:2-3`.
- TinyMCE is dynamically imported client-side from `@tinymce/tinymce-react`: `apps/frontend/components/editor/RichTextEditor.tsx:22-24`, then loaded from the local copied bundle via `tinymceScriptSrc="/tinymce/tinymce.min.js"`: `apps/frontend/components/editor/RichTextEditor.tsx:1760-1768`; config also sets `base_url: "/tinymce"` and `suffix: ".min"`: `apps/frontend/components/editor/RichTextEditor.tsx:343-347`.
- Configured menus/toolbars/plugins are in `apps/frontend/components/editor/RichTextEditor.tsx:347-393`; public plugin folders include all configured plugin names (`accordion`, `advlist`, `anchor`, `autolink`, `autosave`, `charmap`, `code`, `codesample`, `directionality`, `emoticons`, `fullscreen`, `image`, `insertdatetime`, `link`, `lists`, `media`, `nonbreaking`, `pagebreak`, `preview`, `quickbars`, `searchreplace`, `table`, `visualblocks`, `visualchars`, `wordcount`) from `apps/frontend/public/tinymce/plugins`.
- Custom medical buttons/menu items are registered in `setup`: `clinical_warning`, `doctor_note`, `dosage_guide`, `emergency_box`, `clinical_callouts`, `clinical_templates` at `apps/frontend/components/editor/RichTextEditor.tsx:483-614`.
- No P0 missing-plugin toolbar button was confirmed: every non-custom plugin-backed toolbar/menu item seen in `apps/frontend/components/editor/RichTextEditor.tsx:347-393` maps to a public TinyMCE plugin folder or core formatting/table controls. OPEN: I did not execute TinyMCE in browser to verify runtime registration.

### 2) Editor save format and persistence/rendering seam

- In TinyMCE mode, `onEditorChange` receives `newHtml` and sends it directly to parent state: `apps/frontend/components/editor/RichTextEditor.tsx:333-339`, while `value={safeValueHtml}` feeds TinyMCE with HTML-converted content: `apps/frontend/components/editor/RichTextEditor.tsx:1760-1769`.
- Switching from TinyMCE into markdown edit/split mode converts existing HTML to markdown and mutates the stored value via `onChange(markdown)`: `apps/frontend/components/editor/RichTextEditor.tsx:261-278`. This is an HTML-vs-Markdown dual-mode pipeline, not a single canonical format.
- Doctor article save sends `body: body.trim()` through `doctorCreateArticle`/`doctorUpdateArticle`: `apps/frontend/app/doctor/articles/page.tsx:238-257`; API client JSON-stringifies the payload: `apps/frontend/lib/api-client.ts:1217-1246`, `apps/frontend/lib/api-client.ts:3131-3142`.
- Backend DTO accepts `body` as `@Size(max = 8000) String body`: `apps/backend/src/main/java/com/healthcare/hospital/dto/ArticleRequest.java:13-18`; service copies it as-is to entity: `apps/backend/src/main/java/com/healthcare/hospital/service/AdminArticleService.java:54-60`, `apps/backend/src/main/java/com/healthcare/hospital/service/AdminArticleService.java:86-93`.
- Entity maps `body` as `@Column(name = "body", length = 8000)`: `apps/backend/src/main/java/com/healthcare/hospital/entity/Article.java:35-39`; initial migration creates `body VARCHAR(8000)`: `apps/backend/src/main/resources/db/migration/V2__hospital_domain.sql:44-50`. This is a hard long-article limit for rich HTML, not `TEXT`.
- Public service returns `article.getBody()` unchanged: `apps/backend/src/main/java/com/healthcare/hospital/service/ArticleService.java:77-84`; public route exposes only `articleService.getBySlug`: `apps/backend/src/main/java/com/healthcare/hospital/controller/ArticleController.java:24-32`.
- Public page sends `article.body` to `RichContentRenderer`: `apps/frontend/app/articles/[slug]/page.tsx:330-338`; renderer does not use `dangerouslySetInnerHTML`, instead converts HTML to markdown if it detects HTML, parses blocks, and renders React nodes: `apps/frontend/components/editor/RichContentRenderer.tsx:1226-1249`.
- Renderer strips remaining HTML tags during `htmlToMarkdown`: `apps/frontend/components/editor/RichContentRenderer.tsx:923-929`, `apps/frontend/components/editor/RichContentRenderer.tsx:1046-1052`; this prevents raw HTML XSS but also means TinyMCE styles/unsupported rich semantics can be destroyed on output.

