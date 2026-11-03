package com.example.backend.system.account.repository;

import com.example.backend.system.account.model.entity.AccountAppeal;
import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface AccountAppealRepository extends JpaRepository<AccountAppeal, UUID> {
    List<AccountAppeal> findByUserIdOrderByCreatedAtDesc(Integer userId);
    List<AccountAppeal> findAllByOrderByCreatedAtDesc();
    long countByStatus(String status);
    boolean existsByUserIdAndStatus(Integer userId, String status);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select a from AccountAppeal a where a.id = :id")
    java.util.Optional<AccountAppeal> findByIdForUpdate(@org.springframework.data.repository.query.Param("id") UUID id);
}
