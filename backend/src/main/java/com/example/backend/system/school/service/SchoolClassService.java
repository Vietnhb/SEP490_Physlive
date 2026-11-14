package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.model.enums.RoleName;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.AccountAccessService;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.account.service.RoleValidationService;
import com.example.backend.system.school.dto.SchoolClassContracts.ClassDetail;
import com.example.backend.system.school.dto.SchoolClassContracts.ClassSummary;
import com.example.backend.system.school.dto.SchoolClassContracts.Enrollment;
import com.example.backend.system.school.dto.SchoolClassContracts.Person;
import com.example.backend.system.school.dto.SchoolClassContracts.SchoolClassRequest;
import com.example.backend.system.school.dto.SchoolClassContracts.StudentClassSummary;
import com.example.backend.system.school.dto.SchoolClassContracts.StudentClassTeacher;
import com.example.backend.system.school.dto.SchoolClassContracts.TeacherAssignment;
import com.example.backend.system.school.model.entity.ClassEnrollment;
import com.example.backend.system.school.model.entity.ClassTeacherAssignment;
import com.example.backend.system.school.model.entity.School;
import com.example.backend.system.school.model.entity.SchoolClass;
import com.example.backend.system.school.repository.ClassEnrollmentRepository;
import com.example.backend.system.school.repository.ClassTeacherAssignmentRepository;
import com.example.backend.system.school.repository.SchoolClassRepository;
import com.example.backend.system.school.repository.SchoolRepository;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Class, teacher assignment and student enrollment operations scoped to one school. */
@Service
@RequiredArgsConstructor
public class SchoolClassService {
    private final SchoolClassRepository classes;
    private final ClassEnrollmentRepository enrollments;
    private final ClassTeacherAssignmentRepository teacherAssignments;
    private final SchoolRepository schools;
    private final UserRepository users;
    private final CurrentUserService currentUser;
    private final RoleValidationService roleValidation;
    private final LicenseCheckService licenseCheck;
    private final AccountAccessService accountAccess;
    private final jakarta.persistence.EntityManager entityManager;
    private final com.example.backend.system.assignment.repository.AssignmentRepository assignments;

