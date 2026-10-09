"use client";

import Link from "next/link";
import { useRef } from "react";
import { createPortal } from "react-dom";
import UiIcon from "../../../components/UiIcon";
import useDialogFocus from "../../../components/useDialogFocus";
import { formatNotificationType } from "../../../components/PortalChrome";
import { formatBusinessDateTime } from "../../../lib/business-time";
import type { Notification } from "../../../types/hospital";

function queueAction(eventType: string): { href: string; label: string } | null {
  switch (eventType) {
    case "PAYMENT_SUBMITTED": return { href: "/admin/payments?status=PENDING_VERIFICATION", label: "Mở thanh toán chờ đối soát" };
    case "PAYMENT_VERIFIED":
    case "PAYMENT_REJECTED":
    case "PAYMENT_REFUNDED": return { href: "/admin/payments", label: "Mở quản lý thanh toán" };
    case "APPOINTMENT_CREATED":
    case "APPOINTMENT_CONFIRMED":
    case "APPOINTMENT_CANCELLED":
    case "APPOINTMENT_RESCHEDULED":
    case "APPOINTMENT_REMINDER": return { href: "/admin/appointments", label: "Mở quản lý lịch hẹn" };
    case "HEALTH_QUESTION_REPLIED":
    case "HEALTH_QUESTION_ASSIGNED": return { href: "/admin/health-questions", label: "Mở hỏi đáp sức khỏe" };
    case "CONSULTATION_ASSIGNED": return { href: "/admin/consultations", label: "Mở tư vấn bệnh nhân" };
    // AI safety references identify private AI conversations, not consultation
    // queue records. Show details without fabricating an unsupported deep link.
    default: return null;
  }
}

export default function AdminNotificationDetail({ item, pending, error, onRead, onClose }: {
  item: Notification;
  pending: boolean;
  error: string | null;
  onRead: () => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useDialogFocus(dialogRef, true, onClose);
  const action = queueAction(item.eventType);
  return createPortal(
    <div className="portal-modal-backdrop" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div aria-labelledby="admin-notification-detail-title" aria-modal="true" className="portal-notification-modal" ref={dialogRef} role="dialog">
        <div className="portal-notification-modal__header">
          <div className="portal-notification-modal__meta"><span className="portal-notification-popover__badge">{formatNotificationType(item.eventType)}</span><time className="portal-notification-modal__time" dateTime={item.createdAt}>{formatBusinessDateTime(item.createdAt)}</time></div>
          <button aria-label="Đóng chi tiết thông báo" className="portal-notification-modal__close" onClick={onClose} type="button"><UiIcon name="x" size={18} /></button>
        </div>
        <div className="portal-notification-modal__body">
          <h2 className="portal-notification-modal__title" id="admin-notification-detail-title">{item.title}</h2>
          <div className="portal-notification-modal__content"><p className="whitespace-pre-wrap break-words">{item.message}</p></div>
          {item.read ? <p className="mt-3 text-sm text-teal-800" role="status">Đã đọc</p> : <div className="mt-3 grid gap-2">
            {error ? <p className="text-sm text-amber-900" role="alert">{error}</p> : null}
            <button className="outline-button outline-button--small min-h-11" disabled={pending} onClick={onRead} type="button">{pending ? "Đang đánh dấu…" : error ? "Thử đánh dấu đã đọc lại" : "Đánh dấu đã đọc"}</button>
          </div>}
        </div>
        {action ? <div className="portal-notification-modal__footer"><Link className="button button--primary button--small" href={action.href} onClick={onClose}>{action.label}</Link></div> : null}
      </div>
    </div>, document.body,
  );
}
