package com.example.backend.system.support.controller;

import com.example.backend.system.support.dto.SupportContracts.CreateSupportRequest;
import com.example.backend.system.support.dto.SupportContracts.UpdateSupportRequest;
import com.example.backend.system.support.dto.SupportContracts;
import com.example.backend.system.support.model.enums.SupportKind;
import com.example.backend.system.support.service.SupportService;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/support")
@RequiredArgsConstructor
public class SupportController {
    private final SupportService service;
    private final com.example.backend.system.support.service.SupportInboxService inbox;

    @GetMapping("/inbox")
    public com.example.backend.system.support.service.SupportInboxService.InboxPage inbox(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "ALL") String kind, @RequestParam(defaultValue = "ALL") String handler,
            @RequestParam(defaultValue = "ALL") String status, @RequestParam(defaultValue = "") String query) {
        return inbox.page(page, size, kind, handler, status, query);
    }

    @GetMapping("/inbox/pending-count")
    public java.util.Map<String, Long> pendingCount() { return java.util.Map.of("count", inbox.pendingCount()); }


    @PostMapping("/feedback")
    public SupportContracts.SupportView feedback(@Valid @RequestBody CreateSupportRequest request) { return service.create(SupportKind.FEEDBACK, request); }

    @PostMapping("/messages")
    public SupportContracts.SupportView message(@Valid @RequestBody CreateSupportRequest request) { return service.create(SupportKind.MESSAGE, request); }

    /** A teacher reports a simulation as wrong; reviewers answer it. */
    @PostMapping("/complaints")
    public SupportContracts.SupportView complaint(@Valid @RequestBody SupportContracts.CreateComplaintRequest request) {
        return service.createComplaint(request);
    }
    @GetMapping("/complaints/review")
    public List<SupportContracts.SupportView> complaintsForReview() { return service.complaintsForReview(); }
    @PutMapping("/complaints/review/{id}")
    public SupportContracts.SupportView resolveComplaint(@PathVariable UUID id,
                                                       @Valid @RequestBody UpdateSupportRequest request) {
        return service.resolveComplaint(id, request);
    }
    @GetMapping("/mine")
    public List<SupportContracts.SupportView> mine() { return service.mine(); }

    @GetMapping("/admin")
    public List<SupportContracts.SupportView> adminList(@RequestParam(required = false) SupportKind kind) { return service.adminList(kind); }

    @PostMapping("/admin/{id}/refer-reviewer")
    public SupportContracts.SupportView referReviewer(@PathVariable UUID id) { return service.referReviewer(id); }

    @PutMapping("/admin/{id}")
    public SupportContracts.SupportView update(@PathVariable UUID id,
                                             @Valid @RequestBody UpdateSupportRequest request) {
        return service.update(id, request);
    }
}
