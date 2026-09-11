"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import {
  adminCreateArticle,
  adminCreateFaq,
  adminCreatePackage,
  adminDeleteArticle,
  adminDeleteFaq,
  adminDeletePackage,
  adminListArticles,
  adminListFaqs,
  adminListPackages,
  adminReorderFaqs,
  adminReorderPackages,
  adminUpdateArticle,
  adminUpdateFaq,
  adminUpdatePackage,
  type AdminArticlePayload,
  type AdminArticle,
  type Faq,
  type HealthPackage,
  fetchAllContent,
  broadcastCatalogChange,
  subscribeToCatalogChange,
} from "../../../lib/api-client";
import { RichTextEditor } from "../../../components/editor";
import ConfirmActionDialog from "../../../components/ui/ConfirmActionDialog";
import { useSortableList } from "../../../lib/useSortableList";
import { ToastContainer, useToastManager } from "../../../components/ui/ToastNotification";

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[đĐ]/g, "d")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}
import AdminState from "../_components/AdminState";
import { describeAdminError } from "../_lib/errors";

const inputClass = "mt-1 w-full rounded-sm border border-slate-300 px-3 py-2.5 text-sm";
const buttonClass = "rounded-sm bg-teal-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50";
const secondaryButtonClass = "rounded-sm border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-50";
const ADMIN_PAGE_SIZE = 100;

type Feedback = {
  tone: "success" | "error";
  title: string;
  description: string;
};

type PackageForm = {
  name: string;
  slug: string;
  description: string;
  price: string;
  active: boolean;
};

type FaqForm = {
  id: string;
  question: string;
  answer: string;
  active: boolean;
};

type ArticleForm = {
  version: number | null;
  title: string;
  slug: string;
  summary: string;
  body: string;
  contentKind: "GENERAL" | "DISEASE_GUIDE";
  category: string;
  authorName: string;
  readingMinutes: string;
  relatedSpecialtySlug: string;
  coverImageUrl: string;
  seoTitle: string;
  seoDescription: string;
  tags: string;
  scheduledPublishAt: string;
  sections: ArticleSectionForm[];
  contentLanguage: string;
  audience: string;
  topicTags: string;
  keyTakeaways: string;
  warningSigns: string;
  preventionTips: string;
  whenToSeekCare: string;
  sourceReferences: string;
  clinicalMetadata: string;
  clinicalDisclaimer: string;
  featured: boolean;
  active: boolean;
};

type ArticleSectionForm = {
  id: string;
  heading: string;
  body: string;
};

