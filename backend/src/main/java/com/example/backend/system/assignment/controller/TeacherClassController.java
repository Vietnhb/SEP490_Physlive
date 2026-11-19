package com.example.backend.system.assignment.controller;

import com.example.backend.system.school.dto.ClassGradebook;
import com.example.backend.system.school.service.SchoolClassGradeService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assignments/mine/teacher/classes")
@RequiredArgsConstructor
public class TeacherClassController {
    private final SchoolClassGradeService grades;

    private final com.example.backend.system.school.service.SchoolClassGradePageService gradePages;

    @GetMapping("/{classId}/grades/page")
    public com.example.backend.system.school.service.SchoolClassGradePageService.Page gradePage(@PathVariable UUID classId,
            @RequestParam(defaultValue = "0") int assignmentPage, @RequestParam(defaultValue = "5") int assignmentSize,
            @RequestParam(defaultValue = "0") int studentPage, @RequestParam(defaultValue = "5") int studentSize,
            @RequestParam(defaultValue = "ALL") String assignment, @RequestParam(defaultValue = "") String title,
            @RequestParam(defaultValue = "") String studentQuery, @RequestParam(defaultValue = "CURRENT") String membership,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate from,
            @RequestParam(required = false) @org.springframework.format.annotation.DateTimeFormat(iso = org.springframework.format.annotation.DateTimeFormat.ISO.DATE) java.time.LocalDate to) {
        return gradePages.forTeacher(classId, assignmentPage, assignmentSize, studentPage, studentSize, assignment, title, studentQuery, membership, from, to);
    }

    @GetMapping("/{classId}/grades")
    public ClassGradebook grades(@PathVariable UUID classId) { return grades.forTeacher(classId); }
}
