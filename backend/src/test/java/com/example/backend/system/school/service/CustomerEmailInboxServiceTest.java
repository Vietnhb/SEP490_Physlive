package com.example.backend.system.school.service;
import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.realtime.controller.RealtimeChangePublisher;
import java.time.LocalDate;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
class CustomerEmailInboxServiceTest {
 final CustomerContactService contacts=mock(CustomerContactService.class);
 final NamedParameterJdbcTemplate jdbc=mock(NamedParameterJdbcTemplate.class);
 final RealtimeChangePublisher changes=mock(RealtimeChangePublisher.class);
 final CustomerEmailInboxService service=new CustomerEmailInboxService(contacts,jdbc,changes);
 CustomerEmailInboxServiceTest(){var actor=new User();actor.setId(7);when(contacts.manager()).thenReturn(actor);}
 @Test void rejectsUnknownFiltersAndReversedDates(){
  assertThrows(ApiException.class,()->service.list("","INVALID","",null,null,null,0,10));
  assertThrows(ApiException.class,()->service.list("","ALL","INVALID",null,null,null,0,10));
  assertThrows(ApiException.class,()->service.list("","ALL","",null,LocalDate.of(2026,12,1),LocalDate.of(2026,1,1),0,10));verifyNoInteractions(jdbc);
 }
 @Test void permissionIsCheckedBeforeReadingAnyMail(){when(contacts.manager()).thenThrow(ApiException.forbidden("Denied"));assertThrows(ApiException.class,()->service.notifications());verifyNoInteractions(jdbc);}
 @Test void readIsRestrictedToOriginalSenderOrSystemMailAndOnlyDisplayedReplyIds(){
  UUID email=UUID.randomUUID(),reply=UUID.randomUUID();when(jdbc.update(anyString(),anyMap())).thenReturn(1);
  service.read(email,new CustomerEmailInboxService.Read(List.of(reply)));
  verify(jdbc).update(contains("(e.actor_id=:actor OR e.actor_id IS NULL) AND r.id IN(:ids)"),argThat((Map<String,?> p)->p.get("actor").equals(7)&&p.get("email").equals(email)&&p.get("ids").equals(List.of(reply))));
  verify(changes).changed("/api/reports/customer-usage/email-inbox");
 }
 @Test void duplicateReadDoesNotPublishAnotherEvent(){when(jdbc.update(anyString(),anyMap())).thenReturn(0);service.read(UUID.randomUUID(),new CustomerEmailInboxService.Read(List.of(UUID.randomUUID())));verifyNoInteractions(changes);}
 @Test void emptyReadDoesNotWriteAndOversizedOrNullIdsAreRejected(){
  service.read(UUID.randomUUID(),new CustomerEmailInboxService.Read(List.of()));
  assertThrows(ApiException.class,()->service.read(UUID.randomUUID(),new CustomerEmailInboxService.Read(Collections.nCopies(21,UUID.randomUUID()))));
  assertThrows(ApiException.class,()->service.read(UUID.randomUUID(),new CustomerEmailInboxService.Read(Arrays.asList((UUID)null))));verifyNoInteractions(jdbc);
 }
}
