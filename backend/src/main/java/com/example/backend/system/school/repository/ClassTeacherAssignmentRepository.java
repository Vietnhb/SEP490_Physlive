package com.example.backend.system.school.repository;

import com.example.backend.system.school.model.entity.ClassTeacherAssignment;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface ClassTeacherAssignmentRepository extends JpaRepository<ClassTeacherAssignment, UUID> {
    
    interface ClassCount {
        UUID getClassId();
        long getTotal();
    }

    @Query("SELECT a.schoolClass.id AS classId, COUNT(a) AS total FROM ClassTeacherAssignment a WHERE a.schoolClass.id IN :classIds AND a.isActive = true GROUP BY a.schoolClass.id")
    List<ClassCount> countActiveByClasses(@Param("classIds") java.util.Collection<UUID> classIds);

    @Query("SELECT COUNT(a) FROM ClassTeacherAssignment a WHERE a.schoolClass.id = :classId AND a.isActive = true")
    long countActiveByClass(@Param("classId") UUID classId);

    /**
     * Find all teachers assigned to a class.
     */
    @Query("SELECT a FROM ClassTeacherAssignment a WHERE a.schoolClass.id = :classId AND a.isActive = true")
    List<ClassTeacherAssignment> findByClassIdAndIsActiveTrue(@Param("classId") UUID classId);

    boolean existsBySchoolClassIdAndTeacherIdAndIsActiveTrue(UUID classId, Integer teacherId);

    boolean existsBySchoolClassIdAndTeacherIdNotAndIsActiveTrue(UUID classId, Integer teacherId);

    @Query("SELECT a FROM ClassTeacherAssignment a JOIN FETCH a.schoolClass c WHERE a.teacher.id = :teacherId AND a.isActive = true AND c.isActive = true ORDER BY c.gradeLevel, c.name")
    List<ClassTeacherAssignment> findActiveByTeacherId(@Param("teacherId") Integer teacherId);

    java.util.Optional<ClassTeacherAssignment> findBySchoolClassIdAndTeacherId(UUID classId, Integer teacherId);
}
