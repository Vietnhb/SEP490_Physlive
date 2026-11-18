package com.example.backend.system.school.dataio.service;

import com.example.backend.common.text.CodeText;
import com.example.backend.exception.ApiException;
import com.example.backend.security.PasswordPolicy;
import com.example.backend.system.account.dto.CreateManagedUserRequest;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.model.enums.PermissionCode;
import com.example.backend.system.account.model.enums.RoleName;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.AccountAccessService;
import com.example.backend.system.account.service.AdminService;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.account.service.RoleValidationService;
import com.example.backend.system.school.dataio.dto.SchoolImport;
import com.example.backend.system.school.dto.SchoolClassContracts.SchoolClassRequest;
import com.example.backend.system.school.model.entity.School;
import com.example.backend.system.school.model.entity.SchoolClass;
import com.example.backend.system.school.repository.ClassEnrollmentRepository;
import com.example.backend.system.school.repository.ClassTeacherAssignmentRepository;
import com.example.backend.system.school.repository.SchoolClassRepository;
import com.example.backend.system.school.repository.SchoolRepository;
import com.example.backend.system.school.service.LicenseCheckService;
import com.example.backend.system.school.service.SchoolClassService;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Preview is read-only; commit revalidates the complete bounded batch in one transaction. */
@Service
@RequiredArgsConstructor
public class SchoolImportService {
    private static final String AVATAR_URL = "avatarUrl";
    private static final String CLASS_CODE = "classCode";
    private static final String DATE_OF_BIRTH = "dateOfBirth";
    private static final String EMAIL = "email";
    private static final String FULL_NAME = "fullName";
    private static final String GRADE_LEVEL = "gradeLevel";
    private static final String INITIAL_PASSWORD = "initialPassword";
    private static final String PERMISSIONS = "permissions";
    private static final String SCHOOL_YEAR = "schoolYear";
    private static final String STAFF = "STAFF";
    private static final String STUDENT = "STUDENT";
    private static final String STUDENT_EMAIL = "studentEmail";
    private static final String SUBJECT = "subject";
    private static final String TEACHER_EMAIL = "teacherEmail";
    private final SchoolRepository schools;
    private final SchoolClassRepository classes;
    private final ClassEnrollmentRepository enrollments;
    private final ClassTeacherAssignmentRepository assignments;
    private final UserRepository users;
    private final CurrentUserService currentUser;
    private final RoleValidationService roles;
    private final AccountAccessService accountAccess;
    private final LicenseCheckService license;
    private final AdminService admin;
    private final SchoolClassService classService;
    private final EntityManager entityManager;
    private final byte[] previewSecret = randomBytes(32);

    private static final List<String> STAFF_PERMISSIONS = PermissionCode.forRole(RoleName.STAFF).stream().map(Enum::name).toList();

    /**
     * A cell holds one or more permission codes separated by "|" (";", "+" and spaces are also accepted); empty when
     * the cell names none, which leaves the account's permissions to the defaults of its role.
     */
    private static java.util.Optional<List<String>> permissionCodes(String cell) {
        if (cell == null || cell.isBlank()) return java.util.Optional.empty();
        List<String> codes = java.util.Arrays.stream(cell.toUpperCase(Locale.ROOT).split("[|;+,\\s]+")).filter(code -> !code.isBlank()).distinct().toList();
        return codes.isEmpty() ? java.util.Optional.empty() : java.util.Optional.of(codes);
    }

    public static List<String> columns(SchoolImport.Kind kind) {
        if (kind == null) throw bad("Chọn loại dữ liệu cần nhập.");
        return switch (kind) {
            case USERS -> List.of(FULL_NAME, DATE_OF_BIRTH, EMAIL, INITIAL_PASSWORD, "role", PERMISSIONS, CLASS_CODE, SCHOOL_YEAR, AVATAR_URL);
            case CLASSES -> List.of(CLASS_CODE, GRADE_LEVEL, SCHOOL_YEAR, SUBJECT);
            case ENROLLMENTS -> List.of(STUDENT_EMAIL, CLASS_CODE, SCHOOL_YEAR);
            case TEACHER_ASSIGNMENTS -> List.of(TEACHER_EMAIL, CLASS_CODE, SCHOOL_YEAR);
        };
    }

