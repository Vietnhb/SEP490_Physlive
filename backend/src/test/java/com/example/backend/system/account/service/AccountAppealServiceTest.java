package com.example.backend.system.account.service;
import com.example.backend.exception.ApiException;
import com.example.backend.system.account.dto.AppealContracts.*;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.*;
import com.example.backend.system.school.model.entity.School;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
class AccountAppealServiceTest {
 final AccountAppealRepository appeals=mock(AccountAppealRepository.class);
 final UserRepository users=mock(UserRepository.class);
 final CurrentUserService current=mock(CurrentUserService.class);
 final AdminService admin=mock(AdminService.class);
 final AccountAppealService service=new AccountAppealService(appeals,users,current,admin);
 final UUID schoolId=UUID.randomUUID();
 User user(int id,String role){User u=new User();u.setId(id);u.setEmail(id+"@test.com");Role rr=new Role();rr.setName(role);u.setRole(rr);School s=new School();s.setId(schoolId);u.setSchool(s);u.setActive(true);return u;}
 AccountAppeal pending(String scope){User u=user(2,"STUDENT");u.setActive(false);u.setSuspensionId(UUID.randomUUID());u.setSuspensionScope(scope);AccountAppeal a=new AccountAppeal();a.setId(UUID.randomUUID());a.setUser(u);a.setSuspensionId(u.getSuspensionId());a.setSuspensionScope(scope);a.setSchoolId(schoolId);when(appeals.findByIdForUpdate(a.getId())).thenReturn(Optional.of(a));when(users.findByIdForUpdate(2)).thenReturn(Optional.of(u));when(appeals.save(any())).thenAnswer(c->c.getArgument(0));return a;}
 ResolveAppealRequest approve(){return new ResolveAppealRequest("APPROVED","Đã kiểm tra thông tin.");}
 @Test void schoolDecidesOnlyItsSchoolSuspensions(){var a=pending("SCHOOL");when(current.requireCurrentUser()).thenReturn(user(1,"SCHOOL"));assertEquals("APPROVED",service.resolveAppeal(a.getId(),approve()).status());verify(admin).setActive(2,true);}
 @Test void schoolCannotResolveSystemSuspensions(){var a=pending("SYSTEM");when(current.requireCurrentUser()).thenReturn(user(1,"SCHOOL"));assertThrows(ApiException.class,()->service.resolveAppeal(a.getId(),approve()));verifyNoInteractions(admin);}
 @Test void differentSchoolCannotSeeOrResolve(){var a=pending("SCHOOL");User actor=user(1,"SCHOOL");actor.getSchool().setId(UUID.randomUUID());when(current.requireCurrentUser()).thenReturn(actor);when(appeals.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(a));assertTrue(service.allAppeals().isEmpty());assertThrows(ApiException.class,()->service.resolveAppeal(a.getId(),approve()));}
 @Test void managerSeesSchoolAppealButCannotDecide(){var a=pending("SCHOOL");when(current.requireCurrentUser()).thenReturn(user(1,"MANAGER"));when(appeals.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(a));assertFalse(service.allAppeals().getFirst().canResolve());assertThrows(ApiException.class,()->service.resolveAppeal(a.getId(),approve()));verifyNoInteractions(admin);}
 @Test void managerCanResolveSystemLock(){var a=pending("SYSTEM");when(current.requireCurrentUser()).thenReturn(user(1,"MANAGER"));when(appeals.findAllByOrderByCreatedAtDesc()).thenReturn(List.of(a));assertTrue(service.allAppeals().getFirst().canResolve());assertEquals("APPROVED",service.resolveAppeal(a.getId(),approve()).status());verify(admin).setActive(2,true);}
 @Test void staleAppealCannotUnlockNewSuspension(){var a=pending("SYSTEM");a.getUser().setSuspensionId(UUID.randomUUID());when(current.requireCurrentUser()).thenReturn(user(1,"MANAGER"));assertThrows(ApiException.class,()->service.resolveAppeal(a.getId(),approve()));verifyNoInteractions(admin);}
 @Test void rejectedAndCompletedRequireReasonAndCannotBeReprocessed(){var a=pending("SYSTEM");when(current.requireCurrentUser()).thenReturn(user(1,"MANAGER"));assertThrows(ApiException.class,()->service.resolveAppeal(a.getId(),new ResolveAppealRequest("REJECTED"," ")));assertEquals("REJECTED",service.resolveAppeal(a.getId(),new ResolveAppealRequest("REJECTED","Giữ nguyên quyết định.")).status());assertThrows(ApiException.class,()->service.resolveAppeal(a.getId(),approve()));verifyNoInteractions(admin);}
 @Test void managerCannotFileAppeal(){User u=user(2,"MANAGER");u.setActive(false);when(users.findByEmail(u.getEmail())).thenReturn(Optional.of(u));when(users.findByIdForUpdate(2)).thenReturn(Optional.of(u));assertThrows(ApiException.class,()->service.createAppeal(new UsernamePasswordAuthenticationToken(u.getEmail(),""),new CreateAppealRequest("Mở khóa","Kiểm tra")));}
 @Test void snapshotsDecisionAndBlocksDuplicateForSameSuspension(){var a=pending("SCHOOL");User u=a.getUser();when(users.findByEmail(u.getEmail())).thenReturn(Optional.of(u));var auth=new UsernamePasswordAuthenticationToken(u.getEmail(),"");var req=new CreateAppealRequest("Mở khóa","Kiểm tra");assertEquals("SCHOOL",service.createAppeal(auth,req).authority());when(appeals.existsByUserIdAndSuspensionIdAndStatus(2,u.getSuspensionId(),"PENDING")).thenReturn(true);assertThrows(ApiException.class,()->service.createAppeal(auth,req));u.setSuspensionId(UUID.randomUUID());assertDoesNotThrow(()->service.createAppeal(auth,req));}
 @Test void adminNoLongerHandlesAppeals(){var a=pending("SYSTEM");when(current.requireCurrentUser()).thenReturn(user(1,"ADMIN"));assertThrows(ApiException.class,service::allAppeals);assertThrows(ApiException.class,()->service.resolveAppeal(a.getId(),approve()));}
}
