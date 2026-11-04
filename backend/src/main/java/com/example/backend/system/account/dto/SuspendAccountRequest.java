package com.example.backend.system.account.dto;
public record SuspendAccountRequest(@jakarta.validation.constraints.NotBlank @jakarta.validation.constraints.Size(max=2000) String reason) { }
