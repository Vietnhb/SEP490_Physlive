package com.example.backend.performance;

import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.*;
import com.example.backend.system.account.service.*;
import com.example.backend.system.school.model.entity.*;
import com.example.backend.system.school.repository.*;
import com.example.backend.system.school.service.*;
import com.example.backend.system.support.model.entity.SupportItem;
import com.example.backend.system.support.model.enums.SupportKind;
import com.example.backend.system.support.repository.SupportItemRepository;
import com.example.backend.system.support.service.*;
import com.example.backend.system.library.repository.LibraryItemRepository;
import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.domain.EntityScan;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.repository.config.EnableJpaRepositories;
import org.springframework.test.context.ContextConfiguration;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(showSql = false, properties = {"logging.level.root=ERROR", "logging.level.org.hibernate.engine.internal.StatisticalLoggingSessionEventListener=OFF","spring.config.import=optional:classpath:/performance-no-env.properties", "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create", "spring.jpa.properties.hibernate.generate_statistics=true", "spring.jpa.show-sql=false"})
@org.springframework.test.annotation.DirtiesContext(classMode = org.springframework.test.annotation.DirtiesContext.ClassMode.AFTER_CLASS)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@ContextConfiguration(classes = PerformanceReadIntegrationTest.Persistence.class)
@Testcontainers(disabledWithoutDocker = true)
class PerformanceReadIntegrationTest {
    @Configuration
    @EntityScan("com.example.backend")
    @EnableJpaRepositories("com.example.backend")
    static class Persistence { }
    @Container static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");
    @DynamicPropertySource static void database(DynamicPropertyRegistry properties) {
        properties.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        properties.add("spring.datasource.username", POSTGRES::getUsername);
        properties.add("spring.datasource.password", POSTGRES::getPassword);
    }
    @Autowired EntityManager em;
    @Autowired UserRepository users;
    @Autowired RoleRepository roles;
    @Autowired SchoolRepository schools;
    @Autowired SchoolClassRepository classes;
    @Autowired ClassEnrollmentRepository enrollments;
    @Autowired ClassTeacherAssignmentRepository teachers;
    @Autowired SchoolPaymentRepository payments;
    @Autowired LibraryItemRepository library;
    @Autowired com.example.backend.system.simulation.repository.SimulationRunRepository runs;
    @Autowired AccountAppealRepository appeals;
    @Autowired SupportItemRepository support;
    CurrentUserService current;
    RoleValidationService validation;
    School school, other;
    User actor;
    @BeforeEach void setup() {
        current = mock(CurrentUserService.class); validation = mock(RoleValidationService.class);
        school = school("School A"); other = school("School B");
        actor = user("school", "SCHOOL", school);
        when(current.requireCurrentUser()).thenReturn(actor);
        when(validation.canManageSchool(eq(actor), any())).thenReturn(true);
    }
    School school(String name) { School s = new School(); s.setName(name); s.setCode(name); return schools.save(s); }
    User user(String name, String roleName, School s) {
        Role role = roles.findByName(roleName).orElseGet(() -> { Role r = new Role(); r.setName(roleName); return roles.save(r); });
        User u = new User(); u.setFullName(name); u.setEmail(name + "@test.invalid"); u.setPassword("test-hash"); u.setRole(role); u.setSchool(s);
        return users.save(u);
    }
    SchoolClass classroom(School s, String name) {
        SchoolClass c = new SchoolClass(); c.setSchool(s); c.setName(name); c.setSchoolYear("2026-2027"); c.setGradeLevel(10); return classes.save(c);
    }
    AdminService admin() { return new AdminService(users, roles, mock(org.springframework.security.crypto.password.PasswordEncoder.class), current,
            validation, mock(AccountAccessService.class), mock(LicenseCheckService.class), schools, em); }
    SupportInboxService inbox() {
        var account = new AccountAppealService(appeals, users, current, admin(), mock(com.example.backend.system.realtime.controller.RealtimeChangePublisher.class));
        var help = new SupportService(support, current, mock(AccountAccessService.class));
        return new SupportInboxService(em, current, help, account);
    }
    void appeal(User u, School s, String scope) {
        u.setActive(false); u.setAccountStatus("SUSPENDED_READ_ONLY"); u.setSuspensionId(UUID.randomUUID()); u.setSuspensionScope(scope);
        AccountAppeal a = new AccountAppeal(); a.setUser(u); a.setReason("Open account " + u.getFullName()); a.setContent("Details");
        a.setSchoolId(s.getId()); a.setSuspensionScope(scope); a.setSuspensionId(u.getSuspensionId()); appeals.save(a);
    }
    @Test void classCountsUseBoundedQueriesAndDoNotMultiplyStudentsByTeachers() {
        User teacher = user("teacher", "STAFF", school), student = user("student", "STUDENT", school);
        for (int index = 0; index < 25; index++) {
            var c = classroom(school, "Class " + index);
            var link = new ClassTeacherAssignment(); link.setSchoolClass(c); link.setTeacher(teacher); teachers.save(link);
            var e = new ClassEnrollment(); e.setSchoolClass(c); e.setStudent(student); e.setSchoolYear("2026-2027"); enrollments.save(e);
        }
        classroom(other, "Must not appear"); em.flush(); em.clear();
        var stats = em.getEntityManagerFactory().unwrap(org.hibernate.SessionFactory.class).getStatistics(); stats.clear();
        var service = new SchoolClassService(classes, enrollments, teachers, schools, users, current, validation,
                mock(LicenseCheckService.class), mock(AccountAccessService.class), em,
                mock(com.example.backend.system.assignment.repository.AssignmentRepository.class));
        var rows = service.list(school.getId());
        assertEquals(25, rows.size());
        assertTrue(rows.stream().allMatch(row -> row.teacherCount() == 1 && row.studentCount() == 1));
        System.out.println("PERFORMANCE_CLASS_LIST_QUERIES=" + stats.getPrepareStatementCount() + " for 25 classes");
        assertTrue(stats.getPrepareStatementCount() <= 6, "Query count grew with the number of classes: " + stats.getPrepareStatementCount());
    }

