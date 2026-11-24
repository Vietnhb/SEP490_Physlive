package com.example.backend.system.school.controller;
import com.example.backend.system.school.service.CustomerEmailInboxService;
import java.time.LocalDate;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
@RestController @RequiredArgsConstructor
@RequestMapping("/api/reports/customer-usage/email-inbox")
public class CustomerEmailInboxController {
 private final CustomerEmailInboxService service;
 private final com.example.backend.system.school.service.SchoolEmailReminderService reminders;
 @GetMapping("/automation") public com.example.backend.system.school.service.SchoolEmailReminderService.Settings automation(){return reminders.settings();}
 @GetMapping public CustomerEmailInboxService.Page list(@RequestParam(defaultValue="") String query,
  @RequestParam(defaultValue="ALL") String filter,@RequestParam(defaultValue="") String delivery,
  @RequestParam(required=false) UUID schoolId,@RequestParam(required=false) LocalDate from,@RequestParam(required=false) LocalDate to,
  @RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){return service.list(query,filter,delivery,schoolId,from,to,page,size);}
 @GetMapping("/notifications") public CustomerEmailInboxService.Notifications notifications(){return service.notifications();}
 @PostMapping("/{emailId}/read") public void read(@PathVariable UUID emailId,@RequestBody CustomerEmailInboxService.Read input){service.read(emailId,input);}
}
