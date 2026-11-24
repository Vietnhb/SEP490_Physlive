package com.example.backend.system.school.controller;
import com.example.backend.system.school.service.CustomerEmailService;
import com.example.backend.system.school.dto.CustomerEmailContracts;
import jakarta.validation.Valid;import java.util.UUID;import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
@RestController @RequiredArgsConstructor @RequestMapping("/api/reports/customer-usage/{schoolId}/emails")
public class CustomerEmailController {
 private final CustomerEmailService service;
 @GetMapping public CustomerEmailContracts.Page list(@PathVariable UUID schoolId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return service.list(schoolId,page,size);}
 @PostMapping public CustomerEmailContracts.Mail send(@PathVariable UUID schoolId,@Valid @RequestBody CustomerEmailContracts.Compose input){return service.compose(schoolId,input);}
 @GetMapping("/{emailId}") public CustomerEmailContracts.ThreadDetail thread(@PathVariable UUID schoolId,@PathVariable UUID emailId,@RequestParam(defaultValue="0") int page){return service.thread(schoolId,emailId,page);}
 @PostMapping("/{emailId}/retry") public CustomerEmailContracts.Mail retry(@PathVariable UUID schoolId,@PathVariable UUID emailId){return service.retry(schoolId,emailId);}
}
