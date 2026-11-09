package com.example.backend.system.simulation.repository;

import com.example.backend.system.simulation.model.entity.SimulationRun;
import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SimulationRunRepository extends JpaRepository<SimulationRun, UUID> {
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
        """)
    org.springframework.data.domain.Page<ValidationSummary> readValidationPage(org.springframework.data.domain.Pageable page);

    Optional<SimulationRun> findFirstBySimulationIdOrderByCreatedAtDesc(UUID simulationId);
    Optional<SimulationRun> findFirstBySimulationIdAndCreatedAtLessThanEqualOrderByCreatedAtDesc(
            UUID simulationId, Instant timestamp);
    long countByValidationPassedFalse();
}
