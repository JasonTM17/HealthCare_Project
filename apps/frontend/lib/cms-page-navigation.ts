import { fetchArticleBySlug, fetchBranchBySlug, fetchDoctorBySlug, fetchPackageBySlug, fetchServiceBySlug, fetchSpecialtyBySlug } from "./api-client";
import { CMS_PAGE_MANIFESTS, resolveCmsPageIdentity, type CmsPageIdentity } from "./cms-page-manifest";

/** A public URL resolves through its real catalogue; no writable slug hash or user-entered UUID. */
export async function resolveCmsPublicDetail(value: string, origin: string): Promise<CmsPageIdentity> {
  const url = new URL(value.trim(), origin);
  if (url.origin !== origin || url.search || url.hash || url.username || url.password) throw new Error("Dùng đường dẫn trang chi tiết công khai của website, không kèm tham số.");
  const parts = url.pathname.replace(/\/$/, "").split("/").slice(1);
  const manifest = CMS_PAGE_MANIFESTS.find((page) => page.supportsDetail && page.path === `/${parts[0]}`);
  if (!manifest || parts.length !== 2) throw new Error("Đường dẫn này không phải trang chi tiết được hỗ trợ.");
  const placeholder = resolveCmsPageIdentity(url.pathname, "00000000-0000-4000-8000-000000000001");
  if (!placeholder) throw new Error("Đường dẫn trang chi tiết không hợp lệ.");
  const slug = decodeURIComponent(parts[1]);
  const readers = { branches: fetchBranchBySlug, doctors: fetchDoctorBySlug, specialties: fetchSpecialtyBySlug, services: fetchServiceBySlug, packages: fetchPackageBySlug, articles: fetchArticleBySlug, "benh-pho-bien": fetchArticleBySlug };
  const reader = readers[manifest.family as keyof typeof readers];
  if (!reader) throw new Error("Trang chi tiết chưa có nguồn danh mục hợp lệ.");
  const entity = await reader(slug);
  if (manifest.family === "benh-pho-bien" && (!("contentKind" in entity) || entity.contentKind !== "DISEASE_GUIDE")) throw new Error("Bài viết này không thuộc kho bệnh phổ biến.");
  const identity = resolveCmsPageIdentity(url.pathname, entity.id);
  if (!identity) throw new Error("Danh mục chưa trả về định danh trang hợp lệ.");
  return identity;
}
