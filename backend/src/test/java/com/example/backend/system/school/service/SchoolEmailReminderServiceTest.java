package com.example.backend.system.school.service;
import com.example.backend.config.*;
import com.example.backend.exception.ApiException;
import com.example.backend.system.realtime.controller.RealtimeChangePublisher;
import java.time.*;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class SchoolEmailReminderServiceTest {
 final LocalDate today=LocalDate.of(2026,11,24);
 final NamedParameterJdbcTemplate jdbc=mock(NamedParameterJdbcTemplate.class);
 final CustomerContactService contacts=mock(CustomerContactService.class);
 final RealtimeChangePublisher changes=mock(RealtimeChangePublisher.class);
 final CustomerEmailProperties bridge=new CustomerEmailProperties(true,"https://mail.example.org","x".repeat(32),"secret");
 SchoolEmailReminderService service(boolean enabled){return new SchoolEmailReminderService(bridge,new SchoolEmailReminderProperties(enabled,"https://physlive.example.org"),jdbc,changes,contacts);}
 SchoolEmailReminderService.School school(LocalDate end,long used,Long quota){return new SchoolEmailReminderService.School(UUID.randomUUID(),"Test School","school@example.org",true,today.minusMonths(1),end,today.withDayOfMonth(1),used,quota);}
 @Test void licenceThresholdsAndEndDateInclusive(){
  for(int days:new int[]{30,8,7,2,1,0,-1}){
   var due=SchoolEmailReminderService.due(school(today.plusDays(days),0,null),today);assertEquals(1,due.size());
   int mark=days<0?0:days<=1?1:days<=7?7:30;assertTrue(due.getFirst().key().endsWith(":"+mark));
   assertEquals(days<0,due.getFirst().title().contains("đã hết hạn"));
  }
  assertTrue(SchoolEmailReminderService.due(school(today.plusDays(31),0,null),today).isEmpty());
  assertTrue(SchoolEmailReminderService.due(school(today.minusDays(2),0,null),today).isEmpty());
 }
 @Test void quotaUsesHighestCurrentThresholdOnly(){
  for(long usage:new long[]{79999,80000,94999,95000,100000,120000}){
   var due=SchoolEmailReminderService.due(school(today.plusMonths(6),usage,100000L),today);
   if(usage<80000)assertTrue(due.isEmpty());else{assertEquals(1,due.size());assertTrue(due.getFirst().key().endsWith(":"+(usage>=100000?100:usage>=95000?95:80)));}
  }
 }
 @Test void unlimitedAndMonthlyResetDoNotWarn(){
  assertTrue(SchoolEmailReminderService.due(school(today.plusMonths(6),999999,null),today).isEmpty());
  var old=school(today.plusMonths(6),95000,100000L);
  assertTrue(SchoolEmailReminderService.due(old,today.plusMonths(1)).isEmpty());
 }
 @Test void keyChangesAfterRenewalOrNewMonth(){
  var a=SchoolEmailReminderService.due(school(today.plusDays(5),0,null),today).getFirst();
  var b=SchoolEmailReminderService.due(school(today.plusDays(6),0,null),today).getFirst();assertNotEquals(a.key(),b.key());
 }
 @Test void inactiveUpcomingUnlicensedSchoolsDoNotSend(){
  var base=school(today.plusDays(5),95000,100000L);
  assertTrue(SchoolEmailReminderService.due(new SchoolEmailReminderService.School(base.id(),base.name(),base.recipient(),false,base.start(),base.end(),base.usageMonth(),base.used(),base.quota()),today).isEmpty());
  assertTrue(SchoolEmailReminderService.due(new SchoolEmailReminderService.School(base.id(),base.name(),base.recipient(),true,today.plusDays(1),base.end(),base.usageMonth(),base.used(),base.quota()),today).isEmpty());
  assertTrue(SchoolEmailReminderService.due(school(null,95000,100000L),today).isEmpty());
 }
 @Test void disabledSchedulerNeverQueriesOrEnqueues(){service(false).check();verifyNoInteractions(jdbc,changes);}
 @Test void schedulerUsesAtomicDedupeAndSystemSender(){
  var now=LocalDate.now(SchoolEmailReminderService.ZONE);var school=school(now.plusDays(5),0,null);
  when(jdbc.query(anyString(),anyMap(),org.mockito.ArgumentMatchers.<RowMapper<SchoolEmailReminderService.School>>any())).thenReturn(List.of(school));
  when(jdbc.update(anyString(),anyMap())).thenReturn(1);service(true).check();
  verify(jdbc).update(contains("ON CONFLICT(school_id,reminder_key)"),argThat((Map<String,?> p)->p.get("to").equals(school.recipient())&&p.get("body").toString().contains("https://physlive.example.org/school/billing")&&p.get("key").toString().startsWith("LICENSE:")));
  verify(changes).changed("/api/reports/customer-usage");
 }
 @Test void renewedSchoolSkipsStaleUnsentEmail(){
  var now=LocalDate.now(SchoolEmailReminderService.ZONE);var renewed=school(now.plusMonths(6),0,null);
  when(jdbc.query(anyString(),anyMap(),org.mockito.ArgumentMatchers.<RowMapper<SchoolEmailReminderService.School>>any())).thenReturn(List.of(renewed));
  assertFalse(service(true).shouldSend(Map.of("reminder_key","LICENSE:"+now.plusDays(5)+":7","school_id",renewed.id(),"recipient",renewed.recipient(),"attempts",1)));
 }
 @Test void oldManualDraftCannotSendAndUnknownResultKeepsSamePayload(){
  assertFalse(service(true).shouldSend(Map.of("attempts",1)));
  assertTrue(service(true).shouldSend(Map.of("reminder_key","AI_QUOTA:2026-11-01:95","attempts",2)));
  verifyNoInteractions(jdbc);
 }
 @Test void managerCannotSendOrRetryEvenByCallingApiDirectly(){
  var service=new CustomerEmailService(contacts,jdbc,bridge,changes);
  assertThrows(ApiException.class,()->service.compose(UUID.randomUUID(),null));
  assertThrows(ApiException.class,()->service.retry(UUID.randomUUID(),UUID.randomUUID()));verifyNoInteractions(jdbc,changes);
 }
 @Test void publicApplicationUrlMustBeValid(){assertFalse(new SchoolEmailReminderProperties(true,"").validUrl());assertFalse(new SchoolEmailReminderProperties(true,"javascript:alert(1)").validUrl());assertTrue(new SchoolEmailReminderProperties(true,"http://localhost:5173").validUrl());}
 @Test void configurationBindsCommaSeparatedDemoScope(){
  var source=new org.springframework.boot.context.properties.source.MapConfigurationPropertySource(Map.of("physlive.school-email-reminders.enabled","true","physlive.school-email-reminders.application-url","http://localhost:5173","physlive.school-email-reminders.school-codes","DEMO_ALERT_EXPIRY_2026,DEMO_ALERT_AI_2026"));
  var bound=new org.springframework.boot.context.properties.bind.Binder(source).bind("physlive.school-email-reminders",org.springframework.boot.context.properties.bind.Bindable.of(SchoolEmailReminderProperties.class)).get();
  assertTrue(bound.enabled());assertEquals(List.of("DEMO_ALERT_EXPIRY_2026","DEMO_ALERT_AI_2026"),bound.schoolCodes());
 }
}