    private static List<String> required(SchoolImport.Kind kind) {
        return switch (kind) {
            case USERS -> List.of(FULL_NAME, DATE_OF_BIRTH, EMAIL, INITIAL_PASSWORD, "role");
            case CLASSES -> List.of(CLASS_CODE, GRADE_LEVEL, SCHOOL_YEAR);
            case ENROLLMENTS -> List.of(STUDENT_EMAIL, CLASS_CODE, SCHOOL_YEAR);
            case TEACHER_ASSIGNMENTS -> List.of(TEACHER_EMAIL, CLASS_CODE, SCHOOL_YEAR);
        };
    }

    @Transactional(readOnly = true)
    public byte[] template(UUID schoolId, SchoolImport.Kind kind) {
        requireAccess(schoolId, kind);
        int year = LocalDate.now().getMonthValue() >= 8 ? LocalDate.now().getYear() : LocalDate.now().getYear() - 1;
        String schoolYear = year + "-" + (year + 1);
        List<String> example = switch (kind) {
            case USERS -> List.of("Nguyễn Minh An", "2010-09-15", "minhan@example.edu.vn", "ChangeMe2026!", STUDENT, "", "", "", "");
            case CLASSES -> List.of("10A1", "10", schoolYear, "Vật lý");
            case ENROLLMENTS -> List.of("minhan@example.edu.vn", "10A1", schoolYear);
            case TEACHER_ASSIGNMENTS -> List.of("giaovien@example.edu.vn", "10A1", schoolYear);
        };
        String teacherExample = kind == SchoolImport.Kind.USERS ? csv(List.of("Trần Thu Hà", "1988-04-23", "thuha@example.edu.vn", "ChangeMe2026!", STAFF, "TEACH", "", "", "")) + "\r\n" : "";
        return ("\uFEFF" + csv(columns(kind)) + "\r\n" + csv(example) + "\r\n" + teacherExample).getBytes(StandardCharsets.UTF_8);
    }

    @Transactional(readOnly = true)
    public SchoolImport.Preview previewFile(UUID schoolId, SchoolImport.Kind kind, byte[] csvBytes) {
        requireAccess(schoolId, kind);
        if (csvBytes == null || csvBytes.length == 0) throw bad("Chọn tệp CSV.");
        if (csvBytes.length > SchoolCsvParser.MAX_BYTES) throw bad("Tệp CSV tối đa 1 MB.");
        return preview(schoolId, new SchoolImport.Request(kind, SchoolCsvParser.parse(csvBytes, columns(kind), required(kind))));
    }

    @Transactional(readOnly = true)
    public SchoolImport.Preview preview(UUID schoolId, SchoolImport.Request request) {
        checkRequest(request);
        User actor = requireAccess(schoolId, request.kind());
        School school = schools.findById(schoolId).orElseThrow(() -> ApiException.notFound("Không tìm thấy trường."));
        requireActiveSchool(school);
        return validate(schoolId, actor, school, request);
    }

