package com.example.backend.system.assignment.repository;

import com.example.backend.system.assignment.model.entity.AssignmentGradeChange;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AssignmentGradeChangeRepository extends JpaRepository<AssignmentGradeChange, UUID> {
    Page<AssignmentGradeChange> findBySubmissionId(UUID submissionId, Pageable pageable);
}
