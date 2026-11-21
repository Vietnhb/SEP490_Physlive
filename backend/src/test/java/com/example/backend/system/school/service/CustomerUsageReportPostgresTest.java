package com.example.backend.system.school.service;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.*;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.service.CurrentUserService;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
/** Isolated database only: never loads application config or production credentials. */
@Testcontainers(disabledWithoutDocker=true)
class CustomerUsageReportPostgresTest {
 @Container static final PostgreSQLContainer<?> PG=new PostgreSQLContainer<>("postgres:16-alpine");
 static JdbcTemplate db;
 static final UUID A=new UUID(0,1),B=new UUID(0,2),C=new UUID(0,3),CLASS=new UUID(1,1),ASSIGN=new UUID(2,1);
 @BeforeAll static void schema(){
  db=new JdbcTemplate(new DriverManagerDataSource(PG.getJdbcUrl(),PG.getUsername(),PG.getPassword()));
  db.execute("CREATE TABLE schools(id uuid,name text,code text,plan_code text,active boolean,license_end date,monthly_token_quota bigint)");
  db.execute("CREATE TABLE token_usage_audits(school_id uuid,user_id int,recorded_at timestamptz,tokens bigint)");
  db.execute("CREATE TABLE school_classes(id uuid,school_id uuid)");
  db.execute("CREATE TABLE assignments(id uuid,school_class_id uuid,teacher_id int,assigned_at timestamptz)");
  db.execute("CREATE TABLE assignment_submissions(assignment_id uuid,student_id int,completed_at timestamptz)");
  db.execute("CREATE TABLE school_payments(school_id uuid,status text,paid_at timestamptz,amount_vnd bigint,created_at timestamptz)");
  LocalDate today=LocalDate.now(CustomerUsageReportService.ZONE);
  db.update("INSERT INTO schools VALUES (?,'School A','A','STARTER',true,?,10000)",A,today.plusDays(10));
  db.update("INSERT INTO schools VALUES (?,'School B','B','ENTERPRISE',true,?,100)",B,today.plusYears(1));
  db.update("INSERT INTO schools VALUES (?,'School C','C',null,true,null,null)",C);
  db.update("INSERT INTO school_classes VALUES (?,?)",CLASS,A);
  db.update("INSERT INTO assignments VALUES (?,?,10,'2026-10-31T17:00:00Z')",ASSIGN,CLASS);
  db.update("INSERT INTO assignments VALUES (?,?,10,'2026-11-30T17:00:00Z')",new UUID(2,2),CLASS);
  db.update("INSERT INTO assignment_submissions VALUES (?,20,'2026-11-02T00:00:00Z'),(?,30,null)",ASSIGN,ASSIGN);
  db.update("INSERT INTO token_usage_audits VALUES (?,10,'2026-11-01T00:00:00Z',100),(?,10,'2026-11-02T00:00:00Z',200),(?,10,'2026-11-03T00:00:00Z',150)",A,A,B);
  db.update("INSERT INTO school_payments VALUES (?,'PAID','2026-11-04T00:00:00Z',350000000,'2025-01-01T00:00:00Z'),(?,'FAILED','2026-11-04T00:00:00Z',99999,'2026-11-04T00:00:00Z'),(?,'PAID',null,140000000,'2026-11-04T00:00:00Z')",A,A,A);
 }
 @Test void historyTotalsDoNotMultiplyAndUseVietnamBoundaries(){
  var current=mock(CurrentUserService.class);var actor=mock(User.class);var role=new Role();role.setName("MANAGER");when(current.requireCurrentUser()).thenReturn(actor);when(actor.getRole()).thenReturn(role);when(actor.getActive()).thenReturn(true);
  var service=new CustomerUsageReportService(current,new NamedParameterJdbcTemplate(db));
  var report=service.report(2026,11,"","","aiCalls","ALL",null,0,1);
  assertEquals(3,report.totalElements());assertEquals(3,report.summary().aiCalls());assertEquals(2,report.summary().activeUsers());assertEquals(1,report.summary().assignments());assertEquals(1,report.summary().submissions());assertEquals(450,report.summary().tokens());assertEquals(490000000,report.summary().revenue());assertEquals(490000000,report.trend().stream().mapToLong(CustomerUsageReportService.Point::revenue).sum());assertEquals(30,report.trend().size());
  assertEquals(A,report.ranking().getFirst().id());assertEquals(1,report.items().size());
  assertEquals(1,report.trend().getFirst().assignments());assertEquals(1,report.trend().get(1).submissions());
  assertEquals(1,service.report(2026,11,"","STARTER","aiCalls","ALL",null,0,10).totalElements());
  assertEquals(1,service.report(2026,11,"","","aiCalls","ALL",B,0,10).totalElements());
 }
}
