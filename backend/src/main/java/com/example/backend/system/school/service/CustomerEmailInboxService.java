package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.realtime.controller.RealtimeChangePublisher;
import java.time.*;
import java.sql.Timestamp;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class CustomerEmailInboxService {
 private final CustomerContactService contacts;
 private final NamedParameterJdbcTemplate jdbc;
 private final RealtimeChangePublisher changes;
 public record Item(UUID id,UUID schoolId,String schoolName,String recipient,String subject,String preview,
   String status,String actorName,Instant createdAt,Instant activityAt,long replyCount,long unreadCount,UUID latestReplyId) {}
 public record Page(List<Item> items,long totalElements,int page,int size,int totalPages) {}
 public record Notifications(long unreadCount,List<Item> items) {}
 public record Read(List<UUID> replyIds) {}
 // System-email replies are visible to all managers, with independent per-manager read receipts.
 // Legacy manual-email notifications remain scoped to their original sender.
 static final String FROM="""
  FROM school_customer_emails e JOIN schools s ON s.id=e.school_id
  LEFT JOIN LATERAL (
   SELECT count(*) AS replies,
    count(*) FILTER(WHERE (e.actor_id=:actor OR e.actor_id IS NULL) AND NOT EXISTS(
     SELECT 1 FROM school_customer_email_reads rd WHERE rd.reply_id=r.id AND rd.actor_id=:actor)) AS unread
   FROM school_customer_email_replies r WHERE r.email_id=e.id
  ) counts ON true
  LEFT JOIN LATERAL (
   SELECT r.id,r.body,r.created_at FROM school_customer_email_replies r WHERE r.email_id=e.id
   ORDER BY r.created_at DESC,r.id DESC LIMIT 1
  ) latest ON true
  """;
 static final String SELECT="""
  SELECT e.id,e.school_id,s.name AS school_name,e.recipient,e.subject,
   left(coalesce(latest.body,e.body),200) AS preview,e.status,e.actor_name,e.created_at,
   greatest(e.created_at,coalesce(latest.created_at,e.created_at)) AS activity_at,
   counts.replies AS reply_count,counts.unread AS unread_count,latest.id AS latest_reply_id
  """;
 static Instant time(java.sql.ResultSet r,String name)throws java.sql.SQLException{return r.getTimestamp(name).toInstant();}
 @Transactional(readOnly=true)
 public Page list(String query,String filter,String delivery,UUID schoolId,LocalDate from,LocalDate to,int page,int size){
  var actor=contacts.manager();
  if(!Set.of("ALL","UNREAD","REPLIED").contains(filter))throw ApiException.badRequest("Bộ lọc thư không hợp lệ.");
  if(!delivery.isEmpty()&&!Set.of("QUEUED","SENDING","UNKNOWN","ACCEPTED","DELAYED","DELIVERED","BOUNCED","COMPLAINED","FAILED","SKIPPED").contains(delivery))throw ApiException.badRequest("Trạng thái gửi không hợp lệ.");
  if(from!=null&&to!=null&&from.isAfter(to))throw ApiException.badRequest("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
  var p=new HashMap<String,Object>();p.put("actor",actor.getId());
  String where=" WHERE true";
  if(query!=null&&!query.isBlank()){where+=" AND (strpos(lower(s.name),:query)>0 OR strpos(lower(e.subject),:query)>0 OR strpos(lower(e.recipient),:query)>0)";p.put("query",query.trim().toLowerCase(Locale.ROOT));}
  if("UNREAD".equals(filter))where+=" AND counts.unread>0";
  if("REPLIED".equals(filter))where+=" AND counts.replies>0";
  if(!delivery.isEmpty()){where+=" AND e.status=:delivery";p.put("delivery",delivery);}
  if(schoolId!=null){where+=" AND e.school_id=:school";p.put("school",schoolId);}
  var zone=ZoneId.of("Asia/Ho_Chi_Minh");
  if(from!=null){where+=" AND e.created_at>=:from";p.put("from",Timestamp.from(from.atStartOfDay(zone).toInstant()));}
  if(to!=null){where+=" AND e.created_at<:to";p.put("to",Timestamp.from(to.plusDays(1).atStartOfDay(zone).toInstant()));}
  long total=Objects.requireNonNullElse(jdbc.queryForObject("SELECT count(*) "+FROM+where,p,Long.class),0L);
  size=Math.clamp(size,1,50);int pages=Math.max(1,(int)((total+size-1)/size));page=Math.clamp(page,0,pages-1);
  p.put("limit",size);p.put("offset",page*size);
  return new Page(items(where,p),total,page,size,pages);
 }
 private List<Item> items(String where,Map<String,Object> p){
  return jdbc.query(SELECT+FROM+where+" ORDER BY activity_at DESC,e.id DESC LIMIT :limit OFFSET :offset",p,(r,i)->new Item(
   r.getObject("id",UUID.class),r.getObject("school_id",UUID.class),r.getString("school_name"),r.getString("recipient"),r.getString("subject"),r.getString("preview"),r.getString("status"),r.getString("actor_name"),time(r,"created_at"),time(r,"activity_at"),r.getLong("reply_count"),r.getLong("unread_count"),r.getObject("latest_reply_id",UUID.class)));
 }
 @Transactional(readOnly=true) public Notifications notifications(){
  var actor=contacts.manager();var p=new HashMap<String,Object>();p.put("actor",actor.getId());p.put("limit",5);p.put("offset",0);
  long total=Objects.requireNonNullElse(jdbc.queryForObject("SELECT count(*) "+FROM+" WHERE counts.unread>0",p,Long.class),0L);
  return new Notifications(total,items(" WHERE counts.unread>0",p));
 }
 @Transactional public void read(UUID emailId,Read input){
  var actor=contacts.manager();
  if(input==null||input.replyIds()==null||input.replyIds().size()>20||input.replyIds().stream().anyMatch(Objects::isNull))throw ApiException.badRequest("Danh sách thư đã đọc không hợp lệ.");
  if(input.replyIds().isEmpty())return;
  // Mark only replies actually displayed, never a newer response that arrived while the thread was loading.
  int changed=jdbc.update("""
   INSERT INTO school_customer_email_reads(actor_id,reply_id)
   SELECT :actor,r.id FROM school_customer_email_replies r
   JOIN school_customer_emails e ON e.id=r.email_id
   WHERE e.id=:email AND (e.actor_id=:actor OR e.actor_id IS NULL) AND r.id IN(:ids)
   ON CONFLICT(actor_id,reply_id) DO NOTHING
   """,Map.of("actor",actor.getId(),"email",emailId,"ids",input.replyIds()));
  if(changed>0)changes.changed("/api/reports/customer-usage/email-inbox");
 }
}
