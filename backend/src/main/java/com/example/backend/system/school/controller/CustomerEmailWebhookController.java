package com.example.backend.system.school.controller;
import com.example.backend.system.school.service.*;
import jakarta.servlet.http.HttpServletRequest;
import java.io.IOException;import java.util.Map;import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
@RestController @RequiredArgsConstructor
public class CustomerEmailWebhookController {
 private final ResendWebhookVerifier verifier;private final CustomerEmailWebhook webhook;
 @PostMapping(value="/api/email/resend/webhook",consumes="application/json")
 public Map<String,Boolean> receive(HttpServletRequest request)throws IOException{
  var raw=request.getInputStream().readNBytes(262145);var id=request.getHeader("svix-id");
  verifier.verify(raw,id,request.getHeader("svix-timestamp"),request.getHeader("svix-signature"));webhook.handle(id,raw);return Map.of("received",true);
 }
}
