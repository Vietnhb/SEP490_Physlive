package com.example.backend.system.account.dto;

import com.example.backend.system.account.model.entity.AccountAppeal;
import jakarta.validation.constraints.NotBlank;
import java.time.Instant;
import java.util.UUID;

public final class AppealContracts {
    private AppealContracts() { }
    public record CreateAppealRequest(@NotBlank @jakarta.validation.constraints.Size(max = 200) String reason,
                                     @NotBlank @jakarta.validation.constraints.Size(max = 10000) String content) { }
    public record ResolveAppealRequest(@NotBlank String status,
                                      @NotBlank @jakarta.validation.constraints.Size(max = 10000) String resolutionNote) { }
    public record AppealResponse(UUID id, Integer userId, String userEmail, String userName,
                                  String reason, String content, String status, String resolutionNote,
                                  Instant createdAt, Instant resolvedAt, String authority, boolean canResolve, boolean currentSuspension) {
        public static AppealResponse from(AccountAppeal item) {
            return new AppealResponse(item.getId(), item.getUser().getId(), item.getUser().getEmail(),
                    item.getUser().getFullName(), item.getReason(), item.getContent(),
                    item.getStatus(), item.getResolutionNote(), item.getCreatedAt(), item.getResolvedAt(),
                    item.getSuspensionScope(), false, false);
        }
    }

}
