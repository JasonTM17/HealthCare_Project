package com.healthcare.hospital.controller;

import com.healthcare.hospital.service.PublicSpecialtyTriageService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/public")
public class PublicSpecialtyTriageController {

    private final PublicSpecialtyTriageService publicSpecialtyTriageService;

    public PublicSpecialtyTriageController(PublicSpecialtyTriageService publicSpecialtyTriageService) {
        this.publicSpecialtyTriageService = publicSpecialtyTriageService;
    }

    @PostMapping("/specialty-recommendation")
    public ResponseEntity<Map<String, Object>> recommend(@Valid @RequestBody PublicTriageRequest request) {
        return ResponseEntity.ok(publicSpecialtyTriageService.triage(request.symptoms()));
    }

    public record PublicTriageRequest(@NotBlank @Size(min = 2, max = 500) String symptoms) {
    }
}
