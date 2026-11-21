package com.example.backend.system.school.service;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.school.model.entity.*;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
/** Runs against an isolated database; never loads application.properties or the project's env. */
@Testcontainers(disabledWithoutDocker = true)
class ClassAssignmentReportPostgresTest {
 @Container static final PostgreSQLContainer<?> POSTGRES=new PostgreSQLContainer<>("postgres:16-alpine");
 static JdbcTemplate sql; ClassAssignmentReportService service; final UUID classId=UUID.randomUUID();
 @BeforeAll static void schema(){sql=new JdbcTemplate(new DriverManagerDataSource(POSTGRES.getJdbcUrl(),POSTGRES.getUsername(),POSTGRES.getPassword()));sql.execute("CREATE TABLE users(id int primary key, full_name text)");sql.execute("CREATE TABLE assignments(id uuid primary key,school_class_id uuid,teacher_id int,title text,status text,assigned_at timestamptz,due_at timestamptz,allow_late_submission boolean,max_score numeric)");sql.execute("CREATE TABLE assignment_students(assignment_id uuid, student_id int)");sql.execute("CREATE TABLE assignment_submissions(assignment_id uuid,student_id int,completed_at timestamptz,score numeric,max_score numeric,retry_allowed boolean,grading_status text)");sql.update("INSERT INTO users VALUES (1,'Teacher A')");}
 @BeforeEach void data(){var current=mock(CurrentUserService.class);var grades=mock(SchoolClassGradeService.class);var actor=mock(User.class);Role role=new Role();role.setName("STAFF");School school=new School();school.setId(UUID.randomUUID());when(actor.getRole()).thenReturn(role);when(actor.getSchool()).thenReturn(school);when(actor.getActive()).thenReturn(true);when(actor.hasPermission(any())).thenReturn(true);when(current.requireCurrentUser()).thenReturn(actor);SchoolClass classroom=new SchoolClass();classroom.setName("10A1");classroom.setSchoolYear("2026-2027");when(grades.authorize(school.getId(),classId)).thenReturn(classroom);service=new ClassAssignmentReportService(grades,current,new NamedParameterJdbcTemplate(sql));}
 UUID lesson(String title,boolean late){UUID id=UUID.randomUUID();sql.update("INSERT INTO assignments VALUES (?, ?, 1, ?, 'ACTIVE', '2026-10-31 17:00:00Z', '2020-01-01T00:00:00Z', ?, 10)",id,classId,title,late);return id;}
 void recipient(UUID id,int student){sql.update("INSERT INTO assignment_students VALUES (?,?)",id,student);}
 void work(UUID id,int student,String completed,Integer score,int max,boolean retry,String status){sql.update("INSERT INTO assignment_submissions VALUES (?,?,CAST(? AS timestamptz),?,?,?,?)",id,student,completed,score,max,retry,status);}
 @Test void aggregatesOnlyRecipientsRetainsFormerWorkAndUsesFinalHandInAndOfficialScores(){
  UUID late=lesson("Bài thường",true);for(int i=1;i<=5;i++)recipient(late,i);
  work(late,1,"2021-01-01T00:00:00Z",8,10,false,"TEACHER_CONFIRMED");work(late,2,"2021-01-01T00:00:00Z",9,10,false,"AI_GRADED");
  work(late,3,null,null,10,false,"PENDING");work(late,4,null,null,10,true,"RETURNED");work(late,6,"2019-01-01T00:00:00Z",0,20,false,"TEACHER_CONFIRMED");
  UUID strict=lesson("Bài nghiêm",false);recipient(strict,1);recipient(strict,2);work(strict,2,null,0,10,false,"MISSED_DEADLINE");lesson("Không giao ai",true);
  var result=service.page(classId,"","ALL",null,null,0,1);var total=result.summary();assertEquals(3,total.assignments());assertEquals(8,total.recipients());assertEquals(3,total.submitted());assertEquals(5,total.notSubmitted());assertEquals(2,total.late());assertEquals(1,total.awaitingGrade());assertEquals(2,total.confirmed());assertEquals(2,total.missedDeadline());assertEquals(new BigDecimal("2.00"),total.average10());assertEquals(3,result.totalPages());
  var one=service.page(classId,"Bài thường","ALL",null,null,0,10).items().getFirst();assertEquals(6,one.recipients());assertEquals(new BigDecimal("4.00"),one.average10());
  var none=service.page(classId,"Không giao ai","ALL",null,null,0,10);assertNull(none.summary().average10());assertNull(none.summary().submissionRate());
  var start=java.time.LocalDate.of(2026,11,1);assertEquals(3,service.page(classId,"","ALL",start,start,0,10).totalElements());assertEquals(0,service.page(classId,"","ALL",start.plusDays(1),null,0,10).totalElements());
  String csv=new String(service.csv(classId,"","ALL",null,null),StandardCharsets.UTF_8);assertTrue(csv.startsWith("\uFEFF"));assertEquals(4,csv.lines().count());
 }
}
