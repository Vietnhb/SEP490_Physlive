package com.example.backend.system.school.repository;

import com.example.backend.system.school.model.entity.SchoolClass;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface SchoolClassRepository extends JpaRepository<SchoolClass, UUID>, org.springframework.data.jpa.repository.JpaSpecificationExecutor<SchoolClass> {
    
    /**
     * Find all active classes for a school.
     */
    @Query("SELECT c FROM SchoolClass c WHERE c.school.id = :schoolId AND c.isActive = true")
    List<SchoolClass> findBySchoolIdAndIsActiveTrue(@Param("schoolId") UUID schoolId);

    List<SchoolClass> findBySchoolIdOrderByNameAsc(UUID schoolId);
    
    @Query("select distinct c.schoolYear from SchoolClass c where c.school.id = :schoolId order by c.schoolYear desc")
    List<String> schoolYears(@Param("schoolId") UUID schoolId);
    long countBySchoolIdAndIsActiveTrue(UUID schoolId);
    interface StateCount { Boolean getActive(); long getTotal(); }
    @Query("select c.isActive as active, count(c) as total from SchoolClass c where c.school.id = :schoolId group by c.isActive")
    List<StateCount> classStateCounts(@Param("schoolId") UUID schoolId);

    boolean existsBySchoolIdAndNameIgnoreCaseAndSchoolYear(UUID schoolId, String name, String schoolYear);

    interface ProfileClass {
        UUID getId();
        String getName();
        int getGradeLevel();
        String getSchoolYear();
        String getSubject();
    }

    @Query("SELECT DISTINCT c.id AS id, c.name AS name, c.gradeLevel AS gradeLevel, c.schoolYear AS schoolYear, c.subject AS subject "
            + "FROM ClassTeacherAssignment a JOIN a.schoolClass c WHERE a.teacher.id = :userId "
            + "AND c.school.id = :schoolId AND c.isActive = true AND a.isActive = true ORDER BY c.schoolYear DESC, c.name, c.id")
    List<ProfileClass> profileTeacherClasses(@Param("schoolId") UUID schoolId, @Param("userId") Integer userId);

    @Query("SELECT DISTINCT c.id AS id, c.name AS name, c.gradeLevel AS gradeLevel, c.schoolYear AS schoolYear, c.subject AS subject "
            + "FROM ClassEnrollment e JOIN e.schoolClass c WHERE e.student.id = :userId "
            + "AND c.school.id = :schoolId AND c.isActive = true AND e.status = 'ACTIVE' ORDER BY c.schoolYear DESC, c.name, c.id")
    List<ProfileClass> profileStudentClasses(@Param("schoolId") UUID schoolId, @Param("userId") Integer userId);
}