    @Test void profileClassesAreScopedAndExcludeInactiveClassesAndFormerMemberships() {
        User teacher = user("profileTeacher", "STAFF", school), student = user("profileStudent", "STUDENT", school);
        var active = classroom(school, "10A1");
        var second = classroom(school, "11A1");
        var archived = classroom(school, "Archived"); archived.setIsActive(false);
        var former = classroom(school, "Former");
        var foreign = classroom(other, "Foreign");
        for (var classroom : List.of(active, second, archived, former, foreign)) {
            var assignment = new ClassTeacherAssignment(); assignment.setSchoolClass(classroom); assignment.setTeacher(teacher);
            assignment.setIsActive(classroom != former); teachers.save(assignment);
            var enrollment = new ClassEnrollment(); enrollment.setSchoolClass(classroom); enrollment.setStudent(student);
            enrollment.setSchoolYear("2026-2027");
            if (classroom == former) enrollment.setStatus(ClassEnrollment.EnrollmentStatus.TRANSFERRED);
            enrollments.save(enrollment);
        }
        em.flush();
        var profileService = new SchoolAccountProfileService(current, users, classes);
        assertEquals(List.of("10A1", "11A1"), profileService.profile(school.getId(), teacher.getId()).classes().stream().map(item -> item.name()).toList());
        assertEquals(List.of("10A1", "11A1"), profileService.profile(school.getId(), student.getId()).classes().stream().map(item -> item.name()).toList());
    }
    @Test void accountFilteringAndCountsAreAppliedBeforePaging() {
        for (int i = 0; i < 16; i++) user("student" + i, "STUDENT", school);
        user("outside", "STUDENT", other); user("teacher", "STAFF", school);
        em.flush();
        var result = admin().usersPage(school.getId(), 1, 10, "", "STUDENT", "ALL", "");
        assertEquals(16, result.totalElements()); assertEquals(6, result.items().size()); assertEquals(18, result.counts().get("total"));
        var schoolAccount = admin().usersPage(school.getId(), 0, 10, "", "SCHOOL", "ALL", "");
        assertEquals(1, schoolAccount.totalElements()); assertEquals(actor.getId(), schoolAccount.items().getFirst().id());
        var firstPage = admin().usersPage(school.getId(), 0, 10, "", "ALL", "ALL", "");
        assertEquals(actor.getId(), firstPage.items().getFirst().id());
        assertTrue(admin().usersPage(school.getId(), 1, 10, "", "ALL", "ALL", "").items().stream().noneMatch(item -> item.id().equals(actor.getId())));
        var searched = admin().usersPage(school.getId(), 0, 10, "student15", "STUDENT", "ALL", "");
        assertEquals(1, searched.totalElements());
        assertEquals(0, admin().usersPage(school.getId(), 0, 10, "outside", "ALL", "ALL", "").totalElements());
    }
    @Test void schoolInboxCannotReadAnotherSchoolAndManagerOwnerFilterPrecedesPagination() {
        var a = user("studentA", "STUDENT", school); var b = user("studentB", "STUDENT", other);
        appeal(a, school, "SCHOOL"); appeal(b, other, "SCHOOL"); em.flush();
        var own = inbox().page(0, 10, "ALL", "ALL", "ALL", "");
        assertEquals(1, own.totalElements()); assertEquals(a.getId(), own.appeals().getFirst().userId());
        assertEquals(1, inbox().pendingCount());
        actor = user("manager", "MANAGER", null); when(current.requireCurrentUser()).thenReturn(actor);
        SupportItem item = new SupportItem(); item.setSender(a); item.setKind(SupportKind.COMPLAINT); item.setSubject("Simulation issue"); item.setContent("Details"); support.save(item); em.flush();
        assertEquals(2, inbox().page(0, 1, "ALL", "SCHOOL", "ALL", "").totalElements());
        assertEquals(1, inbox().page(0, 1, "ALL", "REVIEWER", "ALL", "").totalElements());
        assertEquals(0, inbox().pendingCount());
    }
    @Test void paymentPageUsesPaidAtAndKeepsAggregateTotalsIndependentOfPage() {
        var now = Instant.parse("2026-11-09T00:00:00Z");
        for (int i = 0; i < 12; i++) {
            var p = new SchoolPayment(); p.setSchool(school); p.setManager(actor); p.setPlanCode("STARTER"); p.setAmountVnd(100L);
            p.setStatus("PAID"); p.setCreatedAt(now.minusSeconds(86400)); p.setPaidAt(now); payments.save(p);
        }
        em.flush();
        var rows = payments.findAdminPage(now.minusSeconds(1), now.plusSeconds(1), "PAID", "%", PageRequest.of(0, 10));
        assertEquals(12, rows.getTotalElements()); assertEquals(10, rows.getContent().size());
        assertEquals(1200, payments.summarizeRevenue().getGrossPaidVnd());
        assertEquals(1200, payments.dashboardPlans().getFirst().getAmount());
        assertEquals(3, payments.dashboardRecent(PageRequest.of(0, 3)).size());
        assertEquals(0, runs.readValidationPage(PageRequest.of(0, 10)).getTotalElements());
        var totals = payments.dashboardTotals(now.plusSeconds(1), now.minusSeconds(86400 * 7), now.minusSeconds(86400 * 30),
                now.minusSeconds(86400 * 7), now.minusSeconds(86400 * 14), now.minusSeconds(86400 * 21));
        assertEquals(1200, totals.getTotalVnd()); assertEquals(12, totals.getPaidCount());
        assertEquals(0, library.dashboardPosts(now, now, now, now, now, now, now).getCumTotal());
    }
    @Test void classPagePreservesAccentInsensitiveSearchFiltersAndYears() {
        classroom(school, "Vật lý 10A1"); var inactive = classroom(school, "Archived"); inactive.setIsActive(false);
        var next = classroom(school, "Next year"); next.setSchoolYear("2027-2028");
        classroom(other, "Vật lý outside"); em.flush();
        var service = new SchoolClassService(classes, enrollments, teachers, schools, users, current, validation,
                mock(LicenseCheckService.class), mock(AccountAccessService.class), em,
                mock(com.example.backend.system.assignment.repository.AssignmentRepository.class));
        var filtered = service.page(school.getId(), 0, 10, 10, "2026-2027", "ACTIVE", "vat ly");
        assertEquals(1, filtered.totalElements()); assertEquals(List.of("2027-2028", "2026-2027"), filtered.years());
        assertEquals(1, service.page(school.getId(), 0, 10, null, "ALL", "INACTIVE", "").totalElements());
    }
    @Test void invalidPageCannotRequestUnboundedData() {
        assertThrows(com.example.backend.exception.ApiException.class, () -> admin().usersPage(school.getId(), 0, 1000, "", "ALL", "ALL", ""));
    }
}
