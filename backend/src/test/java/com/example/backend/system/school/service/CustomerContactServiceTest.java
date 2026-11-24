package com.example.backend.system.school.service;
import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.service.CurrentUserService;
import java.time.*;import java.util.*;
import org.junit.jupiter.api.*;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class CustomerContactServiceTest {
 final CurrentUserService current=mock(CurrentUserService.class);final NamedParameterJdbcTemplate jdbc=mock(NamedParameterJdbcTemplate.class);
 final CustomerContactService service=new CustomerContactService(current,jdbc);final UUID schoolId=UUID.randomUUID();final User actor=new User();
 @BeforeEach void setup(){var role=new Role();role.setName("MANAGER");actor.setId(7);actor.setFullName("Manager A");actor.setRole(role);actor.setActive(true);when(current.requireCurrentUser()).thenReturn(actor);}
 CustomerContactService.Save input(CustomerContactService.Outcome outcome,Instant at,Instant follow){return new CustomerContactService.Save(CustomerContactService.Channel.EMAIL,CustomerContactService.Reason.LICENSE,outcome,"  Đã gọi trường  ",at,follow);}
 void school(){when(jdbc.query(anyString(),anyMap(),eq(CustomerContactService.SCHOOL))).thenReturn(List.of(new CustomerContactService.SchoolInfo(schoolId,"School","S1","School Admin","school@example.com","0900000000")));}
 @Test void onlyActiveManagersCanReadAndWrite(){for(var name:List.of("ADMIN","SCHOOL","STAFF","STUDENT","REVIEWER")){actor.getRole().setName(name);assertThrows(ApiException.class,()->service.list(schoolId,0,10));assertThrows(ApiException.class,()->service.save(schoolId,input(CustomerContactService.Outcome.CONTACTED,Instant.now().minusSeconds(60),null)));}actor.getRole().setName("MANAGER");actor.setActive(false);assertThrows(ApiException.class,()->service.list(schoolId,0,10));actor.setActive(true);actor.setAccountStatus("SUSPENDED_READ_ONLY");assertThrows(ApiException.class,()->service.list(schoolId,0,10));verifyNoInteractions(jdbc);}
 @Test void rejectsInvalidDatesAndResolvedReminder(){var now=Instant.now();assertThrows(ApiException.class,()->service.save(schoolId,input(CustomerContactService.Outcome.CONTACTED,now.plusSeconds(60),null)));assertThrows(ApiException.class,()->service.save(schoolId,input(CustomerContactService.Outcome.WAITING,now.minusSeconds(60),now.minusSeconds(30))));assertThrows(ApiException.class,()->service.save(schoolId,input(CustomerContactService.Outcome.RESOLVED,now.minusSeconds(60),now.plusSeconds(3600))));verifyNoInteractions(jdbc);}
 @Test void missingSchoolCannotReceiveContact(){when(jdbc.query(anyString(),anyMap(),eq(CustomerContactService.SCHOOL))).thenReturn(List.of());assertThrows(ApiException.class,()->service.save(schoolId,input(CustomerContactService.Outcome.CONTACTED,Instant.now().minusSeconds(60),null)));verify(jdbc,never()).update(anyString(),anyMap());}
 @Test void savesActorRecipientAndReminderAsSnapshot(){school();var at=Instant.now().minusSeconds(60);var follow=Instant.now().plusSeconds(86400);var saved=service.save(schoolId,input(CustomerContactService.Outcome.WAITING,at,follow));assertEquals("Manager A",saved.actorName());assertEquals("school@example.com",saved.recipient());assertEquals("Đã gọi trường",saved.note());assertEquals(follow,saved.nextFollowUpAt());var params=ArgumentCaptor.forClass(Map.class);verify(jdbc).update(contains("INSERT INTO school_customer_contacts"),params.capture());assertEquals(7,params.getValue().get("actor"));assertEquals(schoolId,params.getValue().get("schoolId"));}
 @Test void historyIsScopedAndPageIsClamped(){school();when(jdbc.queryForObject(anyString(),anyMap(),eq(Long.class))).thenReturn(23L);when(jdbc.query(anyString(),anyMap(),eq(CustomerContactService.ENTRY))).thenReturn(List.of());var page=service.list(schoolId,99,10);assertEquals(2,page.page());assertEquals(3,page.totalPages());assertEquals(23,page.totalElements());var params=ArgumentCaptor.forClass(Map.class);verify(jdbc).query(contains("WHERE school_id=:schoolId ORDER BY"),params.capture(),eq(CustomerContactService.ENTRY));assertEquals(schoolId,params.getValue().get("schoolId"));assertEquals(20,params.getValue().get("offset"));}
 @Test void blankNoteCannotBeRecorded(){var save=new CustomerContactService.Save(CustomerContactService.Channel.PHONE,CustomerContactService.Reason.USAGE,CustomerContactService.Outcome.NO_ANSWER,"  ",Instant.now().minusSeconds(60),null);assertThrows(ApiException.class,()->service.save(schoolId,save));verifyNoInteractions(jdbc);}
}
