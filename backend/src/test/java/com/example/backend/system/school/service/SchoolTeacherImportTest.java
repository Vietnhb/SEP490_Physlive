package com.example.backend.system.school.service;

import com.example.backend.system.account.model.entity.Role;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.*;
import com.example.backend.system.school.dataio.dto.SchoolImport;
import com.example.backend.system.school.dataio.service.SchoolImportService;
import com.example.backend.system.school.model.entity.*;
import com.example.backend.system.school.repository.*;
import jakarta.persistence.EntityManager;
import java.util.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class SchoolTeacherImportTest {
    private final SchoolRepository schools = mock(SchoolRepository.class);
    private final SchoolClassRepository classes = mock(SchoolClassRepository.class);
    private final ClassTeacherAssignmentRepository assignments = mock(ClassTeacherAssignmentRepository.class);
    private final UserRepository users = mock(UserRepository.class);
    private final CurrentUserService currentUser = mock(CurrentUserService.class);
    private final RoleValidationService roles = mock(RoleValidationService.class);
    private final AccountAccessService access = mock(AccountAccessService.class);
    private final SchoolClassService classService = mock(SchoolClassService.class);
    private final SchoolImportService service = new SchoolImportService(schools, classes,
            mock(ClassEnrollmentRepository.class), assignments, users, currentUser, roles, access,
            mock(LicenseCheckService.class), mock(AdminService.class), classService, mock(EntityManager.class));
    private final UUID schoolId = UUID.randomUUID();
    private final SchoolClass first = new SchoolClass(), second = new SchoolClass();

    @BeforeEach
    void setup() {
        School school = new School(); school.setId(schoolId); school.setActive(true);
        Role managerRole = new Role(); managerRole.setName("MANAGER");
        User actor = new User(); actor.setId(1); actor.setRole(managerRole);
        Role staffRole = new Role(); staffRole.setName("STAFF");
        User teacher = new User(); teacher.setId(42); teacher.setRole(staffRole);
        teacher.setSchool(school); teacher.setActive(true);
        first.setId(UUID.randomUUID()); first.setName("10A1"); first.setSchoolYear("2026-2027"); first.setIsActive(true);
        second.setId(UUID.randomUUID()); second.setName("10A2"); second.setSchoolYear("2026-2027"); second.setIsActive(true);
        when(currentUser.requireCurrentUser()).thenReturn(actor);
        when(roles.canManageSchool(actor, schoolId)).thenReturn(true);
        when(schools.findById(schoolId)).thenReturn(Optional.of(school));
        when(schools.findByIdForUpdate(schoolId)).thenReturn(Optional.of(school));
        when(classes.findBySchoolIdAndIsActiveTrue(schoolId)).thenReturn(List.of(first, second));
        when(users.findFirstByEmailIgnoreCase("teacher@example.com")).thenReturn(Optional.of(teacher));
        when(access.canTeach(teacher)).thenReturn(true);
    }

    private SchoolImport.Row row(int number, String className) {
        return new SchoolImport.Row(number, Map.of("teacherEmail", "teacher@example.com",
                "classCode", className, "schoolYear", "2026-2027"));
    }

    @Test
    void previewsAndCommitsSameTeacherForDifferentClasses() {
        var request = new SchoolImport.Request(SchoolImport.Kind.TEACHER_ASSIGNMENTS,
                List.of(row(2, "10A1"), row(3, "10A2")));
        var preview = service.preview(schoolId, request);
        assertTrue(preview.canCommit(), preview.rows().toString());
        var result = service.commit(schoolId, new SchoolImport.Request(request.kind(), request.rows(), preview.previewToken()));
        assertEquals(2, result.imported());
        verify(classService).assignTeacher(schoolId, first.getId(), 42);
        verify(classService).assignTeacher(schoolId, second.getId(), 42);
    }

    @Test
    void rejectsMultipleAssignmentsToSameClassInFile() {
        var preview = service.preview(schoolId, new SchoolImport.Request(SchoolImport.Kind.TEACHER_ASSIGNMENTS,
                List.of(row(2, "10A1"), row(3, "10A1"))));
        assertFalse(preview.canCommit());
        assertTrue(preview.rows().stream().allMatch(item -> item.errors().stream()
                .anyMatch(error -> error.contains("Mỗi lớp chỉ được có một giáo viên"))));
    }

    @Test
    void rejectsClassThatAlreadyHasTeacher() {
        when(assignments.findByClassIdAndIsActiveTrue(first.getId())).thenReturn(List.of(new ClassTeacherAssignment()));
        var preview = service.preview(schoolId, new SchoolImport.Request(SchoolImport.Kind.TEACHER_ASSIGNMENTS, List.of(row(2, "10A1"))));
        assertFalse(preview.canCommit());
        assertTrue(preview.rows().getFirst().errors().stream().anyMatch(error -> error.contains("Lớp đã có giáo viên")));
    }
}
