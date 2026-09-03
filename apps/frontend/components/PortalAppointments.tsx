import type { Page } from "../lib/api-client";
import { formatBusinessDate } from "../lib/business-time";
import type { DoctorPortalAppointment, PatientPortalAppointment } from "../types/hospital";

type PortalAppointmentsProps =
  | {
      page: Page<PatientPortalAppointment>;
      viewer: "patient";
      onSelectAppointment?: never;
      onUpdateStatus?: never;
      onReschedule?: (appointment: PatientPortalAppointment) => void;
      onPayment?: (appointment: PatientPortalAppointment) => void;
      activePaymentAppointmentId?: string;
    }
  | {
      page: Page<DoctorPortalAppointment>;
      viewer: "doctor";
      onSelectAppointment?: (appointment: DoctorPortalAppointment) => void;
      onUpdateStatus?: (appointment: DoctorPortalAppointment, status: "CHECKED_IN" | "IN_PROGRESS" | "NO_SHOW") => void;
      onReschedule?: never;
      onPayment?: never;
      activePaymentAppointmentId?: never;
    };

const STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã tiếp nhận",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
  NO_SHOW: "Không đến",
  UNPAID: "Chưa thanh toán",
  PENDING_VERIFICATION: "Chờ đối soát",
  PAID: "Đã thanh toán",
  REJECTED: "Cần kiểm tra lại",
  REFUND_PENDING: "Chờ hoàn tiền",
  REFUNDED: "Đã hoàn tiền",
};

function formatTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

function paymentActionLabel(status: string): string {
  if (status === "PENDING_VERIFICATION") return "Xem đối soát";
  if (status === "REJECTED") return "Kiểm tra thanh toán";
  return "Thanh toán";
}

export default function PortalAppointments({
  page,
  viewer,
  onSelectAppointment,
  onUpdateStatus,
  onReschedule,
  onPayment,
  activePaymentAppointmentId,
}: PortalAppointmentsProps) {
  return (
    <div aria-label={viewer === "patient" ? "Danh sách lịch hẹn của bệnh nhân" : "Lịch hẹn trong ngày của bác sĩ"} className="portal-appointment-list">
      {page.content.map((appointment) => (
        <article className="portal-appointment" key={appointment.id}>
          <div className="portal-appointment__meta">
            <span>{formatBusinessDate(appointment.appointmentDate)}</span>
            <span>{formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}</span>
            <span className="portal-appointment__status">{statusLabel(appointment.status)}</span>
          </div>
          <h3>
            {viewer === "doctor"
              ? ("patientName" in appointment ? appointment.patientName : "Bệnh nhân chưa cập nhật")
              : ("doctorName" in appointment ? appointment.doctorName : "Bác sĩ chưa cập nhật")}
          </h3>
          <p className="portal-record__doctor">
            {viewer === "doctor"
              ? "Lịch khám của bác sĩ"
              : appointment.specialtyName ?? "Chuyên khoa chưa cập nhật"}
          </p>
          <dl className="portal-appointment__details">
            {appointment.specialtyName ? <div><dt>Chuyên khoa</dt><dd>{appointment.specialtyName}</dd></div> : null}
            {appointment.branchName ? <div><dt>Cơ sở</dt><dd>{appointment.branchName}</dd></div> : null}
            {appointment.packageName ? <div><dt>Gói khám</dt><dd>{appointment.packageName}</dd></div> : null}
            <div><dt>Mã lịch hẹn</dt><dd>{appointment.bookingCode}</dd></div>
            {viewer === "doctor" && "patientId" in appointment ? (
              <div>
                <dt>Mã hồ sơ BN</dt>
                <dd>
                  <code style={{ fontSize: "0.8rem", background: "oklch(96% 0.015 180)", color: "var(--color-teal-900)", padding: "2px 6px", borderRadius: "4px", border: "1px solid var(--color-teal-200)" }}>
                    {appointment.patientId}
                  </code>
                </dd>
              </div>
            ) : null}
            {viewer === "patient" && "paymentStatus" in appointment ? <div><dt>Thanh toán</dt><dd><span aria-label={`Trạng thái thanh toán: ${statusLabel(appointment.paymentStatus)}`}>{statusLabel(appointment.paymentStatus)}</span></dd></div> : null}
          </dl>
          {viewer === "doctor" && "patientId" in appointment ? (
            <div className="portal-appointment__actions">
              {appointment.status === "CONFIRMED" && onUpdateStatus ? (
                <>
                  <button className="outline-button outline-button--small" onClick={() => onUpdateStatus(appointment, "CHECKED_IN")} type="button">Tiếp nhận</button>
                  <button className="text-button" onClick={() => onUpdateStatus(appointment, "NO_SHOW")} type="button">Không đến</button>
                </>
              ) : null}
              {appointment.status === "CHECKED_IN" && onUpdateStatus ? (
                <>
                  <button className="outline-button outline-button--small" onClick={() => onUpdateStatus(appointment, "IN_PROGRESS")} type="button">Bắt đầu khám</button>
                  <button className="text-button" onClick={() => onUpdateStatus(appointment, "NO_SHOW")} type="button">Không đến</button>
                </>
              ) : null}
              {appointment.status === "IN_PROGRESS" && onSelectAppointment ? (
                <button className="button button--primary" onClick={() => onSelectAppointment(appointment)} type="button">Ghi nhận kết quả khám</button>
              ) : null}
            </div>
          ) : null}
          {viewer === "patient" && "doctorId" in appointment && appointment.status === "CONFIRMED" && onReschedule ? (
            <div className="portal-appointment__actions">
              <button className="outline-button outline-button--small" onClick={() => onReschedule(appointment)} type="button">Đổi lịch</button>
              {onPayment && appointment.paymentStatus !== "PAID" && appointment.paymentStatus !== "REFUNDED" && appointment.paymentStatus !== "REFUND_PENDING" ? (
                <button
                  aria-controls="patient-payment-panel"
                  aria-expanded={activePaymentAppointmentId === appointment.id}
                  aria-label={`${paymentActionLabel(appointment.paymentStatus)} cho lịch ${appointment.bookingCode}`}
                  className="button button--primary"
                  id={`payment-action-${appointment.id}`}
                  onClick={() => onPayment(appointment)}
                  type="button"
                >
                  {paymentActionLabel(appointment.paymentStatus)}
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
