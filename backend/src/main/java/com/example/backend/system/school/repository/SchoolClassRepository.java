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
}
