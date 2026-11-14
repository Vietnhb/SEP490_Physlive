package com.example.backend.system.assignment.repository;

import com.example.backend.system.assignment.model.entity.AssignmentSubmission;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssignmentSubmissionRepository extends JpaRepository<AssignmentSubmission, UUID> {
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select s from AssignmentSubmission s where s.id = :id")
    Optional<AssignmentSubmission> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") UUID id);
    Optional<AssignmentSubmission> findByAssignmentIdAndStudentId(UUID assignmentId, Integer studentId);
    List<AssignmentSubmission> findByAssignmentIdOrderBySubmittedAtDesc(UUID assignmentId);
    boolean existsByAssignmentIdAndStudentId(UUID assignmentId, Integer studentId);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"student", "gradedBy"})
    List<AssignmentSubmission> findByAssignmentIdIn(java.util.Collection<UUID> assignmentIds);
}