    @Transactional
    public SchoolImport.Result commit(UUID schoolId, SchoolImport.Request request) {
        checkRequest(request);
        User actor = requireAccess(schoolId, request.kind());
        School school = schools.findByIdForUpdate(schoolId).orElseThrow(() -> ApiException.notFound("Không tìm thấy trường."));
        entityManager.refresh(school, LockModeType.PESSIMISTIC_WRITE);
        requireActiveSchool(school);
        if (!hasRole(actor, RoleName.MANAGER)) license.requireWriteAccess(actor);
        requirePreview(schoolId, actor, request);
        lockReferences(schoolId, request);
        SchoolImport.Preview preview = validate(schoolId, actor, school, request);
        if (!preview.canCommit()) throw bad("Dữ liệu đã thay đổi hoặc còn lỗi. Hãy kiểm tra lại bản xem trước.");
        List<SchoolImport.Credential> credentials = new ArrayList<>();
        for (SchoolImport.PreviewRow row : preview.rows()) {
            Map<String, String> data = row.data();
            switch (request.kind()) {
                case USERS -> {
                    var created = admin.createUser(new CreateManagedUserRequest(data.get(EMAIL), data.get(INITIAL_PASSWORD),
                            data.get(FULL_NAME), data.get("role"), schoolId.toString(), LocalDate.parse(data.get(DATE_OF_BIRTH)),
                            blankToNull(data.get(AVATAR_URL)), permissionCodes(data.get(PERMISSIONS)).orElse(null)));
                    if (!data.get(CLASS_CODE).isBlank()) {
                        SchoolClass target = findClass(schoolId, data.get(CLASS_CODE), data.get(SCHOOL_YEAR));
                        if (RoleName.STUDENT.matches(data.get("role"))) classService.enrollStudent(schoolId, target.getId(), created.id());
                        else classService.assignTeacher(schoolId, target.getId(), created.id());
                    }
                    credentials.add(new SchoolImport.Credential(data.get(FULL_NAME), LocalDate.parse(data.get(DATE_OF_BIRTH)),
                            data.get(EMAIL), data.get(INITIAL_PASSWORD), data.get("role"), data.get(CLASS_CODE), data.get(SCHOOL_YEAR)));
                }
                case CLASSES -> classService.create(schoolId, new SchoolClassRequest(data.get(CLASS_CODE), Integer.valueOf(data.get(GRADE_LEVEL)), data.get(SCHOOL_YEAR), data.get(SUBJECT)));
                case ENROLLMENTS -> classService.enrollStudent(schoolId, findClass(schoolId, data.get(CLASS_CODE), data.get(SCHOOL_YEAR)).getId(), users.findFirstByEmailIgnoreCase(data.get(STUDENT_EMAIL)).orElseThrow().getId());
                case TEACHER_ASSIGNMENTS -> classService.assignTeacher(schoolId, findClass(schoolId, data.get(CLASS_CODE), data.get(SCHOOL_YEAR)).getId(), users.findFirstByEmailIgnoreCase(data.get(TEACHER_EMAIL)).orElseThrow().getId());
            }
        }
        return new SchoolImport.Result(request.kind(), preview.rows().size(), List.copyOf(credentials));
    }