function createSection(heading = "", body = ""): ArticleSectionForm {
  return {
    id: `sec-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    heading,
    body,
  };
}

type MedicalBlueprint = {
  key: string;
  name: string;
  badge: string;
  description: string;
  apply: (current: ArticleForm) => ArticleForm;
};

const MEDICAL_ARTICLE_BLUEPRINTS: MedicalBlueprint[] = [
  {
    key: "disease-guide",
    name: "Hướng dẫn bệnh học",
    badge: "Bệnh học",
    description: "Cấu trúc 4 phần chuẩn: Tổng quan, Triệu chứng, Chẩn đoán & Phác đồ, Phòng ngừa tái phát",
    apply: (current: ArticleForm): ArticleForm => ({
      ...current,
      contentKind: "DISEASE_GUIDE",
      category: current.category || "Bệnh lý thường gặp",
      readingMinutes: current.readingMinutes || "6",
      keyTakeaways: current.keyTakeaways || "Phát hiện sớm giúp hạn chế tối đa biến chứng nguy hiểm\nTuân thủ phác đồ điều trị của bác sĩ chuyên khoa\nĐiều chỉnh thói quen sinh hoạt và tái khám đúng hẹn",
      warningSigns: current.warningSigns || "Đau dữ dội kéo dài không thuyên giảm\nSốt cao li bì không đáp ứng thuốc hạ sốt\nKhó thở, tím tái hoặc rối loạn tri giác",
      preventionTips: current.preventionTips || "Dinh dưỡng lành mạnh, giảm muối, hạn chế đường tinh luyện\nVận động thể lực tối thiểu 30 phút mỗi ngày\nKhám sức khỏe tổng quát định kỳ 6 tháng một lần",
      whenToSeekCare: current.whenToSeekCare || "Đến ngay cơ sở y tế khi có dấu hiệu cảnh báo đỏ hoặc triệu chứng kéo dài trên 3 ngày.",
      sections: [
        createSection(
          "1. Tổng quan tình trạng & Cơ chế bệnh sinh",
          "Mô tả định nghĩa y khoa, nguyên nhân khởi phát (di truyền, môi trường, lối sống) và các nhóm đối tượng có nguy cơ cao mắc bệnh.",
        ),
        createSection(
          "2. Dấu hiệu nhận biết sớm & Triệu chứng điển hình",
          "Phân tích cụ thể các biểu hiện cơ năng, dấu hiệu thực thể và các triệu chứng cảnh báo giai đoạn tiến triển.",
        ),
        createSection(
          "3. Chẩn đoán cận lâm sàng & Phác đồ điều trị chuẩn",
          "Các phương pháp xét nghiệm máu, chẩn đoán hình ảnh (X-quang, MRI, nội soi) và hướng dẫn điều trị nội - ngoại khoa.",
        ),
        createSection(
          "4. Chăm sóc phục hồi & Phòng ngừa tái phát",
          "Hướng dẫn chăm sóc người bệnh tại nhà, chế độ dinh dưỡng hỗ trợ hồi phục và lịch tái khám định kỳ theo khuyến cáo.",
        ),
      ],
    }),
  },
  {
    key: "nutrition",
    name: "Dinh dưỡng lâm sàng",
    badge: "Dinh dưỡng",
    description: "Cấu trúc 3 phần: Vai trò dinh dưỡng, Thực phẩm nên & không nên, Thực đơn mẫu gợi ý",
    apply: (current: ArticleForm): ArticleForm => ({
      ...current,
      contentKind: "GENERAL",
      category: current.category || "Dinh dưỡng",
      readingMinutes: current.readingMinutes || "5",
      keyTakeaways: current.keyTakeaways || "Dinh dưỡng khoa học là nền tảng củng cố hệ miễn dịch\nƯu tiên thực phẩm tươi sống nguyên bản, giàu chất xơ\nUống đủ nước và kiểm soát calo nạp vào hàng ngày",
      warningSigns: current.warningSigns || "Sụt cân nhanh không chủ đích\nRối loạn tiêu hóa kéo dài kèm mất nước và kiệt sức",
      preventionTips: current.preventionTips || "Tăng cường rau xanh đậm và trái cây ít ngọt\nUống từ 1.5 đến 2 lít nước lọc mỗi ngày\nHạn chế tối đa rượu bia, thuốc lá và thức ăn chế biến sẵn",
      whenToSeekCare: current.whenToSeekCare || "Tham vấn ý kiến bác sĩ chuyên khoa dinh dưỡng khi có bệnh lý mạn tính đi kèm.",
      sections: [
        createSection(
          "1. Vai trò của dinh dưỡng đối với sức khỏe & Phục hồi",
          "Tác động sinh học của các nhóm chất (protein, carbohydrate tốt, chất béo lành mạnh, vitamin & khoáng chất) đối với cơ thể.",
        ),
        createSection(
          "2. Nhóm thực phẩm khuyến nghị & Thực phẩm cần kiêng",
          "Bảng danh mục chi tiết các thực phẩm nên bổ sung hàng ngày và các thực phẩm gây hại cần cắt giảm tối đa.",
        ),
        createSection(
          "3. Thực đơn mẫu tham khảo & Lưu ý chế biến an toàn",
          "Gợi ý thực đơn các bữa ăn trong tuần, kỹ thuật chế biến hấp/luộc để giữ trọn vi chất và cách đọc nhãn thực phẩm.",
        ),
      ],
    }),
  },
  {
    key: "emergency",
    name: "Sơ cấp cứu ban đầu",
    badge: "Cấp cứu",
    description: "Cấu trúc 3 phần: Dấu hiệu nguy kịch, Các bước sơ cứu tại chỗ, Sai lầm cần tránh",
    apply: (current: ArticleForm): ArticleForm => ({
      ...current,
      contentKind: "GENERAL",
      category: current.category || "Sơ cấp cứu",
      readingMinutes: current.readingMinutes || "4",
      keyTakeaways: current.keyTakeaways || "Giữ bình tĩnh và đánh giá an toàn hiện trường đầu tiên\nGọi ngay cấp cứu 115 khi phát hiện nguy cơ đe dọa tính mạng\nSơ cứu đúng kỹ thuật trong thời gian vàng",
      warningSigns: current.warningSigns || "Ngừng tim hoặc ngừng thở đột ngột\nMất ý thức, hôn mê, không phản ứng\nChảy máu ồ ạt không cầm được",
      preventionTips: current.preventionTips || "Trang bị hộp sơ cấp cứu đạt chuẩn tại gia đình và nơi làm việc\nHọc và rèn luyện kỹ năng sơ cấp cứu, ép tim CPR cơ bản",
      whenToSeekCare: current.whenToSeekCare || "Mọi trường hợp tai nạn nặng hoặc chấn thương cột sống cần đưa ngay đến bệnh viện gần nhất sau khi cố định an toàn.",
      sections: [
        createSection(
          "1. Dấu hiệu nguy kịch cần gọi cấp cứu 115 ngay lập tức",
          "Liệt kê các dấu hiệu sinh tồn bất thường, khó thở cấp, ngừng tuần hoàn, chấn thương sọ não cần can thiệp y tế khẩn cấp.",
        ),
        createSection(
          "2. Quy trình các bước sơ cứu an toàn tại chỗ",
          "Hướng dẫn cụ thể theo nguyên tắc DRABC (Danger - Response - Airway - Breathing - Circulation), cách đặt tư thế hồi sức an toàn.",
        ),
        createSection(
          "3. Những sai lầm tai hại tuyệt đối không được làm",
          "Cảnh báo các biện pháp sơ cứu dân gian sai lệch (nhỏ chanh, cạo gió khi đột quỵ, garo sai cách) gây nguy hiểm cho tính mạng nạn nhân.",
        ),
      ],
    }),
  },
];

const emptyPackageForm: PackageForm = {
  name: "",
  slug: "",
  description: "",
  price: "",
  active: true,
};

const emptyFaqForm: FaqForm = {
  id: "",
  question: "",
  answer: "",
  active: true,
};

const emptyArticleForm: ArticleForm = {
  version: null,
  title: "",
  slug: "",
  summary: "",
  body: "",
  contentKind: "GENERAL",
  category: "",
  authorName: "",
  readingMinutes: "",
  relatedSpecialtySlug: "",
  coverImageUrl: "",
  seoTitle: "",
  seoDescription: "",
  tags: "",
  scheduledPublishAt: "",
  sections: [],
  contentLanguage: "vi-VN",
  audience: "PATIENT",
  topicTags: "",
  keyTakeaways: "",
  warningSigns: "",
  preventionTips: "",
  whenToSeekCare: "",
  sourceReferences: "",
  clinicalMetadata: "{}",
  clinicalDisclaimer: "Thông tin chỉ nhằm giáo dục sức khỏe, không thay thế chẩn đoán hoặc tư vấn trực tiếp từ bác sĩ.",
  featured: false,
  active: true,
};

function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 bg-white py-5">
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      {children}
    </section>
  );
}

function StatusBadge({ active }: { active: boolean }) {
  return (
    <span
      className={`rounded-[4px] px-2.5 py-1 text-xs font-bold ${
        active ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"
      }`}
    >
      {active ? "Đang hiển thị" : "Tạm ẩn"}
    </span>
  );
}

function packageFormFrom(item: HealthPackage): PackageForm {
  return {
    name: item.name,
    slug: item.slug,
    description: item.description ?? "",
    price: String(item.price),
    active: item.active ?? true,
  };
}

function faqFormFrom(item: Faq): FaqForm {
  return {
    id: item.id,
    question: item.question,
    answer: item.answer,
    active: item.active ?? true,
  };
}

function listFieldFrom(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.filter((entry): entry is string => typeof entry === "string").join("\n");
}

function dateTimeLocalFrom(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function metadataFrom(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return "{}";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return "{}";
  }
}

function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function articleSectionsFrom(value: unknown): ArticleSectionForm[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter(
      (section): section is { heading: string; body: string } =>
        Boolean(section) &&
        typeof section.heading === "string" &&
        typeof section.body === "string",
    )
    .map((section) => createSection(section.heading, section.body));
}

function articleKindLabel(value: string | null | undefined): string {
  if (value === "DISEASE_GUIDE") return "Hướng dẫn bệnh lý";
  return "Nội dung chung";
}

function listLength(value: unknown): number {
  return Array.isArray(value) ? value.filter((entry) => typeof entry === "string" && entry.trim()).length : 0;
}

function objectKeyCount(value: unknown): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  return Object.keys(value).length;
}

function articleFormFrom(item: AdminArticle): ArticleForm {
  return {
    version: item.version ?? null,
    title: item.title,
    slug: item.slug,
    summary: item.summary ?? "",
    body: item.body ?? "",
    contentKind: item.contentKind === "DISEASE_GUIDE" ? "DISEASE_GUIDE" : "GENERAL",
    category: item.category ?? "",
    authorName: item.authorName ?? "",
    readingMinutes: item.readingMinutes ? String(item.readingMinutes) : "",
    relatedSpecialtySlug: item.relatedSpecialtySlug ?? "",
    coverImageUrl: item.coverImageUrl ?? "",
    seoTitle: item.seoTitle ?? "",
    seoDescription: item.seoDescription ?? "",
    tags: listFieldFrom(item.tags),
    scheduledPublishAt: dateTimeLocalFrom(item.scheduledPublishAt),
    sections: articleSectionsFrom(item.sections),
    contentLanguage: item.contentLanguage ?? "vi-VN",
    audience: item.audience ?? "PATIENT",
    topicTags: listFieldFrom(item.topicTags),
    keyTakeaways: listFieldFrom(item.keyTakeaways),
    warningSigns: listFieldFrom(item.warningSigns),
    preventionTips: listFieldFrom(item.preventionTips),
    whenToSeekCare: item.whenToSeekCare ?? "",
    sourceReferences: listFieldFrom(item.sourceReferences),
    clinicalMetadata: metadataFrom(item.clinicalMetadata),
    clinicalDisclaimer: item.clinicalDisclaimer ?? emptyArticleForm.clinicalDisclaimer,
    featured: item.featured ?? false,
    active: item.active ?? Boolean(item.publishedAt),
  };
}

function listFieldTo(value: string): string[] {
  return value.split(/\r?\n|,/u).map((entry) => entry.trim()).filter(Boolean);
}

function scheduledDateToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function articleSectionAt(form: ArticleForm, index: number, patch: Partial<ArticleSectionForm>): ArticleForm {
  const sections = form.sections.map((section, currentIndex) => {
    if (currentIndex !== index) return section;
    return { ...section, ...patch };
  });
  return { ...form, sections };
}

export default function AdminCatalogPage() {
  const { toasts, addToast, removeToast } = useToastManager();
  const [packages, setPackages] = useState<HealthPackage[]>([]);
  const [faqs, setFaqs] = useState<Faq[]>([]);
  const [articles, setArticles] = useState<AdminArticle[]>([]);
  const [articleSearchQuery, setArticleSearchQuery] = useState("");
  const [packageForm, setPackageForm] = useState<PackageForm>(emptyPackageForm);
  const [faqForm, setFaqForm] = useState<FaqForm>(emptyFaqForm);
  const [articleForm, setArticleForm] = useState<ArticleForm>(emptyArticleForm);
  const [editingPackage, setEditingPackage] = useState<string | null>(null);
  const [editingArticle, setEditingArticle] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const reorderInFlightRef = useRef(false);
  // Monotonic generation for load(): any load finishing after a newer load
  // or a reorder has started must never write its stale response into state
  // (an old GET resolving after a saved order would revert the list).
  const loadGenerationRef = useRef(0);

  const orderPayload = <T extends { id: string; version?: number }>(items: T[]) => items.map((item) => {
    if (typeof item.version !== "number") throw new Error("CATALOG_ORDER_VERSION_MISSING");
    return { id: item.id, version: item.version };
  });

  const persistFaqOrder = async (newFaqs: Faq[], oldIdx: number, newIdx: number) => {
    if (reorderInFlightRef.current) return;
    reorderInFlightRef.current = true;
    loadGenerationRef.current += 1;
    const previous = faqs;
    setFaqs(newFaqs);
    setBusy(true);
    try {
      const saved = await adminReorderFaqs(orderPayload(newFaqs));
      setFaqs(saved);
      addToast({ tone: "success", title: "Đã lưu thứ tự FAQ", message: `Câu hỏi ${oldIdx + 1} đã chuyển sang vị trí ${newIdx + 1}.` });
      broadcastCatalogChange({ kind: "faq", action: "updated" });
    } catch (error) {
      setFaqs(previous);
      const description = describeAdminError(error).description;
      setFeedback({ tone: "error", title: "Không thể lưu thứ tự FAQ", description });
      addToast({ tone: "error", title: "Đã hoàn tác thứ tự FAQ", message: `${description} Danh sách đã trở về thứ tự trước đó.` });
    } finally {
      reorderInFlightRef.current = false;
      setBusy(false);
    }
  };

  const persistPackageOrder = async (newPackages: HealthPackage[], oldIdx: number, newIdx: number) => {
    if (reorderInFlightRef.current) return;
    reorderInFlightRef.current = true;
    loadGenerationRef.current += 1;
    const previous = packages;
    setPackages(newPackages);
    setBusy(true);
    try {
      const saved = await adminReorderPackages(orderPayload(newPackages));
      setPackages(saved);
      addToast({ tone: "success", title: "Đã lưu thứ tự gói khám", message: `Gói khám ${oldIdx + 1} đã chuyển sang vị trí ${newIdx + 1}.` });
      broadcastCatalogChange({ kind: "package", action: "updated" });
    } catch (error) {
      setPackages(previous);
      const description = describeAdminError(error).description;
      setFeedback({ tone: "error", title: "Không thể lưu thứ tự gói khám", description });
      addToast({ tone: "error", title: "Đã hoàn tác thứ tự gói khám", message: `${description} Danh sách đã trở về thứ tự trước đó.` });
    } finally {
      reorderInFlightRef.current = false;
      setBusy(false);
    }
  };

  const moveItem = <T,>(items: T[], index: number, offset: -1 | 1): T[] => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= items.length) return items;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    return next;
  };

  const { containerRef: sectionsContainerRef } = useSortableList<ArticleSectionForm>({
    items: articleForm.sections,
    handle: ".section-drag-handle",
    animation: 180,
    disabled: busy,
    onReorder: (newSections, oldIdx, newIdx) => {
      setArticleForm((current) => ({ ...current, sections: newSections }));
      addToast({
        tone: "info",
        title: "Đã sắp xếp lại Section",
        message: `Đã đổi vị trí Section ${oldIdx + 1} sang Section ${newIdx + 1}.`,
      });
    },
  });

  const { containerRef: faqsContainerRef } = useSortableList<Faq>({
    items: faqs,
    handle: ".faq-drag-handle",
    animation: 180,
    disabled: busy,
    onReorder: (newFaqs, oldIdx, newIdx) => { void persistFaqOrder(newFaqs, oldIdx, newIdx); },
  });

  const { containerRef: packagesContainerRef } = useSortableList<HealthPackage>({
    items: packages,
    handle: ".package-drag-handle",
    animation: 180,
    disabled: busy,
    onReorder: (newPackages, oldIdx, newIdx) => { void persistPackageOrder(newPackages, oldIdx, newIdx); },
  });

  type PendingRemoval = {
    label: string;
    detail: Array<{ label: string; value: string; mono?: boolean }>;
    action: () => Promise<unknown>;
    success: string;
    broadcast?: { kind: "package" | "faq" | "article"; slug?: string };
  };
  const [pendingRemoval, setPendingRemoval] = useState<PendingRemoval | null>(null);

  const load = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setLoading(true);
    setLoadError(null);
    try {
      const [packagePage, faqPage, articlePage] = await Promise.all([
        fetchAllContent(adminListPackages, ADMIN_PAGE_SIZE),
        fetchAllContent(adminListFaqs, ADMIN_PAGE_SIZE),
        fetchAllContent(adminListArticles, ADMIN_PAGE_SIZE),
      ]);
      if (generation !== loadGenerationRef.current) return false;
      setPackages(packagePage);
      setFaqs(faqPage);
      setArticles(articlePage);
      return true;
    } catch (error) {
      if (generation !== loadGenerationRef.current) return false;
      setLoadError(describeAdminError(error).description);
      return false;
    } finally {
      if (generation === loadGenerationRef.current) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    const task = Promise.resolve().then(load);
    const unsubscribe = subscribeToCatalogChange(() => {
      void load();
    });
    return () => {
      void task;
      unsubscribe();
    };
  }, [load]);

  const run = async (action: () => Promise<unknown>, success: string) => {
    setBusy(true);
    setFeedback(null);
    try {
      await action();
      const refreshed = await load();
      const desc = refreshed
        ? "Danh sách đã được cập nhật để phản ánh trạng thái mới nhất."
        : "Thay đổi đã được lưu nhưng danh sách chưa thể làm mới. Vui lòng thử lại.";
      setFeedback({
        tone: "success",
        title: success,
        description: desc,
      });
      addToast({
        tone: "success",
        title: success,
        message: desc,
      });
      return true;
    } catch (error) {
      const copy = describeAdminError(error);
      setFeedback({ tone: "error", title: copy.title, description: copy.description });
      addToast({ tone: "error", title: copy.title, message: copy.description });
      return false;
    } finally {
      setBusy(false);
    }
  };

  const remove = async (
    label: string,
    action: () => Promise<unknown>,
    success: string,
    broadcast?: { kind: "package" | "faq" | "article"; slug?: string }
  ) => {
    const ok = await run(action, success);
    if (ok && broadcast) {
      broadcastCatalogChange({ kind: broadcast.kind, action: "deleted", slug: broadcast.slug });
    }
  };

  const confirmRemoval = async (): Promise<void> => {
    const current = pendingRemoval;
    if (!current) return;
    setPendingRemoval(null);
    await remove(current.label, current.action, current.success, current.broadcast);
  };

  const handleAddSection = () => {
    setArticleForm((current) => ({
      ...current,
      sections: [...current.sections, createSection()],
    }));
    addToast({
      tone: "info",
      title: "Đã thêm Section",
      message: `Đã tạo thêm Section ${articleForm.sections.length + 1}. Kéo biểu tượng ⠿ để sắp xếp thứ tự.`,
    });
  };

  const handleCloneSection = (index: number) => {
    const target = articleForm.sections[index];
    if (!target) return;
    const cloned = createSection(
      target.heading ? `${target.heading} (Bản sao)` : "",
      target.body,
    );
    const next = [...articleForm.sections];
    next.splice(index + 1, 0, cloned);
    setArticleForm((current) => ({ ...current, sections: next }));
    addToast({
      tone: "info",
      title: "Đã sao chép Section",
      message: `Đã nhân bản Section ${index + 1} thành Section ${index + 2}.`,
    });
  };

  const handleMoveSectionUp = (index: number) => {
    if (index <= 0) return;
    const next = [...articleForm.sections];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(index - 1, 0, moved);
    setArticleForm((current) => ({ ...current, sections: next }));
    addToast({
      tone: "info",
      title: "Đã di chuyển Section",
      message: `Đã chuyển Section ${index + 1} lên vị trí ${index}.`,
    });
  };

  const handleMoveSectionDown = (index: number) => {
    if (index >= articleForm.sections.length - 1) return;
    const next = [...articleForm.sections];
    const [moved] = next.splice(index, 1);
    if (!moved) return;
    next.splice(index + 1, 0, moved);
    setArticleForm((current) => ({ ...current, sections: next }));
    addToast({
      tone: "info",
      title: "Đã di chuyển Section",
      message: `Đã chuyển Section ${index + 1} xuống vị trí ${index + 2}.`,
    });
  };

  const handleRemoveSection = (index: number) => {
    setArticleForm((current) => ({
      ...current,
      sections: current.sections.filter((_, currentIndex) => currentIndex !== index),
    }));
    addToast({
      tone: "info",
      title: "Đã xóa Section",
      message: `Đã gỡ Section ${index + 1} khỏi bài viết.`,
    });
  };

  const handleApplyBlueprint = (key: string) => {
    const bp = MEDICAL_ARTICLE_BLUEPRINTS.find((b) => b.key === key);
    if (!bp) return;
    setArticleForm((current) => bp.apply(current));
    addToast({
      tone: "success",
      title: `Áp dụng khung: ${bp.name}`,
      message: `Đã nạp cấu trúc y khoa chuẩn gồm ${bp.name} với các section và gợi ý lâm sàng.`,
    });
  };

  const handleCreateNewArticle = () => {
    setArticleForm(emptyArticleForm);
    setEditingArticle(null);
    addToast({
      tone: "info",
      title: "Tạo bài viết mới",
      message: "Biểu mẫu đã được làm mới để biên tập bài viết mới.",
    });
  };

  const handleTitleChange = (newTitle: string) => {
    setArticleForm((current) => {
      const prevAutoSlug = toSlug(current.title);
      const shouldAutoSlug = !current.slug || current.slug === prevAutoSlug;
      return {
        ...current,
        title: newTitle,
        slug: shouldAutoSlug ? toSlug(newTitle) : current.slug,
      };
    });
  };

  const handleRegenerateSlug = () => {
    const freshSlug = toSlug(articleForm.title);
    setArticleForm((current) => ({ ...current, slug: freshSlug }));
    addToast({
      tone: "info",
      title: "Đã tạo lại slug",
      message: freshSlug ? `Slug chuẩn SEO: ${freshSlug}` : "Vui lòng nhập tiêu đề bài viết trước.",
    });
  };

  const savePackage = async (event: FormEvent) => {
    event.preventDefault();
    if (!packageForm.name.trim()) {
      const msg = "Vui lòng nhập tên gói khám.";
      setFeedback({ tone: "error", title: "Thiếu tên gói khám", description: msg });
      addToast({ tone: "error", title: "Thiếu tên gói khám", message: msg });
      return;
    }
    const finalSlug = packageForm.slug.trim() || toSlug(packageForm.name);
    const payload = {
      name: packageForm.name.trim(),
      slug: finalSlug,
      description: packageForm.description.trim() || null,
      price: Number(packageForm.price),
      active: packageForm.active,
    };
    const saved = await run(
      () => editingPackage ? adminUpdatePackage(editingPackage, payload) : adminCreatePackage(payload),
      "Đã lưu gói khám.",
    );
    if (saved) {
      broadcastCatalogChange({ kind: "package", action: editingPackage ? "updated" : "created", slug: finalSlug });
      setPackageForm(emptyPackageForm);
      setEditingPackage(null);
    }
  };

  const saveFaq = async (event: FormEvent) => {
    event.preventDefault();
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      const msg = "Vui lòng điền đầy đủ cả câu hỏi và câu trả lời.";
      setFeedback({ tone: "error", title: "Thiếu nội dung FAQ", description: msg });
      addToast({ tone: "error", title: "Thiếu nội dung FAQ", message: msg });
      return;
    }
    const payload = {
      question: faqForm.question.trim(),
      answer: faqForm.answer.trim(),
      active: faqForm.active,
    };
    const saved = await run(
      () => faqForm.id ? adminUpdateFaq(faqForm.id, payload) : adminCreateFaq(payload),
      "Đã lưu FAQ.",
    );
    if (saved) {
      broadcastCatalogChange({ kind: "faq", action: faqForm.id ? "updated" : "created" });
      setFaqForm(emptyFaqForm);
    }
  };

  const saveArticle = async (event: FormEvent) => {
    event.preventDefault();
    if (!articleForm.title.trim()) {
      const msg = "Vui lòng nhập tiêu đề bài viết.";
      setFeedback({ tone: "error", title: "Thiếu tiêu đề bài viết", description: msg });
      addToast({ tone: "error", title: "Thiếu tiêu đề bài viết", message: msg });
      return;
    }
    if (articleForm.active && (!articleForm.summary.trim() || !articleForm.body.trim())) {
      const desc = "Bài viết ở trạng thái hiển thị công khai (Active) yêu cầu phải có cả Tóm tắt và Nội dung. Vui lòng điền đủ tóm tắt và nội dung hoặc bỏ chọn 'Đang xuất bản công khai' nếu muốn lưu bản nháp.";
      setFeedback({
        tone: "error",
        title: "Thiếu nội dung bài viết công khai",
        description: desc,
      });
      addToast({
        tone: "error",
        title: "Thiếu nội dung bài viết công khai",
        message: desc,
      });
      return;
    }
    const finalSlug = articleForm.slug.trim() || toSlug(articleForm.title);
    const readingMinutes = articleForm.readingMinutes.trim() ? Number(articleForm.readingMinutes) : null;
    if (readingMinutes !== null && (!Number.isInteger(readingMinutes) || readingMinutes < 1 || readingMinutes > 180)) {
      const msg = "Thời lượng đọc phải là số nguyên từ 1 đến 180 phút.";
      setFeedback({ tone: "error", title: "Thời lượng đọc chưa hợp lệ", description: msg });
      addToast({ tone: "error", title: "Thời lượng đọc chưa hợp lệ", message: msg });
      return;
    }

    let clinicalMetadata: Record<string, string> | null = null;
    try {
      const parsed = JSON.parse(articleForm.clinicalMetadata || "{}");
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("object");
      if (Object.entries(parsed).some(([key, value]) => typeof key !== "string" || typeof value !== "string")) {
        throw new Error("string-map");
      }
      clinicalMetadata = parsed as Record<string, string>;
    } catch {
      const msg = "Clinical metadata phải là JSON object hợp lệ với các giá trị dạng chuỗi (key: value).";
      setFeedback({ tone: "error", title: "Metadata chưa hợp lệ", description: msg });
      addToast({ tone: "error", title: "Metadata chưa hợp lệ", message: msg });
      return;
    }

    const sections = articleForm.sections
      .map((section) => ({ heading: section.heading.trim(), body: section.body.trim() }))
      .filter((section) => section.heading && section.body);
    const payload: AdminArticlePayload = {
      title: articleForm.title.trim(),
      slug: finalSlug,
      summary: articleForm.summary.trim() || null,
      body: articleForm.body.trim() || null,
      category: articleForm.category.trim() || null,
      authorName: articleForm.authorName.trim() || null,
      readingMinutes,
      relatedSpecialtySlug: articleForm.relatedSpecialtySlug.trim() || null,
      contentKind: articleForm.contentKind,
      coverImageUrl: articleForm.coverImageUrl.trim() || null,
      seoTitle: articleForm.seoTitle.trim() || null,
      seoDescription: articleForm.seoDescription.trim() || null,
      tags: listFieldTo(articleForm.tags),
      scheduledPublishAt: scheduledDateToIso(articleForm.scheduledPublishAt),
      version: articleForm.version ?? undefined,
      sections,
      contentLanguage: articleForm.contentLanguage.trim() || null,
      audience: articleForm.audience.trim() || null,
      topicTags: listFieldTo(articleForm.topicTags),
      keyTakeaways: listFieldTo(articleForm.keyTakeaways),
      warningSigns: listFieldTo(articleForm.warningSigns),
      preventionTips: listFieldTo(articleForm.preventionTips),
      whenToSeekCare: articleForm.whenToSeekCare.trim() || null,
      sourceReferences: listFieldTo(articleForm.sourceReferences),
      clinicalMetadata,
      clinicalDisclaimer: articleForm.clinicalDisclaimer.trim() || null,
      featured: articleForm.featured,
      active: articleForm.active,
    };
    const saved = await run(
      () => editingArticle ? adminUpdateArticle(editingArticle, payload) : adminCreateArticle(payload),
      "Đã lưu bài viết.",
    );
    if (saved) {
      broadcastCatalogChange({ kind: "article", action: editingArticle ? "updated" : "created", slug: finalSlug });
      setArticleForm(emptyArticleForm);
      setEditingArticle(null);
    }
  };

  return (
    <div>
      <header className="border-b border-slate-200 pb-6">
        <h1 className="text-3xl font-bold">Gói khám, FAQ và bài viết</h1>
        <p className="mt-2 text-sm text-slate-600">
          Cập nhật nội dung, mức giá và trạng thái hiển thị của các danh mục truyền thông y tế.
        </p>
      </header>

      {feedback ? <div className="mt-5"><AdminState description={feedback.description} title={feedback.title} tone={feedback.tone} /></div> : null}

      {loading ? (
        <div className="mt-6">
          <AdminState description="Vui lòng chờ trong giây lát." title="Đang tải nội dung" tone="loading" />
        </div>
      ) : null}

      {!loading && loadError ? (
        <div className="mt-6">
          <AdminState
            action={<button className={secondaryButtonClass} onClick={() => void load()} type="button">Thử lại</button>}
            description={loadError}
            title="Không thể tải danh mục"
            tone="error"
          />
        </div>
      ) : null}

      {!loading && !loadError ? (
        <div className="mt-6 grid gap-6 xl:grid-cols-2">
          <Panel
            description="Quản lý nội dung, giá và trạng thái hiển thị của từng gói khám."
            title={editingPackage ? "Sửa gói khám" : "Gói khám"}
          >
            <form className="mt-4 space-y-3" onSubmit={savePackage}>
              <label className="block text-sm font-semibold">
                Tên
                <input
                  className={inputClass}
                  required
                  value={packageForm.name}
                  onChange={(event) => setPackageForm({ ...packageForm, name: event.target.value })}
                />
              </label>
              <label className="block text-sm font-semibold">
                Slug
                <input
                  className={inputClass}
                  required
                  value={packageForm.slug}
                  onChange={(event) => setPackageForm({ ...packageForm, slug: event.target.value })}
                />
              </label>
              <label className="block text-sm font-semibold">
                Mô tả
                <textarea
                  className={inputClass}
                  value={packageForm.description}
                  onChange={(event) => setPackageForm({ ...packageForm, description: event.target.value })}
                />
              </label>
              <label className="block text-sm font-semibold">
                Giá
                <input
                  className={inputClass}
                  min="1"
                  required
                  type="number"
                  value={packageForm.price}
                  onChange={(event) => setPackageForm({ ...packageForm, price: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  checked={packageForm.active}
                  onChange={(event) => setPackageForm({ ...packageForm, active: event.target.checked })}
                  type="checkbox"
                />
                Đang hiển thị công khai
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} disabled={busy} type="submit">
                  Lưu gói khám
                </button>
                {editingPackage ? (
                  <button
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() => {
                      setPackageForm(emptyPackageForm);
                      setEditingPackage(null);
                    }}
                    type="button"
                  >
                    Hủy sửa
                  </button>
                ) : null}
              </div>
            </form>
            <div className="mt-5 space-y-2" ref={packagesContainerRef}>
              {packages.length === 0 ? <AdminState description="Tạo gói khám đầu tiên để bắt đầu danh mục." title="Chưa có gói khám" tone="empty" /> : null}
              {packages.map((item) => (
                <div className="rounded-[4px] border border-slate-200 bg-white p-3 text-sm transition-colors hover:border-slate-300" data-id={item.id} key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        aria-label={`Kéo thả đổi thứ tự ${item.name}`}
                        className="package-drag-handle flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-[4px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
                        title="Kéo thả để sắp xếp thứ tự hiển thị"
                        type="button"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="9" cy="6" r="1.5" fill="currentColor" />
                          <circle cx="15" cy="6" r="1.5" fill="currentColor" />
                          <circle cx="9" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="15" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="9" cy="18" r="1.5" fill="currentColor" />
                          <circle cx="15" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      </button>
                      <div className="flex gap-1" aria-label={`Sắp xếp ${item.name}`} role="group">
                        <button aria-label={`Di chuyển ${item.name} lên`} className="min-h-11 rounded-[4px] border border-slate-300 px-2 font-semibold disabled:opacity-40" disabled={busy || packages.indexOf(item) === 0} onClick={() => { const index = packages.indexOf(item); void persistPackageOrder(moveItem(packages, index, -1), index, index - 1); }} type="button">▲</button>
                        <button aria-label={`Di chuyển ${item.name} xuống`} className="min-h-11 rounded-[4px] border border-slate-300 px-2 font-semibold disabled:opacity-40" disabled={busy || packages.indexOf(item) === packages.length - 1} onClick={() => { const index = packages.indexOf(item); void persistPackageOrder(moveItem(packages, index, 1), index, index + 1); }} type="button">▼</button>
                      </div>
                      <strong className="text-slate-900">{item.name}</strong>
                    </div>
                    <StatusBadge active={item.active ?? true} />
                  </div>
                  <p className="mt-1 pl-6 text-slate-600">{item.price.toLocaleString("vi-VN")} đ</p>
                  <div className="mt-2 pl-6">
                    <button
                      aria-label={`Sửa ${item.name}`}
                      className="mr-3 text-teal-800 underline"
                      disabled={busy}
                      onClick={() => {
                        setEditingPackage(item.slug);
                        setPackageForm(packageFormFrom(item));
                      }}
                      type="button"
                    >
                      Sửa
                    </button>
                    <button
                      aria-label={`Xóa ${item.name}`}
                      className="text-red-700 underline"
                      disabled={busy}
                      onClick={() => setPendingRemoval({
                        label: `gói khám "${item.name}"`,
                        detail: [
                          { label: "Tên gói khám", value: item.name },
                          { label: "Slug", value: item.slug, mono: true },
                          { label: "Giá", value: `${Number(item.price).toLocaleString("vi-VN")} đ` },
                        ],
                        action: () => adminDeletePackage(item.slug),
                        success: "Đã xóa gói khám",
                        broadcast: { kind: "package", slug: item.slug },
                      })}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel
            description="Duy trì câu hỏi thường gặp và kiểm soát nội dung đang hiển thị."
            title={faqForm.id ? "Sửa FAQ" : "FAQ"}
          >
            <p className="mt-3 rounded-[4px] border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
              FAQ đang hiển thị công khai chưa đồng nghĩa với nguồn đã đủ điều kiện cho chatbot. Sau khi cập nhật, hãy gửi đúng revision/hash để bác sĩ độc lập review.
              <Link className="mt-2 inline-flex min-h-11 items-center font-bold text-teal-800 underline" href="/admin/ai-content-reviews">Mở luồng AI review →</Link>
            </p>
            <form className="mt-4 space-y-3" onSubmit={saveFaq}>
              <label className="block text-sm font-semibold">
                Câu hỏi
                <textarea
                  className={inputClass}
                  required
                  value={faqForm.question}
                  onChange={(event) => setFaqForm({ ...faqForm, question: event.target.value })}
                />
              </label>
              <label className="block text-sm font-semibold">
                Trả lời
                <textarea
                  className={inputClass}
                  required
                  rows={5}
                  value={faqForm.answer}
                  onChange={(event) => setFaqForm({ ...faqForm, answer: event.target.value })}
                />
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input
                  checked={faqForm.active}
                  onChange={(event) => setFaqForm({ ...faqForm, active: event.target.checked })}
                  type="checkbox"
                />
                Đang hiển thị công khai
              </label>
              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} disabled={busy} type="submit">
                  Lưu FAQ
                </button>
                {faqForm.id ? (
                  <button className={secondaryButtonClass} disabled={busy} onClick={() => setFaqForm(emptyFaqForm)} type="button">
                    Hủy sửa
                  </button>
                ) : null}
              </div>
            </form>
            <div className="mt-5 space-y-2" ref={faqsContainerRef}>
              {faqs.length === 0 ? <AdminState description="Tạo câu hỏi đầu tiên để hỗ trợ người bệnh." title="Chưa có câu hỏi thường gặp" tone="empty" /> : null}
              {faqs.map((item) => (
                <div className="rounded-[4px] border border-slate-200 bg-white p-3 text-sm transition-colors hover:border-slate-300" data-id={item.id} key={item.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        aria-label={`Kéo thả đổi thứ tự ${item.question}`}
                        className="faq-drag-handle flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-[4px] text-slate-500 hover:bg-slate-100 hover:text-slate-700 active:cursor-grabbing"
                        title="Kéo thả để sắp xếp thứ tự hiển thị"
                        type="button"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <circle cx="9" cy="6" r="1.5" fill="currentColor" />
                          <circle cx="15" cy="6" r="1.5" fill="currentColor" />
                          <circle cx="9" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="15" cy="12" r="1.5" fill="currentColor" />
                          <circle cx="9" cy="18" r="1.5" fill="currentColor" />
                          <circle cx="15" cy="18" r="1.5" fill="currentColor" />
                        </svg>
                      </button>
                      <div className="flex gap-1" aria-label={`Sắp xếp ${item.question}`} role="group">
                        <button aria-label={`Di chuyển ${item.question} lên`} className="min-h-11 rounded-[4px] border border-slate-300 px-2 font-semibold disabled:opacity-40" disabled={busy || faqs.indexOf(item) === 0} onClick={() => { const index = faqs.indexOf(item); void persistFaqOrder(moveItem(faqs, index, -1), index, index - 1); }} type="button">▲</button>
                        <button aria-label={`Di chuyển ${item.question} xuống`} className="min-h-11 rounded-[4px] border border-slate-300 px-2 font-semibold disabled:opacity-40" disabled={busy || faqs.indexOf(item) === faqs.length - 1} onClick={() => { const index = faqs.indexOf(item); void persistFaqOrder(moveItem(faqs, index, 1), index, index + 1); }} type="button">▼</button>
                      </div>
                      <strong className="text-slate-900">{item.question}</strong>
                    </div>
                    <StatusBadge active={item.active ?? true} />
                  </div>
                  <p className="mt-1 pl-6 text-slate-600 line-clamp-2">{item.answer}</p>
                  <div className="mt-2 pl-6">
                    <button
                      aria-label={`Sửa câu hỏi: ${item.question}`}
                      className="mr-3 text-teal-800 underline"
                      disabled={busy}
                      onClick={() => setFaqForm(faqFormFrom(item))}
                      type="button"
                    >
                      Sửa
                    </button>
                    <button
                      aria-label={`Xóa câu hỏi: ${item.question}`}
                      className="text-red-700 underline"
                      disabled={busy}
                      onClick={() => setPendingRemoval({
                        label: `câu hỏi "${item.question}"`,
                        detail: [
                          { label: "Câu hỏi", value: item.question },
                          { label: "Trạng thái", value: item.active ?? true ? "Đang hiển thị" : "Tạm ẩn" },
                        ],
                        action: () => adminDeleteFaq(item.id),
                        success: "Đã xóa câu hỏi",
                        broadcast: { kind: "faq" },
                      })}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <div className="xl:col-span-2">
            <Panel
              description="Biên tập bài viết và kiểm soát trạng thái xuất bản công khai."
              title={editingArticle ? "Sửa bài viết" : "Biên tập bài viết y khoa"}
            >
              {/* Editorial top action bar & Medical blueprints */}
              <div className="mt-4 space-y-3 rounded-[4px] border border-slate-200 bg-slate-50 p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-600">Khung bài viết chuẩn:</span>
                    {MEDICAL_ARTICLE_BLUEPRINTS.map((bp) => (
                      <button
                        className="rounded-[4px] border border-teal-600/30 bg-white px-2.5 py-1 text-xs font-bold text-teal-800 transition-colors hover:bg-teal-50"
                        disabled={busy}
                        key={bp.key}
                        onClick={() => handleApplyBlueprint(bp.key)}
                        title={bp.description}
                        type="button"
                      >
                        + {bp.name}
                      </button>
                    ))}
                  </div>
                  {editingArticle ? (
                    <button
                      className="rounded-[4px] border border-slate-300 bg-white px-3 py-1 text-xs font-bold text-slate-700 hover:bg-slate-100"
                      disabled={busy}
                      onClick={handleCreateNewArticle}
                      type="button"
                    >
                      + Tạo bài viết mới
                    </button>
                  ) : null}
                </div>
              </div>

            <form className="mt-4 space-y-6" onSubmit={saveArticle}>
              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Tiêu đề
                  <input
                    className={inputClass}
                    placeholder="Ví dụ: Viêm loét dạ dày tá tràng và vi khuẩn HP..."
                    required
                    value={articleForm.title}
                    onChange={(event) => handleTitleChange(event.target.value)}
                  />
                </label>
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-sm font-semibold">Slug</label>
                    <button
                      className="text-xs font-semibold text-teal-800 underline hover:text-teal-900"
                      onClick={handleRegenerateSlug}
                      type="button"
                    >
                      Tạo lại từ tiêu đề
                    </button>
                  </div>
                  <input
                    className={inputClass}
                    required
                    value={articleForm.slug}
                    onChange={(event) => setArticleForm({ ...articleForm, slug: event.target.value })}
                  />
                </div>
                <label className="block text-sm font-semibold">
                  Loại nội dung
                  <select
                    className={inputClass}
                    value={articleForm.contentKind}
                    onChange={(event) => setArticleForm({ ...articleForm, contentKind: event.target.value as ArticleForm["contentKind"] })}
                  >
                    <option value="GENERAL">Nội dung chung</option>
                    <option value="DISEASE_GUIDE">Hướng dẫn bệnh lý</option>
                  </select>
                </label>
                <label className="block text-sm font-semibold">
                  Chuyên khoa liên quan
                  <input
                    className={inputClass}
                    value={articleForm.relatedSpecialtySlug}
                    onChange={(event) => setArticleForm({ ...articleForm, relatedSpecialtySlug: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Danh mục
                  <input
                    className={inputClass}
                    value={articleForm.category}
                    onChange={(event) => setArticleForm({ ...articleForm, category: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Tác giả
                  <input
                    className={inputClass}
                    value={articleForm.authorName}
                    onChange={(event) => setArticleForm({ ...articleForm, authorName: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Thời lượng đọc (phút)
                  <input
                    className={inputClass}
                    inputMode="numeric"
                    max="180"
                    min="1"
                    type="number"
                    value={articleForm.readingMinutes}
                    onChange={(event) => setArticleForm({ ...articleForm, readingMinutes: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Phiên bản optimistic
                  <input
                    className={inputClass}
                    readOnly
                    value={articleForm.version ?? "mới"}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Ảnh bìa
                  <input
                    className={inputClass}
                    value={articleForm.coverImageUrl}
                    onChange={(event) => setArticleForm({ ...articleForm, coverImageUrl: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Tiêu đề SEO
                  <input
                    className={inputClass}
                    value={articleForm.seoTitle}
                    onChange={(event) => setArticleForm({ ...articleForm, seoTitle: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Mô tả SEO
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.seoDescription}
                    onChange={(event) => setArticleForm({ ...articleForm, seoDescription: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Lịch xuất bản
                  <input
                    className={inputClass}
                    type="datetime-local"
                    value={articleForm.scheduledPublishAt}
                    onChange={(event) => setArticleForm({ ...articleForm, scheduledPublishAt: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Ngôn ngữ nội dung
                  <input
                    className={inputClass}
                    placeholder="vi-VN"
                    value={articleForm.contentLanguage}
                    onChange={(event) => setArticleForm({ ...articleForm, contentLanguage: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold md:col-span-2">
                  Đối tượng độc giả
                  <input
                    className={inputClass}
                    placeholder="PATIENT"
                    value={articleForm.audience}
                    onChange={(event) => setArticleForm({ ...articleForm, audience: event.target.value })}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold text-slate-900">Nội dung biên tập</h3>
                <label className="block text-sm font-semibold">
                  Tóm tắt
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={articleForm.summary}
                    onChange={(event) => setArticleForm({ ...articleForm, summary: event.target.value })}
                  />
                </label>
                <div className="space-y-1">
                  <RichTextEditor
                    id="admin-article-body-editor"
                    label="Nội dung bài viết y khoa (Body)"
                    minHeight="280px"
                    onChange={(newBody) => setArticleForm((current) => ({ ...current, body: newBody }))}
                    placeholder="Nội dung chi tiết bài viết, hỗ trợ định dạng Markdown và hộp thông tin lâm sàng..."
                    purpose="ARTICLE_COVER"
                    value={articleForm.body}
                  />
                </div>
                <label className="block text-sm font-semibold">
                  Tags
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.tags}
                    onChange={(event) => setArticleForm({ ...articleForm, tags: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Topic tags
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.topicTags}
                    onChange={(event) => setArticleForm({ ...articleForm, topicTags: event.target.value })}
                  />
                </label>
              </div>

              <div className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900">Cấu trúc các Section bài viết ({articleForm.sections.length})</h3>
                    <p className="text-xs text-slate-500">Kéo biểu tượng ⠿ hoặc dùng nút ▲ ▼ để sắp xếp thứ tự logic bài viết</p>
                  </div>
                  <button
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={handleAddSection}
                    type="button"
                  >
                    + Thêm section
                  </button>
                </div>
                {articleForm.sections.length === 0 ? (
                  <p className="rounded-[4px] border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
                    Chưa có section nào. Hãy nhấn <strong>+ Thêm section</strong> hoặc chọn một <strong>Khung bài viết chuẩn</strong> ở trên để bắt đầu.
                  </p>
                ) : null}
                <div className="space-y-3" ref={sectionsContainerRef}>
                  {articleForm.sections.map((section, index) => (
                    <div
                      className="space-y-3 rounded-[4px] border border-slate-200 bg-slate-50/80 p-4 transition-colors hover:border-slate-300"
                      data-id={section.id}
                      key={section.id}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/80 pb-2.5">
                        <div className="flex items-center gap-2">
                          <button
                            aria-label={`Kéo thả đổi thứ tự Section ${index + 1}`}
                            className="section-drag-handle flex min-h-11 min-w-11 cursor-grab items-center justify-center rounded-[4px] text-slate-400 hover:bg-slate-200 hover:text-slate-700 active:cursor-grabbing"
                            title="Kéo thả để sắp xếp thứ tự section"
                            type="button"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="9" cy="6" r="1.5" fill="currentColor" />
                              <circle cx="15" cy="6" r="1.5" fill="currentColor" />
                              <circle cx="9" cy="12" r="1.5" fill="currentColor" />
                              <circle cx="15" cy="12" r="1.5" fill="currentColor" />
                              <circle cx="9" cy="18" r="1.5" fill="currentColor" />
                              <circle cx="15" cy="18" r="1.5" fill="currentColor" />
                            </svg>
                          </button>
                          <span className="rounded-[4px] bg-teal-100 px-2 py-0.5 text-xs font-bold text-teal-800">
                            Section {index + 1}
                          </span>
                          <span className="text-xs font-semibold text-slate-700 line-clamp-1 max-w-xs sm:max-w-sm">
                            {section.heading ? section.heading : "(Chưa đặt tiêu đề)"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs">
                          <button
                            aria-label={`Di chuyển Section ${index + 1} lên`}
                            className="rounded-[4px] border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                            disabled={busy || index === 0}
                            onClick={() => handleMoveSectionUp(index)}
                            title="Di chuyển lên"
                            type="button"
                          >
                            ▲ Lên
                          </button>
                          <button
                            aria-label={`Di chuyển Section ${index + 1} xuống`}
                            className="rounded-[4px] border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40"
                            disabled={busy || index === articleForm.sections.length - 1}
                            onClick={() => handleMoveSectionDown(index)}
                            title="Di chuyển xuống"
                            type="button"
                          >
                            ▼ Xuống
                          </button>
                          <button
                            aria-label={`Nhân bản Section ${index + 1}`}
                            className="rounded-[4px] border border-slate-300 bg-white px-2 py-1 font-semibold text-slate-700 hover:bg-slate-100"
                            disabled={busy}
                            onClick={() => handleCloneSection(index)}
                            title="Tạo bản sao section này"
                            type="button"
                          >
                            Sao chép
                          </button>
                          <button
                            aria-label={`Xóa Section ${index + 1}`}
                            className="rounded-[4px] px-2 py-1 font-semibold text-red-700 hover:bg-red-50"
                            disabled={busy}
                            onClick={() => handleRemoveSection(index)}
                            type="button"
                          >
                            Xóa
                          </button>
                        </div>
                      </div>
                      <label className="block text-sm font-semibold">
                        Tiêu đề section
                        <input
                          className={inputClass}
                          placeholder="Ví dụ: 1. Tổng quan tình trạng & Cơ chế bệnh sinh..."
                          value={section.heading}
                          onChange={(event) =>
                            setArticleForm((current) =>
                              articleSectionAt(current, index, { heading: event.target.value }),
                            )
                          }
                        />
                      </label>
                      <label className="block text-sm font-semibold">
                        Nội dung section
                        <textarea
                          className={inputClass}
                          placeholder="Nội dung giải thích chi tiết cho phần mục này..."
                          rows={4}
                          value={section.body}
                          onChange={(event) =>
                            setArticleForm((current) =>
                              articleSectionAt(current, index, { body: event.target.value }),
                            )
                          }
                        />
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <label className="block text-sm font-semibold">
                  Điểm nổi bật
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.keyTakeaways}
                    onChange={(event) => setArticleForm({ ...articleForm, keyTakeaways: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Dấu hiệu cảnh báo
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.warningSigns}
                    onChange={(event) => setArticleForm({ ...articleForm, warningSigns: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Phòng ngừa
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.preventionTips}
                    onChange={(event) => setArticleForm({ ...articleForm, preventionTips: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold">
                  Nguồn tham khảo
                  <textarea
                    className={inputClass}
                    rows={3}
                    value={articleForm.sourceReferences}
                    onChange={(event) => setArticleForm({ ...articleForm, sourceReferences: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold md:col-span-2">
                  Khi nào cần đi khám
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={articleForm.whenToSeekCare}
                    onChange={(event) => setArticleForm({ ...articleForm, whenToSeekCare: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold md:col-span-2">
                  Clinical disclaimer
                  <textarea
                    className={inputClass}
                    rows={4}
                    value={articleForm.clinicalDisclaimer}
                    onChange={(event) => setArticleForm({ ...articleForm, clinicalDisclaimer: event.target.value })}
                  />
                </label>
                <label className="block text-sm font-semibold md:col-span-2">
                  Clinical metadata (JSON object)
                  <textarea
                    className={inputClass}
                    rows={5}
                    value={articleForm.clinicalMetadata}
                    onChange={(event) => setArticleForm({ ...articleForm, clinicalMetadata: event.target.value })}
                  />
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-6">
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    checked={articleForm.featured}
                    onChange={(event) => setArticleForm({ ...articleForm, featured: event.target.checked })}
                    type="checkbox"
                  />
                  Bài viết nổi bật
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold">
                  <input
                    checked={articleForm.active}
                    onChange={(event) => setArticleForm({ ...articleForm, active: event.target.checked })}
                    type="checkbox"
                  />
                  Đang xuất bản công khai
                </label>
                <p className="text-xs text-slate-500">
                  Phiên bản optimistic hiện tại: {articleForm.version ?? "mới"}.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className={buttonClass} disabled={busy} type="submit">
                  Lưu bài viết
                </button>
                {editingArticle ? (
                  <button
                    className={secondaryButtonClass}
                    disabled={busy}
                    onClick={() => {
                      setArticleForm(emptyArticleForm);
                      setEditingArticle(null);
                    }}
                    type="button"
                  >
                    Hủy sửa
                  </button>
                ) : null}
              </div>
            </form>

            <div className="mt-8 border-t border-slate-200 pt-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Danh sách bài viết y khoa ({articles.length})
                  </h3>
                  <p className="text-xs text-slate-500">
                    Hiển thị {articles.filter((item) => {
                      if (!articleSearchQuery.trim()) return true;
                      const q = articleSearchQuery.toLowerCase();
                      return (
                        item.title.toLowerCase().includes(q) ||
                        (item.category && item.category.toLowerCase().includes(q)) ||
                        item.slug.toLowerCase().includes(q) ||
                        (item.authorName && item.authorName.toLowerCase().includes(q))
                      );
                    }).length} / {articles.length} bài viết
                  </p>
                </div>
                <div className="w-full sm:w-72">
                  <input
                    className={inputClass}
                    placeholder="Tìm theo tiêu đề, danh mục, tác giả..."
                    value={articleSearchQuery}
                    onChange={(e) => setArticleSearchQuery(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="mt-2 space-y-2">
              {articles.filter((item) => {
                if (!articleSearchQuery.trim()) return true;
                const q = articleSearchQuery.toLowerCase();
                return (
                  item.title.toLowerCase().includes(q) ||
                  (item.category && item.category.toLowerCase().includes(q)) ||
                  item.slug.toLowerCase().includes(q) ||
                  (item.authorName && item.authorName.toLowerCase().includes(q))
                );
              }).length === 0 ? (
                <AdminState
                  description={articleSearchQuery ? "Không có bài viết nào khớp với từ khóa tìm kiếm." : "Tạo bài viết đầu tiên để bắt đầu thư viện nội dung."}
                  title={articleSearchQuery ? "Không tìm thấy bài viết" : "Chưa có bài viết"}
                  tone="empty"
                />
              ) : null}
              {articles
                .filter((item) => {
                  if (!articleSearchQuery.trim()) return true;
                  const q = articleSearchQuery.toLowerCase();
                  return (
                    item.title.toLowerCase().includes(q) ||
                    (item.category && item.category.toLowerCase().includes(q)) ||
                    item.slug.toLowerCase().includes(q) ||
                    (item.authorName && item.authorName.toLowerCase().includes(q))
                  );
                })
                .map((item) => {
                const active = item.active ?? Boolean(item.publishedAt);
                const metaChips = [
                  articleKindLabel(item.contentKind),
                  item.category,
                  item.authorName,
                  item.relatedSpecialtySlug ? `Chuyên khoa: ${item.relatedSpecialtySlug}` : null,
                  item.contentLanguage ? `Ngôn ngữ: ${item.contentLanguage}` : null,
                  item.audience ? `Đối tượng: ${item.audience}` : null,
                  typeof item.readingMinutes === "number" ? `${item.readingMinutes} phút đọc` : null,
                  item.featured ? "Nổi bật" : null,
                  item.version != null ? `v${item.version}` : null,
                ].filter((value): value is string => Boolean(value));
                const sectionCount = Array.isArray(item.sections) ? item.sections.length : 0;
                const tagCount = listLength(item.tags);
                const topicCount = listLength(item.topicTags);
                const metadataCount = objectKeyCount(item.clinicalMetadata);

                return (
                  <div className="rounded-[4px] border p-3 text-sm" key={item.id}>
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <strong className="block break-words">{item.title}</strong>
                        <p className="mt-1 text-xs text-slate-600">{item.slug}</p>
                      </div>
                      <StatusBadge active={active} />
                    </div>
                    <p className="mt-2 text-sm text-slate-700 line-clamp-2">{item.summary?.trim() || "Chưa có tóm tắt."}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {metaChips.map((chip, index) => (
                        <span className="rounded-[4px] bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700" key={`${chip}-${index}`}>
                          {chip}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                      <p>Xuất bản: {formatDateTime(item.publishedAt)}</p>
                      <p>Lên lịch: {formatDateTime(item.scheduledPublishAt)}</p>
                      <p>Cập nhật: {formatDateTime(item.updatedAt)}</p>
                      <p>Sections: {sectionCount}</p>
                      <p>Tags: {tagCount}</p>
                      <p>Topic tags: {topicCount}</p>
                      <p>Clinical metadata: {metadataCount}</p>
                    </div>
                    {!active ? <p className="mt-2 text-xs font-semibold text-amber-700">Chưa xuất bản</p> : null}
                    <button
                      aria-label={`Sửa ${item.title}`}
                      className="mr-3 text-teal-800 underline"
                      disabled={busy}
                      onClick={() => {
                        setEditingArticle(item.slug);
                        setArticleForm(articleFormFrom(item));
                      }}
                      type="button"
                    >
                      Sửa
                    </button>
                    <button
                      aria-label={`Xóa ${item.title}`}
                      className="text-red-700 underline"
                      disabled={busy}
                      onClick={() => setPendingRemoval({
                        label: `bài viết "${item.title}"`,
                        detail: [
                          { label: "Tiêu đề", value: item.title },
                          { label: "Slug", value: item.slug, mono: true },
                        ],
                        action: () => adminDeleteArticle(item.slug),
                        success: "Đã xóa bài viết",
                        broadcast: { kind: "article", slug: item.slug },
                      })}
                      type="button"
                    >
                      Xóa
                    </button>
                  </div>
                );
              })}
            </div>
          </Panel>
          </div>
        </div>
      ) : null}

      <ConfirmActionDialog
        confirmLabel="Xóa vĩnh viễn"
        confirmingLabel="Đang xóa…"
        description="Nội dung đã xóa không thể khôi phục và sẽ mất khỏi danh mục công khai ở lần làm mới kế tiếp. Nếu chỉ muốn tạm gỡ, hãy dùng trạng thái “Tạm ẩn”."
        destructive
        entity={pendingRemoval}
        onCancel={() => { if (!busy) setPendingRemoval(null); }}
        onConfirm={() => void confirmRemoval()}
        open={pendingRemoval !== null}
        pending={busy}
        summaryItems={pendingRemoval?.detail ?? []}
        summaryLabel="Bản ghi sẽ bị xóa vĩnh viễn"
        title={pendingRemoval ? `Xóa ${pendingRemoval.label}?` : "Xóa bản ghi này?"}
      />

      {/* Enterprise Toast Notifications */}
      <ToastContainer onClose={removeToast} toasts={toasts} />
    </div>
  );
}
