package com.example.backend.system.operations.controller;

import com.example.backend.system.curriculum.dto.CurriculumTreeResponse;
import com.example.backend.system.operations.dto.OperationsContracts.PlanRequest;
import com.example.backend.system.operations.dto.OperationsContracts.TopicStatus;
import com.example.backend.system.operations.dto.OperationsContracts.ValidationMetrics;
import com.example.backend.system.operations.dto.OperationsContracts.ValidationRow;
import com.example.backend.system.operations.service.AdminOperationsService;
import com.example.backend.system.school.dto.SchoolContracts;
import com.example.backend.system.school.dto.SchoolPaymentContracts.LicensePlanResponse;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminOperationsController {
    private final AdminOperationsService service;
    private final com.example.backend.system.operations.service.AdminAnalyticsService analyticsService;

    @GetMapping("/overview-counts")
    public AdminOperationsService.OverviewCounts overviewCounts() { return service.overviewCounts(); }

    @GetMapping("/analytics")
    public com.example.backend.system.operations.dto.AdminAnalyticsDto analytics() {
        return analyticsService.getAnalytics();
    }

    @GetMapping("/plans")
    public List<LicensePlanResponse> plans() {
        return service.plans();
    }

    @PostMapping("/plans")
    public LicensePlanResponse createPlan(@Valid @RequestBody PlanRequest request) {
        return service.createPlan(request);
    }

    @PutMapping("/plans/{code}")
    public LicensePlanResponse updatePlan(@PathVariable String code,
                                  @Valid @RequestBody PlanRequest request) {
        return service.updatePlan(code, request);
    }

    @GetMapping("/schools/page")
    public com.example.backend.common.dto.PageResponse<SchoolContracts.Response> schoolsPage(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "10") int size) {
        return service.schoolsPage(page, size);
    }

    @GetMapping("/validation-runs/page")
    public com.example.backend.common.dto.PageResponse<ValidationRow> validationPage(
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "0") int page,
            @org.springframework.web.bind.annotation.RequestParam(defaultValue = "10") int size) {
        return service.validationPage(page, size);
    }

    @GetMapping("/schools")
    public List<SchoolContracts.Response> schools() {
        return service.schools();
    }

    @PostMapping("/schools")
    public SchoolContracts.Response createSchool(@Valid @RequestBody SchoolContracts.Save request) {
        return service.createSchool(request);
    }

    @GetMapping("/schools/{id}/subscription")
    public SchoolContracts.Subscription schoolSubscription(@PathVariable UUID id) {
        return service.schoolSubscription(id);
    }

    @PutMapping("/schools/{id}")
    public SchoolContracts.Response updateSchool(@PathVariable UUID id,
                               @Valid @RequestBody SchoolContracts.Save request) {
        return service.updateSchool(id, request);
    }

    @GetMapping("/curriculum")
    public CurriculumTreeResponse curriculum() {
        return service.curriculum();
    }

    @PutMapping("/topics/{id}/toggle")
    public TopicStatus toggleTopic(@PathVariable UUID id) {
        return service.toggleTopic(id);
    }

    @GetMapping("/metrics/validation")
    public ValidationMetrics validationMetrics() {
        return service.validationMetrics();
    }

    @GetMapping("/validation-runs")
    public List<ValidationRow> validationRuns() {
        return service.validationRuns();
    }
}
