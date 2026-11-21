package com.example.backend.system.school.controller;
import com.example.backend.system.school.service.CustomerUsageReportService;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
@RestController
@RequestMapping("/api/reports/customer-usage")
@RequiredArgsConstructor
public class CustomerUsageReportController {
 private final CustomerUsageReportService service;
 @GetMapping public CustomerUsageReportService.Report report(@RequestParam int year,@RequestParam(required=false) Integer month,
   @RequestParam(defaultValue="") String query,@RequestParam(defaultValue="") String plan,@RequestParam(defaultValue="aiCalls") String sort,
   @RequestParam(defaultValue="ALL") String attention,@RequestParam(required=false) UUID schoolId,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="10") int size){
   return service.report(year,month,query,plan,sort,attention,schoolId,page,size);
 }
 @GetMapping(value="/csv",produces="text/csv") public ResponseEntity<byte[]> csv(@RequestParam int year,@RequestParam(required=false) Integer month,
   @RequestParam(defaultValue="") String query,@RequestParam(defaultValue="") String plan,@RequestParam(defaultValue="aiCalls") String sort,@RequestParam(defaultValue="ALL") String attention){
   return ResponseEntity.ok().contentType(MediaType.parseMediaType("text/csv; charset=UTF-8"))
     .header(HttpHeaders.CONTENT_DISPOSITION,"attachment; filename=customer-usage.csv").body(service.csv(year,month,query,plan,sort,attention));
 }
}
