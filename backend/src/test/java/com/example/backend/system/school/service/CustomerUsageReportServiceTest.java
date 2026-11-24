package com.example.backend.system.school.service;
import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.service.CurrentUserService;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class CustomerUsageReportServiceTest {
 final CurrentUserService current=mock(CurrentUserService.class);
 final NamedParameterJdbcTemplate jdbc=mock(NamedParameterJdbcTemplate.class);
 final CustomerUsageReportService service=new CustomerUsageReportService(current,jdbc);
 final User user=mock(User.class);
 @BeforeEach void setup(){when(current.requireCurrentUser()).thenReturn(user);role("MANAGER");when(user.getActive()).thenReturn(true);}
 void role(String name){Role role=new Role();role.setName(name);when(user.getRole()).thenReturn(role);}
 @Test void otherRolesAndSuspendedManagersCannotReadOrExport(){
  for(String role:List.of("ADMIN","SCHOOL","STAFF","STUDENT","REVIEWER")){role(role);assertThrows(ApiException.class,()->service.report(2026,null,"","","aiCalls","ALL",null,0,10));assertThrows(ApiException.class,()->service.csv(2026,null,"","","aiCalls","ALL"));}
  role("MANAGER");when(user.isSuspendedReadOnly()).thenReturn(true);assertThrows(ApiException.class,()->service.report(2026,null,"","","aiCalls","ALL",null,0,10));verifyNoInteractions(jdbc);
 }
 @Test void dateBoundsUseVietnamTimeAndRejectInvalidInput(){
  var ctx=service.prepare(2024,2," A ","","aiCalls","ALL",null);
  assertEquals(Instant.parse("2024-01-31T17:00:00Z"),((Timestamp)ctx.params().get("from")).toInstant());
  assertEquals(Instant.parse("2024-02-29T17:00:00Z"),((Timestamp)ctx.params().get("until")).toInstant());
  assertEquals("a",ctx.params().get("query"));
  assertThrows(ApiException.class,()->service.prepare(1999,null,"","","aiCalls","ALL",null));
  assertThrows(ApiException.class,()->service.prepare(2026,13,"","","aiCalls","ALL",null));
  assertThrows(ApiException.class,()->service.prepare(2026,null,"","","DROP TABLE","ALL",null));
  assertThrows(ApiException.class,()->service.prepare(2026,null,"","","aiCalls","INVALID",null));verifyNoInteractions(jdbc);
 }
 CustomerUsageReportService.Row row(int id,long calls,String attention,String name){return new CustomerUsageReportService.Row(new UUID(0,id),name,"S"+id,"STARTER",null,2,calls,1,2,100,1000,Instant.parse("2026-11-01T00:00:00Z"),attention,null,null,null);}
 @Test void totalsRankingAndCareUseFullFilteredSetRatherThanVisiblePage(){
  var rows=List.of(row(1,20,"NONE","A"),row(2,50,"IDLE","B"),row(3,30,"IDLE","C"));
  when(jdbc.query(anyString(),anyMap(),eq(CustomerUsageReportService.ROW))).thenReturn(rows);
  when(jdbc.queryForMap(anyString(),anyMap())).thenReturn(Map.of("users",3L,"first",Timestamp.from(Instant.parse("2026-01-01T00:00:00Z"))));
  when(jdbc.queryForList(anyString(),anyMap())).thenReturn(List.of());
  when(jdbc.queryForList(anyString(),anyMap(),eq(String.class))).thenReturn(List.of("STARTER"));
  var report=service.report(2026,null,"","","aiCalls","IDLE",null,99,1);
  assertEquals(2,report.summary().schools());assertEquals(80,report.summary().aiCalls());assertEquals(3,report.summary().activeUsers());
  assertEquals(2,report.totalElements());assertEquals(1,report.page());assertEquals("C",report.items().getFirst().name());assertEquals("B",report.ranking().getFirst().name());assertEquals(12,report.trend().size());
  assertEquals(2,report.attention().stream().filter(g->g.key().equals("IDLE")).findFirst().orElseThrow().count());
 }
 @Test void emptyLeapMonthHas29BucketsAndCsvEscapesFormulas(){
  when(jdbc.query(anyString(),anyMap(),eq(CustomerUsageReportService.ROW))).thenReturn(List.of());
  when(jdbc.queryForList(anyString(),anyMap(),eq(String.class))).thenReturn(List.of());
  var empty=service.report(2024,2,"","","aiCalls","ALL",null,10,0);assertEquals(29,empty.trend().size());assertEquals(1,empty.size());assertEquals(0,empty.page());assertNull(empty.firstRecordedAt());verify(jdbc,never()).queryForMap(anyString(),anyMap());
  when(jdbc.query(anyString(),anyMap(),eq(CustomerUsageReportService.ROW))).thenReturn(List.of(row(1,1,"NONE","=1+1")));
  String csv=new String(service.csv(2026,null,"","","revenue","ALL"),StandardCharsets.UTF_8);assertTrue(csv.startsWith("\uFEFF"));assertTrue(csv.contains("'=1+1"));assertTrue(csv.contains("Doanh thu đã thanh toán"));
 }
}
