package com.healthcare.career.controller;

import com.healthcare.career.dto.JobApplicationRequest;
import com.healthcare.career.dto.JobApplicationReceipt;
import com.healthcare.career.dto.JobPositionResponse;
import com.healthcare.career.service.CareerService;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/careers/jobs")
public class CareerController {

    private final CareerService careerService;

    public CareerController(CareerService careerService) {
        this.careerService = careerService;
    }

    @GetMapping
    public Page<JobPositionResponse> list(
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String location,
            @PageableDefault(size = 30) Pageable pageable) {
        return careerService.listOpenPositions(department, location, pageable);
    }

    @GetMapping("/{slug}")
    public JobPositionResponse detail(@PathVariable String slug) {
        return careerService.getOpenPosition(slug);
    }

    @PostMapping("/{slug}/applications")
    @ResponseStatus(HttpStatus.CREATED)
    public JobApplicationReceipt apply(
            @PathVariable String slug,
            @Valid @RequestBody JobApplicationRequest request) {
        return careerService.apply(slug, request);
    }
}
