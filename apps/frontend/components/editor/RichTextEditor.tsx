"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactElement,
} from "react";
import dynamic from "next/dynamic";
import type { Editor as TinyMCEEditor } from "tinymce";
import type { IAllProps } from "@tinymce/tinymce-react";
import UiIcon, { type IconName } from "../UiIcon";
import ConfirmActionDialog from "../ui/ConfirmActionDialog";
import RichContentRenderer, { htmlToMarkdown, markdownToHtml } from "./RichContentRenderer";
import { uploadMediaAsset, ApiError } from "../../lib/api-client";
import { MEDIA_UPLOADS_DISABLED_MESSAGE, MEDIA_UPLOADS_ENABLED } from "../../lib/media-uploads";
import { presentApiError } from "../../lib/present-api-error";

const TinyEditor = dynamic<IAllProps>(
  () => import("@tinymce/tinymce-react").then((mod) => mod.Editor),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center bg-slate-50 text-xs text-slate-500 font-medium border border-slate-200 rounded-[4px]">
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-4 rounded-full border-2 border-teal-800 border-t-transparent animate-spin" />
          <span>Đang khởi động trình soạn thảo TinyMCE…</span>
        </div>
      </div>
    ),
  }
);

export interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  minHeight?: string;
  disabled?: boolean;
  onReadingMinutesCalculated?: (minutes: number) => void;
  purpose?: "ARTICLE_COVER" | "GENERAL";
  id?: string;
  required?: boolean;
}

type EditorViewMode = "tinymce" | "edit" | "split" | "preview";

// Same HTML detection contract as RichContentRenderer: TinyMCE drafts are
// stored as HTML, Markdown-mode drafts are not.
const HTML_TAG_PATTERN = /<[a-z][\s\S]*>/i;

function containsHtml(value: string): boolean {
  return HTML_TAG_PATTERN.test(value);
}

/**
 * Remove Microsoft Word's paste scaffolding from clipboard HTML.
 *
 * Word does not paste a fragment of HTML; it pastes a small document, and the
 * parts that exist only to describe that document survive the editor's own
 * filtering as visible text. Authors reported clinical articles opening with
 * runs of `[if gte mso 9]`, `mso-list:Ignore`, `</o:p>` and Office namespace
 * XML — none of it authored, all of it published.
 *
 * The order matters and is the whole design: the conditional comments go first,
 * because a downlevel-hidden block *contains* the `<xml>`/`<w:*>` payload and
 * deleting the payload first would leave the block's own markers behind as
 * text; the namespace remnants go last, once nothing is wrapping them.
 *
 * Self-contained on purpose — `tests/editor-toolbar-honesty.test.mjs` lifts
 * this function out of the module by name and runs it, so it may not depend on
 * anything else in the file.
 */
