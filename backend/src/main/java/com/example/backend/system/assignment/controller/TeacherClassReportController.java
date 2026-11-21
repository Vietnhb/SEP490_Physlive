package com.example.backend.system.assignment.controller;

import com.example.backend.system.school.service.ClassAssignmentReportService;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assignments/mine/teacher/classes/{classId}/report")
@RequiredArgsConstructor
public class TeacherClassReportController {
    private final ClassAssignmentReportService reports;
    @GetMapping
    public ClassAssignmentReportService.Page report(@PathVariable UUID classId,
            @RequestParam(defaultValue = "") String query, @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "10") int size) {
        return reports.page(classId, query, status, from, to, page, size);
    }
    @GetMapping(value = "/csv", produces = "text/csv")
    public ResponseEntity<byte[]> csv(@PathVariable UUID classId,
            @RequestParam(defaultValue = "") String query, @RequestParam(defaultValue = "ALL") String status,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to) {
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
            .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename("ket-qua-lop-" + classId + ".csv").build().toString())
            .body(reports.csv(classId, query, status, from, to));
    }
}
