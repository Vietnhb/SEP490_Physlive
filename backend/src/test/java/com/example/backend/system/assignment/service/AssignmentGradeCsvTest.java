package com.example.backend.system.assignment.service;

import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.assignment.model.entity.*;
import com.example.backend.system.assignment.model.enums.GradingStatus;
import com.example.backend.system.school.model.entity.SchoolClass;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.*;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class AssignmentGradeCsvTest {
    final Assignment assignment = new Assignment();
    final Instant due = Instant.parse("2026-11-19T10:00:00Z");
    AssignmentGradeCsvTest() { assignment.setTitle("Bài đo"); assignment.setDueAt(due); SchoolClass classroom = new SchoolClass(); classroom.setName("10A1"); assignment.setSchoolClass(classroom); }
    User student(int id) { User user = new User(); user.setId(id); user.setFullName("Học sinh " + id); user.setEmail("student" + id + "@test.invalid"); assignment.getAssignedStudentIds().add(id); return user; }
    AssignmentSubmission work(User user, Instant completed, BigDecimal score) { var work = new AssignmentSubmission(); work.setAssignment(assignment); work.setStudent(user); work.setCompletedAt(completed); work.setScore(score); work.setGradingStatus(score == null ? GradingStatus.PENDING : GradingStatus.TEACHER_CONFIRMED); return work; }
    String csv(List<User> people, List<AssignmentSubmission> rows) { return new String(AssignmentGradeCsv.render(assignment, people, rows, due.plusSeconds(60)), StandardCharsets.UTF_8); }
    @Test void exportsAllRecipientsAndExcludesUnassignedPeopleRegardlessOfUiPagination() {
        var people = new ArrayList<>(IntStream.rangeClosed(1, 25).mapToObj(this::student).toList());
        User outsider = new User(); outsider.setId(99); outsider.setFullName("Not assigned"); people.add(outsider);
        String file = csv(people, List.of()); assertEquals(26, file.lines().count()); assertTrue(file.contains("student25@test.invalid")); assertFalse(file.contains("Not assigned"));
    }
    @Test void ungradedAndUnsubmittedStayBlankWhileRealZeroAndLateSubmissionArePreserved() {
        User unsubmitted = student(1), waiting = student(2), gradedZero = student(3);
        var pending = work(waiting, due.minusSeconds(1), null); var zero = work(gradedZero, due.plusSeconds(1), BigDecimal.ZERO);
        User grader = new User(); grader.setFullName("Giáo viên B"); zero.setGradedBy(grader); zero.setGradedAt(due.plusSeconds(30)); zero.setFeedback("Cần xem lại");
        String file = csv(List.of(unsubmitted, waiting, gradedZero), List.of(pending, zero));
        assertTrue(file.contains("\"Bài đo\",\"\",\"10\",\"Chưa nộp\""));
        assertTrue(file.contains("\"Bài đo\",\"\",\"10\",\"Chờ chấm\""));
        assertTrue(file.contains("\"Bài đo\",\"0\",\"10\",\"Đã chấm\""));
        assertTrue(file.contains("19/11/2026 17:00:01\",\"Có\"")); assertTrue(file.contains("Giáo viên B"));
    }
    @Test void strictOverdueZeroIncludesMissingAndPredictionOnlyButNeverOverwritesCompletedGrade() {
        assignment.setAllowLateSubmission(false); User missing = student(1), prediction = student(2), completed = student(3);
        var predicted = work(prediction, null, null); var submitted = work(completed, due.minusSeconds(1), BigDecimal.TEN);
        String file = csv(List.of(missing, prediction, completed), List.of(predicted, submitted));
        assertEquals(2, file.lines().filter(line -> line.contains("Quá hạn · Không nộp")).count());
        assertTrue(file.contains("\"Bài đo\",\"10\",\"10\",\"Đã chấm\""));
        assertEquals(2, file.lines().filter(line -> line.contains("Hệ thống")).count());
    }
    @Test void utf8BomQuotesNewlinesAndFormulaLikeCellsAreExcelSafe() {
        User student = student(1); student.setFullName("=HYPERLINK(1)"); assignment.setTitle("Bài, \"mẫu\"");
        var submission = work(student, due.minusSeconds(1), BigDecimal.ONE); submission.setFeedback("Dòng một\nDòng hai, \"đúng\"");
        String file = csv(List.of(student), List.of(submission)); assertEquals('\uFEFF', file.charAt(0));
        assertTrue(file.contains("'=HYPERLINK(1)")); assertTrue(file.contains("\"Bài, \"\"mẫu\"\"\""));
        assertTrue(file.contains("\"Dòng một\nDòng hai, \"\"đúng\"\"\"")); assertTrue(file.endsWith("\r\n"));
    }
}
