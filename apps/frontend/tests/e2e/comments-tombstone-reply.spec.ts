import { expect, test } from "@playwright/test";

/**
 * Regression: a soft-deleted root comment renders as a tombstone anchor and
 * its surviving reply thread stays fully readable beneath it — not merely
 * counted. Found in round 7 when the doctor's professional answer to a
 * patient question disappeared for every reader after the question was
 * deleted. The fixture is fully route-mocked so the spec is self-contained.
 */
const SLUG = "e2e-comments-tombstone-reply-fixture";

// Convention guard: every e2e fixture slug must start with `e2e-`. The backend
// relies on that prefix to keep fixture content out of public reads (V100
// unpublishes existing `e2e-*` rows and the public ArticleRepository queries
// exclude the prefix structurally), so a fixture created outside it would leak
// onto the real hospital site and survive both safeguards.
test("fixture slug follows the e2e- convention", () => {
  expect(SLUG).toMatch(/^e2e-/);
});

const article = {
  id: "art-fixture-1",
  title: "E2E: Tombstone reply thread fixture",
  slug: SLUG,
  summary: "Kiểm tra hồi quy cho luồng phản hồi dưới bình luận đã xóa.",
  body: "Nội dung tham khảo cho bài viết fixture.",
  publishedAt: "2026-09-22T00:00:00Z",
  active: true,
  authorDoctorId: null,
  reviewStatus: "APPROVED",
  category: "Cẩm nang sức khỏe",
  authorName: "Ban biên tập",
  readingMinutes: 1,
  contentKind: "GENERAL",
};

const comments = [
  {
    id: "root-deleted-1",
    articleSlug: SLUG,
    authorUserId: "user-deleted",
    authorName: "",
    authorRole: "PATIENT",
    content: "[Bình luận đã xóa]",
    parentCommentId: null,
    createdAt: "2026-09-22T10:00:00Z",
    updatedAt: "2026-09-22T10:05:00Z",
    active: false,
  },
  {
    id: "reply-survives-1",
    articleSlug: SLUG,
    authorUserId: "doctor-1",
    authorName: "BS. E2E Phản hồi",
    authorRole: "DOCTOR",
    content: "Phản hồi chuyên môn vẫn hiển thị dưới placeholder.",
    parentCommentId: "root-deleted-1",
    createdAt: "2026-09-22T10:06:00Z",
    updatedAt: "2026-09-22T10:06:00Z",
    active: true,
  },
  // Wukong falsification case: the API accepts reply-to-reply nesting, so a
  // surviving reply whose own parent reply was deleted must still render.
  {
    id: "reply-deleted-2",
    articleSlug: SLUG,
    authorUserId: "user-deleted-2",
    authorName: "",
    authorRole: "PATIENT",
    content: "[Bình luận đã xóa]",
    parentCommentId: "reply-survives-1",
    createdAt: "2026-09-22T10:07:00Z",
    updatedAt: "2026-09-22T10:08:00Z",
    active: false,
  },
  {
    id: "reply-survives-2",
    articleSlug: SLUG,
    authorUserId: "doctor-2",
    authorName: "BS. E2E Sâu",
    authorRole: "DOCTOR",
    content: "Phản hồi cấp hai vẫn hiển thị sau khi cha trung gian bị xóa.",
    parentCommentId: "reply-deleted-2",
    createdAt: "2026-09-22T10:09:00Z",
    updatedAt: "2026-09-22T10:09:00Z",
    active: true,
  },
];

test("deleted root keeps its reply thread visible under the tombstone", async ({ page }) => {
  await page.route(`**/api/v1/hospital/articles/${SLUG}`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(article) }));
  await page.route(`**/api/v1/hospital/articles/${SLUG}/comments`, (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(comments) }));

  await page.goto(`/articles/${SLUG}`);

  const tombstone = page.getByText("[Bình luận đã xóa]");
  await expect(tombstone.first()).toBeVisible();
  await expect(page.getByText("Phản hồi chuyên môn vẫn hiển thị dưới placeholder.")).toBeVisible();
  // Depth-2: surviving reply under a deleted intermediate reply.
  await expect(page.getByText("Phản hồi cấp hai vẫn hiển thị sau khi cha trung gian bị xóa.")).toBeVisible();
  await expect(page.getByText(/Luồng phản hồi & giải đáp \(1\)/).first()).toBeVisible();
});
