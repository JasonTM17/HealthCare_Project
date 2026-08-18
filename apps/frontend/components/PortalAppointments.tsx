import type { Page } from "../lib/api-client";
import type { DoctorPortalAppointment, PatientPortalAppointment } from "../types/hospital";

type PortalAppointmentsProps =
  | {
      page: Page<PatientPortalAppointment>;
      viewer: "patient";
      onSelectAppointment?: never;
    }
  | {
      page: Page<DoctorPortalAppointment>;
      viewer: "doctor";
      onSelectAppointment?: (appointment: DoctorPortalAppointment) => void;
    };

const STATUS_LABELS: Record<string, string> = {
  PENDING_CONFIRMATION: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  CHECKED_IN: "Đã tiếp nhận",
  IN_PROGRESS: "Đang khám",
  COMPLETED: "Đã hoàn tất",
  CANCELLED: "Đã hủy",
  NO_SHOW: "Không đến",
};

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf())
    ? value
    : new Intl.DateTimeFormat("vi-VN", { dateStyle: "medium" }).format(date);
}

function formatTime(value: string): string {
  return value.length >= 5 ? value.slice(0, 5) : value;
}

function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status.replaceAll("_", " ");
}

export default function PortalAppointments({
  page,
  viewer,
  onSelectAppointment,
}: PortalAppointmentsProps) {
  return (
    <div aria-label={viewer === "patient" ? "Danh sách lịch hẹn của bệnh nhân" : "Lịch hẹn trong ngày của bác sĩ"} className="portal-appointment-list">
      {page.content.map((appointment) => (
        <article className="portal-appointment" key={appointment.id}>
          <div className="portal-appointment__meta">
            <span>{formatDate(appointment.appointmentDate)}</span>
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
          </dl>
          {viewer === "doctor" && onSelectAppointment ? (
            <button className="outline-button outline-button--small" onClick={() => {
              if ("patientId" in appointment) onSelectAppointment(appointment);
            }} type="button">
              Ghi nhận kết quả khám
            </button>
          ) : null}
        </article>
      ))}
    </div>
  );
}