    private SchoolImport.Preview validate(UUID schoolId, User actor, School school, SchoolImport.Request request) {
        List<SchoolClass> schoolClasses = classes.findBySchoolIdAndIsActiveTrue(schoolId);
        List<User> schoolUsers = request.kind() == SchoolImport.Kind.USERS ? users.findBySchoolId(schoolId) : List.of();
        Map<String, Long> emailCounts = new HashMap<>();
        Map<String, Long> identityCounts = new HashMap<>();
        Map<String, Long> classCounts = new HashMap<>();
        Map<String, Long> teacherClassCounts = new HashMap<>();
        List<SchoolImport.Row> normalized = request.rows().stream().map(row -> normalize(request.kind(), row)).toList();
        for (SchoolImport.Row row : normalized) {
            var data = row.data();
            String emailKey = switch (request.kind()) {
                case USERS -> data.get(EMAIL);
                case ENROLLMENTS -> data.get(STUDENT_EMAIL) + "|" + data.get(SCHOOL_YEAR);
                case TEACHER_ASSIGNMENTS -> data.get(TEACHER_EMAIL) + "|" + data.get(CLASS_CODE).toLowerCase(Locale.ROOT) + "|" + data.get(SCHOOL_YEAR);
                case CLASSES -> "";
            };
            emailCounts.merge(emailKey, 1L, Long::sum);
            identityCounts.merge(identity(data.get(FULL_NAME), data.get(DATE_OF_BIRTH)), 1L, Long::sum);
            classCounts.merge(classKey(data.get(CLASS_CODE), data.get(SCHOOL_YEAR)), 1L, Long::sum);
            if (request.kind() == SchoolImport.Kind.TEACHER_ASSIGNMENTS
                    || request.kind() == SchoolImport.Kind.USERS && STAFF.equals(data.get("role")) && !data.get(CLASS_CODE).isBlank()) {
                teacherClassCounts.merge(classKey(data.get(CLASS_CODE), data.get(SCHOOL_YEAR)), 1L, Long::sum);
            }
        }
        long studentCount = normalized.stream().filter(row -> STUDENT.equals(row.data().get("role"))).count();
        boolean userQuotaExceeded = request.kind() == SchoolImport.Kind.USERS && school.getStudentQuota() != null
                && users.countActiveStudents(schoolId) + studentCount > school.getStudentQuota();
        long incomingEnrollments = incomingEnrollments(request.kind(), normalized);
        boolean enrollmentQuotaExceeded = incomingEnrollments > 0 && school.getStudentQuota() != null
                && enrollments.countActiveStudentsBySchoolId(schoolId) + incomingEnrollments > school.getStudentQuota();
        List<SchoolImport.PreviewRow> result = new ArrayList<>();
        for (SchoolImport.Row row : normalized) {
            Map<String, String> data = row.data();
            List<String> errors = new ArrayList<>();
            List<String> warnings = new ArrayList<>();
            List<SchoolImport.Match> matches = new ArrayList<>();
            if (request.kind() == SchoolImport.Kind.USERS) {
                requiredText(data.get(FULL_NAME), 120, "Họ tên", errors);
                LocalDate dob = date(data.get(DATE_OF_BIRTH), errors);
                validEmail(data.get(EMAIL), errors);
                if (emailCounts.get(data.get(EMAIL)) > 1) errors.add("Email trùng trong tệp.");
                if (users.findFirstByEmailIgnoreCase(data.get(EMAIL)).isPresent()) errors.add("Email đã được sử dụng.");
                if (!Set.of(STAFF, STUDENT).contains(data.get("role"))) errors.add("Vai trò phải là STAFF hoặc STUDENT.");
                try { PasswordPolicy.requireValid(data.get(INITIAL_PASSWORD)); }
                catch (ApiException ex) { errors.add("Mật khẩu ban đầu cần ít nhất 8 ký tự và tối đa 72 byte UTF-8."); }
                if (RoleName.STAFF.matches(data.get("role"))) {
                    java.util.Optional<List<String>> codes = permissionCodes(data.get(PERMISSIONS));
                    if (codes.isEmpty() || !STAFF_PERMISSIONS.containsAll(codes.get())) errors.add("permissions phải là TEACH, DEPARTMENT_HEAD_PHYSICS hoặc TEACH|DEPARTMENT_HEAD_PHYSICS.");
                } else if (!data.get(PERMISSIONS).isBlank()) errors.add("permissions chỉ áp dụng cho STAFF.");
                if (!data.get(AVATAR_URL).isBlank() && (data.get(AVATAR_URL).length() > 2000 || !data.get(AVATAR_URL).matches("https?://[^\\s]+"))) errors.add("Ảnh đại diện cần URL http hoặc https hợp lệ.");
                if (dob != null) for (User existing : schoolUsers) {
                    if (dob.equals(existing.getDateOfBirth()) && identity(data.get(FULL_NAME), "").equals(identity(existing.getFullName(), "")))
                        matches.add(new SchoolImport.Match(existing.getId(), existing.getEmail(), existing.getFullName(), existing.getDateOfBirth()));
                }
                if (!matches.isEmpty()) warnings.add("Trùng họ tên và ngày sinh với tài khoản trong trường; vẫn tạo tài khoản mới khi email khác.");
                if (identityCounts.get(identity(data.get(FULL_NAME), data.get(DATE_OF_BIRTH))) > 1) warnings.add("Có dòng khác trong tệp cùng họ tên và ngày sinh.");
                if (userQuotaExceeded && RoleName.STUDENT.matches(data.get("role"))) errors.add("Số học sinh mới vượt hạn mức của trường.");
                if (data.get(CLASS_CODE).isBlank() != data.get(SCHOOL_YEAR).isBlank()) errors.add("Nhập cả classCode và schoolYear để xếp lớp hoặc phân công.");
            }
            if (request.kind() == SchoolImport.Kind.CLASSES) {
                requiredText(data.get(CLASS_CODE), 100, "Mã lớp", errors);
                validYear(data.get(SCHOOL_YEAR), errors);
                if (!Set.of("10", "11", "12").contains(data.get(GRADE_LEVEL))) errors.add("Khối phải là 10, 11 hoặc 12.");
                if (data.get(SUBJECT).length() > 50) errors.add("Môn học tối đa 50 ký tự.");
                if (classCounts.get(classKey(data.get(CLASS_CODE), data.get(SCHOOL_YEAR))) > 1) errors.add("Lớp và năm học trùng trong tệp.");
                if (classes.existsBySchoolIdAndNameIgnoreCaseAndSchoolYear(schoolId, data.get(CLASS_CODE), data.get(SCHOOL_YEAR))) errors.add("Lớp đã tồn tại trong năm học này.");
            } else if (!data.get(CLASS_CODE).isBlank() || request.kind() != SchoolImport.Kind.USERS) {
                requiredText(data.get(CLASS_CODE), 100, "Mã lớp", errors);
                validYear(data.get(SCHOOL_YEAR), errors);
                SchoolClass target = schoolClasses.stream().filter(item -> Boolean.TRUE.equals(item.getIsActive()) && item.getName().equalsIgnoreCase(data.get(CLASS_CODE)) && item.getSchoolYear().equals(data.get(SCHOOL_YEAR))).findFirst().orElse(null);
                if (target == null) errors.add("Không tìm thấy lớp đang hoạt động trong trường và năm học này.");
                boolean teacherRow = request.kind() == SchoolImport.Kind.TEACHER_ASSIGNMENTS
                        || request.kind() == SchoolImport.Kind.USERS && STAFF.equals(data.get("role"));
                if (teacherRow) {
                    if (teacherClassCounts.getOrDefault(classKey(data.get(CLASS_CODE), data.get(SCHOOL_YEAR)), 0L) > 1)
                        errors.add("Mỗi lớp chỉ được có một giáo viên; lớp có nhiều dòng phân công trong tệp.");
                    if (target != null && !assignments.findByClassIdAndIsActiveTrue(target.getId()).isEmpty())
                        errors.add("Lớp đã có giáo viên phụ trách. Hãy gỡ phân công hiện tại trước.");
                }
                if (request.kind() == SchoolImport.Kind.ENROLLMENTS || request.kind() == SchoolImport.Kind.TEACHER_ASSIGNMENTS) {
                    boolean student = request.kind() == SchoolImport.Kind.ENROLLMENTS;
                    String email = data.get(student ? STUDENT_EMAIL : TEACHER_EMAIL);
                    validEmail(email, errors);
                    User person = users.findFirstByEmailIgnoreCase(email).orElse(null);
                    if (person == null || person.getSchool() == null || !schoolId.equals(person.getSchool().getId())
                            || Boolean.FALSE.equals(person.getActive()) || !hasRole(person, student ? RoleName.STUDENT : RoleName.STAFF)) errors.add(student ? "Học sinh không hợp lệ trong trường này." : "Giáo viên không hợp lệ trong trường này.");
                    else if (target != null) {
                        if (!student && !accountAccess.canTeach(person)) errors.add("Tài khoản chưa có quyền giáo viên nên không thể phân công giảng dạy.");
                        if (student && enrollments.findActiveEnrollment(person.getId(), data.get(SCHOOL_YEAR)).isPresent()) errors.add("Học sinh đã được xếp lớp trong năm học này. Dùng chức năng chuyển lớp nếu cần.");
                        if (!student && assignments.existsBySchoolClassIdAndTeacherIdAndIsActiveTrue(target.getId(), person.getId())) errors.add("Giáo viên đã được phân công cho lớp này.");
                    }
                    String key = student ? email + "|" + data.get(SCHOOL_YEAR) : email + "|" + data.get(CLASS_CODE).toLowerCase(Locale.ROOT) + "|" + data.get(SCHOOL_YEAR);
                    if (emailCounts.get(key) > 1) errors.add(student ? "Học sinh có nhiều dòng trong cùng năm học." : "Phân công trùng trong tệp.");
                }
            }
            if (enrollmentQuotaExceeded && (request.kind() == SchoolImport.Kind.ENROLLMENTS || STUDENT.equals(data.get("role")) && !data.get(CLASS_CODE).isBlank())) errors.add("Số lượt xếp lớp vượt hạn mức của trường.");
            result.add(new SchoolImport.PreviewRow(row.row(), data, List.copyOf(errors), List.copyOf(warnings), List.copyOf(matches)));
        }
        int invalid = (int) result.stream().filter(row -> !row.errors().isEmpty()).count();
        String token = invalid == 0 ? signPreview(schoolId, actor, new SchoolImport.Request(request.kind(), normalized), Instant.now().getEpochSecond()) : null;
        return new SchoolImport.Preview(request.kind(), columns(request.kind()), List.copyOf(result), result.size() - invalid, invalid, invalid == 0, token);
    }

