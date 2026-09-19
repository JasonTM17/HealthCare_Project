package com.healthcare.clinical.controller;

import com.healthcare.appointment.dto.PatientAppointmentResponse;
import com.healthcare.appointment.service.AppointmentPortalService;
import com.healthcare.appointment.service.PatientProfileService;
import com.healthcare.appointment.dto.PatientProfileResponse;
import com.healthcare.appointment.dto.UpdatePatientProfileRequest;
import com.healthcare.clinical.dto.DiagnosticResultResponse;
import com.healthcare.clinical.dto.MedicalRecordResponse;
import com.healthcare.clinical.dto.PrescriptionResponse;
import com.healthcare.clinical.dto.PatientOverviewResponse;
import com.healthcare.clinical.service.ClinicalService;
import com.healthcare.clinical.service.PatientOverviewService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.util.List;
import jakarta.validation.Valid;

@Tag(name = "Clinical Records & Prescriptions", description = "Cổng thông tin người bệnh: Bệnh án điện tử EMR, kết quả cận lâm sàng, đơn thuốc, lịch hẹn")
@RestController
@RequestMapping("/api/v1/patient")
@PreAuthorize("hasRole('PATIENT')")
public class PatientPortalController {

    private final ClinicalService clinicalService;
    private final AppointmentPortalService appointmentPortalService;
    private final PatientProfileService patientProfileService;
    private final PatientOverviewService patientOverviewService;

    public PatientPortalController(
            ClinicalService clinicalService,
            AppointmentPortalService appointmentPortalService,
            PatientProfileService patientProfileService,
            PatientOverviewService patientOverviewService) {
        this.clinicalService = clinicalService;
        this.appointmentPortalService = appointmentPortalService;
        this.patientProfileService = patientProfileService;
        this.patientOverviewService = patientOverviewService;
    }

    @Operation(summary = "Tổng quan thông tin người bệnh", description = "Lấy dữ liệu tổng quan bao gồm lịch hẹn sắp tới, đơn thuốc gần nhất và chỉ số sức khỏe")
    @GetMapping("/overview")
    public ResponseEntity<PatientOverviewResponse> getOverview(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(patientOverviewService.getOverview(userDetails));
    }

    @Operation(summary = "Hồ sơ cá nhân người bệnh", description = "Lấy chi tiết hồ sơ bệnh nhân, thông tin liên hệ, ngày sinh, giới tính và nhóm thẻ")
    @GetMapping("/profile")
    public ResponseEntity<PatientProfileResponse> getProfile(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(patientProfileService.getProfile(userDetails));
    }

    @Operation(summary = "Cập nhật hồ sơ cá nhân người bệnh", description = "Chỉnh sửa thông tin liên hệ cá nhân và địa chỉ của người bệnh")
    @PutMapping("/profile")
    public ResponseEntity<PatientProfileResponse> updateProfile(
            @Valid @RequestBody UpdatePatientProfileRequest request,
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(patientProfileService.updateProfile(request, userDetails));
    }

    @Operation(summary = "Danh sách lịch hẹn của tôi", description = "Truy xuất danh sách lịch hẹn khám của người bệnh có phân trang")
    @GetMapping("/appointments")
    public ResponseEntity<Page<PatientAppointmentResponse>> getAppointments(
            @AuthenticationPrincipal UserDetails userDetails,
            @PageableDefault(size = 20) Pageable pageable) {
        return ResponseEntity.ok(appointmentPortalService.getPatientAppointments(userDetails, pageable));
    }

    @Operation(summary = "Bệnh án điện tử EMR", description = "Lịch sử khám bệnh, chẩn đoán lâm sàng theo phân loại ICD-10 và tóm tắt điều trị")
    @GetMapping("/medical-records")
    public ResponseEntity<List<MedicalRecordResponse>> getMedicalRecords(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getPatientPortalRecords(userDetails));
    }

    @Operation(summary = "Danh sách đơn thuốc điện tử", description = "Chi tiết các đơn thuốc được bác sĩ kê sau mỗi lượt khám kèm hướng dẫn liều dùng")
    @GetMapping("/prescriptions")
    public ResponseEntity<List<PrescriptionResponse>> getPrescriptions(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getPatientPortalPrescriptions(userDetails));
    }

    @Operation(summary = "Kết quả xét nghiệm & Chẩn đoán hình ảnh", description = "Kết quả cận lâm sàng gồm xét nghiệm huyết học, sinh hóa, X-quang, MRI, siêu âm")
    @GetMapping("/diagnostic-results")
    public ResponseEntity<List<DiagnosticResultResponse>> getDiagnosticResults(
            @AuthenticationPrincipal UserDetails userDetails) {
        return ResponseEntity.ok(clinicalService.getPatientPortalDiagnostics(userDetails));
    }
}
