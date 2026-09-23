"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ApiError,
  clearAuthSession,
  fetchNotifications,
  fetchPatientOverview,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type Page,
} from "../lib/api-client";
import { formatBusinessDateTime } from "../lib/business-time";
import { presentApiError } from "../lib/present-api-error";
import type { Notification } from "../types/hospital";
import { formatNotificationType, type PortalRole } from "./PortalChrome";
import { ErrorState, LoadingState } from "./PortalStates";
import UiIcon, { type IconName } from "./UiIcon";

/**
 * Full-screen notification inbox — the destination of the bell's
 * "Xem tất cả thông báo" (docs/design/stitch-notification-panel.md backlog #1
 * and #2: category filters, whole-page list, empty state).
 *
 * One component serves both `/patient/notifications` and
 * `/doctor/notifications`: the notifications API is role-agnostic and scopes
 * rows to the caller server-side, so forking a second list would only duplicate
 * the filter, pagination and empty-state behaviour.
 *
 * The endpoint accepts page/size only (no category parameter), so a category
 * filter narrows the rows already loaded and "Tải thêm" pulls the next page of
 * the same inbox. The summary line says "đã tải" for exactly that reason: it
 * must not read like a total the server never returned.
 *
 * The *unread* number is the exception: for the patient portal it is the same
 * `unreadNotificationCount` the bell badge and popover read from the overview
 * endpoint, so all three surfaces agree. While the loaded pages do not cover
 * every unread (pagination), the header states "đang hiển thị X trong Y tin
 * chưa đọc" instead of presenting the page slice as the whole inbox.
 */

const PAGE_SIZE = 20;

type CategoryKey = "appointment" | "clinical" | "consultation" | "care_plan" | "payment" | "other";

interface CategoryDefinition {
  key: CategoryKey;
  label: string;
  icon: IconName;
}

/** Mirrors `Notification.EventType` / the V94 event whitelist. */
const CATEGORIES: CategoryDefinition[] = [
  { key: "appointment", label: "Lịch hẹn", icon: "calendar" },
  { key: "clinical", label: "Cận lâm sàng", icon: "stethoscope" },
  { key: "consultation", label: "Tư vấn & hỏi đáp", icon: "message-square" },
  { key: "care_plan", label: "Kế hoạch chăm sóc", icon: "layers" },
  { key: "payment", label: "Thanh toán", icon: "activity" },
  { key: "other", label: "Thông báo khác", icon: "bell" },
];

const ALL_TAB = "all";

function categoryOf(eventType: string): CategoryKey {
  if (eventType.startsWith("APPOINTMENT_")) return "appointment";
  if (eventType.startsWith("CARE_PLAN_")) return "care_plan";
  if (eventType.startsWith("PAYMENT_")) return "payment";
  if (eventType.startsWith("HEALTH_QUESTION_") || eventType === "CONSULTATION_MESSAGE") return "consultation";
  if (eventType.startsWith("DIAGNOSTIC_") || eventType === "VISIT_COMPLETED") return "clinical";
  // An event type added server-side without a FE update still shows up under
  // "all" and under this bucket instead of disappearing from a filter.
  return "other";
}

function iconFor(eventType: string): IconName {
  return CATEGORIES.find((category) => category.key === categoryOf(eventType))?.icon ?? "bell";
}

function errorMessage(error: unknown): string {
  return error instanceof ApiError
    ? presentApiError(error.code, error.status)
    : "Chưa thể tải thông báo. Vui lòng thử lại.";
}

function errorStatus(error: unknown): number | undefined {
  return error instanceof ApiError ? error.status : undefined;
}

interface NotificationCenterProps {
  role: PortalRole;
}

