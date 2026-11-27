package com.example.backend.system.reviewer.controller;

import com.example.backend.base.crud.model.enums.LifecycleStatus;
import com.example.backend.system.physics.dto.SchemaContracts;
import com.example.backend.system.reviewer.service.ReviewerVersionService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/reviewer")
@RequiredArgsConstructor
public class ReviewerVersionsController {
    private final ReviewerVersionService service;

    @GetMapping("/schemas")
    public List<SchemaContracts.Response> schemas() {
        return service.schemaResponses();
    }

    @GetMapping("/schemas/summary")
    public List<SchemaContracts.Summary> schemaSummaries() {
        return service.schemaSummaries();
    }

    @GetMapping("/schemas/history")
    public List<SchemaContracts.FamilyAudit> allHistory() {
        return service.allHistory();
    }

    @GetMapping("/schemas/{schemaId}/history")
    public List<SchemaContracts.FamilyAudit> familyHistory(@PathVariable String schemaId) {
        return service.familyHistory(schemaId);
    }

    @GetMapping("/schema-versions/{id}/history")
    public List<SchemaContracts.Audit> schemaHistory(@PathVariable UUID id) {
        return service.schemaHistory(id);
    }

    @PutMapping("/schema-versions/{id}")
    public SchemaContracts.Response updateSchema(@PathVariable UUID id, @Valid @RequestBody SchemaContracts.Request request) {
        return SchemaContracts.Response.from(service.updateSchema(id, request));
    }

    @DeleteMapping("/schema-versions/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteSchema(@PathVariable UUID id) {
        service.deleteSchema(id);
    }

    @PutMapping("/schema-versions/{id}/lifecycle")
    public SchemaContracts.Response schemaLifecycle(@PathVariable UUID id, @RequestParam LifecycleStatus status) {
        return SchemaContracts.Response.from(service.schemaLifecycle(id, status));
    }

    @org.springframework.web.bind.annotation.PostMapping("/schema-versions/dry-run")
    public ReviewerVersionService.DryRunResult dryRun(@Valid @RequestBody SchemaContracts.Request request) {
        return service.dryRun(request);
    }
}
