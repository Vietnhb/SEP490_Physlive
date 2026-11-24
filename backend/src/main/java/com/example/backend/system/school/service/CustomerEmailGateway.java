package com.example.backend.system.school.service;
import com.example.backend.config.CustomerEmailProperties;
import com.fasterxml.jackson.databind.*;
import java.net.URI;import java.net.http.*;import java.time.Duration;import java.util.*;
import org.springframework.stereotype.Component;
@Component
public class CustomerEmailGateway {
 private final CustomerEmailProperties config;private final ObjectMapper json;
 private final HttpClient http=HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).followRedirects(HttpClient.Redirect.NEVER).build();
 public CustomerEmailGateway(CustomerEmailProperties config,ObjectMapper json){this.config=config;this.json=json;}
 public static class GatewayException extends RuntimeException {public final boolean retryable;public GatewayException(boolean retryable){super("Dịch vụ email chưa xử lý được yêu cầu.");this.retryable=retryable;}}
 public JsonNode invoke(Map<String,Object> body){
  try{
   URI uri=URI.create(config.edgeUrl());if(!"https".equals(uri.getScheme())&&!Set.of("127.0.0.1","localhost").contains(uri.getHost()))throw new GatewayException(false);
   var request=HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(20)).header("Content-Type","application/json").header("X-PhysLive-Mail-Secret",config.bridgeSecret()).POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(body))).build();
   var response=http.send(request,HttpResponse.BodyHandlers.ofInputStream());
   byte[] bytes;try(var stream=response.body()){bytes=stream.readNBytes(400001);}if(bytes.length>400000)throw new GatewayException(true);
   if(response.statusCode()<200||response.statusCode()>=300)throw new GatewayException(response.statusCode()>=500||response.statusCode()==429);
   var result=json.readTree(bytes);if(result==null||!result.isObject())throw new GatewayException(true);return result;
  }catch(GatewayException e){throw e;}catch(InterruptedException e){Thread.currentThread().interrupt();throw new GatewayException(true);}catch(Exception e){throw new GatewayException(true);}
 }
 public UUID send(UUID id,String recipient,String subject,String body,UUID token){
  var response=invoke(Map.of("action","send","id",id,"to",recipient,"subject",subject,"text",body,"replyToken",token));
  try{return UUID.fromString(response.path("id").asText());}catch(Exception e){throw new GatewayException(true);}
 }
 public JsonNode received(UUID providerId){return invoke(Map.of("action","receive","id",providerId));}
}
