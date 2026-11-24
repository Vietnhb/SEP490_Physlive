package com.example.backend.system.school.controller;
import com.example.backend.system.school.service.CustomerContactService;
import jakarta.validation.Valid;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/reports/customer-usage/{schoolId}/contacts")
@RequiredArgsConstructor
public class CustomerContactController {
 private final CustomerContactService service;
 @GetMapping public CustomerContactService.Page list(@PathVariable UUID schoolId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return service.list(schoolId,page,size);}
 @PostMapping @ResponseStatus(HttpStatus.CREATED)
 public CustomerContactService.Entry save(@PathVariable UUID schoolId,@Valid @RequestBody CustomerContactService.Save input){return service.save(schoolId,input);}
}
