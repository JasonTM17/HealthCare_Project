package com.healthcare.academic.controller;

import com.healthcare.academic.dto.AcademicThesisResponse;
import com.healthcare.academic.dto.CreateAcademicThesisRequest;
import com.healthcare.academic.dto.FacultyLecturerResponse;
import com.healthcare.academic.dto.GradeAcademicThesisRequest;
import com.healthcare.academic.dto.UpdateAcademicThesisRequest;
import com.healthcare.academic.service.AcademicThesisService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/doctor/academic/theses")
@PreAuthorize("hasRole('DOCTOR')")
public class DoctorAcademicThesisController {

    private final AcademicThesisService thesisService;

    public DoctorAcademicThesisController(AcademicThesisService thesisService) {
        this.thesisService = thesisService;
    }

    @GetMapping("/faculty-profile")
    public ResponseEntity<FacultyLecturerResponse> getFacultyProfile(
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(thesisService.getFacultyProfile(actor));
    }

    @GetMapping
    public ResponseEntity<Page<AcademicThesisResponse>> listMyTheses(
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String academicYear,
            @PageableDefault(size = 20) Pageable pageable,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(thesisService.listThesesForDoctor(actor, status, academicYear, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<AcademicThesisResponse> getThesisDetail(
            @PathVariable UUID id,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(thesisService.getThesisDetail(id, actor));
    }

    @PostMapping
    public ResponseEntity<AcademicThesisResponse> createThesis(
            @Valid @RequestBody CreateAcademicThesisRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.status(HttpStatus.CREATED).body(thesisService.createThesis(request, actor));
    }

    @PutMapping("/{id}")
    public ResponseEntity<AcademicThesisResponse> updateThesis(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateAcademicThesisRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(thesisService.updateThesis(id, request, actor));
    }

    @PutMapping("/{id}/grade")
    public ResponseEntity<AcademicThesisResponse> gradeThesis(
            @PathVariable UUID id,
            @Valid @RequestBody GradeAcademicThesisRequest request,
            @AuthenticationPrincipal UserDetails actor) {
        return ResponseEntity.ok(thesisService.gradeThesis(id, request, actor));
    }
}
