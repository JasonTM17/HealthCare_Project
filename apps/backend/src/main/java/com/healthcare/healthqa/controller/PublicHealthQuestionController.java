package com.healthcare.healthqa.controller;

import com.healthcare.healthqa.dto.HealthQuestionContracts;
import com.healthcare.healthqa.service.HealthQuestionService;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/v1/hospital/health-questions")
public class PublicHealthQuestionController {
    private final HealthQuestionService service;
    public PublicHealthQuestionController(HealthQuestionService service) { this.service = service; }
    @GetMapping
    public List<HealthQuestionContracts.Summary> list(@RequestParam(required = false) String topic) { return service.publicList(topic); }
}