    private User requireAccess(UUID schoolId, SchoolImport.Kind kind) {
        columns(kind);
        User actor = currentUser.requireCurrentUser();
        boolean head = accountAccess.isDepartmentHead(actor) && actor.getSchool() != null && schoolId.equals(actor.getSchool().getId());
        if (!roles.canManageSchool(actor, schoolId) && !head) throw ApiException.forbidden("Không có quyền quản lý dữ liệu trường này.");
        if (kind == SchoolImport.Kind.CLASSES && !hasRole(actor, RoleName.SCHOOL)) throw ApiException.forbidden("Chỉ SCHOOL được tạo lớp học.");
        if (kind == SchoolImport.Kind.USERS && head) throw ApiException.forbidden("Trưởng bộ môn chỉ được xếp lớp và phân công giáo viên.");
        return actor;
    }

    private static void checkRequest(SchoolImport.Request request) {
        if (request == null || request.kind() == null || request.rows() == null || request.rows().isEmpty()) throw bad("Dữ liệu nhập chưa có dòng nào.");
        if (request.rows().size() > SchoolCsvParser.MAX_ROWS) throw bad("Mỗi lần nhập tối đa 200 dòng.");
        Set<Integer> rowNumbers = new HashSet<>();
        long bytes = 0;
        for (SchoolImport.Row row : request.rows()) {
            if (row == null || row.row() < 1 || !rowNumbers.add(row.row()) || row.data() == null) throw bad("Số dòng hoặc dữ liệu dòng không hợp lệ.");
            for (Map.Entry<String, String> entry : row.data().entrySet()) {
                if (!columns(request.kind()).contains(entry.getKey()) || entry.getValue() == null || entry.getValue().length() > 10_000 || entry.getValue().indexOf('\0') >= 0) throw bad("Cột hoặc ô dữ liệu không hợp lệ.");
                bytes += entry.getValue().getBytes(StandardCharsets.UTF_8).length;
            }
        }
        if (bytes > SchoolCsvParser.MAX_BYTES) throw bad("Dữ liệu nhập tối đa 1 MB.");
    }

