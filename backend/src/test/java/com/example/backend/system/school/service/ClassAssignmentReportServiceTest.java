package com.example.backend.system.school.service;
import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.school.model.entity.*;
import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class ClassAssignmentReportServiceTest {
 final SchoolClassGradeService grades=mock(SchoolClassGradeService.class);
 final CurrentUserService current=mock(CurrentUserService.class);
 final NamedParameterJdbcTemplate jdbc=mock(NamedParameterJdbcTemplate.class);
 final ClassAssignmentReportService service=new ClassAssignmentReportService(grades,current,jdbc);
 final UUID classId=UUID.randomUUID(),schoolId=UUID.randomUUID(); final User actor=mock(User.class);
 ClassAssignmentReportServiceTest(){Role role=new Role();role.setName("STAFF");School school=new School();school.setId(schoolId);when(actor.getRole()).thenReturn(role);when(actor.getSchool()).thenReturn(school);when(actor.getActive()).thenReturn(true);when(actor.hasPermission(any())).thenReturn(true);when(current.requireCurrentUser()).thenReturn(actor);SchoolClass classroom=new SchoolClass();classroom.setName("10A1");classroom.setSchoolYear("2026-2027");when(grades.authorize(schoolId,classId)).thenReturn(classroom);}
 @Test void rejectsNonTeachingSuspendedAndTransferredTeachersBeforeQueries(){
  when(actor.hasPermission(any())).thenReturn(false);assertThrows(ApiException.class,()->service.page(classId,"","ALL",null,null,0,10));
  when(actor.hasPermission(any())).thenReturn(true);when(actor.isSuspendedReadOnly()).thenReturn(true);assertThrows(ApiException.class,()->service.csv(classId,"","ALL",null,null));
  when(actor.isSuspendedReadOnly()).thenReturn(false);when(grades.authorize(schoolId,classId)).thenThrow(ApiException.forbidden("not assigned"));assertThrows(ApiException.class,()->service.page(classId,"","ALL",null,null,0,10));verifyNoInteractions(jdbc);
 }
 @Test void validatesFiltersBeforeReading(){assertThrows(ApiException.class,()->service.page(classId,"","BROKEN",null,null,0,10));assertThrows(ApiException.class,()->service.page(classId,"x".repeat(161),"ALL",null,null,0,10));assertThrows(ApiException.class,()->service.page(classId,"","ALL",LocalDate.of(2026,11,20),LocalDate.of(2026,11,1),0,10));verifyNoInteractions(jdbc);}
 @Test @SuppressWarnings("unchecked") void boundsPagesUsesVietnameseDayBoundariesAndWholeFilterSummary(){
  var totals=new ClassAssignmentReportService.Totals(23,100,50,50,4,20,30,2,new BigDecimal("6.25"),new BigDecimal("50.0"));
  when(jdbc.queryForObject(anyString(),anyMap(),any(RowMapper.class))).thenReturn(totals);
  when(jdbc.query(anyString(),anyMap(),any(RowMapper.class))).thenAnswer(call->{Map<String,Object> p=call.getArgument(1);assertEquals(50,p.get("limit"));assertEquals(0L,p.get("offset"));assertEquals("test",p.get("query"));assertEquals(Instant.parse("2026-10-31T17:00:00Z"),((Timestamp)p.get("from")).toInstant());assertEquals(Instant.parse("2026-11-30T17:00:00Z"),((Timestamp)p.get("until")).toInstant());return List.of();});
  var page=service.page(classId," TEST ","ACTIVE",LocalDate.of(2026,11,1),LocalDate.of(2026,11,30),999,1000);assertEquals(0,page.page());assertEquals(50,page.size());assertEquals(totals,page.summary());assertEquals(23,page.totalElements());
 }
 @Test @SuppressWarnings("unchecked") void emptyResultSkipsRowQuery(){when(jdbc.queryForObject(anyString(),anyMap(),any(RowMapper.class))).thenReturn(new ClassAssignmentReportService.Totals(0,0,0,0,0,0,0,0,null,null));var result=service.page(classId,"","ALL",null,null,-1,0);assertEquals(0,result.page());assertEquals(1,result.size());assertEquals(1,result.totalPages());assertTrue(result.items().isEmpty());verify(jdbc,never()).query(anyString(),anyMap(),any(RowMapper.class));}
 @Test void officialAverageIncludesZeroAndCsvPreventsFormulaInjection(){assertNull(ClassAssignmentReportService.average(BigDecimal.ZERO,0));assertEquals(new BigDecimal("4.00"),ClassAssignmentReportService.average(new BigDecimal("8"),2));assertEquals(new BigDecimal("33.3"),ClassAssignmentReportService.percent(1,3));StringBuilder out=new StringBuilder();ClassAssignmentReportService.csvRow(out,"=CMD()","Bài \"A\"\nDòng 2",null);assertEquals("\"'=CMD()\",\"Bài \"\"A\"\"\nDòng 2\",\"\"\r\n",out.toString());}
}
