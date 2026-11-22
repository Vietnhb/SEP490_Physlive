package com.example.backend.system.assignment.controller;

import com.example.backend.system.assignment.service.TeacherStudentProfileService;
import com.example.backend.system.school.dto.SchoolAccountProfile;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/assignments/mine/teacher/classes")
@RequiredArgsConstructor
public class TeacherStudentProfileController {
    private final TeacherStudentProfileService service;
    @GetMapping("/{classId}/students/{studentId}/profile")
    public SchoolAccountProfile profile(@PathVariable UUID classId, @PathVariable Integer studentId) {
        return service.profile(classId, studentId);
    }
}