    /** How many new class enrollments an import brings in. */
    private static long incomingEnrollments(SchoolImport.Kind kind, List<SchoolImport.Row> normalized) {
        if (kind == SchoolImport.Kind.ENROLLMENTS) return normalized.size();
        if (kind == SchoolImport.Kind.USERS) {
            return normalized.stream().filter(row -> STUDENT.equals(row.data().get("role")) && !row.data().get(CLASS_CODE).isBlank()).count();
        }
        return 0;
    }

    private static SchoolImport.Row normalize(SchoolImport.Kind kind, SchoolImport.Row row) {
        Map<String, String> data = new LinkedHashMap<>();
        for (String column : columns(kind)) {
            String value = row.data().getOrDefault(column, "");
            data.put(column, column.equals(INITIAL_PASSWORD) ? value : value.trim());
        }
        for (String column : List.of(EMAIL, STUDENT_EMAIL, TEACHER_EMAIL)) if (data.containsKey(column)) data.put(column, data.get(column).toLowerCase(Locale.ROOT));
        if (kind == SchoolImport.Kind.USERS) {
            data.put("role", data.get("role").toUpperCase(Locale.ROOT));
            java.util.Optional<List<String>> codes = permissionCodes(data.get(PERMISSIONS));
            data.put(PERMISSIONS, codes.map(written -> String.join("|", written)).orElse(""));
            if (RoleName.STAFF.matches(data.get("role")) && codes.isEmpty()) data.put(PERMISSIONS, PermissionCode.TEACH.name());
            if (data.get(INITIAL_PASSWORD).isBlank()) data.put(INITIAL_PASSWORD, "Pl!" + Base64.getUrlEncoder().withoutPadding().encodeToString(randomBytes(12)));
        }
        return new SchoolImport.Row(row.row(), data);
    }

