package com.example.backend.system.simulation.repository;

import com.example.backend.system.simulation.model.entity.SimulationRun;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SimulationRunRepository extends JpaRepository<SimulationRun, UUID> {
    /** How many operations fell in each period the dashboard shows. */
    interface OperationCounts {
        long getWeek();
        long getMonth();
        long getW1();
        long getW2();
        long getW3();
        long getW4();
    }

    /** Simulation runs started since the start of this week and month, and in each of the last four weeks. */
    @org.springframework.data.jpa.repository.Query("""
        select coalesce(sum(case when r.createdAt >= :week then 1L else 0L end), 0L) as week,
            coalesce(sum(case when r.createdAt >= :month then 1L else 0L end), 0L) as month,
            coalesce(sum(case when r.createdAt >= :w1 and r.createdAt < :w2 then 1L else 0L end), 0L) as w1,
            coalesce(sum(case when r.createdAt >= :w2 and r.createdAt < :w3 then 1L else 0L end), 0L) as w2,
            coalesce(sum(case when r.createdAt >= :w3 and r.createdAt < :w4 then 1L else 0L end), 0L) as w3,
            coalesce(sum(case when r.createdAt >= :w4 then 1L else 0L end), 0L) as w4
        from SimulationRun r where r.createdAt >= :w1 or r.createdAt >= :month
        """)
    OperationCounts operationCounts(@org.springframework.data.repository.query.Param("week") Instant week,
            @org.springframework.data.repository.query.Param("month") Instant month,
            @org.springframework.data.repository.query.Param("w1") Instant w1, @org.springframework.data.repository.query.Param("w2") Instant w2,
            @org.springframework.data.repository.query.Param("w3") Instant w3, @org.springframework.data.repository.query.Param("w4") Instant w4);

    interface ValidationSummary {
        UUID getId(); UUID getSubmissionId(); String getTopic(); String getSchemaId(); String getSchemaVersion();
        String getSolverVersion(); boolean getPassed(); String getStatus(); String getErrorMessage(); Instant getCreatedAt();
    }

    @org.springframework.data.jpa.repository.Query("""
        select r.id as id, submission.id as submissionId, spec.topic as topic, simulation.schemaId as schemaId,
               spec.schemaVersion as schemaVersion, simulation.solverVersion as solverVersion,
               r.validationPassed as passed, case when r.validationPassed = true then 'PASS' else 'FAIL' end as status,
               r.validationError as errorMessage, r.createdAt as createdAt
        from SimulationRun r join r.simulation simulation join simulation.specification spec join spec.submission submission
        where (:topic = '' or spec.topic = :topic)
          and (:status = 'ALL' or (:status = 'PASS' and r.validationPassed = true) or (:status = 'FAIL' and r.validationPassed = false))
          and r.createdAt >= :from and r.createdAt < :until
        """)
    org.springframework.data.domain.Page<ValidationSummary> readValidationPage(
            @org.springframework.data.repository.query.Param("topic") String topic,
            @org.springframework.data.repository.query.Param("status") String status,
            @org.springframework.data.repository.query.Param("from") Instant from,
            @org.springframework.data.repository.query.Param("until") Instant until,
            org.springframework.data.domain.Pageable page);

    default org.springframework.data.domain.Page<ValidationSummary> readValidationPage(org.springframework.data.domain.Pageable page) {
        return readValidationPage("", "ALL", Instant.parse("1900-01-01T00:00:00Z"), Instant.parse("9999-12-31T00:00:00Z"), page);
    }

    @org.springframework.data.jpa.repository.Query("select distinct spec.topic from SimulationRun r join r.simulation simulation join simulation.specification spec where spec.topic is not null order by spec.topic")
    java.util.List<String> validationTopics();

    Optional<SimulationRun> findFirstBySimulationIdOrderByCreatedAtDesc(UUID simulationId);
    Optional<SimulationRun> findFirstBySimulationIdAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
            UUID simulationId, Instant timestamp);
    long countByValidationPassedFalse();
}
