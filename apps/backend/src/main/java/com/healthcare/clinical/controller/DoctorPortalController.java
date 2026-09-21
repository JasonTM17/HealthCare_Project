package com.healthcare.clinical.controller;

import com.healthcare.appointment.dto.DoctorAppointmentResponse;
import com.healthcare.appointment.dto.UpdateAppointmentStatusRequest;
import com.healthcare.appointment.service.AppointmentPortalService;
import com.healthcare.clinical.dto.DiagnosticResultResponse;
import com.healthcare.clinical.dto.CreateDiagnosticResultRequest;
import com.healthcare.clinical.dto.MedicalRecordResponse;
import com.healthcare.clinical.service.ClinicalService;
import com.healthcare.hospital.dto.DoctorResponse;
import com.healthcare.hospital.service.DoctorService;
import com.healthcare.scheduling.dto.DoctorRosterEntryResponse;
import com.healthcare.scheduling.dto.DoctorRosterExceptionResponse;
import com.healthcare.security.HealthcareUserPrincipal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import java.util.UUID;
import jakarta.validation.Valid;

@Tag(name = "Clinical Records & Prescriptions", description = "Cổng bác sĩ điều trị: Hồ sơ, lịch khám phân công, xem bệnh án EMR, chỉ định cận lâm sàng và cập nhật kết quả")
@RestController
@RequestMapping("/api/v1/doctor")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorPortalController {

    private final ClinicalService clinicalService;
    private final AppointmentPortalService appointmentPortalService;
    private final DoctorService doctorService;

    public DoctorPortalController(
            ClinicalService clinicalService,
            AppointmentPortalService appointmentPortalService,
            DoctorService doctorService) {
        this.clinicalService = clinicalService;
        this.appointmentPortalService = appointmentPortalService;
        this.doctorService = doctorService;
    }

    @Operation(summary = "Hồ sơ bác sĩ điều trị", description = "Lấy thông tin chuyên môn, học hàm, học vị, chuyên khoa và cơ sở của bác sĩ hiện tại")
    @GetMapping("/profile")
    public ResponseEntity<com.healthcare.hospital.dto.DoctorProfileResponse> getProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        if (!(userDetails instanceof HealthcareUserPrincipal principal)) {
            throw new org.springframework.security.access.AccessDeniedException("Authenticated doctor profile is unavailable");
        }
        return ResponseEntity.ok(doctorService.getByUserId(principal.getUserId()));
    }

    @Operation(summary = "Cập nhật hồ sơ bác sĩ", description = "Cập nhật tiểu sử, số điện thoại liên hệ chuyên môn và kinh nghiệm lâm sàng")
    @org.springframework.web.bind.annotation.PutMapping("/profile")
    public ResponseEntity<com.healthcare.hospital.dto.DoctorProfileResponse> updateProfile(
            @Valid @RequestBody com.healthcare.hospital.dto.UpdateDoctorProfileRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        if (!(userDetails instanceof HealthcareUserPrincipal principal)) {
            throw new org.springframework.security.access.AccessDeniedException("Authenticated doctor profile is unavailable");
        }
        return ResponseEntity.ok(doctorService.updateProfile(principal.getUserId(), request));
    }

    @Operation(
        summary = "Lịch khám bệnh của bác sĩ",
        description = """
            Tra cứu danh sách bệnh nhân hẹn khám của chính bác sĩ đang đăng nhập. Truyền 'date' \
            (yyyy-MM-dd) để xem một ngày, hoặc bỏ 'date' và truyền 'from' + 'to' để xem theo \
            khoảng ngày tối đa 31 ngày (sắp xếp theo ngày khám rồi giờ bắt đầu). Có thể lọc thêm \
            theo 'status'."""
    )
    @GetMapping("/appointments")
    public ResponseEntity<Page<DoctorAppointmentResponse>> getAppointments(
            @RequestParam(required = false) String date,
            @RequestParam(required = false) String from,
            @RequestParam(required = false) String to,
            @RequestParam(required = false) String status,
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(
            appointmentPortalService.getDoctorAppointments(date, from, to, status, userDetails, pageable));
    }

    @Operation(
        summary = "Cập nhật trạng thái lịch khám",
        description = """
            Bác sĩ điều trị chuyển trạng thái lượt khám đang được phân công cho mình. Chỉ hai \
            bước hợp lệ: CONFIRMED sang CHECKED_IN hoặc NO_SHOW, và CHECKED_IN sang IN_PROGRESS \
            hoặc NO_SHOW. Tiếp nhận (CHECKED_IN / IN_PROGRESS) chỉ thực hiện được trong ngày \
            khám; NO_SHOW chỉ sau khi khung giờ khám đã kết thúc. COMPLETED không đặt qua endpoint \
            này mà được ghi nhận khi bác sĩ tạo bệnh án cho lượt khám."""
    )
    @PatchMapping("/appointments/{appointmentId}/status")
    public ResponseEntity<DoctorAppointmentResponse> updateAppointmentStatus(
            @PathVariable UUID appointmentId,
            @Valid @RequestBody UpdateAppointmentStatusRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(
            appointmentPortalService.updateDoctorAppointmentStatus(appointmentId, request.status(), userDetails));
    }

    @Operation(
        summary = "Lịch làm việc cố định của bác sĩ",
        description = """
            Danh sách ca khám định kỳ theo tuần của chính bác sĩ đang đăng nhập, gồm cả ca đã \
            tạm ngưng (trường 'active'), sắp xếp theo thứ rồi giờ bắt đầu. Giờ trả về theo định \
            dạng HH:mm:ss."""
    )
    @GetMapping("/schedules")
    public ResponseEntity<List<DoctorRosterEntryResponse>> getSchedules(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(appointmentPortalService.getDoctorRoster(userDetails));
    }

    @Operation(
        summary = "Ngoại lệ lịch làm việc của bác sĩ",
        description = """
            Các ngày nghỉ, đổi ca hoặc điều chỉnh giờ khám riêng của chính bác sĩ đang đăng \
            nhập, sắp xếp theo ngày mới nhất trước. Giờ tùy chỉnh (nếu có) trả về theo định dạng \
            HH:mm:ss."""
    )
    @GetMapping("/schedule-exceptions")
    public ResponseEntity<List<DoctorRosterExceptionResponse>> getScheduleExceptions(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(appointmentPortalService.getDoctorScheduleExceptions(userDetails));
    }

    @Operation(summary = "Bệnh án điện tử của người bệnh", description = "Xem lịch sử bệnh án lâm sàng của bệnh nhân theo chỉ định y khoa")
    @GetMapping("/patients/{patientId}/medical-records")
    public ResponseEntity<List<MedicalRecordResponse>> getPatientRecords(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getDoctorPatientRecords(patientId, userDetails));
    }

    @Operation(summary = "Kết quả cận lâm sàng của người bệnh", description = "Xem các phiếu xét nghiệm và chẩn đoán hình ảnh của người bệnh")
    @GetMapping("/patients/{patientId}/diagnostic-results")
    public ResponseEntity<List<DiagnosticResultResponse>> getPatientDiagnostics(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getDoctorPatientDiagnostics(patientId, userDetails));
    }

    @Operation(summary = "Danh sách chỉ định cận lâm sàng của người bệnh", description = "Tra cứu các chỉ định xét nghiệm và chẩn đoán hình ảnh đã tạo cho bệnh nhân")
    @GetMapping("/patients/{patientId}/diagnostic-orders")
    public ResponseEntity<List<com.healthcare.clinical.dto.DiagnosticOrderResponse>> getPatientDiagnosticOrders(
            @PathVariable UUID patientId,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getDoctorPatientDiagnosticOrders(patientId, userDetails));
    }

    @Operation(summary = "Tạo chỉ định cận lâm sàng mới", description = "Bác sĩ chỉ định các xét nghiệm sinh hóa, huyết học, X-quang hoặc CT/MRI cho người bệnh")
    @PostMapping("/patients/{patientId}/diagnostic-orders")
    public ResponseEntity<com.healthcare.clinical.dto.DiagnosticOrderResponse> createPatientDiagnosticOrder(
            @PathVariable UUID patientId,
            @Valid @RequestBody com.healthcare.clinical.dto.CreateDiagnosticOrderRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED)
            .body(clinicalService.createDiagnosticOrder(patientId, request, userDetails));
    }

    @Operation(summary = "Ghi nhận kết quả cận lâm sàng", description = "Bác sĩ chuyên khoa cập nhật kết quả chỉ số xét nghiệm hoặc kết luận chẩn đoán hình ảnh")
    @PostMapping("/patients/{patientId}/diagnostic-results")
    public ResponseEntity<DiagnosticResultResponse> createPatientDiagnostic(
            @PathVariable UUID patientId,
            @Valid @RequestBody CreateDiagnosticResultRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.status(org.springframework.http.HttpStatus.CREATED)
            .body(clinicalService.createDiagnosticResult(patientId, request, userDetails));
    }
}
