package com.example.backend.system.account.service;
import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.*;
import com.example.backend.system.school.model.entity.School;
import com.example.backend.system.school.repository.SchoolRepository;
import com.example.backend.system.school.service.LicenseCheckService;
import jakarta.persistence.EntityManager;
import java.util.*;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class SuspensionAuthorityTest {
 final UserRepository users=mock(UserRepository.class);final CurrentUserService current=mock(CurrentUserService.class);final RoleValidationService access=mock(RoleValidationService.class);
 final AdminService service=new AdminService(users,mock(RoleRepository.class),mock(org.springframework.security.crypto.password.PasswordEncoder.class),current,access,mock(AccountAccessService.class),mock(LicenseCheckService.class),mock(SchoolRepository.class),mock(EntityManager.class));
 User person(int id,String role,School s){User u=new User();u.setId(id);Role r=new Role();r.setName(role);u.setRole(r);u.setSchool(s);u.setEmail(id+"@test");return u;}
 @Test void schoolCannotRestoreOrReplaceSystemLockEvenThroughDirectAccountEndpoint(){School s=new School();s.setId(UUID.randomUUID());User actor=person(1,"SCHOOL",s),target=person(2,"STUDENT",s);target.setActive(false);target.setSuspensionScope("SYSTEM");target.setSuspensionId(UUID.randomUUID());when(current.requireCurrentUser()).thenReturn(actor);when(users.findByIdForUpdate(2)).thenReturn(Optional.of(target));when(access.canManageSchool(actor,s.getId())).thenReturn(true);assertThrows(ApiException.class,()->service.setActive(2,true));assertThrows(ApiException.class,()->service.setActive(2,false,"Khóa lại"));verify(users,never()).save(any());}
 @Test void lockRecordsAuthorityReasonActorAndNewIdThenRestoreClearsIt(){User actor=person(1,"MANAGER",null),target=person(2,"STUDENT",null);when(current.requireCurrentUser()).thenReturn(actor);when(users.findByIdForUpdate(2)).thenReturn(Optional.of(target));when(users.save(any())).thenAnswer(c->c.getArgument(0));assertThrows(ApiException.class,()->service.setActive(2,false," "));service.setActive(2,false,"Spam nền tảng");UUID first=target.getSuspensionId();assertNotNull(first);assertEquals("SYSTEM",target.getSuspensionScope());assertEquals("Spam nền tảng",target.getSuspensionReason());assertEquals(1,target.getDeactivatedBy());service.setActive(2,true);assertNull(target.getSuspensionId());assertNull(target.getSuspensionScope());assertEquals("ACTIVE",target.getAccountStatus());service.setActive(2,false,"Spam lần hai");assertNotEquals(first,target.getSuspensionId());}
 @Test void managerCannotRestoreOrReplaceSchoolLockThroughAccountEndpoint(){User actor=person(1,"MANAGER",null),target=person(2,"STUDENT",null);target.setActive(false);target.setSuspensionScope("SCHOOL");when(current.requireCurrentUser()).thenReturn(actor);when(users.findByIdForUpdate(2)).thenReturn(Optional.of(target));assertThrows(ApiException.class,()->service.setActive(2,true));assertThrows(ApiException.class,()->service.setActive(2,false,"Ghi đè"));verify(users,never()).save(any());}
 @Test void managerCannotManageOtherManager(){User actor=person(1,"MANAGER",null),target=person(2,"MANAGER",null);when(current.requireCurrentUser()).thenReturn(actor);when(users.findByIdForUpdate(2)).thenReturn(Optional.of(target));assertThrows(ApiException.class,()->service.setActive(2,false,"Khóa"));verify(users,never()).save(any());}
}
