package com.example.backend.system.library.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.model.entity.User;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.library.dto.LibraryFolders;
import com.example.backend.system.library.model.entity.LibraryFolder;
import com.example.backend.system.library.repository.LibraryFolderRepository;
import com.example.backend.system.library.repository.LibraryItemRepository;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class LibraryFolderService {
    private static final String DUPLICATE_FOLDER_NAME = "Đã có thư mục thư viện trùng tên";
    private final LibraryFolderRepository folderRepository;
    private final LibraryItemRepository itemRepository;
    private final CurrentUserService currentUserService;

    @Transactional(readOnly = true)
    public List<LibraryFolders.Response> mine() {
        User owner = currentUserService.requireCurrentUser();
        List<LibraryFolder> folders = folderRepository.findByOwnerIdAndActiveTrueOrderByNameAsc(owner.getId());
        if (folders.isEmpty()) return List.of();
        // one counting statement for all folders, not one per folder
        java.util.Map<UUID, Long> counts = new java.util.HashMap<>();
        itemRepository.countActiveByFolderIds(folders.stream().map(LibraryFolder::getId).toList())
                .forEach(row -> counts.put(row.getFolderId(), row.getTotal()));
        return folders.stream()
                .map(folder -> toResponse(folder, counts.getOrDefault(folder.getId(), 0L)))
                .toList();
    }

    @Transactional
    public LibraryFolders.Response create(LibraryFolders.Request request) {
        User owner = currentUserService.requireCurrentUser();
        String name = normalizedName(request.name());
        String nameKey = nameKey(name);
        if (folderRepository.existsByOwnerIdAndActiveTrueAndNameKey(owner.getId(), nameKey)) {
            throw ApiException.conflict(DUPLICATE_FOLDER_NAME);
        }
        LibraryFolder folder = new LibraryFolder();
        folder.setOwner(owner);
        folder.setName(name);
        folder.setNameKey(nameKey);
        try {
            return toResponse(folderRepository.saveAndFlush(folder));
        } catch (DataIntegrityViolationException exception) {
            throw ApiException.conflict(DUPLICATE_FOLDER_NAME);
        }
    }

    @Transactional
    public LibraryFolders.Response rename(UUID id, LibraryFolders.Request request) {
        User owner = currentUserService.requireCurrentUser();
        LibraryFolder folder = requireOwned(id, owner);
        String name = normalizedName(request.name());
        String nameKey = nameKey(name);
        if (folderRepository.existsByOwnerIdAndActiveTrueAndNameKeyAndIdNot(owner.getId(), nameKey, id)) {
            throw ApiException.conflict(DUPLICATE_FOLDER_NAME);
        }
        folder.setName(name);
        folder.setNameKey(nameKey);
        try {
            return toResponse(folderRepository.saveAndFlush(folder));
        } catch (DataIntegrityViolationException exception) {
            throw ApiException.conflict(DUPLICATE_FOLDER_NAME);
        }
    }

    @Transactional
    public void remove(UUID id) {
        User owner = currentUserService.requireCurrentUser();
        LibraryFolder folder = requireOwned(id, owner);
        if (itemRepository.existsByFolderIdAndActiveTrue(folder.getId())) {
            throw ApiException.conflict("Vui lòng di chuyển hoặc xóa các mô phỏng trước khi xóa thư mục");
        }
        folder.setActive(false);
        folder.setNameKey(folder.getId().toString());
        folderRepository.save(folder);
    }

    private LibraryFolder requireOwned(UUID id, User owner) {
        return folderRepository.findByIdAndOwnerIdAndActiveTrue(id, owner.getId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy thư mục thư viện"));
    }

    private String normalizedName(String value) {
        return value.trim().replaceAll("\\s+", " ");
    }

    private String nameKey(String value) {
        return value.toLowerCase(Locale.ROOT);
    }

    private LibraryFolders.Response toResponse(LibraryFolder folder) {
        return toResponse(folder, itemRepository.countByFolderIdAndActiveTrue(folder.getId()));
    }

    private LibraryFolders.Response toResponse(LibraryFolder folder, long itemCount) {
        return new LibraryFolders.Response(folder.getId(), folder.getName(), itemCount,
                folder.getCreatedAt(), folder.getUpdatedAt());
    }
}
