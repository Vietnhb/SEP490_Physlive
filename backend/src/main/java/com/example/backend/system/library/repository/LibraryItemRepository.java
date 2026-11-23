package com.example.backend.system.library.repository;

import com.example.backend.system.library.model.entity.LibraryItem;
import com.example.backend.system.library.model.enums.LibraryModerationStatus;
import com.example.backend.system.library.model.enums.Visibility;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface LibraryItemRepository extends JpaRepository<LibraryItem, UUID> {
    interface DashboardPosts {
        long getCumTotal();
        long getCumPub();
        long getCumPriv();
        long getCumDeleted();
        long getWeekTotal();
        long getWeekPub();
        long getWeekPriv();
        long getWeekDeleted();
        long getMonthTotal();
        long getMonthPub();
        long getMonthPriv();
        long getMonthDeleted();
        long getPostsW4();
        long getPostsW3();
        long getPostsW2();
        long getPostsW1();
    }
    @Query("""
        select coalesce(sum(case when (true) and (true) then 1L else 0L end), 0L) as cumTotal,
            coalesce(sum(case when (true) and (i.active = true and i.visibility = 'PUBLIC') then 1L else 0L end), 0L) as cumPub,
            coalesce(sum(case when (true) and (i.active = true and i.visibility <> 'PUBLIC') then 1L else 0L end), 0L) as cumPriv,
            coalesce(sum(case when (true) and (i.active = false) then 1L else 0L end), 0L) as cumDeleted,
            coalesce(sum(case when (coalesce(i.createdAt, :now) >= :weekStart) and (true) then 1L else 0L end), 0L) as weekTotal,
            coalesce(sum(case when (coalesce(i.createdAt, :now) >= :weekStart) and (i.active = true and i.visibility = 'PUBLIC') then 1L else 0L end), 0L) as weekPub,
            coalesce(sum(case when (coalesce(i.createdAt, :now) >= :weekStart) and (i.active = true and i.visibility <> 'PUBLIC') then 1L else 0L end), 0L) as weekPriv,
            coalesce(sum(case when (coalesce(i.createdAt, :now) >= :weekStart) and (i.active = false) then 1L else 0L end), 0L) as weekDeleted,
            coalesce(sum(case when (coalesce(i.createdAt, :now) >= :monthStart) and (true) then 1L else 0L end), 0L) as monthTotal,
            coalesce(sum(case when (coalesce(i.createdAt, :now) >= :monthStart) and (i.active = true and i.visibility = 'PUBLIC') then 1L else 0L end), 0L) as monthPub,
            coalesce(sum(case when (coalesce(i.createdAt, :now) >= :monthStart) and (i.active = true and i.visibility <> 'PUBLIC') then 1L else 0L end), 0L) as monthPriv,
            coalesce(sum(case when (coalesce(i.createdAt, :now) >= :monthStart) and (i.active = false) then 1L else 0L end), 0L) as monthDeleted,
            coalesce(sum(case when coalesce(i.createdAt, :now) >= :w4 then 1L else 0L end), 0L) as postsW4,
            coalesce(sum(case when coalesce(i.createdAt, :now) >= :w3 and coalesce(i.createdAt, :now) < :w4 then 1L else 0L end), 0L) as postsW3,
            coalesce(sum(case when coalesce(i.createdAt, :now) >= :w2 and coalesce(i.createdAt, :now) < :w3 then 1L else 0L end), 0L) as postsW2,
            coalesce(sum(case when coalesce(i.createdAt, :now) >= :monthAgo and coalesce(i.createdAt, :now) < :w2 then 1L else 0L end), 0L) as postsW1
        from LibraryItem i
        """)
    DashboardPosts dashboardPosts(@Param("now") java.time.Instant now, @Param("weekStart") java.time.Instant weekStart,
            @Param("monthStart") java.time.Instant monthStart, @Param("w4") java.time.Instant w4,
            @Param("w3") java.time.Instant w3, @Param("w2") java.time.Instant w2, @Param("monthAgo") java.time.Instant monthAgo);

    @Query(value = "select count(*) from library_likes where item_id = :itemId", nativeQuery = true)
    long countLikes(@Param("itemId") UUID itemId);

    @Query(value = "select exists(select 1 from library_likes where item_id = :itemId and user_id = :userId)", nativeQuery = true)
    boolean hasLiked(@Param("itemId") UUID itemId, @Param("userId") Integer userId);

    @Modifying
    @Query(value = "insert into library_likes (item_id, user_id) values (:itemId, :userId) on conflict (item_id, user_id) do nothing", nativeQuery = true)
    int addLike(@Param("itemId") UUID itemId, @Param("userId") Integer userId);

    @Modifying
    @Query(value = "delete from library_likes where item_id = :itemId and user_id = :userId", nativeQuery = true)
    int removeLike(@Param("itemId") UUID itemId, @Param("userId") Integer userId);

    @EntityGraph(attributePaths = {"specification", "owner", "owner.school"})
    @Query("select i from LibraryItem i where i.visibility = com.example.backend.system.library.model.enums.Visibility.SHARED and i.moderationStatus = :status and i.owner.school.id = :schoolId and (i.active = true or i.moderationStatus = com.example.backend.system.library.model.enums.LibraryModerationStatus.REMOVED) order by i.createdAt asc")
    List<LibraryItem> findSchoolModerationItems(@Param("schoolId") UUID schoolId, @Param("status") LibraryModerationStatus status);
    /**
     * The item, locked for this transaction, with its owner and specification. Only the item row is locked:
     * a JPA lock on the joined query made Hibernate lock the owner, their school and the specification too,
     * one database round trip each, and made every like on a school's items wait on that school's row.
     */
    default Optional<LibraryItem> findByIdForUpdate(UUID id) {
        lockRow(id);
        return findWithRelationsById(id);
    }

    @Query(value = "select 1 from library_items where id = :id for update", nativeQuery = true)
    Optional<Integer> lockRow(@Param("id") UUID id);

    @EntityGraph(attributePaths = {"specification", "owner", "owner.school"})
    @Query("select i from LibraryItem i where i.id = :id")
    Optional<LibraryItem> findWithRelationsById(@Param("id") UUID id);
    Optional<LibraryItem> findBySimulationIdAndOwnerId(UUID simulationId, Integer ownerId);
    @EntityGraph(attributePaths = {"simulation", "simulation.specification", "owner", "owner.school"})
    Optional<LibraryItem> findFirstBySimulationId(UUID simulationId);

    @EntityGraph(attributePaths = {"simulation", "simulation.specification", "owner", "owner.school"})
    List<LibraryItem> findBySimulationIdAndVisibilityOrderByCreatedAtDesc(UUID simulationId, Visibility visibility);

    Optional<LibraryItem> findByIdAndOwnerIdAndActiveTrue(UUID id, Integer ownerId);

    @Query("""
            select i from LibraryItem i left join i.owner.school ownerSchool
            where i.simulation.id = :simulationId
              and i.active = true
              and i.visibility in :visibilities
              and i.moderationStatus in :moderationStatuses
              and (i.visibility = :publicVisibility
                   or (i.sharedInstitutionId = :institutionId and :institutionId is not null)
                   or ((i.sharedInstitutionId is null or trim(i.sharedInstitutionId) = '')
                       and cast(ownerSchool.id as string) = :institutionId and :institutionId is not null))
            """)
    Optional<LibraryItem> findVisiblePublishedSimulation(@Param("simulationId") UUID simulationId,
                                                          @Param("visibilities") java.util.Set<Visibility> visibilities,
                                                          @Param("publicVisibility") Visibility publicVisibility,
                                                          @Param("moderationStatuses") java.util.Set<LibraryModerationStatus> moderationStatuses,
                                                          @Param("institutionId") String institutionId);

    List<LibraryItem> findByOwnerIdAndActiveTrueOrderByCreatedAtDesc(Integer ownerId);

    @EntityGraph(attributePaths = {"specification", "owner", "owner.school"})
    @Query("""
            select i from LibraryItem i left join i.owner.school ownerSchool
            where i.active = true
              and (coalesce(:topic, '') = '' or lower(i.specification.topic) = lower(:topic))
              and (
                  i.owner.id = :ownerId
                  or (
                      i.visibility <> :personalVisibility
                      and i.moderationStatus in :publishedStatuses
                      and (
                          i.visibility = :publicVisibility
                          or (i.sharedInstitutionId = :institutionId and :institutionId is not null)
                          or ((i.sharedInstitutionId is null or trim(i.sharedInstitutionId) = '')
                              and cast(ownerSchool.id as string) = :institutionId and :institutionId is not null)
                      )
                  )
              )
            """)
    List<LibraryItem> findSearchVisibleItems(@Param("ownerId") Integer ownerId,
                                              @Param("institutionId") String institutionId,
                                              @Param("personalVisibility") Visibility personalVisibility,
                                              @Param("publicVisibility") Visibility publicVisibility,
                                              @Param("publishedStatuses") Set<LibraryModerationStatus> publishedStatuses,
                                              @Param("topic") String topic);

    @EntityGraph(attributePaths = {"specification", "owner", "owner.school"})
    @Query("""
            select i from LibraryItem i
            where i.active = true
              and i.visibility = :publicVisibility
              and i.moderationStatus in :publishedStatuses
              and (coalesce(:topic, '') = '' or lower(i.specification.topic) = lower(:topic))
            """)
    List<LibraryItem> findCommunityItems(@Param("publicVisibility") Visibility publicVisibility,
                                         @Param("publishedStatuses") Set<LibraryModerationStatus> publishedStatuses,
                                         @Param("topic") String topic);

    boolean existsByFolderIdAndActiveTrue(UUID folderId);

    long countByFolderIdAndActiveTrue(UUID folderId);

    interface FolderCount { UUID getFolderId(); long getTotal(); }

    /** Active items per folder, for a whole folder list in one statement. */
    @Query("select i.folder.id as folderId, count(i) as total from LibraryItem i where i.folder.id in :folderIds and i.active = true group by i.folder.id")
    List<FolderCount> countActiveByFolderIds(@Param("folderIds") java.util.Collection<UUID> folderIds);

    interface ModerationStatusCount {
        LibraryModerationStatus getStatus();
        long getTotal();
    }

    @Query("select i.moderationStatus as status, count(i) as total from LibraryItem i where i.visibility in :visibilities and (i.active = true or i.moderationStatus = com.example.backend.system.library.model.enums.LibraryModerationStatus.REMOVED) group by i.moderationStatus")
    List<ModerationStatusCount> countByVisibilityInGroupByModerationStatus(@Param("visibilities") java.util.Set<Visibility> visibilities);

    @Query("select i from LibraryItem i where i.visibility in :visibilities and i.moderationStatus = :status and (i.active = true or i.moderationStatus = com.example.backend.system.library.model.enums.LibraryModerationStatus.REMOVED) order by i.createdAt asc")
    List<LibraryItem> findByVisibilityInAndModerationStatusOrderByCreatedAtAsc(@Param("visibilities") java.util.Set<Visibility> visibilities, @Param("status") LibraryModerationStatus status);
    @EntityGraph(attributePaths = {"specification", "owner", "owner.school", "assignedTo"})
    @Query("""
            select i from LibraryItem i
            left join i.owner owner
            left join owner.school school
            left join i.assignedTo assignee
            where i.visibility in :visibilities
              and i.moderationStatus = :status
              and (i.active = true or i.moderationStatus = com.example.backend.system.library.model.enums.LibraryModerationStatus.REMOVED)
              and (:assignedToId < 0 or assignee.id = :assignedToId)
              and (:unassignedOnly = false or assignee is null)
              and (:useSla = false or i.createdAt < :slaBefore)
              and (:topic = '' or lower(coalesce(i.specification.topic, '')) = lower(:topic))
              and (:pattern = ''
                   or cast(function('vn_fold', coalesce(i.title, '')) as string) like :pattern
                   or cast(function('vn_fold', coalesce(i.specification.topic, '')) as string) like :pattern
                   or cast(function('vn_fold', coalesce(owner.fullName, '')) as string) like :pattern
                   or cast(function('vn_fold', coalesce(school.name, '')) as string) like :pattern)
            order by i.createdAt asc
            """)
    Page<LibraryItem> findModerationPage(@Param("visibilities") java.util.Set<Visibility> visibilities,
                                         @Param("status") LibraryModerationStatus status,
                                         @Param("assignedToId") int assignedToId,
                                         @Param("unassignedOnly") boolean unassignedOnly,
                                         @Param("useSla") boolean useSla,
                                         @Param("slaBefore") java.time.Instant slaBefore,
                                         @Param("topic") String topic,
                                         @Param("pattern") String pattern,
                                         Pageable pageable);

    @EntityGraph(attributePaths = {"specification", "owner", "owner.school", "assignedTo"})
    @Query("select i from LibraryItem i where i.visibility in :visibilities and i.moderationStatus = :status and (i.active = true or i.moderationStatus = com.example.backend.system.library.model.enums.LibraryModerationStatus.REMOVED) order by i.createdAt asc")
    Page<LibraryItem> findByVisibilityInAndModerationStatusOrderByCreatedAtAsc(@Param("visibilities") java.util.Set<Visibility> visibilities,
                                                                                 @Param("status") LibraryModerationStatus status,
                                                                                 Pageable pageable);
}
