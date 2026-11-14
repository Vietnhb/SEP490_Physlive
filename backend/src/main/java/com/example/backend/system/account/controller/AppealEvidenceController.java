package com.example.backend.system.account.controller;

import com.example.backend.system.account.dto.AppealContracts.*;
import com.example.backend.system.account.service.AccountAppealEvidenceService;
import jakarta.validation.Valid;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

@RestController @RequestMapping("/api/appeals") @RequiredArgsConstructor
public class AppealEvidenceController {
    private final AccountAppealEvidenceService service;
    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public AppealResponse create(Authentication auth, @Valid @RequestPart("request") CreateAppealRequest request,
            @RequestPart(value = "files", required = false) List<MultipartFile> files) {
        return service.create(auth, request, files);
    }
    @GetMapping("/{appealId}/evidence")
    public List<AccountAppealEvidenceService.Metadata> list(@PathVariable UUID appealId) { return service.list(appealId); }
    @GetMapping("/{appealId}/evidence/{id}")
    public ResponseEntity<byte[]> image(@PathVariable UUID appealId, @PathVariable UUID id) {
        var image = service.image(appealId, id);
        return ResponseEntity.ok().contentType(MediaType.parseMediaType(image.contentType()))
                .cacheControl(CacheControl.noStore()).header("X-Content-Type-Options", "nosniff")
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"evidence." + (image.contentType().equals("image/png") ? "png" : "jpg") + "\"")
                .body(image.content());
    }
}
