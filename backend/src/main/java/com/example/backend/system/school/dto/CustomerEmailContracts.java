package com.example.backend.system.school.dto;
import jakarta.validation.constraints.*;
import java.time.Instant;import java.util.*;
public final class CustomerEmailContracts {
 private CustomerEmailContracts(){}
 public record Compose(@NotNull UUID requestId,@NotBlank @Size(max=180) String subject,@NotBlank @Size(max=20000) String body,@NotNull com.example.backend.system.school.service.CustomerContactService.Reason reason){}
 public record Mail(UUID id,String actorName,String recipient,String subject,String body,String reason,String status,String lastError,int attempts,Instant createdAt,Instant sentAt,Instant statusAt,long replyCount,boolean canRetry){}
 public record Reply(UUID id,String sender,String subject,String body,String attachments,Instant receivedAt){}
 public record Page(List<Mail> items,long totalElements,int page,int size,int totalPages,boolean configured){}
 public record ThreadDetail(Mail email,List<Reply> replies,long totalElements,int page,int size,int totalPages){}
}
