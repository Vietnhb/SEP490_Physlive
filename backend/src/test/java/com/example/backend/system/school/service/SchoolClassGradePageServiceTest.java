package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.assignment.model.entity.Assignment;
import com.example.backend.system.assignment.repository.*;
import com.example.backend.system.school.model.entity.SchoolClass;
import java.sql.*;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.RowCallbackHandler;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class SchoolClassGradePageServiceTest {
    final SchoolClassGradeService grades = mock(SchoolClassGradeService.class);
    final NamedParameterJdbcTemplate jdbc = mock(NamedParameterJdbcTemplate.class);
    final AssignmentRepository assignments = mock(AssignmentRepository.class);
    final AssignmentSubmissionRepository submissions = mock(AssignmentSubmissionRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final SchoolClassGradePageService service = new SchoolClassGradePageService(grades, mock(CurrentUserService.class), jdbc, assignments, submissions, users);
    final UUID schoolId = UUID.randomUUID(), classId = UUID.randomUUID(), lessonId = UUID.randomUUID();
    final SchoolClass classroom = new SchoolClass();
    SchoolClassGradePageServiceTest() { classroom.setId(classId); classroom.setName("10A1"); when(grades.authorize(schoolId, classId)).thenReturn(classroom); }

    @Test @SuppressWarnings("unchecked") void queriesBoundBothAxesAndApplyDateNameMembershipAndRecipientBeforePaging() throws Exception {
        List<Map<String, ?>> seen = new ArrayList<>();
        when(jdbc.queryForObject(anyString(), anyMap(), eq(Long.class))).thenAnswer(call -> {
            seen.add(new HashMap<>((Map<String, ?>) call.getArgument(1))); return call.<String>getArgument(0).contains("FROM assignments a WHERE") ? 1000L : 32L;
        });
        when(jdbc.query(anyString(), anyMap(), any(RowMapper.class))).thenReturn(List.of(lessonId));
        doAnswer(call -> { ResultSet row = mock(ResultSet.class); when(row.getInt("id")).thenReturn(9); when(row.getBoolean("is_current")).thenReturn(true); call.<RowCallbackHandler>getArgument(2).processRow(row); return null;
        }).when(jdbc).query(anyString(), anyMap(), any(RowCallbackHandler.class));
        Assignment lesson = new Assignment(); lesson.setId(lessonId); lesson.setTitle("Bài tập"); User teacher = new User(); teacher.setFullName("Teacher"); lesson.setTeacher(teacher);
        when(assignments.findAllById(List.of(lessonId))).thenReturn(List.of(lesson));
        User student = new User(); student.setId(9); student.setFullName("Student"); when(users.findAllById(List.of(9))).thenReturn(List.of(student));
        when(submissions.findByAssignmentIdInAndStudentIdIn(List.of(lessonId), List.of(9))).thenReturn(List.of());
        var page = service.get(schoolId, classId, 2, 3, 1, 10, "ALL", "  PHYSICS  ", "  Student ", "CURRENT", LocalDate.of(2026, 11, 1), LocalDate.of(2026, 11, 30));
        assertEquals(1000, page.totalAssignments()); assertEquals(334, page.assignmentPages()); assertEquals(2, page.assignmentPage());
        assertEquals(32, page.totalStudents()); assertEquals(4, page.studentPages()); assertEquals(1, page.studentPage());
        assertEquals(1, page.assignments().size()); assertEquals(1, page.students().size());
        assertEquals("physics", seen.getFirst().get("title")); assertEquals("student", seen.getFirst().get("studentQuery"));
        assertEquals(Timestamp.from(Instant.parse("2026-10-31T17:00:00Z")), seen.getFirst().get("from"));
        assertEquals(Timestamp.from(Instant.parse("2026-11-30T17:00:00Z")), seen.getFirst().get("until"));
        verify(jdbc).query(contains("LIMIT :assignmentSize OFFSET :assignmentOffset"), argThat((Map<String, ?> map) -> map.get("assignmentOffset").equals(6)), any(RowMapper.class));
        verify(jdbc).query(contains("LIMIT :studentSize OFFSET :studentOffset"), argThat((Map<String, ?> map) -> map.get("studentOffset").equals(10)), any(RowCallbackHandler.class));
        verify(submissions, never()).findByAssignmentIdIn(any()); verify(users, never()).findAll();
        assertTrue(SchoolClassGradePageService.STUDENT_FILTER.contains("r.assignment_id::text = :assignment"));
        assertTrue(SchoolClassGradePageService.STUDENT_FILTER.contains("s.assignment_id::text = :assignment"));
    }
    @Test void deniedClassNeverQueriesTheMatrix() {
        when(grades.authorize(schoolId, classId)).thenThrow(ApiException.forbidden("denied"));
        assertThrows(ApiException.class, () -> service.get(schoolId, classId, 0, 5, 0, 5, "ALL", "", "", "CURRENT", null, null)); verifyNoInteractions(jdbc);
    }
    @Test @SuppressWarnings("unchecked") void emptyFilterResultClampsPagesAndSkipsStudentAndSubmissionLoads() {
        when(jdbc.queryForObject(anyString(), anyMap(), eq(Long.class))).thenReturn(0L);
        when(jdbc.query(anyString(), anyMap(), any(RowMapper.class))).thenReturn(List.of());
        var page = service.get(schoolId, classId, 999, 1000, 999, 1000, "ALL", "missing", "", "ALL", null, null);
        assertEquals(0, page.assignmentPage()); assertEquals(0, page.studentPage()); assertEquals(5, page.assignmentSize()); assertEquals(50, page.studentSize());
        assertTrue(page.students().isEmpty()); verifyNoInteractions(assignments, users, submissions);
    }
    @Test void invalidDateRangeMembershipAndAssignmentRejectedBeforeDatabaseReads() {
        assertThrows(ApiException.class, () -> service.get(schoolId, classId, 0, 5, 0, 5, "ALL", "", "", "CURRENT", LocalDate.of(2026, 11, 30), LocalDate.of(2026, 11, 1)));
        assertThrows(ApiException.class, () -> service.get(schoolId, classId, 0, 5, 0, 5, "ALL", "", "", "INVALID", null, null));
        assertThrows(ApiException.class, () -> service.get(schoolId, classId, 0, 5, 0, 5, "invalid", "", "", "ALL", null, null)); verifyNoInteractions(jdbc);
    }
}