    private SchoolClass findClass(UUID schoolId, String code, String year) {
        return classes.findBySchoolIdAndIsActiveTrue(schoolId).stream().filter(item -> Boolean.TRUE.equals(item.getIsActive()) && item.getName().equalsIgnoreCase(code) && item.getSchoolYear().equals(year)).findFirst()
                .orElseThrow(() -> bad("Lớp đã thay đổi. Hãy kiểm tra lại dữ liệu."));
    }
    private void lockReferences(UUID schoolId, SchoolImport.Request request) {
        if (request.kind() == SchoolImport.Kind.CLASSES) return;
        Set<String> classKeys = new HashSet<>();
        Set<String> emails = new HashSet<>();
        for (SchoolImport.Row row : request.rows()) {
            Map<String, String> data = row.data();
            if (!data.getOrDefault(CLASS_CODE, "").isBlank()) classKeys.add(classKey(data.get(CLASS_CODE), data.get(SCHOOL_YEAR)));
            if (request.kind() == SchoolImport.Kind.ENROLLMENTS) emails.add(data.get(STUDENT_EMAIL));
            if (request.kind() == SchoolImport.Kind.TEACHER_ASSIGNMENTS) emails.add(data.get(TEACHER_EMAIL));
        }
        if (!classKeys.isEmpty()) classes.findBySchoolIdAndIsActiveTrue(schoolId).stream().filter(item -> classKeys.contains(classKey(item.getName(), item.getSchoolYear())))
                .sorted(java.util.Comparator.comparing(SchoolClass::getId)).forEach(item -> entityManager.refresh(item, LockModeType.PESSIMISTIC_WRITE));
        emails.stream().map(users::findFirstByEmailIgnoreCase).flatMap(java.util.Optional::stream)
                .filter(item -> item.getSchool() != null && schoolId.equals(item.getSchool().getId()))
                .sorted(java.util.Comparator.comparing(User::getId)).forEach(item -> entityManager.refresh(item, LockModeType.PESSIMISTIC_WRITE));
    }
    private static void requireActiveSchool(School school) { if (!school.isActive()) throw ApiException.forbidden("Trường đã bị tạm khóa."); }
    private static boolean hasRole(User user, RoleName role) { return user != null && user.getRole() != null && role.matches(user.getRole().getName()); }
    private static String identity(String name, String dob) { return Normalizer.normalize(name == null ? "" : name, Normalizer.Form.NFC).trim().replaceAll("\\s+", " ").toLowerCase(Locale.ROOT) + "|" + (dob == null ? "" : dob); }
    private static String classKey(String code, String year) { return (code == null ? "" : code.toLowerCase(Locale.ROOT)) + "|" + year; }
    private static void requiredText(String value, int max, String label, List<String> errors) { if (value.isBlank() || value.length() > max) errors.add(label + " cần 1–" + max + " ký tự."); }
    private static void validEmail(String value, List<String> errors) { if (value.length() > 254 || !emailShape(value)) errors.add("Email không hợp lệ."); }

