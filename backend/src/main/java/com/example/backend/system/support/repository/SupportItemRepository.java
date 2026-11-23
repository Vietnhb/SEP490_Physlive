package com.example.backend.system.support.repository;

import com.example.backend.system.support.model.entity.SupportItem;
import com.example.backend.system.support.model.enums.SupportKind;
import com.example.backend.system.support.model.enums.SupportStatus;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SupportItemRepository extends JpaRepository<SupportItem, UUID> {
    List<SupportItem> findTop200ByKindOrderByCreatedAtDesc(SupportKind kind);
    List<SupportItem> findTop200ByKindAndReviewerReferredTrueOrderByCreatedAtDesc(SupportKind kind);
    List<SupportItem> findAllByOrderByCreatedAtDesc();
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from SupportItem s where s.id = :id")
    java.util.Optional<SupportItem> findByIdForUpdate(@Param("id") UUID id);
    List<SupportItem> findBySenderIdOrderByCreatedAtDesc(Integer senderId);
    boolean existsByKindAndSimulationId(SupportKind kind, UUID simulationId);
    long countByKindAndStatus(SupportKind kind, SupportStatus status);
    long countByKindAndStatusNotAndCreatedAtGreaterThanEqual(SupportKind kind, SupportStatus status, Instant since);
    long countByKindAndStatusNotAndCreatedAtGreaterThanEqualAndCreatedAtLessThan(SupportKind kind, SupportStatus status, Instant from, Instant to);
    long countByKindAndStatusNotAndCreatedAtLessThan(SupportKind kind, SupportStatus status, Instant before);

    @Query("select min(s.createdAt) from SupportItem s where s.kind = :kind and s.status <> :excludedStatus")
    Instant findOldestCreatedAtByKindAndStatusNot(@Param("kind") SupportKind kind, @Param("excludedStatus") SupportStatus excludedStatus);

    @EntityGraph(attributePaths = {"sender", "assignedTo", "respondedBy", "lawGap"})
    @Query("select s from SupportItem s where s.id = :id and s.kind = :kind")
    java.util.Optional<SupportItem> findDetailedByIdAndKind(@Param("id") UUID id, @Param("kind") SupportKind kind);

    @EntityGraph(attributePaths = {"sender", "assignedTo", "respondedBy", "lawGap"})
    @Query("""
            select s from SupportItem s
            join s.sender sender
            left join s.assignedTo assignee
            where s.kind = com.example.backend.system.support.model.enums.SupportKind.COMPLAINT
              and (:statusGroup = 'ALL'
                   or (:statusGroup = 'TODO' and s.status <> com.example.backend.system.support.model.enums.SupportStatus.RESOLVED)
                   or (:statusGroup = 'DONE' and s.status = com.example.backend.system.support.model.enums.SupportStatus.RESOLVED))
              and (:exactStatus = 'ALL' or cast(s.status as string) = :exactStatus)
              and (:assignedToId < 0 or assignee.id = :assignedToId)
              and (:unassignedOnly = false or assignee is null)
              and (:useSla = false or (s.status <> com.example.backend.system.support.model.enums.SupportStatus.RESOLVED and s.createdAt < :slaBefore))
              and s.createdAt >= :fromInstant
              and s.createdAt < :untilInstant
              and (:pattern = ''
                   or cast(function('vn_fold', coalesce(s.subject, '')) as string) like :pattern
                   or cast(function('vn_fold', coalesce(sender.fullName, '')) as string) like :pattern
                   or lower(coalesce(sender.email, '')) like :pattern
                   or cast(function('vn_fold', coalesce(assignee.fullName, '')) as string) like :pattern
                   or lower(concat('kn-', substring(cast(s.id as string), 1, 8))) like :pattern)
            """)
    Page<SupportItem> findComplaintsForReviewPage(@Param("statusGroup") String statusGroup,
                                                  @Param("exactStatus") String exactStatus,
                                                  @Param("assignedToId") int assignedToId,
                                                  @Param("unassignedOnly") boolean unassignedOnly,
                                                  @Param("useSla") boolean useSla,
                                                  @Param("slaBefore") Instant slaBefore,
                                                  @Param("fromInstant") Instant fromInstant,
                                                  @Param("untilInstant") Instant untilInstant,
                                                  @Param("pattern") String pattern,
                                                  Pageable pageable);
}