export default function NotificationCenter({ role }: NotificationCenterProps) {
  const path = role === "PATIENT" ? "/patient/notifications" : "/doctor/notifications";
  const [items, setItems] = useState<Notification[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [failure, setFailure] = useState<{ message: string; statusCode?: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [lastPage, setLastPage] = useState(true);
  const [currentPage, setCurrentPage] = useState(0);
  const [fetchingMore, setFetchingMore] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [clearingAll, setClearingAll] = useState(false);
  const [activeCategory, setActiveCategory] = useState<string>(ALL_TAB);
  // The single server-provided unread number shared with the bell badge and the
  // bell popover (`PatientOverview.unreadNotificationCount`). While it is
  // unknown (doctor portal has no overview endpoint; a failed fetch), the
  // header honestly derives from the loaded rows instead of inventing a total.
  const [serverUnreadCount, setServerUnreadCount] = useState<number | null>(null);
  const loadRun = useRef(0);
  const ownEvent = useRef(false);

  const load = useCallback(async (page: number): Promise<void> => {
    const runId = loadRun.current + 1;
    loadRun.current = runId;
    if (page === 0) {
      setStatus("loading");
      setFailure(null);
    } else {
      setFetchingMore(true);
    }
    try {
      const result: Page<Notification> = await fetchNotifications(page, PAGE_SIZE);
      if (loadRun.current !== runId) return;
      const content = result?.content ?? [];
      setItems((current) => (page === 0 ? content : [...current, ...content]));
      setCurrentPage(result?.number ?? page);
      setLastPage(result?.last ?? content.length < PAGE_SIZE);
      setNotice(null);
      setStatus("ready");
    } catch (error) {
      if (loadRun.current !== runId) return;
      if (errorStatus(error) === 401) clearAuthSession();
      if (page === 0) {
        // Only a failed first read may replace the list with an error surface.
        setFailure({ message: errorMessage(error), statusCode: errorStatus(error) });
        setStatus("error");
      } else {
        setNotice(`${errorMessage(error)} Danh sách bên dưới vẫn còn hiệu lực.`);
      }
    } finally {
      if (loadRun.current === runId) setFetchingMore(false);
    }
  }, []);

  const refreshServerUnread = useCallback(async (): Promise<void> => {
    if (role !== "PATIENT") return;
    try {
      const overview = await fetchPatientOverview();
      setServerUnreadCount(
        typeof overview?.unreadNotificationCount === "number" ? overview.unreadNotificationCount : null,
      );
    } catch {
      // Without the server number the header must not pretend it has one:
      // null falls back to the honest loaded-rows derivation.
      setServerUnreadCount(null);
    }
  }, [role]);

  useEffect(() => {
    // Deferred off the effect body so the render→effect boundary stays free of
    // synchronous setState (same pattern as the portal load helpers).
    void Promise.resolve().then(() => load(0));
    void Promise.resolve().then(refreshServerUnread);
  }, [load, refreshServerUnread]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // The bell marks rows read from its popover on this very page; reload so the
    // inbox, the unread pill and the filter strip stop disagreeing with the
    // server. Local actions are skipped because they already patched the state.
    const handleUpdated = (): void => {
      if (ownEvent.current) {
        ownEvent.current = false;
        return;
      }
      void load(0);
      // The bell marks rows from its popover; its read is the server's truth,
      // so the shared unread number must be re-read here as well.
      void refreshServerUnread();
    };
    window.addEventListener("healthcare:notifications-updated", handleUpdated);
    return () => {
      window.removeEventListener("healthcare:notifications-updated", handleUpdated);
    };
  }, [load, refreshServerUnread]);

  const loadedUnreadCount = useMemo(() => items.filter((item) => !item.read).length, [items]);

  // The patient overview's `unreadNotificationCount` is the single source the
  // bell badge and popover also read; the inbox must not publish a different
  // number derived from a page slice. When the server number is unknown (a
  // failed fetch; the doctor portal has no overview endpoint) the header falls
  // back to the loaded-rows count and says so.
  const displayedUnread = serverUnreadCount ?? loadedUnreadCount;
  // "đang hiển thị X trong Y" whenever the loaded rows do not cover every
  // unread the server says exists (paginated inbox or an un-refreshed page).
  const paginatedUnread = serverUnreadCount !== null && (loadedUnreadCount < serverUnreadCount || !lastPage);

  const visibleItems = useMemo(() => (
    activeCategory === ALL_TAB
      ? items
      : items.filter((item) => categoryOf(item.eventType) === activeCategory)
  ), [activeCategory, items]);

  // Only offer categories that actually have rows, so a doctor with no payment
  // notices never sees a filter that can only return an empty list.
  const availableCategories = useMemo(() => {
    const present = new Set(items.map((item) => categoryOf(item.eventType)));
    return CATEGORIES.filter((category) => present.has(category.key));
  }, [items]);

  const filterLabel = (key: string): string => (
    key === ALL_TAB
      ? "Tất cả"
      : CATEGORIES.find((category) => category.key === key)?.label ?? "Tất cả"
  );

  const announceChange = (): void => {
    if (typeof window === "undefined") return;
    ownEvent.current = true;
    window.dispatchEvent(new CustomEvent("healthcare:notifications-updated"));
  };

  const handleMarkOne = async (notification: Notification): Promise<void> => {
    if (notification.read || pendingId !== null) return;
    setPendingId(notification.id);
    setNotice(null);
    try {
      await markNotificationAsRead(notification.id);
      setItems((current) => current.map((item) => (
        item.id === notification.id ? { ...item, read: true } : item
      )));
      // The server count moved exactly one step; patch it locally so the header
      // does not contradict the row the user just acted on between refreshes.
      setServerUnreadCount((current) => (current === null ? current : Math.max(0, current - 1)));
      announceChange();
    } catch (error) {
      if (errorStatus(error) === 401) clearAuthSession();
      setNotice(`${errorMessage(error)} Tin nhắn chưa được đánh dấu đã đọc.`);
    } finally {
      setPendingId(null);
    }
  };

  const handleMarkAll = async (): Promise<void> => {
    if (clearingAll) return;
    setClearingAll(true);
    setNotice(null);
    try {
      await markAllNotificationsAsRead();
      setItems((current) => current.map((item) => ({ ...item, read: true })));
      setServerUnreadCount((current) => (current === null ? current : 0));
      announceChange();
    } catch (error) {
      if (errorStatus(error) === 401) clearAuthSession();
      setNotice(`${errorMessage(error)} Chưa đánh dấu được toàn bộ thông báo.`);
    } finally {
      setClearingAll(false);
    }
  };

  const ready = status === "ready" && items.length > 0;

  return (
    <div className="section-inner portal-page">
      <header className="portal-hero">
        <div>
          <p className="section-note">HỘP THƯ THÔNG BÁO</p>
          <h1>Thông báo từ bệnh viện</h1>
          <p>
            {role === "PATIENT"
              ? "Toàn bộ thông báo về lịch hẹn, kết quả cận lâm sàng, thanh toán và kế hoạch chăm sóc của riêng bạn."
              : "Toàn bộ thông báo về lịch khám, tin nhắn tư vấn, câu hỏi hỏi đáp và kế hoạch chăm sóc cho bệnh nhân của bạn."}
          </p>
        </div>
        <div className="portal-hero__actions">
          {ready && displayedUnread > 0 ? (
            <div className="portal-notification-center__toolbar">
              <span className="portal-notification-center__count" aria-hidden="true">{displayedUnread}</span>
              <button
                className="outline-button outline-button--small"
                disabled={clearingAll}
                onClick={() => void handleMarkAll()}
                type="button"
              >
                {clearingAll ? "Đang cập nhật..." : "Đánh dấu đã đọc tất cả"}
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {status === "error" && failure ? (
        <ErrorState
          message={failure.message}
          nextPath={path}
          onRetry={() => void load(0)}
          status={failure.statusCode}
        />
      ) : null}

      {status !== "error" && items.length === 0 ? (
        status === "loading" ? (
          <LoadingState label="Đang tải thông báo..." />
        ) : (
          <div className="portal-notification-center__empty">
            <span aria-hidden="true" className="portal-notification-center__empty-mark">
              <UiIcon name="bell" size={22} />
            </span>
            <div>
              <h3>Chưa có thông báo mới</h3>
              <p>
                {role === "PATIENT"
                  ? "Mọi thông báo về lịch hẹn, kết quả cận lâm sàng và thanh toán sẽ xuất hiện tại đây."
                  : "Mọi thông báo về lịch khám, tin nhắn tư vấn và kế hoạch chăm sóc sẽ xuất hiện tại đây."}
              </p>
            </div>
          </div>
        )
      ) : null}

      {status !== "error" && items.length > 0 ? (
        <>
          {notice ? (
            <p aria-live="assertive" className="portal-inline-error" role="alert">{notice}</p>
          ) : null}

          <div aria-label="Danh mục thông báo" className="portal-notification-center__filters" role="group">
            {[ALL_TAB, ...availableCategories.map((category) => category.key)].map((key) => (
              <button
                aria-pressed={activeCategory === key}
                className="portal-notification-center__filter"
                key={key}
                onClick={() => setActiveCategory(key)}
                type="button"
              >
                {filterLabel(key)}
              </button>
            ))}
          </div>

          <p className="portal-notification-center__summary">
            {activeCategory === ALL_TAB
              ? paginatedUnread
                ? `đang hiển thị ${loadedUnreadCount} trong ${serverUnreadCount} tin chưa đọc${lastPage ? "." : " (còn trang tiếp theo)."}`
                : `${items.length} thông báo đã tải, ${displayedUnread} tin chưa đọc${lastPage ? "." : " (còn trang tiếp theo)."}`
              : `${visibleItems.length}/${items.length} thông báo đã tải thuộc mục “${filterLabel(activeCategory)}”.`}
          </p>

          {visibleItems.length === 0 ? (
            <div className="portal-notification-center__empty">
              <span aria-hidden="true" className="portal-notification-center__empty-mark">
                <UiIcon name="bell" size={22} />
              </span>
              <div>
                <h3>Chưa có thông báo mới</h3>
                <p>Chưa có thông báo nào thuộc mục “{filterLabel(activeCategory)}” trong các trang đã tải.</p>
              </div>
            </div>
          ) : (
            <div className="portal-notification-center__list">
              {visibleItems.map((item) => (
                <article
                  className={`portal-notification-center__row${item.read ? "" : " portal-notification-center__row--unread"}`}
                  key={item.id}
                >
                  <span aria-hidden="true" className="portal-notification-center__icon">
                    <UiIcon name={iconFor(item.eventType)} size={18} />
                  </span>
                  <div className="portal-notification-center__copy">
                    <div className="portal-notification-center__meta">
                      <span>{formatNotificationType(item.eventType)}</span>
                      <time dateTime={item.createdAt}>{formatBusinessDateTime(item.createdAt)}</time>
                    </div>
                    <h3 className="portal-notification-center__title">{item.title}</h3>
                    <p className="portal-notification-center__snippet">{item.message}</p>
                  </div>
                  <div className="portal-notification-center__actions">
                    {item.read
                      ? <span className="portal-read-label">Đã đọc</span>
                      : (
                        <button
                          className="outline-button outline-button--small"
                          disabled={pendingId !== null}
                          onClick={() => void handleMarkOne(item)}
                          type="button"
                        >
                          {pendingId === item.id ? "Đang lưu..." : "Đã đọc"}
                        </button>
                      )}
                  </div>
                </article>
              ))}
            </div>
          )}

          {!lastPage ? (
            <div className="portal-notification-center__more">
              <button
                className="outline-button"
                disabled={fetchingMore}
                onClick={() => void load(currentPage + 1)}
                type="button"
              >
                {fetchingMore ? "Đang tải..." : "Tải thêm thông báo"}
              </button>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