    @Transactional(readOnly = true)
    public List<StudentClassSummary> mineForStudent() {
        User student = currentUser.requireCurrentUser();
        if (student.getRole() == null || !RoleName.STUDENT.matches(student.getRole().getName()))
            throw ApiException.forbidden("Chỉ học sinh mới được xem danh sách lớp của mình");
        return enrollments.findActiveEnrollmentsByStudentId(student.getId()).stream()
                .filter(item -> item.getSchoolClass() != null && Boolean.TRUE.equals(item.getSchoolClass().getIsActive()))
                .filter(item -> student.getSchool() != null && item.getSchoolClass().getSchool() != null
                        && student.getSchool().getId().equals(item.getSchoolClass().getSchool().getId()))
                .map(item -> {
                    SchoolClass schoolClass = item.getSchoolClass();
                    List<StudentClassTeacher> teachers = teacherAssignments.findByClassIdAndIsActiveTrue(schoolClass.getId()).stream()
                            .map(assignment -> new StudentClassTeacher(assignment.getTeacher().getId(), assignment.getTeacher().getFullName())).toList();
                    long classmates = Math.max(0, enrollments.countActiveByClass(schoolClass.getId()) - 1L);
                    return new StudentClassSummary(schoolClass.getId(), schoolClass.getName(), schoolClass.getGradeLevel(),
                            schoolClass.getSchoolYear(), schoolClass.getSubject(), schoolClass.getSchool().getId(),
                            schoolClass.getSchool().getName(), teachers, classmates);
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public List<ClassSummary> list(UUID schoolId) {
        return list(schoolId, false);
    }

    @Transactional(readOnly = true)
    public List<ClassSummary> list(UUID schoolId, boolean includeInactive) {
        requireSchoolAccess(schoolId);
        List<SchoolClass> rows = includeInactive ? classes.findBySchoolIdOrderByNameAsc(schoolId)
                : classes.findBySchoolIdAndIsActiveTrue(schoolId);
        return summaries(rows);
    }

    public record ClassPage(List<ClassSummary> items, long totalElements, int totalPages, int page, int size, List<String> years, long totalClasses, long activeClasses) { }

    @Transactional(readOnly = true)
    public ClassPage page(UUID schoolId, int page, int size, Integer grade, String year, String status, String query) {
        requireSchoolAccess(schoolId);
        if (query != null && query.length() > 200) throw ApiException.badRequest("Search is too long.");
        var request = com.example.backend.common.dto.PageResponse.request(page, size,
                org.springframework.data.domain.Sort.by("name").and(org.springframework.data.domain.Sort.by("id")));
        org.springframework.data.jpa.domain.Specification<SchoolClass> filter = (root, cq, cb) -> {
            var predicates = new java.util.ArrayList<jakarta.persistence.criteria.Predicate>();
            predicates.add(cb.equal(root.get("school").get("id"), schoolId));
            if (grade != null) predicates.add(cb.equal(root.get("gradeLevel"), grade));
            if (year != null && !year.equals("ALL")) predicates.add(cb.equal(root.get("schoolYear"), year));
            if (status != null && !status.equals("ALL")) predicates.add(cb.equal(root.get("isActive"), status.equals("ACTIVE")));
            if (query != null && !query.isBlank()) {
                String needle = java.text.Normalizer.normalize(query.trim().toLowerCase(java.util.Locale.ROOT), java.text.Normalizer.Form.NFD)
                        .replaceAll("\\p{M}", "").replace("!","!!").replace("%","!%").replace("_","!_");
                var text = cb.concat(cb.concat(root.get("name"), " "), cb.coalesce(root.get("subject"), ""));
                var normalized = cb.function("translate", String.class, cb.lower(text), cb.literal("àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵ"), cb.literal("aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyy"));
                predicates.add(cb.like(normalized, "%" + needle + "%", '!'));
            }
            return cb.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
        var result = classes.findAll(filter, request);
        if (page > 0 && result.isEmpty() && result.getTotalElements() > 0)
            result = classes.findAll(filter, request.withPage(result.getTotalPages() - 1));
        var stateCounts = classes.classStateCounts(schoolId);
        long total = stateCounts.stream().mapToLong(SchoolClassRepository.StateCount::getTotal).sum();
        long active = stateCounts.stream().filter(row -> Boolean.TRUE.equals(row.getActive())).mapToLong(SchoolClassRepository.StateCount::getTotal).sum();
        return new ClassPage(summaries(result.getContent()), result.getTotalElements(), result.getTotalPages(), result.getNumber(), size, classes.schoolYears(schoolId), total, active);
    }

    private List<ClassSummary> summaries(List<SchoolClass> rows) {
        if (rows.isEmpty()) return List.of();
        var ids = rows.stream().map(SchoolClass::getId).toList();
        var teachers = teacherAssignments.activeTeacherNames(ids).stream().collect(java.util.stream.Collectors.groupingBy(
                ClassTeacherAssignmentRepository.ClassTeacherName::getClassId, java.util.stream.Collectors.mapping(
                        ClassTeacherAssignmentRepository.ClassTeacherName::getFullName, java.util.stream.Collectors.toList())));
        var students = enrollments.countActiveByClasses(ids).stream().collect(java.util.stream.Collectors.toMap(
                ClassEnrollmentRepository.ClassCount::getClassId, ClassEnrollmentRepository.ClassCount::getTotal));
        return rows.stream().map(row -> new ClassSummary(row.getId(), row.getName(), row.getGradeLevel(), row.getSchoolYear(),
                row.getSubject(), Boolean.TRUE.equals(row.getIsActive()), teachers.getOrDefault(row.getId(), List.of()).size(),
                students.getOrDefault(row.getId(), 0L), teachers.getOrDefault(row.getId(), List.of()))).toList();
    }

    @Transactional(readOnly = true)
    public ClassDetail get(UUID schoolId, UUID classId) {
        return getInternal(schoolId, classId);
    }

    @Transactional(readOnly = true)
    public com.example.backend.system.school.dto.SchoolClassContracts.ClassOverview overview(UUID schoolId, UUID classId) {
        requireSchoolAccess(schoolId);
        SchoolClass classroom = classInSchool(schoolId, classId);
        List<Person> teachers = teacherAssignments.findByClassIdAndIsActiveTrue(classId).stream()
                .map(item -> person(item.getTeacher())).toList();
        return new com.example.backend.system.school.dto.SchoolClassContracts.ClassOverview(classroom.getId(),
                classroom.getName(), classroom.getGradeLevel(), classroom.getSchoolYear(), classroom.getSubject(),
                Boolean.TRUE.equals(classroom.getIsActive()), teachers, enrollments.countActiveByClass(classId));
    }

    private ClassDetail getInternal(UUID schoolId, UUID classId) {
        requireSchoolAccess(schoolId);
        SchoolClass schoolClass = activeClassInSchool(schoolId, classId);
        List<Person> teachers = teacherAssignments.findByClassIdAndIsActiveTrue(classId).stream()
                .map(item -> person(item.getTeacher())).toList();
        List<Person> students = enrollments.findActiveStudentsByClassId(classId).stream()
                .map(item -> person(item.getStudent())).toList();
        return new ClassDetail(schoolClass.getId(), schoolClass.getName(), schoolClass.getGradeLevel(),
                schoolClass.getSchoolYear(), schoolClass.getSubject(), Boolean.TRUE.equals(schoolClass.getIsActive()), teachers, students);
    }

    @Transactional
    public ClassDetail create(UUID schoolId, SchoolClassRequest request) {
        User creator = currentUser.requireCurrentUser();
        if (creator.getRole() == null || !RoleName.SCHOOL.matches(creator.getRole().getName()))
            throw ApiException.forbidden("Chỉ SCHOOL được tạo lớp học.");
        requireWriteAccess(schoolId);
        School school = schools.findByIdForUpdate(schoolId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy trường."));
        entityManager.refresh(school, jakarta.persistence.LockModeType.PESSIMISTIC_WRITE);
        String name = clean(request.name());
        String year = clean(request.schoolYear());
        if (classes.existsBySchoolIdAndNameIgnoreCaseAndSchoolYear(schoolId, name, year))
            throw ApiException.conflict("Lớp đã tồn tại trong năm học này.");
        SchoolClass schoolClass = new SchoolClass();
        schoolClass.setSchool(school); schoolClass.setName(name); schoolClass.setGradeLevel(request.gradeLevel());
        schoolClass.setSchoolYear(year); schoolClass.setSubject(blankToNull(request.subject())); schoolClass.setIsActive(true);
        return getInternal(schoolId, classes.save(schoolClass).getId());
    }

    @Transactional
    public ClassDetail update(UUID schoolId, UUID classId, SchoolClassRequest request) {
        requireWriteAccess(schoolId);
        SchoolClass schoolClass = activeClassInSchool(schoolId, classId);
        String name = clean(request.name());
        String year = clean(request.schoolYear());
        if ((!schoolClass.getName().equalsIgnoreCase(name) || !schoolClass.getSchoolYear().equals(year))
                && classes.existsBySchoolIdAndNameIgnoreCaseAndSchoolYear(schoolId, name, year))
            throw ApiException.conflict("Lớp đã tồn tại trong năm học này.");
        if (!schoolClass.getSchoolYear().equals(year) && !enrollments.findByClassId(classId).isEmpty())
            throw ApiException.conflict("Không thể đổi năm học khi lớp đã có enrollment.");
        schoolClass.setName(name); schoolClass.setGradeLevel(request.gradeLevel()); schoolClass.setSchoolYear(year);
        schoolClass.setSubject(blankToNull(request.subject()));
        return getInternal(schoolId, classes.save(schoolClass).getId());
    }

    @Transactional
    public void archive(UUID schoolId, UUID classId) {
        requireWriteAccess(schoolId);
        schools.findByIdForUpdate(schoolId).orElseThrow(() -> ApiException.notFound("Không tìm thấy trường."));
        SchoolClass schoolClass = activeClassInSchool(schoolId, classId);
        schoolClass.setIsActive(false); classes.save(schoolClass);
        teacherAssignments.findByClassIdAndIsActiveTrue(classId).forEach(item -> { item.setIsActive(false); teacherAssignments.save(item); });
        enrollments.findActiveStudentsByClassId(classId).forEach(item -> { item.setStatus(ClassEnrollment.EnrollmentStatus.COMPLETED); enrollments.save(item); });
    }

    @Transactional
    public ClassSummary restore(UUID schoolId, UUID classId) {
        requireWriteAccess(schoolId);
        schools.findByIdForUpdate(schoolId).orElseThrow(() -> ApiException.notFound("Không tìm thấy trường."));
        SchoolClass schoolClass = classInSchool(schoolId, classId);
        if (!Boolean.TRUE.equals(schoolClass.getIsActive())) {
            // Old memberships remain closed: people may have joined a different class since archiving.
            schoolClass.setIsActive(true);
            classes.save(schoolClass);
        }
        return summary(schoolClass);
    }

    @Transactional
    public TeacherAssignment assignTeacher(UUID schoolId, UUID classId, Integer teacherId) {
        requireWriteAccess(schoolId);
        // Serialize manual and CSV assignments so each class keeps at most one teacher.
        schools.findByIdForUpdate(schoolId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy trường."));
        SchoolClass schoolClass = activeClassInSchool(schoolId, classId);
        User teacher = userInSchool(schoolId, teacherId, RoleName.STAFF.name());
        if (!accountAccess.canTeach(teacher))
            throw ApiException.badRequest("Tài khoản này chưa được gắn quyền giáo viên nên không thể phân công giảng dạy.");
        if (teacherAssignments.existsBySchoolClassIdAndTeacherIdNotAndIsActiveTrue(classId, teacherId))
            throw ApiException.conflict("Lớp đã có giáo viên phụ trách. Hãy gỡ phân công hiện tại trước khi chọn giáo viên khác.");
        ClassTeacherAssignment assignment = teacherAssignments.findBySchoolClassIdAndTeacherId(classId, teacherId).orElseGet(ClassTeacherAssignment::new);
        assignment.setSchoolClass(schoolClass); assignment.setTeacher(teacher); assignment.setIsActive(true);
        assignment = teacherAssignments.save(assignment);
        return new TeacherAssignment(assignment.getId(), teacher.getId(), teacher.getFullName(), true);
    }

    @Transactional
    public TeacherAssignment replaceTeacher(UUID schoolId, UUID classId, Integer teacherId, Integer expectedTeacherId) {
        requireWriteAccess(schoolId);
        schools.findByIdForUpdate(schoolId).orElseThrow(() -> ApiException.notFound("Không tìm thấy trường."));
        SchoolClass schoolClass = activeClassInSchool(schoolId, classId);
        var current = teacherAssignments.findByClassIdAndIsActiveTrue(classId);
        if (current.size() != 1 || !current.getFirst().getTeacher().getId().equals(expectedTeacherId))
            throw ApiException.conflict("Phân công giáo viên đã thay đổi. Vui lòng tải lại lớp trước khi thay giáo viên.");
        if (teacherId.equals(expectedTeacherId)) throw ApiException.badRequest("Hãy chọn giáo viên khác người đang phụ trách.");
        User teacher = userInSchool(schoolId, teacherId, RoleName.STAFF.name());
        if (!accountAccess.canTeach(teacher)) throw ApiException.badRequest("Giáo viên mới chưa có quyền giảng dạy.");
        current.getFirst().setIsActive(false);
        teacherAssignments.saveAndFlush(current.getFirst());
        var next = teacherAssignments.findBySchoolClassIdAndTeacherId(classId, teacherId).orElseGet(ClassTeacherAssignment::new);
        next.setSchoolClass(schoolClass); next.setTeacher(teacher); next.setIsActive(true);
        next = teacherAssignments.save(next);
        return new TeacherAssignment(next.getId(), teacher.getId(), teacher.getFullName(), true);
    }

    @Transactional
    public void unassignTeacher(UUID schoolId, UUID classId, Integer teacherId) {
        requireWriteAccess(schoolId);
        schools.findByIdForUpdate(schoolId).orElseThrow(() -> ApiException.notFound("Không tìm thấy trường."));
        activeClassInSchool(schoolId, classId);
        ClassTeacherAssignment assignment = teacherAssignments.findBySchoolClassIdAndTeacherId(classId, teacherId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy phân công giáo viên."));
        assignment.setIsActive(false); teacherAssignments.save(assignment);
    }

    @Transactional
    public Enrollment enrollStudent(UUID schoolId, UUID classId, Integer studentId) {
        return enrollStudentInternal(schoolId, classId, studentId);
    }

    private Enrollment enrollStudentInternal(UUID schoolId, UUID classId, Integer studentId) {
        requireWriteAccess(schoolId);
        School school = schools.findByIdForUpdate(schoolId)
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy trường."));
        SchoolClass schoolClass = activeClassInSchool(schoolId, classId);
        User student = userInSchool(schoolId, studentId, RoleName.STUDENT.name());
        Optional<ClassEnrollment> activeEnrollment = enrollments.findActiveEnrollment(studentId, schoolClass.getSchoolYear());
        activeEnrollment.ifPresent(existing -> {
            if (!existing.getSchoolClass().getId().equals(classId))
                throw ApiException.conflict("Học sinh đã thuộc một lớp khác trong năm học này.");
        });
        if (activeEnrollment.isEmpty() && school.getStudentQuota() != null
                && enrollments.countActiveStudentsBySchoolId(schoolId) >= school.getStudentQuota())
            throw ApiException.conflict("Trường đã đạt quota học sinh của gói hiện tại.");
        ClassEnrollment enrollment = enrollments.findBySchoolClassIdAndStudentIdAndStatus(classId, studentId, ClassEnrollment.EnrollmentStatus.ACTIVE)
                .orElseGet(ClassEnrollment::new);
        enrollment.setSchoolClass(schoolClass); enrollment.setStudent(student); enrollment.setSchoolYear(schoolClass.getSchoolYear());
        enrollment.setStatus(ClassEnrollment.EnrollmentStatus.ACTIVE); enrollment = enrollments.save(enrollment);
        // Joining after removal and direct transfers must receive the same open work.
        // Existing recipients/submissions are preserved, including historical grades.
        assignments.findOpenForTransfer(classId, java.time.Instant.now()).forEach(assignment -> {
            if (assignment.getAssignedStudentIds().add(studentId)) assignments.save(assignment);
        });
        return new Enrollment(enrollment.getId(), student.getId(), student.getFullName(), enrollment.getSchoolYear(), enrollment.getStatus().name());
    }

    @Transactional
    public Enrollment transferStudent(UUID schoolId, UUID targetClassId, Integer studentId) {
        requireWriteAccess(schoolId);
        schools.findByIdForUpdate(schoolId).orElseThrow(() -> ApiException.notFound("Không tìm thấy trường."));
        SchoolClass target = activeClassInSchool(schoolId, targetClassId);
        User student = userInSchool(schoolId, studentId, RoleName.STUDENT.name());
        enrollments.findActiveEnrollment(studentId, target.getSchoolYear()).ifPresent(existing -> {
            if (!existing.getSchoolClass().getId().equals(targetClassId)) {
                existing.setStatus(ClassEnrollment.EnrollmentStatus.TRANSFERRED); enrollments.save(existing);
            }
        });
        return enrollStudentInternal(schoolId, targetClassId, student.getId());
    }

    @Transactional
    public void removeStudent(UUID schoolId, UUID classId, Integer studentId) {
        requireWriteAccess(schoolId); activeClassInSchool(schoolId, classId);
        ClassEnrollment enrollment = enrollments.findBySchoolClassIdAndStudentIdAndStatus(classId, studentId, ClassEnrollment.EnrollmentStatus.ACTIVE)
                .orElseThrow(() -> ApiException.notFound("Học sinh chưa ở trong lớp này."));
        enrollment.setStatus(ClassEnrollment.EnrollmentStatus.DROPPED); enrollments.save(enrollment);
    }

    private ClassSummary summary(SchoolClass schoolClass) {
        var names = teacherAssignments.activeTeacherNames(List.of(schoolClass.getId())).stream()
                .map(ClassTeacherAssignmentRepository.ClassTeacherName::getFullName).toList();
        return new ClassSummary(schoolClass.getId(), schoolClass.getName(), schoolClass.getGradeLevel(), schoolClass.getSchoolYear(),
                schoolClass.getSubject(), Boolean.TRUE.equals(schoolClass.getIsActive()),
                names.size(), enrollments.countActiveByClass(schoolClass.getId()), names);
    }

    private User requireWriteAccess(UUID schoolId) {
        User actor = requireSchoolAccess(schoolId);
        if (!RoleName.MANAGER.matches(actor.getRole() == null ? null : actor.getRole().getName())) licenseCheck.requireWriteAccess(actor);
        return actor;
    }

    private User requireSchoolAccess(UUID schoolId) {
        User actor = currentUser.requireCurrentUser();
        boolean departmentAccess = accountAccess.isDepartmentHead(actor)
                && actor.getSchool() != null && schoolId.equals(actor.getSchool().getId());
        if (!roleValidation.canManageSchool(actor, schoolId) && !departmentAccess)
            throw ApiException.forbidden("Bạn không có quyền truy cập trường này");
        return actor;
    }

    private SchoolClass classInSchool(UUID schoolId, UUID classId) {
        SchoolClass schoolClass = classes.findById(classId).orElseThrow(() -> ApiException.notFound("Không tìm thấy lớp."));
        if (schoolClass.getSchool() == null || !schoolId.equals(schoolClass.getSchool().getId())) throw ApiException.forbidden("Lớp không thuộc trường này.");
        return schoolClass;
    }

    private SchoolClass activeClassInSchool(UUID schoolId, UUID classId) {
        SchoolClass schoolClass = classInSchool(schoolId, classId);
        if (!Boolean.TRUE.equals(schoolClass.getIsActive()))
            throw ApiException.conflict("Lớp đã được tắt và không thể cập nhật.");
        return schoolClass;
    }

    private User userInSchool(UUID schoolId, Integer id, String role) {
        User user = users.findById(id).orElseThrow(() -> ApiException.notFound("Không tìm thấy người dùng."));
        if (user.getSchool() == null || !schoolId.equals(user.getSchool().getId()) || user.getRole() == null || !role.equals(user.getRole().getName()) || !Boolean.TRUE.equals(user.getActive()))
            throw ApiException.badRequest("Người dùng không hợp lệ trong trường này.");
        return user;
    }

    private static Person person(User user) { return new Person(user.getId(), user.getFullName(), user.getEmail()); }
    private static String clean(String value) { return value == null ? "" : value.trim(); }
    private static String blankToNull(String value) { String cleaned = clean(value); return cleaned.isBlank() ? null : cleaned; }
}
