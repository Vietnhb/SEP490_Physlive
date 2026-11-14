package com.example.backend.system.account.repository;

import com.example.backend.system.account.model.entity.AccountAppealEvidence;
import java.util.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;

public interface AccountAppealEvidenceRepository extends JpaRepository<AccountAppealEvidence, UUID> {
    interface Metadata { UUID getId(); String getContentType(); }
    @Query("select e.id as id, e.contentType as contentType from AccountAppealEvidence e where e.appeal.id = :appealId order by e.id")
    List<Metadata> metadata(@Param("appealId") UUID appealId);
    Optional<AccountAppealEvidence> findByIdAndAppealId(UUID id, UUID appealId);
}