export function stripWordPasteArtifacts(html: string): string {
  if (!html || html.indexOf("<") < 0) return html ?? "";
  let cleaned = html;

  // 1. Downlevel-hidden conditional comments, with their payload:
  //    <!--[if gte mso 9]><xml>…</xml><![endif]--> and the
  //    <!--[if !mso]><!-->…<!--<![endif]--> wrapper form.
  cleaned = cleaned.replace(/<!--\s*\[if[\s\S]*?<!\[endif\]\s*-->/gi, "");
  cleaned = cleaned.replace(/<!--\s*\[if[\s\S]*?-->/gi, "");

  // 2. Downlevel-revealed markers, where the content between them is real and
  //    must be kept: <![if !supportLists]>•<![endif]> is how Word marks list
  //    bullets. Only the markers are artifacts.
  cleaned = cleaned.replace(/<!\[if[\s\S]*?\]>/gi, "");
  cleaned = cleaned.replace(/<!\[endif\]\s*>/gi, "");

  // 3. Word's head CSS is nothing but Office scaffolding, so a style block that
  //    is still carrying mso declarations goes as a block. This has to run
  //    before those declarations are stripped below — the check is what is left
  //    in the block, and stripping first leaves a selector and no marker. Any
  //    other style block is left for the author and TinyMCE to decide about.
  cleaned = cleaned.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, (block) =>
    /mso-/i.test(block) ? "" : block);

  // 4. mso-* declarations inside style attributes, and the class Word writes
  //    on every paragraph. Word omits the quotes as often as it writes them,
  //    and mixes its own declarations in among real ones, so the declaration
  //    form is removed wherever it sits rather than only after the quote.
  cleaned = cleaned.replace(/;?\s*mso-[a-z-]+\s*:\s*[^;"']*;?/gi, "");
  cleaned = cleaned.replace(/\sstyle=(["'])\s*(?:[a-z-]+\s*:\s*;?\s*)*\1/gi, "");
  cleaned = cleaned.replace(/\sstyle=(?!["'])[^\s>]*mso-[^\s>]*/gi, "");
  cleaned = cleaned.replace(/\sclass=(["'])[^"']*\bMso[A-Za-z]*[^"']*\1/gi, "");
  cleaned = cleaned.replace(/\sclass=(?!["'])[^\s>]*\bMso[A-Za-z]*/gi, "");

  // 5. Office namespace elements. <o:p></o:p> is the empty paragraph Word pads
  //    documents with; the rest (w:, v:, x:, o:) are its document metadata.
  cleaned = cleaned.replace(/<\s*o:p\b[^>]*>\s*<\s*\/\s*o:p\s*>/gi, "");
  cleaned = cleaned.replace(/<\s*\/?\s*(?:o|w|v|x):[a-z0-9]+\b[^>]*>/gi, "");
  cleaned = cleaned.replace(/<xml\b[^>]*>[\s\S]*?<\/xml>/gi, "");
  cleaned = cleaned.replace(/<\?xml[\s\S]*?\?>/gi, "");
  cleaned = cleaned.replace(/<\s*\/?\s*xml\b[^>]*>/gi, "");

  return cleaned;
}

interface MedicalTemplate {
  title: string;
  description: string;
  content: string;
}

const MEDICAL_TEMPLATES: MedicalTemplate[] = [
  {
    title: "Cẩm nang chăm sóc & điều trị bệnh",
    description: "Mẫu chuẩn y khoa gồm tổng quan, triệu chứng, phác đồ điều trị và lưu ý",
    content: `## 1. Tổng quan tình trạng & Định nghĩa

Mô tả ngắn gọn về bệnh lý, cơ chế sinh học và đối tượng dễ mắc phải trong cộng đồng...

## 2. Các dấu hiệu & Triệu chứng nhận biết

- **Triệu chứng sớm:** Mệt mỏi nhẹ, khó chịu không rõ nguyên nhân.
- **Triệu chứng điển hình:** Đau tức, khó thở khi vận động gắng sức.
- **Biểu hiện tiến triển:** Phù nề, chóng mặt hoặc kéo dài trên 3 ngày.

:::clinical-warning Lưu ý chẩn đoán phân biệt
Các triệu chứng trên có thể nhầm lẫn với bệnh lý tiêu hóa hoặc cơ xương khớp. Cần thực hiện xét nghiệm cận lâm sàng để xác định chính xác.
:::

## 3. Phác đồ điều trị & Hướng dẫn dùng thuốc

| Nhóm thuốc | Mục đích | Liều lượng & Thời điểm |
| --- | --- | --- |
| Kiểm soát huyết áp | Hạ áp mục tiêu < 130/80 mmHg | 1 viên buổi sáng sau ăn |
| Dự phòng biến chứng | Bảo vệ thành mạch | Theo chỉ định bác sĩ tim mạch |

:::dosage-guide Hướng dẫn uống thuốc an toàn
Tuyệt đối không tự ý ngừng thuốc hoặc thay đổi liều lượng khi chưa có ý kiến của Bác sĩ điều trị.
:::

## 4. Chế độ dinh dưỡng & Vận động tại nhà

1. Giảm lượng muối tiêu thụ dưới 5g/ngày (khoảng 1 thìa cà phê).
2. Tăng cường rau xanh, củ quả tươi giàu kali và chất xơ hòa tan.
3. Duy trì vận động nhẹ nhàng 30 phút mỗi ngày (đi bộ nhanh, yoga).

:::emergency-box Dấu hiệu cần đưa đi cấp cứu ngay
Nếu xuất hiện cơn đau thắt ngực dữ dội lan ra cánh tay trái, vã mồ hôi lạnh kèm khó thở, hãy gọi 115 hoặc đưa người bệnh đến khoa Cấp cứu gần nhất ngay lập tức.
:::

## 5. Lời khuyên của bác sĩ chuyên khoa

:::doctor-note Lời dặn từ chuyên gia y tế
Việc tuân thủ lịch tái khám định kỳ mỗi tháng giúp bác sĩ điều chỉnh phác đồ kịp thời và bảo vệ sức khỏe tim mạch của bạn bền vững.
:::
`,
  },
  {
    title: "Chế độ dinh dưỡng & Phòng ngừa",
    description: "Mẫu hướng dẫn thực đơn dinh dưỡng, nhóm chất nên ăn và nên tránh",
    content: `## 1. Tầm quan trọng của dinh dưỡng hợp lý

Chế độ ăn đóng vai trò then chốt trong việc kiểm soát diễn tiến bệnh và phục hồi thể trạng...

## 2. Danh mục thực phẩm nên dùng và cần hạn chế

- **Thực phẩm nên ưu tiên:**
  - Cá béo giàu Omega-3 (cá hồi, cá thu).
  - Các loại ngũ cốc nguyên cám (gạo lứt, yến mạch).
  - Rau lá xanh thẫm (cải bó xôi, súp lơ xanh).
- **Thực phẩm cần hạn chế tối đa:**
  - Thực phẩm chế biến sẵn đóng hộp nhiều natri.
  - Đồ uống có ga và chất kích thích.
  - Phủ tạng động vật và mỡ động vật.

:::doctor-note Nguyên tắc ăn uống lành mạnh
Nên chia nhỏ thành 4-5 bữa ăn trong ngày để hệ tiêu hóa hấp thu tối ưu và tránh tăng đường huyết đột ngột sau ăn.
:::
`,
  },
  {
    title: "Cảnh báo khẩn cấp & Sơ cứu ban đầu",
    description: "Mẫu tài liệu hướng dẫn xử trí nhanh các trường hợp y tế nguy kịch",
    content: `## 1. Nhận diện tình huống khẩn cấp

:::emergency-box Dấu hiệu nguy hiểm đe dọa tính mạng
- Bất tỉnh hoặc lơ mơ không đáp ứng.
- Khó thở dữ dội, tím tái môi đầu chi.
- Chấn thương nặng kèm chảy máu không cầm được.
:::

## 2. Các bước xử trí ban đầu (Sơ cứu)

1. **Giữ an toàn hiện trường:** Kiểm tra môi trường xung quanh trước khi tiếp cận nạn nhân.
2. **Gọi hỗ trợ y tế:** Lập tức gọi số cấp cứu **115** và nêu rõ vị trí, tình trạng người bệnh.
3. **Duy trì thông khí:** Đặt người bệnh nằm nghiêng an toàn nếu hôn mê nhưng còn thở.

:::clinical-warning Điều tuyệt đối KHÔNG làm
Không cho người bệnh uống nước hoặc dùng bất kỳ loại thuốc ngậm nào khi đang trong trạng thái co giật hoặc tri giác không tỉnh táo.
:::
`,
  },
];

export function RichTextEditor({
  value = "",
  onChange,
  placeholder = "Nhập nội dung bài viết... Bạn có thể dùng Markdown hoặc các công cụ định dạng phía trên.",
  label,
  minHeight = "320px",
  disabled = false,
  onReadingMinutesCalculated,
  purpose = "ARTICLE_COVER",
  id = "rich-text-editor",
  required = false,
}: RichTextEditorProps): ReactElement {
  const safeValue = value ?? "";
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileUploadInputRef = useRef<HTMLInputElement | null>(null);

  // axe frame-title + aria-prohibited-attr: name the editing iframe via its
  // title attribute, and drop TinyMCE's default aria-label on <body>, which
  // the ARIA spec prohibits on that element.
  const handleEditorInit = useCallback((_evt: unknown, editor: TinyMCEEditor) => {
    const iframe = editor.iframeElement ?? null;
    const frameTitle = label || "Trình soạn thảo nội dung";
    if (iframe && !iframe.getAttribute("title")) {
      iframe.setAttribute("title", frameTitle);
    }
    editor.getBody?.()?.removeAttribute?.("aria-label");
  }, [label]);

  // View mode: tinymce, edit, split, preview
  const [viewMode, setViewMode] = useState<EditorViewMode>("tinymce");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const tinyEditorInstanceRef = useRef<TinyMCEEditor | null>(null);

  // Modals for Link and Image insertion
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkText, setLinkText] = useState("");
  const [linkUrl, setLinkUrl] = useState("");

  const [showImageModal, setShowImageModal] = useState(false);
  const [imageAlt, setImageAlt] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isDraggingImageModal, setIsDraggingImageModal] = useState(false);
  const [isDirectUploading, setIsDirectUploading] = useState(false);
  const [directUploadError, setDirectUploadError] = useState<string | null>(null);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);

  // Dropdown states
  const [showCalloutMenu, setShowCalloutMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [pendingTemplate, setPendingTemplate] = useState<MedicalTemplate | null>(null);

  // History stack for Undo / Redo with external value synchronization
  const historyRef = useRef<string[]>([safeValue]);
  const historyIndexRef = useRef<number>(0);
  const isInternalChangeRef = useRef<boolean>(false);
  const lastExternalValueRef = useRef<string>(safeValue);
  const lastTypingTimeRef = useRef<number>(0);
  const savedSelectionRef = useRef<{ start: number; end: number } | null>(null);

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Synchronize history baseline when value changes externally (e.g. data loaded from API)
  useEffect(() => {
    if (!isInternalChangeRef.current && safeValue !== lastExternalValueRef.current) {
      historyRef.current = [safeValue];
      historyIndexRef.current = 0;
      lastExternalValueRef.current = safeValue;
      setCanUndo(false);
      setCanRedo(false);
    }
    isInternalChangeRef.current = false;
  }, [safeValue]);

  // Record history with smart batching for keystrokes vs immediate formatting
  const recordHistory = useCallback((newValue: string, immediate = false) => {
    const now = Date.now();
    const stack = historyRef.current.slice(0, historyIndexRef.current + 1);
    const currentTop = stack[stack.length - 1];
    if (currentTop === newValue) return;

    // Never overwrite initial baseline (stack.length <= 1)
    const isBaseline = stack.length <= 1;
    const isBoundary = /\s$/.test(newValue);
    const isTimeout = now - lastTypingTimeRef.current > 700;
    const shouldPush = immediate || isBaseline || isTimeout || isBoundary;

    if (shouldPush) {
      stack.push(newValue);
      if (stack.length > 50) stack.shift();
    } else {
      stack[stack.length - 1] = newValue;
    }

    historyRef.current = stack;
    historyIndexRef.current = stack.length - 1;
    lastTypingTimeRef.current = now;
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  // Entering a Markdown textarea (edit/split) with an HTML draft converts the
  // value to Markdown exactly once, so the displayed text, selection helpers,
  // and the stored value keep operating on one consistent string. The
  // previous-viewMode guard keeps typing inside the textarea from re-triggering
  // the conversion.
  const previousViewModeRef = useRef<EditorViewMode>("tinymce");
  useEffect(() => {
    const previousViewMode = previousViewModeRef.current;
    previousViewModeRef.current = viewMode;
    if (previousViewMode === viewMode) return;
    if (viewMode !== "edit" && viewMode !== "split") return;
    if (!containsHtml(safeValue)) return;
    const markdown = htmlToMarkdown(safeValue);
    isInternalChangeRef.current = true;
    lastExternalValueRef.current = markdown;
    onChange(markdown);
    recordHistory(markdown, true);
  }, [viewMode, safeValue, onChange, recordHistory]);

  const handleUndo = useCallback(() => {
    if (viewMode === "tinymce" && tinyEditorInstanceRef.current) {
      tinyEditorInstanceRef.current.undoManager.undo();
      return;
    }
    if (historyIndexRef.current > 0) {
      historyIndexRef.current -= 1;
      const prev = historyRef.current[historyIndexRef.current];
      isInternalChangeRef.current = true;
      lastExternalValueRef.current = prev;
      onChange(prev);
      setCanUndo(historyIndexRef.current > 0);
      setCanRedo(true);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [onChange, viewMode]);

  const handleRedo = useCallback(() => {
    if (viewMode === "tinymce" && tinyEditorInstanceRef.current) {
      tinyEditorInstanceRef.current.undoManager.redo();
      return;
    }
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyIndexRef.current += 1;
      const next = historyRef.current[historyIndexRef.current];
      isInternalChangeRef.current = true;
      lastExternalValueRef.current = next;
      onChange(next);
      setCanUndo(true);
      setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
      setTimeout(() => textareaRef.current?.focus(), 0);
    }
  }, [onChange, viewMode]);

  // Statistics — computed from markup-free text so an HTML draft (TinyMCE mode)
  // does not count tags as content.
  const plainSource = useMemo(
    () => (containsHtml(safeValue) ? htmlToMarkdown(safeValue) : safeValue),
    [safeValue]
  );
  const charCount = plainSource.length;
  const wordCount = plainSource.trim() ? plainSource.trim().split(/\s+/).length : 0;
  const readingMinutes = Math.max(1, Math.ceil(wordCount / 180));

  useEffect(() => {
    onReadingMinutesCalculated?.(readingMinutes);
  }, [readingMinutes, onReadingMinutesCalculated]);

  const safeValueHtml = useMemo(() => {
    if (!safeValue) return "<p></p>";
    return markdownToHtml(safeValue);
  }, [safeValue]);

  const handleTinyEditorChange = useCallback(
    (newHtml: string) => {
      isInternalChangeRef.current = true;
      lastExternalValueRef.current = newHtml;
      onChange(newHtml);
      recordHistory(newHtml);
    },
    [onChange, recordHistory]
  );

  const tinyMceInitConfig = useMemo(
    () => ({
      base_url: "/tinymce",
      suffix: ".min",
      // No menubar. Every label in it — File, Edit, View, Insert, Format, Tools,
      // Table and the whole dropdown beneath each — was English in a Vietnamese
      // product, and TinyMCE ships language packs separately. The choice was a
      // vendored download or no untranslated chrome, so the chrome goes: the
      // toolbar below carries the commands, including the row and column
      // operations the clinical templates need to build dosage tables.
      // Restore `menubar` together with a reviewed `language_url` if a vi pack
      // is ever added.
      menubar: false,
      // Wrap rather than overflow: the added commands must stay reachable in a
      // narrow editor instead of hiding behind a "more" button.
      toolbar_mode: "wrap" as const,
      // The toolbar is a promise about what will still be there tomorrow: the
      // body is stored as markdown, so a command whose result the converter
      // cannot express is a button that quietly eats the author's work.
      // Removed for exactly that reason, each verified lossy on the round trip:
      //   tablemergecells/tablesplitcells/tablecellprops — colspan and rowspan
      //     have no GFM syntax; the converter dropped them and shifted a
      //     rowspan's value into the wrong column of the dosage tables.
      //   media — <video>/<audio>/<iframe> sources are deleted, leaving a void.
      //   anchor — the id attribute is dropped, so intra-document links break.
      //   pagebreak, lineheight, accordion, emoticons — dropped entirely (the
      //     emoticons images are remote cdnjs URLs the CSP does not allow).
      // The table insert/row/column commands stay: those tables do survive as
      // GFM. tests/editor-toolbar-honesty.test.mjs pins the removals, and
      // tests/editor-round-trip.test.mjs pins what the pipeline keeps.
      toolbar: `undo redo | blocks | bold italic underline strikethrough | alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | table tableinsertrowbefore tableinsertrowafter tabledeleterow tableinsertcolbefore tableinsertcolafter tabledeletecol link ${
        MEDIA_UPLOADS_ENABLED ? "image " : ""
      }| clinical_warning doctor_note dosage_guide emergency_box | searchreplace charmap insertdatetime | hr nonbreaking selectall visualblocks | removeformat code preview fullscreen`,
      plugins: [
        "advlist",
        "autolink",
        "autosave",
        "lists",
        "link",
        "image",
        "charmap",
        "preview",
        "searchreplace",
        "visualblocks",
        "code",
        "fullscreen",
        "insertdatetime",
        "table",
        "wordcount",
        "nonbreaking",
        "quickbars",
      ],
      quickbars_selection_toolbar:
        "bold italic underline strikethrough | quicklink h2 h3 blockquote",
      quickbars_insert_toolbar: `${MEDIA_UPLOADS_ENABLED ? "quickimage " : ""}quicktable | hr`,
      // font_family_formats and font_size_formats used to sit here naming nine
      // typefaces and eleven sizes. Nothing could reach them: the menubar is
      // off and no toolbar token exposed the `fontfamily`/`fontsize` lists, so
      // they were dead configuration that read as supported capability.
      table_default_attributes: {
        border: "1",
      },
      table_default_styles: {
        "border-collapse": "collapse",
        width: "100%",
      },
      automatic_uploads: MEDIA_UPLOADS_ENABLED,
      paste_data_images: MEDIA_UPLOADS_ENABLED,
      // Word paste arrives as a whole Office document, and the parts that only
      // describe that document used to land in the body as visible text. The
      // hook is scrubbed before insertion; `paste_as_text` was the alternative
      // and was rejected because it also discards the tables and lists authors
      // legitimately paste out of Word.
      paste_preprocess: (_editor: TinyMCEEditor, args: { content: string }) => {
        args.content = stripWordPasteArtifacts(args.content);
      },
      images_reuse_filename: true,
      branding: false,
      promotion: false,
      elementpath: true,
      // A fixed height only. Referencing `isFullscreen` here looked like it
      // resized the editor, but `init` is read once at mount and never again,
      // so the fullscreen container grew around a 480px editor. The toggle is
      // now handled at runtime by the resizeTo effect below.
      height: 480,
      min_height: 380,
      skin: "oxide",
      content_css: "default",
      content_style: `
        @import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,600;1,700&display=swap');
        body {
          font-family: 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          font-size: 14px;
          line-height: 1.7;
          color: #0f172a;
          padding: 16px 20px;
          background-color: #ffffff;
        }
        h1, h2, h3, h4 { color: #0f172a; font-weight: 700; }
        h1 { font-size: 1.75rem; margin-top: 1.5rem; margin-bottom: 0.75rem; }
        h2 { font-size: 1.35rem; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-top: 1.5rem; color: #134e4a; }
        h3 { font-size: 1.15rem; margin-top: 1.25rem; color: #134e4a; }
        h4 { font-size: 1.05rem; margin-top: 1rem; }
        p { margin-bottom: 1rem; }
        table { border-collapse: collapse; width: 100%; margin: 14px 0; border: 1px solid #e2e8f0; }
        th, td { border: 1px solid #cbd5e1; padding: 9px 12px; font-size: 13px; }
        th { background-color: #f1f5f9; font-weight: 700; color: #0f172a; text-align: left; }
        tr:nth-child(even) { background-color: #f8fafc; }
        blockquote { border-left: 3px solid #0d9488; margin: 14px 0; padding: 8px 16px; background: #f0fdfa; color: #134e4a; font-style: italic; }
        details.accordion { border: 1px solid #e2e8f0; border-radius: 4px; padding: 10px 14px; margin: 12px 0; background: #f8fafc; }
        details.accordion summary { font-weight: 700; color: #0f172a; cursor: pointer; margin-bottom: 6px; }
        .clinical-warning {
          border: 1px solid #fde68a;
          border-left: 4px solid #f59e0b;
          background-color: #fefce8;
          padding: 12px 16px;
          margin: 14px 0;
          border-radius: 4px;
        }
        .doctor-note {
          border: 1px solid #ccfbf1;
          border-left: 4px solid #0d9488;
          background-color: #f0fdfa;
          padding: 12px 16px;
          margin: 14px 0;
          border-radius: 4px;
        }
        .dosage-guide {
          border: 1px solid #bae6fd;
          border-left: 4px solid #0284c7;
          background-color: #f0f9ff;
          padding: 12px 16px;
          margin: 14px 0;
          border-radius: 4px;
        }
        .emergency-box {
          border: 1px solid #fecdd3;
          border-left: 4px solid #e11d48;
          background-color: #fff1f2;
          padding: 12px 16px;
          margin: 14px 0;
          border-radius: 4px;
        }
        .clinical-prescription {
          border: 1px solid #c7d2fe;
          border-left: 4px solid #4f46e5;
          background-color: #eef2ff;
          padding: 12px 16px;
          margin: 14px 0;
          border-radius: 4px;
        }
        img { max-width: 100%; height: auto; border-radius: 4px; }
        figcaption { font-size: 12px; color: #64748b; font-style: italic; text-align: center; margin-top: 6px; }
      `,
      setup: (editor: TinyMCEEditor) => {
        tinyEditorInstanceRef.current = editor;

        editor.ui.registry.addButton("clinical_warning", {
          text: "⚠️ Cảnh báo",
          tooltip: "Chèn Cảnh báo lâm sàng (chống chỉ định, tác dụng phụ)",
          onAction: () => {
            const sel =
              editor.selection.getContent({ format: "html" }) ||
              "<p>Tác dụng phụ hoặc chống chỉ định lâm sàng cần đặc biệt lưu ý...</p>";
            editor.insertContent(
              '<div class="clinical-warning" data-callout="clinical-warning" data-title="Cảnh báo lâm sàng & Chống chỉ định"><p><strong style="color: #78350f;">⚠️ Cảnh báo lâm sàng & Chống chỉ định</strong></p>' +
                sel +
                "</div><p>&nbsp;</p>"
            );
          },
        });

        editor.ui.registry.addButton("doctor_note", {
          text: "💡 Lời khuyên",
          tooltip: "Chèn Lời khuyên bác sĩ chuyên khoa",
          onAction: () => {
            const sel =
              editor.selection.getContent({ format: "html" }) ||
              "<p>Dặn dò chăm sóc, thói quen sinh hoạt và phục hồi thể trạng...</p>";
            editor.insertContent(
              '<div class="doctor-note" data-callout="doctor-note" data-title="Lời khuyên bác sĩ chuyên khoa"><p><strong style="color: #134e4a;">💡 Lời khuyên bác sĩ chuyên khoa</strong></p>' +
                sel +
                "</div><p>&nbsp;</p>"
            );
          },
        });

        editor.ui.registry.addButton("dosage_guide", {
          text: "📋 Liều dùng",
          tooltip: "Chèn Hướng dẫn liều dùng & Phác đồ",
          onAction: () => {
            const sel =
              editor.selection.getContent({ format: "html" }) ||
              "<p>Liều lượng, thời điểm uống thuốc và lưu ý tương tác...</p>";
            editor.insertContent(
              '<div class="dosage-guide" data-callout="dosage-guide" data-title="Chỉ định & Hướng dẫn liều dùng"><p><strong style="color: #075985;">📋 Chỉ định & Hướng dẫn liều dùng</strong></p>' +
                sel +
                "</div><p>&nbsp;</p>"
            );
          },
        });

        editor.ui.registry.addButton("emergency_box", {
          text: "🚨 Cấp cứu",
          tooltip: "Chèn Dấu hiệu cấp cứu khẩn cấp",
          onAction: () => {
            const sel =
              editor.selection.getContent({ format: "html" }) ||
              "<p>Dấu hiệu nguy kịch đe dọa tính mạng cần cấp cứu 115 ngay...</p>";
            editor.insertContent(
              '<div class="emergency-box" data-callout="emergency-box" data-title="Dấu hiệu cấp cứu khẩn cấp"><p><strong style="color: #9f1239;">🚨 Dấu hiệu cấp cứu khẩn cấp</strong></p>' +
                sel +
                "</div><p>&nbsp;</p>"
            );
          },
        });

        const clinicalCalloutEntries = [
          {
            type: "menuitem",
            text: "⚠️ Cảnh báo lâm sàng",
            onAction: () =>
              editor.execCommand(
                "mceInsertContent",
                false,
                '<div class="clinical-warning" data-callout="clinical-warning"><p><strong>⚠️ Cảnh báo lâm sàng</strong></p><p>Nội dung cảnh báo...</p></div><p>&nbsp;</p>'
              ),
          },
          {
            type: "menuitem",
            text: "💡 Lời khuyên bác sĩ",
            onAction: () =>
              editor.execCommand(
                "mceInsertContent",
                false,
                '<div class="doctor-note" data-callout="doctor-note"><p><strong>💡 Lời khuyên bác sĩ</strong></p><p>Lời khuyên...</p></div><p>&nbsp;</p>'
              ),
          },
          {
            type: "menuitem",
            text: "📋 Hướng dẫn dùng thuốc",
            onAction: () =>
              editor.execCommand(
                "mceInsertContent",
                false,
                '<div class="dosage-guide" data-callout="dosage-guide"><p><strong>📋 Hướng dẫn dùng thuốc</strong></p><p>Liều lượng...</p></div><p>&nbsp;</p>'
              ),
          },
          {
            type: "menuitem",
            text: "🚨 Dấu hiệu cấp cứu",
            onAction: () =>
              editor.execCommand(
                "mceInsertContent",
                false,
                '<div class="emergency-box" data-callout="emergency-box"><p><strong>🚨 Dấu hiệu cấp cứu</strong></p><p>Dấu hiệu...</p></div><p>&nbsp;</p>'
              ),
          },
        ] as const;

        editor.ui.registry.addNestedMenuItem("clinical_callouts", {
          text: "Hộp ghi chú y khoa",
          getSubmenuItems: () => [...clinicalCalloutEntries],
        });

        editor.ui.registry.addMenuButton("clinical_callouts", {
          text: "Hộp ghi chú y khoa",
          fetch: (callback) => {
            callback([...clinicalCalloutEntries]);
          },
        });

        const templateMenuItems = MEDICAL_TEMPLATES.map((tmpl) => ({
          type: "menuitem" as const,
          text: tmpl.title,
          onAction: () => {
            const html = markdownToHtml(tmpl.content);
            editor.insertContent(html);
          },
        }));

        editor.ui.registry.addNestedMenuItem("clinical_templates", {
          text: "Mẫu bài viết y khoa chuẩn",
          getSubmenuItems: () => templateMenuItems,
        });
      },
      images_upload_handler: async (blobInfo: { blob: () => Blob; filename: () => string }) => {
        if (!MEDIA_UPLOADS_ENABLED) {
          const message = MEDIA_UPLOADS_DISABLED_MESSAGE;
          setDirectUploadError(message);
          throw new Error(message);
        }
        try {
          setIsDirectUploading(true);
          const blob = blobInfo.blob();
          const file = new File([blob], blobInfo.filename() || "article-media.png", { type: blob.type });
          const uploadRes = await uploadMediaAsset(file, purpose);
          setIsDirectUploading(false);
          return uploadRes.url;
        } catch (err) {
          setIsDirectUploading(false);
          const message = err instanceof ApiError
            ? presentApiError(err.code, err.status)
            : "Không thể tải ảnh lên máy chủ bệnh viện.";
          setDirectUploadError(message);
          throw new Error(message);
        }
      },
    }),
    [isFullscreen, purpose]
  );

  // Handle escape key in fullscreen or modal
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        if (showLinkModal) setShowLinkModal(false);
        else if (showImageModal) setShowImageModal(false);
        else if (showCalloutMenu) setShowCalloutMenu(false);
        else if (showTemplateMenu) setShowTemplateMenu(false);
        else if (isFullscreen) setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen, showLinkModal, showImageModal, showCalloutMenu, showTemplateMenu]);

  // The fullscreen container grew while the editor inside it stayed 480px tall.
  // `init` is read once at mount, so a height declared there can never react to
  // the toggle — the original config put `isFullscreen ? "100%" : 480` in init
  // and it was never applied. resizeTo is the runtime API for this.
  useEffect(() => {
    const editor = tinyEditorInstanceRef.current;
    if (!editor) return;
    let cancelled = false;
    const apply = () => {
      if (cancelled) return;
      const instance = tinyEditorInstanceRef.current;
      if (!instance) return;
      const targetHeight = isFullscreen
        ? Math.max(360, Math.round(window.innerHeight * 0.7))
        : 480;
      try {
        // `resizeTo` is documented and present at runtime but absent from the
        // bundled type definitions, so it is reached through a narrow shape
        // rather than casting the whole editor to `any`.
        (instance.theme as unknown as { resizeTo?: (w: number | null, h: number) => void })
          .resizeTo?.(null, targetHeight);
      } catch {
        // The editor can be torn down between the toggle and this callback;
        // a stale instance is not an error worth surfacing to the author.
      }
    };
    // Let the container finish its layout before measuring the target.
    const frame = window.requestAnimationFrame(apply);
    return () => {
      cancelled = true;
      window.cancelAnimationFrame(frame);
    };
  }, [isFullscreen]);

  // Helper to wrap selected text in textarea (with toggle off support)
  const wrapSelection = useCallback(
    (before: string, after: string, defaultText = "văn bản") => {
      if (viewMode === "tinymce" && tinyEditorInstanceRef.current) {
        const editor = tinyEditorInstanceRef.current;
        if (before === "**") {
          editor.execCommand("Bold");
          return;
        }
        if (before === "*") {
          editor.execCommand("Italic");
          return;
        }
        if (before === "~~") {
          editor.execCommand("Strikethrough");
          return;
        }
        if (before === "`") {
          editor.execCommand("mceToggleFormat", false, "code");
          return;
        }
      }
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const selectedText = safeValue.slice(start, end);

      if (!selectedText) {
        const replacement = `${before}${defaultText}${after}`;
        const newValue = safeValue.slice(0, start) + replacement + safeValue.slice(end);
        isInternalChangeRef.current = true;
        lastExternalValueRef.current = newValue;
        onChange(newValue);
        recordHistory(newValue, true);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(
            start + before.length,
            start + before.length + defaultText.length,
          );
        }, 0);
        return;
      }

      // If already wrapped by before/after: toggle off (unwrap)
      if (
        selectedText.startsWith(before) &&
        selectedText.endsWith(after) &&
        selectedText.length >= before.length + after.length
      ) {
        const unwrapped = selectedText.slice(before.length, selectedText.length - after.length);
        const newValue = safeValue.slice(0, start) + unwrapped + safeValue.slice(end);
        isInternalChangeRef.current = true;
        lastExternalValueRef.current = newValue;
        onChange(newValue);
        recordHistory(newValue, true);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start, start + unwrapped.length);
        }, 0);
        return;
      }

      // If outer boundary already matches before/after
      if (
        start >= before.length &&
        safeValue.slice(start - before.length, start) === before &&
        safeValue.slice(end, end + after.length) === after
      ) {
        const newValue = safeValue.slice(0, start - before.length) + selectedText + safeValue.slice(end + after.length);
        isInternalChangeRef.current = true;
        lastExternalValueRef.current = newValue;
        onChange(newValue);
        recordHistory(newValue, true);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start - before.length, end - before.length);
        }, 0);
        return;
      }

      const replacement = `${before}${selectedText}${after}`;
      const newValue = safeValue.slice(0, start) + replacement + safeValue.slice(end);
      isInternalChangeRef.current = true;
      lastExternalValueRef.current = newValue;
      onChange(newValue);
      recordHistory(newValue, true);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          start + before.length,
          start + before.length + selectedText.length,
        );
      }, 0);
    },
    [safeValue, viewMode, onChange, recordHistory],
  );

  // Helper to prefix lines with markdown (supports intelligent toggle, consecutive numbered lists, and checklist)
  const prefixLines = useCallback(
    (prefix: string) => {
      if (viewMode === "tinymce" && tinyEditorInstanceRef.current) {
        const editor = tinyEditorInstanceRef.current;
        if (prefix === "## ") {
          editor.execCommand("mceToggleFormat", false, "h2");
          return;
        }
        if (prefix === "### ") {
          editor.execCommand("mceToggleFormat", false, "h3");
          return;
        }
        if (prefix === "- ") {
          editor.execCommand("InsertUnorderedList");
          return;
        }
        if (prefix === "1. ") {
          editor.execCommand("InsertOrderedList");
          return;
        }
        if (prefix === "> ") {
          editor.execCommand("mceToggleFormat", false, "blockquote");
          return;
        }
      }
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // Find start of current line
      const lineStart = safeValue.lastIndexOf("\n", start - 1) + 1;
      const lineEnd = safeValue.indexOf("\n", end);
      const effectiveEnd = lineEnd === -1 ? safeValue.length : lineEnd;

      const targetBlock = safeValue.slice(lineStart, effectiveEnd);
      const modified = targetBlock
        .split("\n")
        .map((line, idx) => {
          if (prefix === "## " || prefix === "### ") {
            if (line.startsWith(prefix)) {
              return line.slice(prefix.length); // toggle off
            }
            if (/^#{1,6}\s+/.test(line)) {
              return line.replace(/^#{1,6}\s+/, prefix); // switch heading
            }
            return prefix + line;
          }
          if (prefix === "- ") {
            if (/^[-*+]\s+\[[ xX]\]\s+/.test(line)) {
              return line.replace(/^[-*+]\s+\[[ xX]\]\s+/, "- "); // switch from checklist to bullet
            }
            if (/^[-*+]\s+/.test(line)) {
              return line.replace(/^[-*+]\s+/, ""); // toggle off
            }
            if (/^\d+\.\s+/.test(line)) {
              return line.replace(/^\d+\.\s+/, "- "); // switch from numbered to bullet
            }
            return prefix + line;
          }
          if (prefix === "- [ ] ") {
            if (/^[-*+]\s+\[[ xX]\]\s+/.test(line)) {
              return line.replace(/^[-*+]\s+\[[ xX]\]\s+/, ""); // toggle off
            }
            if (/^[-*+]\s+/.test(line)) {
              return line.replace(/^[-*+]\s+/, "- [ ] "); // switch bullet to checklist
            }
            if (/^\d+\.\s+/.test(line)) {
              return line.replace(/^\d+\.\s+/, "- [ ] "); // switch numbered to checklist
            }
            return prefix + line;
          }
          if (prefix === "1. ") {
            if (/^\d+\.\s+/.test(line)) {
              return line.replace(/^\d+\.\s+/, ""); // toggle off
            }
            if (/^[-*+]\s+\[[ xX]\]\s+/.test(line)) {
              return line.replace(/^[-*+]\s+\[[ xX]\]\s+/, `${idx + 1}. `); // switch from checklist to numbered
            }
            if (/^[-*+]\s+/.test(line)) {
              return line.replace(/^[-*+]\s+/, `${idx + 1}. `); // switch from bullet to numbered
            }
            return `${idx + 1}. ` + line;
          }
          if (prefix === "> ") {
            if (/^>\s?/.test(line)) {
              return line.replace(/^>\s?/, ""); // toggle off
            }
            return prefix + line;
          }
          return prefix + line;
        })
        .join("\n");

      const newValue = safeValue.slice(0, lineStart) + modified + safeValue.slice(effectiveEnd);
      isInternalChangeRef.current = true;
      lastExternalValueRef.current = newValue;
      onChange(newValue);
      recordHistory(newValue, true);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(lineStart, lineStart + modified.length);
      }, 0);
    },
    [safeValue, viewMode, onChange, recordHistory],
  );

  // Insert raw text at cursor
  const insertAtCursor = useCallback(
    (snippet: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      const newValue = safeValue.slice(0, start) + snippet + safeValue.slice(end);
      isInternalChangeRef.current = true;
      lastExternalValueRef.current = newValue;
      onChange(newValue);
      recordHistory(newValue, true);

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + snippet.length, start + snippet.length);
      }, 0);
    },
    [safeValue, onChange, recordHistory],
  );

  // Open Link modal preserving current selection range
  const handleOpenLinkModal = useCallback(() => {
    if (disabled || viewMode === "preview") return;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? 0;
    const end = textarea?.selectionEnd ?? 0;
    savedSelectionRef.current = { start, end };
    const selected = textarea ? safeValue.slice(start, end) : "";
    setLinkText(selected || "Xem hướng dẫn");
    setLinkUrl("https://");
    setShowLinkModal(true);
  }, [disabled, viewMode, safeValue]);

  // Open Image modal preserving current selection range
  const handleOpenImageModal = useCallback(() => {
    if (disabled || viewMode === "preview") return;
    const textarea = textareaRef.current;
    const start = textarea?.selectionStart ?? safeValue.length;
    const end = textarea?.selectionEnd ?? safeValue.length;
    savedSelectionRef.current = { start, end };
    setShowImageModal(true);
  }, [disabled, viewMode, safeValue.length]);

  // Keyboard shortcut handler
  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;

    // Ctrl / Cmd combinations
    if (e.ctrlKey || e.metaKey) {
      if (e.key.toLowerCase() === "s") {
        e.preventDefault();
        return;
      }
      if (e.key.toLowerCase() === "b") {
        e.preventDefault();
        wrapSelection("**", "**", "in đậm");
        return;
      }
      if (e.key.toLowerCase() === "i") {
        e.preventDefault();
        wrapSelection("*", "*", "in nghiêng");
        return;
      }
      if (e.key.toLowerCase() === "k") {
        e.preventDefault();
        handleOpenLinkModal();
        return;
      }
      if (e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        handleUndo();
        return;
      }
      if (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey)) {
        e.preventDefault();
        handleRedo();
        return;
      }
    }

    // Tab and Shift+Tab key indent (with multi-line selection support to prevent data loss)
    if (e.key === "Tab") {
      e.preventDefault();
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;

      // If selection spans multiple lines
      if (start !== end && safeValue.slice(start, end).includes("\n")) {
        const lineStart = safeValue.lastIndexOf("\n", start - 1) + 1;
        const lineEnd = safeValue.indexOf("\n", end);
        const effectiveEnd = lineEnd === -1 ? safeValue.length : lineEnd;
        const targetBlock = safeValue.slice(lineStart, effectiveEnd);

        let modified: string;
        if (e.shiftKey) {
          modified = targetBlock
            .split("\n")
            .map((line) => line.replace(/^ {1,2}/, ""))
            .join("\n");
        } else {
          modified = targetBlock
            .split("\n")
            .map((line) => "  " + line)
            .join("\n");
        }

        const newValue = safeValue.slice(0, lineStart) + modified + safeValue.slice(effectiveEnd);
        isInternalChangeRef.current = true;
        lastExternalValueRef.current = newValue;
        onChange(newValue);
        recordHistory(newValue, true);

        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(lineStart, lineStart + modified.length);
        }, 0);
        return;
      }

      // Single line or collapsed cursor
      if (e.shiftKey) {
        // Unindent 2 spaces
        const lineStart = safeValue.lastIndexOf("\n", start - 1) + 1;
        if (safeValue.slice(lineStart, lineStart + 2) === "  ") {
          const newValue = safeValue.slice(0, lineStart) + safeValue.slice(lineStart + 2);
          isInternalChangeRef.current = true;
          lastExternalValueRef.current = newValue;
          onChange(newValue);
          recordHistory(newValue, true);
          setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(Math.max(lineStart, start - 2), Math.max(lineStart, end - 2));
          }, 0);
        }
      } else {
        insertAtCursor("  ");
      }
    }
  };

  // Link dialog submit (restores exact saved selection range)
  const handleInsertLink = () => {
    if (!linkUrl.trim()) return;
    if (viewMode === "tinymce" && tinyEditorInstanceRef.current) {
      const text = linkText.trim() || linkUrl.trim();
      tinyEditorInstanceRef.current.insertContent(`<a href="${linkUrl.trim()}">${text}</a>`);
      setShowLinkModal(false);
      setLinkText("");
      setLinkUrl("");
      return;
    }
    const markdown = `[${linkText.trim() || linkUrl.trim()}](${linkUrl.trim()})`;
    const sel = savedSelectionRef.current;
    savedSelectionRef.current = null;
    if (sel) {
      const newValue = safeValue.slice(0, sel.start) + markdown + safeValue.slice(sel.end);
      isInternalChangeRef.current = true;
      lastExternalValueRef.current = newValue;
      onChange(newValue);
      recordHistory(newValue, true);
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(sel.start + markdown.length, sel.start + markdown.length);
        }
      }, 0);
    } else {
      insertAtCursor(markdown);
    }
    setShowLinkModal(false);
    setLinkText("");
    setLinkUrl("");
  };

  // Image dialog submit (restores exact saved selection range)
  const handleInsertImage = () => {
    if (!imageUrl.trim()) return;
    if (viewMode === "tinymce" && tinyEditorInstanceRef.current) {
      const alt = imageAlt.trim() || "Hình ảnh y khoa";
      tinyEditorInstanceRef.current.insertContent(
        `<figure style="margin: 14px 0; text-align: center;"><img src="${imageUrl.trim()}" alt="${alt}" style="max-width: 100%; border-radius: 4px;" /><figcaption style="font-size: 12px; color: #64748b; font-style: italic; margin-top: 6px;">${alt}</figcaption></figure><p>&nbsp;</p>`
      );
      setShowImageModal(false);
      setImageAlt("");
      setImageUrl("");
      setImageUploadError(null);
      return;
    }
    const markdown = `\n![${imageAlt.trim() || "Hình ảnh y khoa"}](${imageUrl.trim()})\n`;
    const sel = savedSelectionRef.current;
    savedSelectionRef.current = null;
    if (sel) {
      const newValue = safeValue.slice(0, sel.start) + markdown + safeValue.slice(sel.end);
      isInternalChangeRef.current = true;
      lastExternalValueRef.current = newValue;
      onChange(newValue);
      recordHistory(newValue, true);
      setTimeout(() => {
        const ta = textareaRef.current;
        if (ta) {
          ta.focus();
          ta.setSelectionRange(sel.start + markdown.length, sel.start + markdown.length);
        }
      }, 0);
    } else {
      insertAtCursor(markdown);
    }
    setShowImageModal(false);
    setImageAlt("");
    setImageUrl("");
    setImageUploadError(null);
  };

  // Process file upload helper
  const processImageFile = async (file: File): Promise<string | null> => {
    if (!file.type.startsWith("image/")) {
      setImageUploadError("Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, WEBP, GIF).");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      setImageUploadError("Dung lượng ảnh vượt quá giới hạn 10 MB.");
      return null;
    }

    setImageUploadError(null);
    setIsUploadingImage(true);

    try {
      const res = await uploadMediaAsset(file, purpose);
      setImageUrl(res.url);
      if (!imageAlt) {
        setImageAlt(file.name.replace(/\.[^/.]+$/, ""));
      }
      return res.url;
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? presentApiError(err.code, err.status) : "Tải ảnh lên thất bại.";
      setImageUploadError(msg);
      return null;
    } finally {
      setIsUploadingImage(false);
    }
  };

  // Direct file input upload inside image dialog
  const handleProcessImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processImageFile(file);
    }
  };

  // Drag and drop onto image modal dropzone
  const handleImageModalDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDraggingImageModal(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      await processImageFile(file);
    }
  };

  // Direct Drag & Drop image file onto the textarea (non-blocking notification, batches multiple files)
  const handleTextareaDrop = async (e: React.DragEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    const files = Array.from(e.dataTransfer.files).filter((f) => f.type.startsWith("image/"));
    if (files.length > 0) {
      e.preventDefault();
      setIsDirectUploading(true);
      setDirectUploadError(null);
      try {
        const snippets: string[] = [];
        for (const file of files) {
          const res = await uploadMediaAsset(file, purpose);
          const alt = file.name.replace(/\.[^/.]+$/, "") || "Hình ảnh y khoa";
          snippets.push(`\n![${alt}](${res.url})\n`);
        }
        if (snippets.length > 0) {
          insertAtCursor(snippets.join(""));
        }
      } catch (err: unknown) {
        const msg = err instanceof ApiError ? presentApiError(err.code, err.status) : "Tải ảnh lên thất bại.";
        setDirectUploadError(msg);
        setTimeout(() => setDirectUploadError(null), 6000);
      } finally {
        setIsDirectUploading(false);
      }
    }
  };

  // Direct Clipboard Image Paste (Ctrl+V) into textarea (non-blocking notification, batches multiple files)
  const handleTextareaPaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (disabled) return;
    const items = e.clipboardData.items;
    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind === "file" && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length > 0) {
      e.preventDefault();
      setIsDirectUploading(true);
      setDirectUploadError(null);
      try {
        const snippets: string[] = [];
        for (const file of imageFiles) {
          const res = await uploadMediaAsset(file, purpose);
          snippets.push(`\n![Ảnh chụp đính kèm](${res.url})\n`);
        }
        if (snippets.length > 0) {
          insertAtCursor(snippets.join(""));
        }
      } catch (err: unknown) {
        const msg = err instanceof ApiError ? presentApiError(err.code, err.status) : "Tải ảnh lên thất bại.";
        setDirectUploadError(msg);
        setTimeout(() => setDirectUploadError(null), 6000);
      } finally {
        setIsDirectUploading(false);
      }
    }
  };

  // Insert Table Template
  const handleInsertTable = () => {
    if (viewMode === "tinymce" && tinyEditorInstanceRef.current) {
      tinyEditorInstanceRef.current.execCommand("mceInsertTable", false, {
        rows: 3,
        columns: 3,
      });
      return;
    }
    const tableSnippet = `\n| Tiêu chuẩn lâm sàng | Chỉ số khuyến nghị | Ghi chú theo dõi |
| --- | --- | --- |
| Huyết áp mục tiêu | < 130/80 mmHg | Đo cố định vào buổi sáng |
| Đường huyết đói | 70 - 99 mg/dL | Nhịn ăn ít nhất 8 tiếng |
| Chỉ số BMI | 18.5 - 22.9 kg/m² | Duy trì cân nặng ổn định |\n`;
    insertAtCursor(tableSnippet);
  };

  // Insert Code Block Template (wraps highlighted selection if available)
  const handleInsertCodeBlock = () => {
    if (viewMode === "tinymce" && tinyEditorInstanceRef.current) {
      const editor = tinyEditorInstanceRef.current;
      const sel = editor.selection.getContent() || "// Nội dung định dạng kỹ thuật hoặc bảng mã y khoa";
      editor.insertContent(`<pre><code>${sel}</code></pre><p>&nbsp;</p>`);
      return;
    }
    const textarea = textareaRef.current;
    const selected = textarea && textarea.selectionStart !== textarea.selectionEnd
      ? safeValue.slice(textarea.selectionStart, textarea.selectionEnd)
      : "";
    const inner = selected || "// Nội dung định dạng kỹ thuật hoặc bảng mã y khoa";
    const codeSnippet = `\n\`\`\`\n${inner}\n\`\`\`\n`;
    insertAtCursor(codeSnippet);
  };

  // Insert Clinical Callout (wraps highlighted selection if available)
  const handleInsertCallout = (kind: string, title?: string) => {
    setShowCalloutMenu(false);
    if (viewMode === "tinymce" && tinyEditorInstanceRef.current) {
      const editor = tinyEditorInstanceRef.current;
      const sel = editor.selection.getContent({ format: "html" }) || `<p>Nhập thông tin chuyên môn, khuyến cáo y khoa hoặc hướng dẫn chi tiết tại đây...</p>`;
      const titleColors: Record<string, string> = {
        "clinical-warning": "#78350f",
        "doctor-note": "#134e4a",
        "dosage-guide": "#075985",
        "emergency-box": "#9f1239",
      };
      const icons: Record<string, string> = {
        "clinical-warning": "⚠️",
        "doctor-note": "💡",
        "dosage-guide": "📋",
        "emergency-box": "🚨",
      };
      const icon = icons[kind] || "ℹ️";
      const color = titleColors[kind] || "#0f172a";
      const displayTitle = title || "Ghi chú chuyên môn";
      editor.insertContent(
        `<div class="${kind}" data-callout="${kind}" data-title="${displayTitle}"><p><strong style="color: ${color};">${icon} ${displayTitle}</strong></p>${sel}</div><p>&nbsp;</p>`
      );
      return;
    }
    const textarea = textareaRef.current;
    const selected = textarea && textarea.selectionStart !== textarea.selectionEnd
      ? safeValue.slice(textarea.selectionStart, textarea.selectionEnd)
      : "";
    const inner = selected || "Nhập thông tin chuyên môn, khuyến cáo y khoa hoặc hướng dẫn chi tiết tại đây...";
    const snippet = `\n:::${kind}${title ? ` ${title}` : ""}\n${inner}\n:::\n`;
    insertAtCursor(snippet);
  };

  // Keeps the textarea selection alive across the confirm dialog so undo/redo
  // and the highlighted range survive an open/close round-trip.
  const restoreSavedSelection = useCallback(() => {
    const saved = savedSelectionRef.current;
    savedSelectionRef.current = null;
    const textarea = textareaRef.current;
    if (saved && textarea) {
      textarea.focus();
      try {
        textarea.setSelectionRange(saved.start, saved.end);
      } catch {
        // selection restore is best-effort
      }
    }
  }, []);

  const applyTemplateNow = useCallback((tmpl: MedicalTemplate) => {
    if (viewMode === "tinymce" && tinyEditorInstanceRef.current) {
      const html = markdownToHtml(tmpl.content);
      const editor = tinyEditorInstanceRef.current;
      const currentHtml = editor.getContent();
      const newHtml = currentHtml.trim() ? `${currentHtml}<hr /><p>&nbsp;</p>${html}` : html;
      editor.setContent(newHtml);
      handleTinyEditorChange(newHtml);
      return;
    }
    const newValue = safeValue.trim() ? `${safeValue}\n\n${tmpl.content}` : tmpl.content;
    isInternalChangeRef.current = true;
    lastExternalValueRef.current = newValue;
    onChange(newValue);
    recordHistory(newValue, true);
  }, [safeValue, viewMode, handleTinyEditorChange, onChange, recordHistory]);

  // Apply Medical Template
  const handleApplyTemplate = (tmpl: MedicalTemplate) => {
    if (disabled) return;
    setShowTemplateMenu(false);
    if (safeValue.trim()) {
      const textarea = textareaRef.current;
      savedSelectionRef.current = {
        start: textarea?.selectionStart ?? safeValue.length,
        end: textarea?.selectionEnd ?? safeValue.length,
      };
      setPendingTemplate(tmpl);
      return;
    }
    applyTemplateNow(tmpl);
  };

  const handleConfirmTemplate = () => {
    const tmpl = pendingTemplate;
    if (!tmpl) return;
    setPendingTemplate(null);
    restoreSavedSelection();
    applyTemplateNow(tmpl);
  };

  const handleCancelTemplate = () => {
    setPendingTemplate(null);
    restoreSavedSelection();
  };

  const containerClasses = isFullscreen
    ? "fixed inset-0 z-50 flex flex-col bg-white p-4 sm:p-6 shadow-2xl overflow-hidden"
    : "flex flex-col rounded-[4px] border border-slate-300 bg-white transition-colors focus-within:border-teal-700 focus-within:ring-1 focus-within:ring-teal-700";

  // The visible label has to point at the control that is actually mounted.
  // TinyMCE does not use the caller's `id`: tinymce-react renders its own
  // textarea carrying this one and swaps in an iframe, so a label left pointing
  // at `id` named nothing in the default mode — the association was lost in
  // exactly the mode an author lands in. Deriving both from one value keeps the
  // label and the editor from drifting apart again, and the iframe keeps the
  // same accessible name through `iframe_title`/`handleEditorInit` below.
  const tinyEditorId = id ? `${id}-tinymce` : "healthcare-tinymce-editor";
  const editorControlId = viewMode === "tinymce" ? tinyEditorId : id;

  return (
    <div className={containerClasses}>
      {/* Editor Header / Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/90 px-3 py-2">
        <div className="flex items-center gap-2">
          {label && (
            <label
              className="text-xs font-bold uppercase tracking-wider text-slate-800"
              htmlFor={editorControlId}
              id={`${id}-label`}
            >
              {label} {required && <span className="text-red-500">*</span>}
            </label>
          )}
          <span className="hidden sm:inline-flex items-center gap-1 rounded-[3px] bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800 border border-teal-200">
            <UiIcon name="sparkles" size={11} />
            <span>Trình soạn thảo y khoa</span>
          </span>
        </div>

        {/* View Mode Switcher + Fullscreen */}
        <div className="flex items-center gap-1">
          <div className="inline-flex rounded-[3px] border border-slate-300 bg-white p-0.5">
            <button
              aria-label="Chế độ trực quan TinyMCE"
              aria-pressed={viewMode === "tinymce"}
              className={`rounded-[2px] px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer flex items-center gap-1 ${
                viewMode === "tinymce"
                  ? "bg-teal-800 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              onClick={() => setViewMode("tinymce")}
              title="Trực quan (TinyMCE)"
              type="button"
            >
              <UiIcon name="sparkles" size={11} />
              <span>TinyMCE</span>
            </button>
            <button
              aria-label="Mã nguồn"
              aria-pressed={viewMode === "edit"}
              className={`rounded-[2px] px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === "edit"
                  ? "bg-teal-800 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              onClick={() => setViewMode("edit")}
              title="Chỉ soạn thảo"
              type="button"
            >
              Mã nguồn
            </button>
            <button
              aria-label="Chế độ chia đôi màn hình xem trước trực quan"
              aria-pressed={viewMode === "split"}
              className={`rounded-[2px] px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === "split"
                  ? "bg-teal-800 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              onClick={() => setViewMode("split")}
              title="Chia đôi: Soạn thảo và Xem trước song song"
              type="button"
            >
              Chia đôi
            </button>
            <button
              aria-label="Chế độ xem trước toàn bộ bài viết"
              aria-pressed={viewMode === "preview"}
              className={`rounded-[2px] px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer ${
                viewMode === "preview"
                  ? "bg-teal-800 text-white"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
              }`}
              onClick={() => setViewMode("preview")}
              title="Xem trước định dạng"
              type="button"
            >
              Xem trước
            </button>
          </div>

          <button
            aria-label={isFullscreen ? "Thoát toàn màn hình" : "Mở rộng toàn màn hình"}
            className="inline-flex items-center justify-center rounded-[3px] border border-slate-300 bg-white p-1.5 text-slate-600 hover:text-teal-900 hover:bg-slate-100 cursor-pointer transition ml-1 min-h-[30px]"
            onClick={() => setIsFullscreen(!isFullscreen)}
            title={isFullscreen ? "Thu nhỏ (Esc)" : "Toàn màn hình"}
            type="button"
          >
            <UiIcon name="layers" size={14} />
          </button>
        </div>
      </div>

      {/* Formatting Toolbar */}
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-white p-1.5 text-slate-700">
        {/* Undo / Redo */}
        <button
          aria-label="Hoàn tác (Ctrl+Z)"
          className="rounded-[3px] p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
          disabled={disabled || !canUndo}
          onClick={handleUndo}
          onMouseDown={(e) => e.preventDefault()}
          title="Hoàn tác (Ctrl+Z)"
          type="button"
        >
          <span className="font-bold text-xs">↶ Hoàn tác</span>
        </button>
        <button
          aria-label="Làm lại (Ctrl+Y)"
          className="rounded-[3px] p-1.5 text-slate-600 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
          disabled={disabled || !canRedo}
          onClick={handleRedo}
          onMouseDown={(e) => e.preventDefault()}
          title="Làm lại (Ctrl+Y)"
          type="button"
        >
          <span className="font-bold text-xs">↷ Làm lại</span>
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        {/* Headings */}
        <button
          aria-label="Tiêu đề mục lớn (H2)"
          className="rounded-[3px] px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-teal-900 cursor-pointer"
          disabled={disabled}
          onClick={() => prefixLines("## ")}
          onMouseDown={(e) => e.preventDefault()}
          title="Tiêu đề cấp 2 (##)"
          type="button"
        >
          H2
        </button>
        <button
          aria-label="Tiêu đề mục nhỏ (H3)"
          className="rounded-[3px] px-2 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100 hover:text-teal-900 cursor-pointer"
          disabled={disabled}
          onClick={() => prefixLines("### ")}
          onMouseDown={(e) => e.preventDefault()}
          title="Tiêu đề cấp 3 (###)"
          type="button"
        >
          H3
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        {/* Basic Styles */}
        <button
          aria-label="In đậm (Ctrl+B)"
          className="rounded-[3px] px-2 py-1 text-xs font-black text-slate-800 hover:bg-slate-100 hover:text-teal-900 cursor-pointer"
          disabled={disabled}
          onClick={() => wrapSelection("**", "**", "in đậm")}
          onMouseDown={(e) => e.preventDefault()}
          title="In đậm (Ctrl+B)"
          type="button"
        >
          B
        </button>
        <button
          aria-label="In nghiêng (Ctrl+I)"
          className="rounded-[3px] px-2 py-1 text-xs font-semibold italic text-slate-800 hover:bg-slate-100 hover:text-teal-900 cursor-pointer"
          disabled={disabled}
          onClick={() => wrapSelection("*", "*", "in nghiêng")}
          onMouseDown={(e) => e.preventDefault()}
          title="In nghiêng (Ctrl+I)"
          type="button"
        >
          I
        </button>
        <button
          aria-label="Gạch ngang"
          className="rounded-[3px] px-2 py-1 text-xs line-through text-slate-600 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
          disabled={disabled}
          onClick={() => wrapSelection("~~", "~~", "gạch ngang")}
          onMouseDown={(e) => e.preventDefault()}
          title="Gạch ngang (~~)"
          type="button"
        >
          S
        </button>
        <button
          aria-label="Mã định dạng / Tên thuốc"
          className="rounded-[3px] px-1.5 py-1 font-mono text-xs text-slate-700 hover:bg-slate-100 hover:text-teal-900 cursor-pointer"
          disabled={disabled}
          onClick={() => wrapSelection("`", "`", "thuật ngữ")}
          onMouseDown={(e) => e.preventDefault()}
          title="Thuật ngữ / Tên thuốc (`)"
          type="button"
        >
          {"< >"}
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        {/* Lists & Quotes */}
        <button
          aria-label="Danh sách gạch đầu dòng"
          className="rounded-[3px] px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-teal-900 cursor-pointer"
          disabled={disabled || viewMode === "preview"}
          onClick={() => prefixLines("- ")}
          onMouseDown={(e) => e.preventDefault()}
          title="Danh sách dấu chấm (-)"
          type="button"
        >
          • Danh sách
        </button>
        <button
          aria-label="Danh sách đánh số"
          className="rounded-[3px] px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-teal-900 cursor-pointer"
          disabled={disabled || viewMode === "preview"}
          onClick={() => prefixLines("1. ")}
          onMouseDown={(e) => e.preventDefault()}
          title="Danh sách số (1. 2. 3.)"
          type="button"
        >
          1. Số thứ tự
        </button>
        <button
          aria-label="Danh sách kiểm tra"
          className="rounded-[3px] px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-teal-900 cursor-pointer"
          disabled={disabled || viewMode === "preview"}
          onClick={() => prefixLines("- [ ] ")}
          onMouseDown={(e) => e.preventDefault()}
          title="Danh sách kiểm tra (- [ ])"
          type="button"
        >
          ☑ Kiểm tra
        </button>
        <button
          aria-label="Trích dẫn"
          className="rounded-[3px] px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-teal-900 cursor-pointer"
          disabled={disabled || viewMode === "preview"}
          onClick={() => prefixLines("> ")}
          onMouseDown={(e) => e.preventDefault()}
          title="Trích dẫn (>)"
          type="button"
        >
          “ Trích dẫn
        </button>
        <button
          aria-label="Chèn bảng y khoa"
          className="rounded-[3px] px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-teal-900 cursor-pointer"
          disabled={disabled || viewMode === "preview"}
          onClick={handleInsertTable}
          onMouseDown={(e) => e.preventDefault()}
          title="Chèn bảng phân liều / tiêu chuẩn y tế"
          type="button"
        >
          ⊞ Bảng
        </button>
        <button
          aria-label="Khối mã định dạng"
          className="rounded-[3px] px-2 py-1 text-xs font-mono text-slate-700 hover:bg-slate-100 hover:text-teal-900 cursor-pointer"
          disabled={disabled || viewMode === "preview"}
          onClick={handleInsertCodeBlock}
          onMouseDown={(e) => e.preventDefault()}
          title="Chèn khối mã / cấu trúc (```)"
          type="button"
        >
          {"{ } Khối mã"}
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        {/* Link & Image */}
        <button
          aria-label="Chèn liên kết (Ctrl+K)"
          className="rounded-[3px] px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-teal-900 cursor-pointer flex items-center gap-1"
          disabled={disabled || viewMode === "preview"}
          onClick={handleOpenLinkModal}
          onMouseDown={(e) => e.preventDefault()}
          title="Chèn liên kết web (Ctrl+K)"
          type="button"
        >
          🔗 Link
        </button>

        <button
          aria-label="Chèn hình ảnh hoặc tải ảnh lên"
          className="rounded-[3px] px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 hover:text-teal-900 cursor-pointer flex items-center gap-1"
          disabled={disabled || viewMode === "preview"}
          onClick={handleOpenImageModal}
          onMouseDown={(e) => e.preventDefault()}
          title="Chèn hoặc tải ảnh y khoa"
          type="button"
        >
          🖼️ Ảnh
        </button>

        <span className="mx-1 h-4 w-px bg-slate-200" />

        {/* Healthcare Callouts Dropdown */}
        <div className="relative">
          <button
            aria-expanded={showCalloutMenu}
            aria-haspopup="true"
            className="rounded-[3px] bg-teal-50 border border-teal-200 px-2.5 py-1 text-xs font-bold text-teal-900 hover:bg-teal-100 cursor-pointer flex items-center gap-1"
            disabled={disabled || viewMode === "preview"}
            onClick={() => setShowCalloutMenu(!showCalloutMenu)}
            onMouseDown={(e) => e.preventDefault()}
            type="button"
          >
            <UiIcon name="shield-check" size={13} />
            <span>Hộp ghi chú y khoa ▾</span>
          </button>

          {showCalloutMenu && (
            <div
              className="absolute left-0 top-full mt-1 z-30 w-72 rounded-[4px] border border-slate-200 bg-white p-1.5 shadow-lg space-y-1 text-xs"
              onMouseLeave={() => setShowCalloutMenu(false)}
            >
              <button
                className="w-full text-left rounded-[3px] px-3 py-2 font-medium hover:bg-amber-50 text-amber-950 flex items-center gap-2 cursor-pointer"
                onClick={() => handleInsertCallout("clinical-warning", "Cảnh báo lâm sàng")}
                onMouseDown={(e) => e.preventDefault()}
                type="button"
              >
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <div>
                  <strong className="block text-amber-900">⚠️ Cảnh báo lâm sàng</strong>
                  <span className="text-[11px] text-slate-500">Tác dụng phụ, chống chỉ định</span>
                </div>
              </button>

              <button
                className="w-full text-left rounded-[3px] px-3 py-2 font-medium hover:bg-teal-50 text-teal-950 flex items-center gap-2 cursor-pointer"
                onClick={() => handleInsertCallout("doctor-note", "Lời khuyên chuyên môn")}
                onMouseDown={(e) => e.preventDefault()}
                type="button"
              >
                <span className="w-2 h-2 rounded-full bg-teal-600" />
                <div>
                  <strong className="block text-teal-900">💡 Lời khuyên bác sĩ</strong>
                  <span className="text-[11px] text-slate-500">Dặn dò chăm sóc, thói quen tốt</span>
                </div>
              </button>

              <button
                className="w-full text-left rounded-[3px] px-3 py-2 font-medium hover:bg-sky-50 text-sky-950 flex items-center gap-2 cursor-pointer"
                onClick={() => handleInsertCallout("dosage-guide", "Chỉ định liều lượng")}
                onMouseDown={(e) => e.preventDefault()}
                type="button"
              >
                <span className="w-2 h-2 rounded-full bg-sky-600" />
                <div>
                  <strong className="block text-sky-900">📋 Hướng dẫn dùng thuốc</strong>
                  <span className="text-[11px] text-slate-500">Liều dùng, thời điểm uống thuốc</span>
                </div>
              </button>

              <button
                className="w-full text-left rounded-[3px] px-3 py-2 font-medium hover:bg-rose-50 text-rose-950 flex items-center gap-2 cursor-pointer"
                onClick={() => handleInsertCallout("emergency-box", "Dấu hiệu cấp cứu ngay")}
                onMouseDown={(e) => e.preventDefault()}
                type="button"
              >
                <span className="w-2 h-2 rounded-full bg-rose-600" />
                <div>
                  <strong className="block text-rose-900">🚨 Dấu hiệu cấp cứu khẩn cấp</strong>
                  <span className="text-[11px] text-slate-500">Triệu chứng nguy kịch cần đến viện</span>
                </div>
              </button>
            </div>
          )}
        </div>

        {/* Medical Templates Dropdown */}
        <div className="relative">
          <button
            aria-expanded={showTemplateMenu}
            aria-haspopup="true"
            className="rounded-[3px] border border-slate-300 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 cursor-pointer flex items-center gap-1"
            disabled={disabled || viewMode === "preview"}
            onClick={() => setShowTemplateMenu(!showTemplateMenu)}
            onMouseDown={(e) => e.preventDefault()}
            type="button"
          >
            <UiIcon name="book-open" size={13} />
            <span>Mẫu bài viết ▾</span>
          </button>

          {showTemplateMenu && (
            <div
              className="absolute left-0 top-full mt-1 z-30 w-80 rounded-[4px] border border-slate-200 bg-white p-2 shadow-lg space-y-1.5 text-xs"
              onMouseLeave={() => setShowTemplateMenu(false)}
            >
              <div className="border-b border-slate-100 pb-1 font-bold text-slate-500 uppercase tracking-wider text-[10px]">
                Chọn mẫu soạn thảo sẵn
              </div>
              {MEDICAL_TEMPLATES.map((tmpl, idx) => (
                <button
                  className="w-full text-left rounded-[3px] p-2 hover:bg-slate-50 text-slate-800 transition cursor-pointer border border-transparent hover:border-slate-200"
                  key={`tmpl-${idx}`}
                  onClick={() => handleApplyTemplate(tmpl)}
                  onMouseDown={(e) => e.preventDefault()}
                  type="button"
                >
                  <strong className="block text-teal-950 font-bold">{tmpl.title}</strong>
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-normal">{tmpl.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Main Workspace Area (Edit / Split / Preview) */}
      <div className={`flex-1 overflow-hidden ${isFullscreen ? "min-h-0" : ""}`}>
        {isDirectUploading && (
          <div className="flex items-center gap-2 bg-teal-50 border-b border-teal-200 px-3 py-1.5 text-xs text-teal-800 font-medium">
            <UiIcon name="activity" size={13} />
            <span>Đang tải hình ảnh lên máy chủ bệnh viện…</span>
          </div>
        )}
        {directUploadError && (
          <div className="flex items-center justify-between gap-2 bg-rose-50 border-b border-rose-200 px-3 py-1.5 text-xs text-rose-900 font-medium">
            <div className="flex items-center gap-1.5">
              <UiIcon name="alert-triangle" size={13} />
              <span>{directUploadError}</span>
            </div>
            <button
              className="text-rose-700 hover:text-rose-950 font-bold px-1.5 py-0.5 cursor-pointer rounded-[3px] hover:bg-rose-100"
              onClick={() => setDirectUploadError(null)}
              type="button"
            >
              ✕
            </button>
          </div>
        )}

        {viewMode === "tinymce" && (
          /* The wrapper keeps the caller's `id` so a label or hash anchor
             written against it still resolves to the editor region; the
             labelled control inside it is the textarea TinyMCE replaces. */
          <div className="h-full w-full" id={id}>
            <TinyEditor
              disabled={disabled}
              id={tinyEditorId}
              init={{ ...tinyMceInitConfig, iframe_title: label || "Trình soạn thảo nội dung" }}
              licenseKey="gpl"
              onEditorChange={handleTinyEditorChange}
              onInit={handleEditorInit}
              tinymceScriptSrc="/tinymce/tinymce.min.js"
              value={safeValueHtml}
            />
          </div>
        )}

        {viewMode === "edit" && (
          <div className="h-full p-2">
            <textarea
              aria-label={label || "Nội dung soạn thảo"}
              className="w-full h-full p-3.5 text-sm font-sans leading-relaxed text-slate-900 placeholder:text-slate-400 bg-white resize-y focus:outline-none"
              disabled={disabled}
              id={id}
              onChange={(e) => {
                isInternalChangeRef.current = true;
                lastExternalValueRef.current = e.target.value;
                onChange(e.target.value);
                recordHistory(e.target.value);
              }}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes("Files")) e.preventDefault();
              }}
              onDrop={handleTextareaDrop}
              onKeyDown={handleKeyDown}
              onPaste={handleTextareaPaste}
              placeholder={placeholder}
              ref={textareaRef}
              required={required}
              style={{ minHeight: isFullscreen ? "100%" : minHeight }}
              value={safeValue}
            />
          </div>
        )}

        {viewMode === "split" && (
          <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200 h-full">
            <div className="h-full p-2 overflow-y-auto">
              <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1 px-2">
                Soạn thảo trực tiếp
              </div>
              <textarea
                aria-label={label || "Nội dung soạn thảo"}
                className="w-full p-3 text-sm font-sans leading-relaxed text-slate-900 placeholder:text-slate-400 bg-white focus:outline-none"
                disabled={disabled}
                id={id}
                onChange={(e) => {
                  isInternalChangeRef.current = true;
                  lastExternalValueRef.current = e.target.value;
                  onChange(e.target.value);
                  recordHistory(e.target.value);
                }}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("Files")) e.preventDefault();
                }}
                onDrop={handleTextareaDrop}
                onKeyDown={handleKeyDown}
                onPaste={handleTextareaPaste}
                placeholder={placeholder}
                ref={textareaRef}
                required={required}
                style={{ minHeight: isFullscreen ? "100%" : minHeight }}
                value={safeValue}
              />
            </div>
            <div className="h-full p-4 overflow-y-auto bg-slate-50/50">
              <div className="text-[11px] font-bold uppercase tracking-wider text-teal-800 mb-2 flex items-center gap-1.5">
                <UiIcon name="eye" size={12} />
                <span>Xem trước thời gian thực</span>
              </div>
              <div className="rounded-[4px] border border-slate-200 bg-white p-5">
                <RichContentRenderer content={safeValue} />
              </div>
            </div>
          </div>
        )}

        {viewMode === "preview" && (
          <div className="h-full p-6 overflow-y-auto bg-slate-50/40">
            <div className="max-w-4xl mx-auto rounded-[4px] border border-slate-200 bg-white p-6 sm:p-10 shadow-sm">
              <div className="mb-4 pb-3 border-b border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <span className="font-bold text-teal-900 uppercase tracking-wider flex items-center gap-1.5">
                  <UiIcon name="shield-check" size={14} />
                  <span>Bản xem trước giao diện bài viết hoàn chỉnh</span>
                </span>
                <span>Ước tính: {readingMinutes} phút đọc</span>
              </div>
              <RichContentRenderer content={safeValue} />
            </div>
          </div>
        )}
      </div>

      {/* Editor Status Bar & Counters */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600">
        <div className="flex items-center gap-4">
          <span>
            Số từ: <strong className="text-slate-900 font-bold">{wordCount}</strong>
          </span>
          <span>
            Số ký tự: <strong className="text-slate-900 font-bold">{charCount}</strong>
          </span>
          <span className="inline-flex items-center gap-1 text-teal-900 font-medium">
            <UiIcon name="clock" size={12} />
            <span>~{readingMinutes} phút đọc</span>
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-3 text-[11px] text-slate-500">
          <span>Phím tắt:</span>
          <kbd className="rounded-[3px] bg-white px-1.5 py-0.5 border border-slate-300 font-mono">Ctrl+B: Đậm</kbd>
          <kbd className="rounded-[3px] bg-white px-1.5 py-0.5 border border-slate-300 font-mono">Ctrl+I: Nghiêng</kbd>
          <kbd className="rounded-[3px] bg-white px-1.5 py-0.5 border border-slate-300 font-mono">Ctrl+K: Link</kbd>
          <kbd className="rounded-[3px] bg-white px-1.5 py-0.5 border border-slate-300 font-mono">Ctrl+Z: Hoàn tác</kbd>
        </div>
      </div>

      {/* Modal: Insert Link */}
      {showLinkModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-md rounded-[4px] bg-white p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <UiIcon name="arrow-up-right" size={16} />
                <span>Chèn liên kết tham khảo</span>
              </h3>
              <button
                aria-label="Đóng"
                className="rounded-[3px] p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                onClick={() => setShowLinkModal(false)}
                type="button"
              >
                <UiIcon name="x" size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Văn bản hiển thị
                </label>
                <input
                  className="mt-1 w-full rounded-[4px] border border-slate-300 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  onChange={(e) => setLinkText(e.target.value)}
                  placeholder="Ví dụ: Đọc hướng dẫn khám tim mạch"
                  type="text"
                  value={linkText}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Địa chỉ URL *
                </label>
                <input
                  className="mt-1 w-full rounded-[4px] border border-slate-300 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://... hoặc /articles/..."
                  type="url"
                  value={linkUrl}
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                className="rounded-[4px] px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                onClick={() => setShowLinkModal(false)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="rounded-[4px] bg-teal-800 px-4 py-2 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50 cursor-pointer"
                disabled={!linkUrl.trim()}
                onClick={handleInsertLink}
                type="button"
              >
                Chèn liên kết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Insert Image */}
      {showImageModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-2xs">
          <div className="w-full max-w-lg rounded-[4px] bg-white p-5 shadow-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-1.5">
                <UiIcon name="activity" size={16} />
                <span>Chèn hình ảnh y khoa</span>
              </h3>
              <button
                aria-label="Đóng"
                className="rounded-[3px] p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                onClick={() => setShowImageModal(false)}
                type="button"
              >
                <UiIcon name="x" size={16} />
              </button>
            </div>

            <div className="mt-4 space-y-4">
              {/* Option A: Direct file upload & Drag and Drop */}
              <div
                className={`rounded-[4px] border-2 border-dashed p-4 text-center transition-colors ${
                  isDraggingImageModal
                    ? "border-teal-600 bg-teal-100/70"
                    : "border-teal-300 bg-teal-50/50"
                }`}
                onDragLeave={() => setIsDraggingImageModal(false)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingImageModal(true);
                }}
                onDrop={handleImageModalDrop}
              >
                <input
                  accept="image/png, image/jpeg, image/webp, image/gif"
                  className="hidden"
                  onChange={handleProcessImageUpload}
                  ref={fileUploadInputRef}
                  type="file"
                />
                <button
                  className="inline-flex items-center gap-2 rounded-[4px] bg-teal-800 px-4 py-2 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50 cursor-pointer"
                  disabled={isUploadingImage}
                  onClick={() => fileUploadInputRef.current?.click()}
                  onMouseDown={(e) => e.preventDefault()}
                  type="button"
                >
                  <UiIcon name="plus" size={14} />
                  <span>{isUploadingImage ? "Đang tải ảnh lên..." : "Tải ảnh từ máy tính hoặc Kéo thả vào đây"}</span>
                </button>
                <p className="mt-2 text-[11px] text-slate-500">
                  Hỗ trợ PNG, JPG, WEBP, GIF (Tối đa 10 MB). Kéo thả ảnh trực tiếp hoặc chọn tệp.
                </p>
                {imageUploadError && (
                  <p className="mt-2 text-xs text-red-600 font-semibold">{imageUploadError}</p>
                )}
              </div>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-slate-200 w-full" />
                <span className="bg-white px-2 text-[11px] font-bold text-slate-400 uppercase">Hoặc nhập link ảnh</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Đường dẫn ảnh (URL) *
                </label>
                <input
                  className="mt-1 w-full rounded-[4px] border border-slate-300 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://... hoặc /uploads/..."
                  type="url"
                  value={imageUrl}
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Chú thích ảnh (Alt text)
                </label>
                <input
                  className="mt-1 w-full rounded-[4px] border border-slate-300 px-3 py-2 text-sm focus:border-teal-700 focus:outline-none"
                  onChange={(e) => setImageAlt(e.target.value)}
                  placeholder="Ví dụ: Sơ đồ phác đồ tầm soát tim mạch"
                  type="text"
                  value={imageAlt}
                />
              </div>

              {/* Preview uploaded / entered image */}
              {imageUrl && (
                <div className="rounded-[4px] border border-slate-200 p-2 bg-slate-50">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                    Xem trước ảnh:
                  </span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt={imageAlt || "Preview"}
                    className="max-h-36 rounded-[2px] object-contain mx-auto"
                    src={imageUrl}
                  />
                </div>
              )}
            </div>

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-3">
              <button
                className="rounded-[4px] px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                onClick={() => setShowImageModal(false)}
                type="button"
              >
                Hủy
              </button>
              <button
                className="rounded-[4px] bg-teal-800 px-4 py-2 text-xs font-bold text-white hover:bg-teal-900 disabled:opacity-50 cursor-pointer"
                disabled={!imageUrl.trim() || isUploadingImage}
                onClick={handleInsertImage}
                type="button"
              >
                Chèn ảnh vào bài viết
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Apply medical template over existing content */}
      <ConfirmActionDialog
        confirmLabel="Áp dụng mẫu"
        confirmingLabel="Đang áp dụng…"
        cancelLabel="Hủy"
        description={`Nội dung hiện tại sẽ được giữ nguyên và cấu trúc y khoa của mẫu "${pendingTemplate?.title ?? ""}" sẽ được thêm vào cuối bài viết. Sau khi áp dụng, bạn vẫn có thể hoàn tác bằng Ctrl+Z.`}
        destructive
        entity={pendingTemplate}
        onCancel={handleCancelTemplate}
        onConfirm={handleConfirmTemplate}
        open={pendingTemplate !== null}
        summaryItems={pendingTemplate ? [
          { label: "Mẫu áp dụng", value: pendingTemplate.title },
          { label: "Độ dài nội dung hiện tại", value: `${safeValue.length} ký tự` },
        ] : []}
        summaryLabel="Bài viết hiện tại"
        title="Thêm mẫu y khoa vào bài viết đã có nội dung?"
      />
    </div>
  );
}

export default RichTextEditor;