    /** name@domain.tld: exactly one "@" after a non-empty name, no whitespace, and at least two non-empty domain labels. */
    private static boolean emailShape(String value) {
        int at = value.indexOf('@');
        if (at <= 0 || value.indexOf('@', at + 1) >= 0 || value.chars().anyMatch(CodeText::regexSpace)) return false;
        String[] labels = value.substring(at + 1).split("\\.", -1);
        if (labels.length < 2) return false;
        for (String label : labels) {
            if (label.isEmpty()) return false;
        }
        return true;
    }

    private static LocalDate date(String value, List<String> errors) {
        try {
            if (!value.matches("\\d{4}-\\d{2}-\\d{2}")) throw new DateTimeParseException("format", value, 0);
            LocalDate date = LocalDate.parse(value);
            if (date.isAfter(LocalDate.now()) || date.isBefore(LocalDate.of(1900, 1, 1))) throw new DateTimeParseException("range", value, 0);
            return date;
        } catch (DateTimeParseException ex) { errors.add("Ngày sinh cần yyyy-MM-dd và không được ở tương lai."); return null; }
    }
    private static void validYear(String value, List<String> errors) {
        if (!value.matches("\\d{4}-\\d{4}") || Integer.parseInt(value.substring(5)) != Integer.parseInt(value.substring(0, 4)) + 1) errors.add("Năm học cần dạng 2026-2027 với hai năm liên tiếp.");
    }
    private static String blankToNull(String value) { return value == null || value.isBlank() ? null : value; }
    private static String csv(List<String> fields) { return String.join(",", fields.stream().map(value -> "\"" + value.replace("\"", "\"\"") + "\"").toList()); }
    private static final SecureRandom RANDOM = new SecureRandom();
    private static byte[] randomBytes(int size) { byte[] bytes = new byte[size]; RANDOM.nextBytes(bytes); return bytes; }

    // A short-lived signature binds the reviewed rows to this school and actor without storing passwords server-side.
    private String signPreview(UUID schoolId, User actor, SchoolImport.Request request, long issued) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256"); mac.init(new SecretKeySpec(previewSecret, "HmacSHA256"));
            mac.update((schoolId + "|" + actor.getId() + "|" + request.kind() + "|" + issued).getBytes(StandardCharsets.UTF_8));
            for (SchoolImport.Row row : request.rows()) {
                mac.update(("|" + row.row()).getBytes(StandardCharsets.UTF_8));
                for (String column : columns(request.kind())) {
                    byte[] value = row.data().getOrDefault(column, "").getBytes(StandardCharsets.UTF_8);
                    mac.update(("|" + value.length + ":").getBytes(StandardCharsets.UTF_8)); mac.update(value);
                }
            }
            return issued + "." + Base64.getUrlEncoder().withoutPadding().encodeToString(mac.doFinal());
        } catch (java.security.GeneralSecurityException ex) { throw new IllegalStateException("Cannot sign import preview", ex); }
    }
    private void requirePreview(UUID schoolId, User actor, SchoolImport.Request request) {
        try {
            String token = request.previewToken();
            if (token == null || token.length() > 100) throw new IllegalArgumentException();
            long issued = Long.parseLong(token.split("\\.", 2)[0]);
            long age = Instant.now().getEpochSecond() - issued;
            if (age < 0 || age > 900 || !MessageDigest.isEqual(token.getBytes(StandardCharsets.UTF_8), signPreview(schoolId, actor, request, issued).getBytes(StandardCharsets.UTF_8))) throw new IllegalArgumentException();
        } catch (IllegalArgumentException ex) { throw bad("Hãy kiểm tra dữ liệu trước khi nhập. Bản xem trước có hiệu lực 15 phút."); }
    }
    private static ApiException bad(String message) { return ApiException.badRequest(message); }
}
