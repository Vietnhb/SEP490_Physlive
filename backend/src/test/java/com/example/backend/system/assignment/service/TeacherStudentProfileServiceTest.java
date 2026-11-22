package com.example.backend.system.assignment.service;
import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.*;
import com.example.backend.system.account.repository.UserRepository;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.school.model.entity.*;
import com.example.backend.system.school.repository.*;
import java.util.*;
import org.junit.jupiter.api.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
class TeacherStudentProfileServiceTest {
 private final CurrentUserService current=mock(CurrentUserService.class);
 private final UserRepository users=mock(UserRepository.class);
 private final SchoolClassRepository classes=mock(SchoolClassRepository.class);
 private final ClassTeacherAssignmentRepository teachers=mock(ClassTeacherAssignmentRepository.class);
 private final ClassEnrollmentRepository enrollments=mock(ClassEnrollmentRepository.class);
 private final TeacherStudentProfileService service=new TeacherStudentProfileService(current,users,classes,teachers,enrollments);
 private final User teacher=new User(),student=new User();
 private final SchoolClass classroom=new SchoolClass();private final UUID classId=UUID.randomUUID();
 @BeforeEach void setup(){
  School school=new School();school.setId(UUID.randomUUID());school.setName("School");
  Role staff=new Role();staff.setName("STAFF");teacher.setId(1);teacher.setRole(staff);teacher.setSchool(school);teacher.grantPermission(new Permission("TEACH"),null);
  Role role=new Role();role.setName("STUDENT");student.setId(2);student.setRole(role);student.setSchool(school);student.setFullName("Student");student.setAvatarUrl("/avatars/student.jpg");student.setLastLogin(java.time.Instant.now());
  classroom.setId(classId);classroom.setSchool(school);classroom.setIsActive(true);classroom.setName("10A1");classroom.setGradeLevel(10);classroom.setSchoolYear("2026-2027");
  when(current.requireCurrentUser()).thenReturn(teacher);when(classes.findById(classId)).thenReturn(Optional.of(classroom));when(users.findById(2)).thenReturn(Optional.of(student));
  when(teachers.existsBySchoolClassIdAndTeacherIdAndIsActiveTrue(classId,1)).thenReturn(true);when(enrollments.existsBySchoolClassIdAndStudentId(classId,2)).thenReturn(true);
  when(enrollments.findBySchoolClassIdAndStudentIdAndStatus(classId,2,ClassEnrollment.EnrollmentStatus.ACTIVE)).thenReturn(Optional.of(new ClassEnrollment()));
 }
 @Test void assignedTeacherSeesBasicProfileButNotLoginMetadata(){var result=service.profile(classId,2);assertEquals("/avatars/student.jpg",result.avatarUrl());assertEquals(classId,result.classes().getFirst().id());assertNull(result.lastLogin());assertTrue(result.permissions().isEmpty());}
 @Test void removedTeacherCannotReadProfile(){when(teachers.existsBySchoolClassIdAndTeacherIdAndIsActiveTrue(classId,1)).thenReturn(false);assertThrows(ApiException.class,()->service.profile(classId,2));verifyNoInteractions(users);}
 @Test void rejectsTeacherWithoutTeachingPermission(){teacher.setPermissions(Set.of());assertThrows(ApiException.class,()->service.profile(classId,2));verifyNoInteractions(users);}
 @Test void rejectsStudentWithoutClassMembership(){when(enrollments.existsBySchoolClassIdAndStudentId(classId,2)).thenReturn(false);assertThrows(ApiException.class,()->service.profile(classId,2));}
 @Test void rejectsStudentFromAnotherSchool(){School foreign=new School();foreign.setId(UUID.randomUUID());student.setSchool(foreign);assertThrows(ApiException.class,()->service.profile(classId,2));}
 @Test void historicalStudentProfileDoesNotClaimCurrentMembership(){when(enrollments.findBySchoolClassIdAndStudentIdAndStatus(classId,2,ClassEnrollment.EnrollmentStatus.ACTIVE)).thenReturn(Optional.empty());assertTrue(service.profile(classId,2).classes().isEmpty());}
 @Test void rejectsInactiveClass(){classroom.setIsActive(false);assertThrows(ApiException.class,()->service.profile(classId,2));verifyNoInteractions(users);}
}
