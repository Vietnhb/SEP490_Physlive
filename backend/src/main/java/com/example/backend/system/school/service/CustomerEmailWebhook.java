package com.example.backend.system.school.service;
import com.example.backend.exception.ApiException;
import com.example.backend.system.realtime.controller.RealtimeChangePublisher;
import com.fasterxml.jackson.databind.*;
import java.sql.Timestamp;import java.time.Instant;import java.util.*;import java.util.regex.Pattern;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
@Service
public class CustomerEmailWebhook {
 private final NamedParameterJdbcTemplate jdbc;private final CustomerEmailGateway gateway;private final ObjectMapper json;private final RealtimeChangePublisher changes;private final TransactionTemplate tx;
 public CustomerEmailWebhook(NamedParameterJdbcTemplate jdbc,CustomerEmailGateway gateway,ObjectMapper json,RealtimeChangePublisher changes,PlatformTransactionManager manager){this.jdbc=jdbc;this.gateway=gateway;this.json=json;this.changes=changes;tx=new TransactionTemplate(manager);}
 static final Map<String,Integer> RANK=Map.of("email.sent",10,"email.delivery_delayed",20,"email.delivered",30,"email.failed",40,"email.bounced",50,"email.complained",60);
 static final Map<String,String> STATUS=Map.of("email.sent","ACCEPTED","email.delivery_delayed","DELAYED","email.delivered","DELIVERED","email.failed","FAILED","email.bounced","BOUNCED","email.complained","COMPLAINED");
 static final Pattern TOKEN=Pattern.compile("(?i)^reply\\+([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})@[^@]+$");
 static String mailbox(String raw){if(raw==null)return "";var value=raw.trim();int a=value.lastIndexOf('<'),b=value.lastIndexOf('>');if(a>=0&&b>a)value=value.substring(a+1,b);return value.trim().toLowerCase(Locale.ROOT);}
 public void handle(String eventId,byte[] raw){
  if(Boolean.TRUE.equals(jdbc.queryForObject("SELECT EXISTS(SELECT 1 FROM school_customer_email_events WHERE event_id=:id)",Map.of("id",eventId),Boolean.class)))return;
  JsonNode event;UUID provider;Instant occurred;String type;
  try{event=json.readTree(raw);type=event.path("type").asText();if(type.length()>64)throw new IllegalArgumentException();provider=UUID.fromString(event.path("data").path("email_id").asText());occurred=Instant.parse(event.path("created_at").asText());}catch(Exception e){throw ApiException.badRequest("Nội dung webhook không hợp lệ.");}
  JsonNode inbound=null;
  if("email.received".equals(type))inbound=gateway.received(provider);
  final JsonNode reply=inbound;
  tx.execute(status->{
   var p=new HashMap<String,Object>();p.put("event",eventId);p.put("provider",provider);p.put("type",type);p.put("at",Timestamp.from(occurred));p.put("rank",RANK.getOrDefault(type,0));p.put("status",STATUS.get(type));
   if(jdbc.update("INSERT INTO school_customer_email_events(event_id,provider_id,event_type,occurred_at,delivery_rank,delivery_status) VALUES(:event,:provider,:type,:at,:rank,:status) ON CONFLICT(event_id) DO NOTHING",p)==0)return null;
   if(reply!=null)attach(provider,reply,occurred);
   else CustomerEmailWorker.project(jdbc,provider);
   changes.changed("/api/reports/customer-usage");return null;
  });
 }
 void attach(UUID provider,JsonNode reply,Instant occurred){
  if(!provider.toString().equals(reply.path("id").asText()))throw ApiException.upstream("Không đọc được email trả lời.");
  if("fail".equalsIgnoreCase(reply.path("authentication").path("dmarc").asText()))return;
  var sender=mailbox(reply.path("from").asText());
  for(var recipient:reply.path("to")){
   var match=TOKEN.matcher(mailbox(recipient.asText()));if(!match.matches())continue;
   var threads=jdbc.queryForList("SELECT id,recipient FROM school_customer_emails WHERE reply_token=:token",Map.of("token",UUID.fromString(match.group(1))));
   if(threads.isEmpty()||!sender.equals(mailbox((String)threads.getFirst().get("recipient"))))continue;
   var p=new HashMap<String,Object>();p.put("id",UUID.randomUUID());p.put("email",threads.getFirst().get("id"));p.put("provider",provider);p.put("sender",sender);p.put("subject",limit(reply.path("subject").asText(),998));p.put("body",limit(reply.path("text").asText("Email này không có nội dung văn bản."),100000));
   var attachments=reply.path("attachments");p.put("attachments",attachments.isArray()?attachments.toString():"[]");p.put("at",Timestamp.from(occurred));
   jdbc.update("INSERT INTO school_customer_email_replies(id,email_id,provider_id,sender,subject,body,attachments,received_at) VALUES(:id,:email,:provider,:sender,:subject,:body,CAST(:attachments AS jsonb),:at) ON CONFLICT(provider_id) DO NOTHING",p);return;
  }
 }
 static String limit(String text,int max){return text.length()>max?text.substring(0,max):text;}
}
