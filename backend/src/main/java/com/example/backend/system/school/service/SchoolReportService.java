package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.enums.RoleName;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.account.service.RoleValidationService;
import com.example.backend.system.school.dto.SchoolReportContracts.ClassRow;
import com.example.backend.system.school.dto.SchoolReportContracts.Summary;
import com.example.backend.system.school.dto.SchoolReportContracts.TokenRow;
import com.example.backend.system.school.dto.SchoolReportContracts.TokenPage;
import com.example.backend.system.school.dto.SchoolReportContracts.TokenOptions;
import com.example.backend.system.school.dto.SchoolContracts;
import com.example.backend.system.school.model.entity.TokenUsageAudit;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import java.time.YearMonth;
import java.time.LocalDate;
import java.util.Locale;
import com.example.backend.system.school.model.entity.School;
import com.example.backend.system.school.repository.ClassEnrollmentRepository;
import com.example.backend.system.school.repository.ClassTeacherAssignmentRepository;
import com.example.backend.system.school.repository.SchoolClassRepository;
import com.example.backend.system.school.repository.SchoolRepository;
import com.example.backend.system.school.repository.TokenUsageAuditRepository;
import java.util.List;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class SchoolReportService {
    private final SchoolRepository schools;
    private final AiQuotaService aiQuota;
    private final SchoolClassRepository classes;
    private final ClassEnrollmentRepository enrollments;
    private final ClassTeacherAssignmentRepository teacherAssignments;
    private final UserRepository users;
    private final CurrentUserService currentUser;
    private final RoleValidationService roles;
    private final TokenUsageAuditRepository tokenAudits;

    public Summary summary(UUID schoolId) {
        return summary(schoolId, null, null);
    }

    public Summary summary(UUID schoolId, String month, Integer year) {
        requireAccess(schoolId); School school = school(schoolId);
        long teachers = users.countReportAccounts(schoolId, RoleName.STAFF.name());
        long students = users.countActiveStudents(schoolId);
        long managers = users.countReportAccounts(schoolId, RoleName.SCHOOL.name());
        long enrolled = enrollments.countActiveStudentsBySchoolId(schoolId);
        LocalDate currentMonth = aiQuota.currentMonth();
        LocalDate usageMonth = currentMonth;
        long usedTokens;
        if (month != null && !month.isBlank()) {
            usageMonth = parseMonth(month);
            if (usageMonth.equals(currentMonth)) {
                usedTokens = aiQuota.usedThisMonth(school);
            } else {
                usedTokens = tokenAudits.monthlyTokens(schoolId, usageMonth, usageMonth).stream()
                        .mapToLong(r -> r.getTokens() == null ? 0L : r.getTokens()).sum();
            }
        } else if (year != null) {
            validateYear(year);
            LocalDate start = LocalDate.of(year, 1, 1);
            LocalDate end = LocalDate.of(year, 12, 1);
            usageMonth = start;
            var totals = tokenAudits.monthlyTokens(schoolId, start, end).stream().collect(java.util.stream.Collectors.toMap(
                    TokenUsageAuditRepository.MonthlyTokens::getMonth, r -> r.getTokens() == null ? 0L : r.getTokens()));
            if (currentMonth.getYear() == year) totals.put(currentMonth, aiQuota.usedThisMonth(school));
            usedTokens = totals.values().stream().mapToLong(Long::longValue).sum();
        } else {
            usedTokens = aiQuota.usedThisMonth(school);
        }
        return new Summary(schoolId, school.getName(), students, teachers, managers,
                classes.countBySchoolIdAndIsActiveTrue(schoolId), enrolled,
                usedTokens, school.getMonthlyTokenQuota(), school.getLicenseEnd(),
                usageMonth, school.getStudentQuota(), school.getPlanCode(), school.getLicenseStart(),
                SchoolContracts.Response.from(school).subscriptionStatus());
    }

    public List<ClassRow> classes(UUID schoolId) {
        requireAccess(schoolId);
        var rows = classes.findBySchoolIdAndIsActiveTrue(schoolId);
        if (rows.isEmpty()) return List.of();
        var ids = rows.stream().map(com.example.backend.system.school.model.entity.SchoolClass::getId).toList();
        var teachers = teacherAssignments.countActiveByClasses(ids).stream().collect(java.util.stream.Collectors.toMap(
                ClassTeacherAssignmentRepository.ClassCount::getClassId, ClassTeacherAssignmentRepository.ClassCount::getTotal));
        var students = enrollments.countActiveByClasses(ids).stream().collect(java.util.stream.Collectors.toMap(
                ClassEnrollmentRepository.ClassCount::getClassId, ClassEnrollmentRepository.ClassCount::getTotal));
        return rows.stream().map(item -> new ClassRow(item.getId(), item.getName(), item.getGradeLevel(), item.getSchoolYear(),
                teachers.getOrDefault(item.getId(), 0L), students.getOrDefault(item.getId(), 0L))).toList();
    }

    public List<com.example.backend.system.school.dto.SchoolReportContracts.MonthlyTokenRow> monthlyTokens(UUID schoolId) {
        return monthlyTokens(schoolId, null, null);
    }

    public List<com.example.backend.system.school.dto.SchoolReportContracts.MonthlyTokenRow> monthlyTokens(UUID schoolId, String month, Integer year) {
        requireAccess(schoolId);
        School school = school(schoolId);
        LocalDate currentMonth = aiQuota.currentMonth();
        LocalDate start;
        LocalDate end;
        int count;
        if (year != null && (month == null || month.isBlank())) {
            validateYear(year);
            start = LocalDate.of(year, 1, 1);
            end = LocalDate.of(year, 12, 1);
            count = 12;
        } else {
            end = (month != null && !month.isBlank()) ? parseMonth(month) : currentMonth;
            start = end.minusMonths(5);
            count = 6;
        }
        var totals = tokenAudits.monthlyTokens(schoolId, start, end).stream().collect(java.util.stream.Collectors.toMap(
                TokenUsageAuditRepository.MonthlyTokens::getMonth, row -> row.getTokens() == null ? 0L : row.getTokens()));
        if (!currentMonth.isBefore(start) && !currentMonth.isAfter(end)) {
            totals.put(currentMonth, aiQuota.usedThisMonth(school));
        }
        return java.util.stream.IntStream.range(0, count).mapToObj(offset -> {
            LocalDate m = start.plusMonths(offset);
            return new com.example.backend.system.school.dto.SchoolReportContracts.MonthlyTokenRow(m, totals.getOrDefault(m, 0L));
        }).toList();
    }

    public List<TokenRow> tokenAudit(UUID schoolId) {
        requireAccess(schoolId);
        return tokenAudits.findTop200BySchoolIdOrderByRecordedAtDesc(schoolId).stream()
                .map(row -> new TokenRow(row.getUser().getEmail(), row.getOperation(), row.getTokens(), row.getUsageMonth(), row.getRecordedAt())).toList();
    }

    public List<ClassRow> filteredClasses(UUID schoolId, Integer grade, String year, String query) {
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        return classes(schoolId).stream().filter(row -> grade == null || grade.equals(row.gradeLevel()))
                .filter(row -> year == null || year.isBlank() || year.equals(row.schoolYear()))
                .filter(row -> row.name().toLowerCase(Locale.ROOT).contains(needle)).toList();
    }

    public TokenOptions tokenOptions(UUID schoolId) {
        requireAccess(schoolId);
        return new TokenOptions(tokenAudits.operations(schoolId), tokenAudits.months(schoolId));
    }

    public TokenPage tokenPage(UUID schoolId, int page, int size, String query, String operation, String month) {
        return tokenPage(schoolId, page, size, query, operation, month, null);
    }

    public TokenPage tokenPage(UUID schoolId, int page, int size, String query, String operation, String month, Integer year) {
        requireAccess(schoolId);
        if (page < 0 || size < 1 || size > 100) throw ApiException.badRequest("Phân trang không hợp lệ (1–100 dòng/trang).");
        if ((query != null && query.length() > 200) || (operation != null && operation.length() > 64))
            throw ApiException.badRequest("Bộ lọc quá dài.");
        LocalDate usageMonth = (month == null || month.isBlank()) ? null : parseMonth(month);
        if (usageMonth == null && year != null) validateYear(year);
        String needle = query == null ? "" : query.trim().toLowerCase(Locale.ROOT);
        Specification<TokenUsageAudit> filter = (root, criteria, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("school").get("id"), schoolId));
            if (usageMonth != null) predicates.add(cb.equal(root.get("usageMonth"), usageMonth));
            else if (year != null) {
                predicates.add(cb.greaterThanOrEqualTo(root.get("usageMonth"), LocalDate.of(year, 1, 1)));
                predicates.add(cb.lessThanOrEqualTo(root.get("usageMonth"), LocalDate.of(year, 12, 31)));
            }
            if (operation != null && !operation.isBlank()) predicates.add(cb.equal(root.get("operation"), operation));
            if (!needle.isEmpty()) {
                String escaped = needle.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                predicates.add(cb.like(cb.lower(root.get("user").get("email")), "%" + escaped + "%", '\\'));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        Sort sort = Sort.by(Sort.Order.desc("recordedAt"), Sort.Order.desc("id"));
        var result = tokenAudits.findAll(filter, PageRequest.of(page, size, sort));
        if (result.getTotalElements() > 0 && page >= result.getTotalPages())
            result = tokenAudits.findAll(filter, PageRequest.of(result.getTotalPages() - 1, size, sort));
        var items = result.getContent().stream().map(row -> new TokenRow(row.getUser().getEmail(), row.getOperation(),
                row.getTokens(), row.getUsageMonth(), row.getRecordedAt())).toList();
        return new TokenPage(items, result.getTotalElements(), result.getTotalPages(), result.getNumber(), result.getSize());
    }

    private static LocalDate parseMonth(String month) {
        try { return YearMonth.parse(month.trim()).atDay(1); }
        catch (java.time.format.DateTimeParseException invalid) { throw ApiException.badRequest("Tháng cần có dạng yyyy-MM."); }
    }

    private static void validateYear(int year) {
        if (year < 2000 || year > 2100) throw ApiException.badRequest("Năm không hợp lệ.");
    }

    private School school(UUID schoolId) { return schools.findById(schoolId).orElseThrow(() -> ApiException.notFound("Không tìm thấy trường")); }
    private void requireAccess(UUID schoolId) {
        if (!roles.canManageSchool(currentUser.requireCurrentUser(), schoolId)) {
            throw ApiException.forbidden("Bạn không có quyền truy cập trường này");
        }
    }

}
