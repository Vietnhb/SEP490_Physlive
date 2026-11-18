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
    /** Submissions handed in plus submissions graded, since the start of this week and month and in each of the last four weeks. */
    @org.springframework.data.jpa.repository.Query("""
        select coalesce(sum((case when s.submittedAt >= :week then 1L else 0L end) + (case when s.gradedAt >= :week then 1L else 0L end)), 0L) as week,
            coalesce(sum((case when s.submittedAt >= :month then 1L else 0L end) + (case when s.gradedAt >= :month then 1L else 0L end)), 0L) as month,
            coalesce(sum((case when s.submittedAt >= :w1 and s.submittedAt < :w2 then 1L else 0L end) + (case when s.gradedAt >= :w1 and s.gradedAt < :w2 then 1L else 0L end)), 0L) as w1,
            coalesce(sum((case when s.submittedAt >= :w2 and s.submittedAt < :w3 then 1L else 0L end) + (case when s.gradedAt >= :w2 and s.gradedAt < :w3 then 1L else 0L end)), 0L) as w2,
            coalesce(sum((case when s.submittedAt >= :w3 and s.submittedAt < :w4 then 1L else 0L end) + (case when s.gradedAt >= :w3 and s.gradedAt < :w4 then 1L else 0L end)), 0L) as w3,
            coalesce(sum((case when s.submittedAt >= :w4 then 1L else 0L end) + (case when s.gradedAt >= :w4 then 1L else 0L end)), 0L) as w4
        from AssignmentSubmission s
        where s.submittedAt >= :w1 or s.gradedAt >= :w1 or s.submittedAt >= :month or s.gradedAt >= :month
        """)
    com.example.backend.system.simulation.repository.SimulationRunRepository.OperationCounts operationCounts(
            @org.springframework.data.repository.query.Param("week") java.time.Instant week,
            @org.springframework.data.repository.query.Param("month") java.time.Instant month,
            @org.springframework.data.repository.query.Param("w1") java.time.Instant w1, @org.springframework.data.repository.query.Param("w2") java.time.Instant w2,
            @org.springframework.data.repository.query.Param("w3") java.time.Instant w3, @org.springframework.data.repository.query.Param("w4") java.time.Instant w4);

    Optional<AssignmentSubmission> findByAssignmentIdAndStudentId(UUID assignmentId, Integer studentId);
    List<AssignmentSubmission> findByStudentIdAndAssignmentIdIn(Integer studentId, java.util.Collection<UUID> assignmentIds);
    List<AssignmentSubmission> findByAssignmentIdOrderBySubmittedAtDesc(UUID assignmentId);
    boolean existsByAssignmentIdAndStudentId(UUID assignmentId, Integer studentId);
    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"student", "gradedBy"})
    List<AssignmentSubmission> findByAssignmentIdIn(java.util.Collection<UUID> assignmentIds);
}
