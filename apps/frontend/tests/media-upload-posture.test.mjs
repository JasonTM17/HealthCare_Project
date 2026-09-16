import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const flagModule = new URL("../lib/media-uploads.ts", import.meta.url);
const editorPath = new URL("../components/editor/RichTextEditor.tsx", import.meta.url);
const imageUploadPath = new URL("../components/ImageUpload.tsx", import.meta.url);

test("media upload surfaces mirror the backend upload-enabled posture", async () => {
  const flagSource = await readFile(flagModule, "utf8");
  assert.match(
    flagSource,
    /process\.env\.NEXT_PUBLIC_STORAGE_UPLOAD_ENABLED !== "false"/,
    "flag must default to enabled and turn off only on explicit false"
  );
  assert.match(flagSource, /chưa được bật trên máy chủ/, "disabled copy must be Vietnamese and actionable");

  const editor = await readFile(editorPath, "utf8");
  assert.match(editor, /MEDIA_UPLOADS_ENABLED/, "editor must consume the shared flag");
  // Toolbar and paste behaviour hide image controls instead of shipping
  // buttons that can only end in a storage 503.
  assert.match(editor, /MEDIA_UPLOADS_ENABLED \? "image " : ""/);
  assert.match(editor, /MEDIA_UPLOADS_ENABLED \? "image media " : ""/);
  assert.match(editor, /MEDIA_UPLOADS_ENABLED \? "quickimage " : ""/);
  assert.match(editor, /automatic_uploads: MEDIA_UPLOADS_ENABLED/);
  assert.match(editor, /paste_data_images: MEDIA_UPLOADS_ENABLED/);
  const handler = editor.match(/images_upload_handler: async[\s\S]*?\n      \},/);
  assert.ok(handler, "images_upload_handler must exist");
  assert.match(handler[0], /if \(!MEDIA_UPLOADS_ENABLED\)/, "handler must fail closed with copy");

  const imageUpload = await readFile(imageUploadPath, "utf8");
  assert.match(imageUpload, /MEDIA_UPLOADS_ENABLED/, "ImageUpload must consume the shared flag");
  assert.match(imageUpload, /if \(!MEDIA_UPLOADS_ENABLED\) \{/, "process-file guard present");
  assert.match(
    imageUpload,
    /!MEDIA_UPLOADS_ENABLED \? \(/,
    "dropzone is replaced by an honest notice when uploads are off"
  );
});
