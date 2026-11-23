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
    private final com.example.backend.system.realtime.controller.RealtimeEvents realtime;

    @GetMapping("/inbox")
    public com.example.backend.system.support.service.SupportInboxService.InboxPage inbox(
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size,
            @RequestParam(defaultValue = "ALL") String kind, @RequestParam(defaultValue = "ALL") String handler,
            @RequestParam(defaultValue = "ALL") String status, @RequestParam(defaultValue = "") String query,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return inbox.page(page, size, kind, handler, status, query, from, to);
    }

    @GetMapping("/inbox/pending-count")
    public java.util.Map<String, Long> pendingCount() {
        long revision = realtime.currentSupportRevision();
        return java.util.Map.of("count", inbox.pendingCount(), "revision", revision);
    }


    @PostMapping("/feedback")
    public SupportContracts.SupportView feedback(@Valid @RequestBody CreateSupportRequest request) { return service.create(SupportKind.FEEDBACK, request); }

    @PostMapping("/messages")
    public SupportContracts.SupportView message(@Valid @RequestBody CreateSupportRequest request) { return service.create(SupportKind.MESSAGE, request); }

    /** A teacher reports a simulation as wrong; reviewers answer it. */
    @PostMapping("/complaints")
    public SupportContracts.SupportView complaint(@Valid @RequestBody SupportContracts.CreateComplaintRequest request) {
        return service.createComplaint(request);
    }
    @GetMapping("/complaints/counts")
    public SupportContracts.ComplaintCounts complaintCounts() { return service.complaintCounts(); }
    @GetMapping("/complaints/review")
    public List<SupportContracts.SupportView> complaintsForReview() { return service.complaintsForReview(); }
    @GetMapping("/complaints/review/page")
    public SupportContracts.ComplaintPage complaintsForReviewPage(
            @RequestParam(defaultValue = "TODO") String group,
            @RequestParam(required = false) com.example.backend.system.support.model.enums.SupportStatus status,
            @RequestParam(required = false) String q,
            @RequestParam(defaultValue = "false") boolean assignedToMe,
            @RequestParam(defaultValue = "false") boolean unassignedOnly,
            @RequestParam(required = false) Integer slaHours,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        return service.complaintsForReviewPage(group, status, q, assignedToMe, unassignedOnly, slaHours, from, to, page, size);
    }
    @GetMapping("/complaints/review/{id}")
    public SupportContracts.SupportView complaintForReview(@PathVariable UUID id) {
        return service.complaintForReview(id);
    }
    @PostMapping("/complaints/review/{id}/claim")
    public SupportContracts.SupportView claimComplaint(@PathVariable UUID id,
                                                       @RequestParam(defaultValue = "false") boolean release,
                                                       @RequestParam(defaultValue = "false") boolean force) {
        return service.claimComplaint(id, release, force);
    }
    @PostMapping("/complaints/review/{id}/escalate-law-gap")
    public SupportContracts.SupportView escalateComplaintToLawGap(
            @PathVariable UUID id,
            @Valid @RequestBody(required = false) SupportContracts.EscalateLawGapRequest request) {
        return service.escalateComplaintToLawGap(id, request);
    }
    @PutMapping("/complaints/review/{id}")
    public SupportContracts.SupportView resolveComplaint(@PathVariable UUID id,
                                                       @Valid @RequestBody UpdateSupportRequest request) {
        return service.resolveComplaint(id, request);
    }
    @GetMapping("/mine")
    public List<SupportContracts.SupportView> mine() { return service.mine(); }

    @GetMapping("/admin")
    public List<SupportContracts.SupportView> adminList(@RequestParam(required = false) SupportKind kind) { return service.adminList(kind); }

    @PutMapping("/admin/{id}")
    public SupportContracts.SupportView update(@PathVariable UUID id,
                                             @Valid @RequestBody UpdateSupportRequest request) {
        return service.update(id, request);
    }
}
