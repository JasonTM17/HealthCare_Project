import type { Page } from "../lib/api-client";
import { businessDate, formatBusinessDate } from "../lib/business-time";
import type { DoctorPortalAppointment, PatientPortalAppointment } from "../types/hospital";
import { buildGoogleCalendarUrl, downloadIcsFile } from "../lib/appointment-calendar";

type PortalAppointmentsProps =
  | {
      page: Page<PatientPortalAppointment>;
      viewer: "patient";
      onSelectAppointment?: never;
      onUpdateStatus?: never;
      onReschedule?: (appointment: PatientPortalAppointment) => void;
      onCancel?: (appointment: PatientPortalAppointment) => void;
      onPayment?: (appointment: PatientPortalAppointment) => void;
      activePaymentAppointmentId?: string;
    }
  | {
      page: Page<DoctorPortalAppointment>;
      viewer: "doctor";
      onSelectAppointment?: (appointment: DoctorPortalAppointment) => void;
      onUpdateStatus?: (appointment: DoctorPortalAppointment, status: "CHECKED_IN" | "IN_PROGRESS" | "NO_SHOW") => void;
      onReschedule?: never;
      onCancel?: never;
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
  onCancel,
  onPayment,
  activePaymentAppointmentId,
}: PortalAppointmentsProps) {
  // Doctor actions are day-scoped by the backend; re-derive per render so a
  // long-lived tab crosses midnight correctly.
  const today = businessDate();
  return (
    <div aria-label={viewer === "patient" ? "Danh sách lịch hẹn của bệnh nhân" : "Lịch hẹn trong ngày của bác sĩ"} className="portal-appointment-list">
      {page.content.map((appointment) => (
        <article className="portal-appointment" key={appointment.id}>
          <div className="portal-appointment__meta">
            <span>{formatBusinessDate(appointment.appointmentDate)}</span>
            <span>{formatTime(appointment.startTime)} – {formatTime(appointment.endTime)}</span>
            <span className="portal-appointment__status" data-status={appointment.status}>{statusLabel(appointment.status)}</span>
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
                  <code className="portal-appointment__patient-code">{appointment.patientId}</code>
                </dd>
              </div>
            ) : null}
            {/* Payment status is informational for the doctor viewer and
                actionable for the patient, so the doctor chip stays neutral. */}
            {"paymentStatus" in appointment ? (
              <div>
                <dt>Thanh toán</dt>
                <dd>
                  <span
                    aria-label={`Trạng thái thanh toán: ${statusLabel(appointment.paymentStatus)}`}
                    {...(viewer === "doctor" ? { "data-viewer": "doctor" } : {})}
                  >
                    {statusLabel(appointment.paymentStatus)}
                  </span>
                </dd>
              </div>
            ) : null}
            {appointment.status === "CANCELLED" && appointment.cancellationReason ? (
              <div>
                <dt>Lý do hủy</dt>
                <dd>{appointment.cancellationReason}</dd>
              </div>
            ) : null}
          </dl>
          {viewer === "doctor" && "patientId" in appointment ? (
            <div className="portal-appointment__actions">
              {/* The backend only accepts check-in on the appointment day and
                  no-show once the visit window has ended, so a future row must
                  not offer either action. */}
              {appointment.status === "CONFIRMED" && onUpdateStatus ? (
                appointment.appointmentDate === today ? (
                  <>
                    <button className="outline-button outline-button--small" onClick={() => onUpdateStatus(appointment, "CHECKED_IN")} type="button">Tiếp nhận</button>
                    <button className="text-button" onClick={() => onUpdateStatus(appointment, "NO_SHOW")} type="button">Không đến</button>
                  </>
                ) : appointment.appointmentDate < today ? (
                  <button className="text-button" onClick={() => onUpdateStatus(appointment, "NO_SHOW")} type="button">Không đến</button>
                ) : (
                  <p className="section-note">Chỉ thao tác được trong ngày khám.</p>
                )
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
          {viewer === "patient" && "doctorId" in appointment
            && (appointment.status === "CONFIRMED" || appointment.status === "PENDING_CONFIRMATION")
            && (onReschedule || onCancel || onPayment) ? (
            <div className="portal-appointment__actions">
              {appointment.status === "CONFIRMED" ? (
                <>
                  <a
                    className="outline-button outline-button--small"
                    href={buildGoogleCalendarUrl({
                      appointmentId: appointment.id,
                      bookingCode: appointment.bookingCode,
                      doctorName: appointment.doctorName,
                      specialtyName: appointment.specialtyName,
                      appointmentDate: appointment.appointmentDate,
                      startTime: appointment.startTime,
                      endTime: appointment.endTime,
                      branchName: appointment.branchName,
                    })}
                    rel="noopener noreferrer"
                    target="_blank"
                    title="Thêm lịch hẹn vào Google Calendar"
                  >
                    Google Calendar
                  </a>
                  <button
                    className="outline-button outline-button--small"
                    onClick={() =>
                      downloadIcsFile({
                        appointmentId: appointment.id,
                        bookingCode: appointment.bookingCode,
                        doctorName: appointment.doctorName,
                        specialtyName: appointment.specialtyName,
                        appointmentDate: appointment.appointmentDate,
                        startTime: appointment.startTime,
                        endTime: appointment.endTime,
                        branchName: appointment.branchName,
                      })
                    }
                    title="Tải tệp lịch nhắc hẹn (.ics)"
                    type="button"
                  >
                    Tải .ics
                  </button>
                </>
              ) : null}
              {onReschedule && appointment.status === "CONFIRMED" ? (
                <button className="outline-button outline-button--small" onClick={() => onReschedule(appointment)} type="button">Đổi lịch</button>
              ) : null}
              {onPayment && appointment.status === "CONFIRMED" && appointment.paymentStatus !== "PAID" && appointment.paymentStatus !== "REFUNDED" && appointment.paymentStatus !== "REFUND_PENDING" ? (
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
              {onCancel ? (
                <button
                  aria-label={`Hủy lịch ${appointment.bookingCode}`}
                  className="text-button portal-appointment__cancel"
                  onClick={() => onCancel(appointment)}
                  type="button"
                >
                  Hủy lịch
                </button>
              ) : null}
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}
