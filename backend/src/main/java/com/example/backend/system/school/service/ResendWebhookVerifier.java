package com.example.backend.system.school.service;
import com.example.backend.config.CustomerEmailProperties;
import com.example.backend.exception.ApiException;
import java.nio.charset.StandardCharsets;import java.security.MessageDigest;import java.time.*;import java.util.*;
import javax.crypto.Mac;import javax.crypto.spec.SecretKeySpec;
import org.springframework.stereotype.Component;
@Component
public class ResendWebhookVerifier {
 private final CustomerEmailProperties config;
 public ResendWebhookVerifier(CustomerEmailProperties config){this.config=config;}
 public void verify(byte[] raw,String id,String timestamp,String signatures){
  if(!config.configured())throw ApiException.unavailable("Chức năng email chưa được cấu hình.");
  try{
   if(raw.length>262144||id==null||id.length()>255||timestamp==null||signatures==null||signatures.length()>2048)throw new IllegalArgumentException();
   long time=Long.parseLong(timestamp),now=Instant.now().getEpochSecond();if(time<now-300||time>now+300)throw new IllegalArgumentException();
   var secret=config.webhookSecret();if(!secret.startsWith("whsec_"))throw new IllegalArgumentException();
   var mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(Base64.getDecoder().decode(secret.substring(6)),"HmacSHA256"));
   mac.update((id+"."+timestamp+".").getBytes(StandardCharsets.UTF_8));var expected=mac.doFinal(raw);
   for(var part:signatures.split(" "))if(part.startsWith("v1,")){try{if(MessageDigest.isEqual(expected,Base64.getDecoder().decode(part.substring(3))))return;}catch(IllegalArgumentException ignored){}}
  }catch(Exception ignored){}
  throw ApiException.unauthorized("Chữ ký webhook không hợp lệ.");
 }
}
