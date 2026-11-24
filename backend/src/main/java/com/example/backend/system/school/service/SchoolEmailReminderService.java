package com.example.backend.system.school.service;

import com.example.backend.config.CustomerEmailProperties;
import com.example.backend.config.SchoolEmailReminderProperties;
import com.example.backend.system.realtime.controller.RealtimeChangePublisher;
import java.time.*;
import java.time.temporal.ChronoUnit;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service @RequiredArgsConstructor
public class SchoolEmailReminderService {
 private final CustomerEmailProperties mail;
 private final SchoolEmailReminderProperties config;
 private final NamedParameterJdbcTemplate jdbc;
 private final RealtimeChangePublisher changes;
 private final CustomerContactService contacts;
 static final ZoneId ZONE=ZoneId.of("Asia/Ho_Chi_Minh");
 record School(UUID id,String name,String recipient,boolean active,LocalDate start,LocalDate end,LocalDate usageMonth,long used,Long quota) {}
 record Reminder(String key,String reason,String title,String description) {}
 public record Settings(boolean enabled,boolean configured) {}
 public Settings settings(){contacts.manager();return new Settings(config.enabled(),mail.configured()&&config.validUrl());}
 static final String SCHOOLS="""
  SELECT s.id,s.name,s.active,s.license_start,s.license_end,s.token_usage_month,s.used_tokens,s.monthly_token_quota,
   coalesce(nullif(trim(s.contact_email),''),m.email) AS recipient
  FROM schools s LEFT JOIN LATERAL (
   SELECT u.email FROM users u JOIN roles r ON r.id=u.role_id
   WHERE u.school_id=s.id AND r.name='SCHOOL' AND u.active=true ORDER BY u.id LIMIT 1
  ) m ON true
  """;
 private List<School> schools(String where,Map<String,?> params){
  return jdbc.query(SCHOOLS+where,params,(r,i)->new School(r.getObject("id",UUID.class),r.getString("name"),r.getString("recipient"),r.getBoolean("active"),
   r.getObject("license_start",LocalDate.class),r.getObject("license_end",LocalDate.class),r.getObject("token_usage_month",LocalDate.class),r.getLong("used_tokens"),r.getObject("monthly_token_quota")==null?null:r.getLong("monthly_token_quota")));
 }
 static List<Reminder> due(School school,LocalDate today){
  if(!school.active()||school.start()==null||school.end()==null||(school.start()!=null&&school.start().isAfter(today)))return List.of();
  var result=new ArrayList<Reminder>();long days=ChronoUnit.DAYS.between(today,school.end());
  // Notify only the current milestone; do not replay historical reminders after downtime.
  if(days>=-1&&days<=30){int milestone=days<0?0:days<=1?1:days<=7?7:30;
   result.add(new Reminder("LICENSE:"+school.end()+":"+milestone,"LICENSE",days<0?"Gói sử dụng đã hết hạn":"Gói sử dụng sắp hết hạn",
    "Gói của trường hết hạn ngày "+school.end().format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"))+
    (days<0?". Vui lòng gia hạn để tiếp tục sử dụng.":" (còn "+days+" ngày). Vui lòng kiểm tra và gia hạn trước ngày hết hạn.")));
  }
  if(days>=0&&school.quota()!=null){long used=today.withDayOfMonth(1).equals(school.usageMonth())?school.used():0;long quota=school.quota();
   int milestone=used>=quota?100:used>=quota*.95?95:used>=quota*.8?80:0;
   if(milestone>0)result.add(new Reminder("AI_QUOTA:"+today.withDayOfMonth(1)+":"+milestone,"AI_QUOTA",milestone==100?"Đã hết hạn mức AI tháng này":"Sắp hết hạn mức AI tháng này",
    "Tháng "+today.getMonthValue()+"/"+today.getYear()+": trường đã dùng "+String.format(Locale.forLanguageTag("vi-VN"),"%,d",used)+" / "+String.format(Locale.forLanguageTag("vi-VN"),"%,d",quota)+" token, còn "+String.format(Locale.forLanguageTag("vi-VN"),"%,d",Math.max(0,quota-used))+" token. "+
    (milestone==100?"Các tính năng dùng AI tạm dừng. ":"")+"Hạn mức được làm mới vào đầu tháng sau. Trường có thể nâng gói nếu cần sử dụng thêm."));
  }
  return result;
 }
 @Scheduled(fixedDelayString="${physlive.school-email-reminders.check-interval-ms:900000}",initialDelay=60000)
 @Transactional public void check(){
  if(!config.enabled()||!mail.configured()||!config.validUrl())return;
  var today=LocalDate.now(ZONE);int count=0;
  var params=new HashMap<String,Object>();params.put("oldest",today.minusDays(1));
  String scope=" WHERE s.active=true AND s.license_end>=:oldest";
  if(!config.schoolCodes().isEmpty()){scope+=" AND s.code IN(:codes)";params.put("codes",config.schoolCodes());}
  for(var school:schools(scope,params)){
   if(!CustomerEmailService.validAddress(school.recipient())||school.recipient().toLowerCase(Locale.ROOT).endsWith(".test"))continue;
   for(var reminder:due(school,today)){
    var p=new HashMap<String,Object>();p.put("id",UUID.randomUUID());p.put("school",school.id());p.put("request",UUID.randomUUID());p.put("token",UUID.randomUUID());p.put("to",school.recipient().trim());p.put("key",reminder.key());p.put("reason",reminder.reason());
    String subject="[PhysLive] "+reminder.title()+" – "+school.name();p.put("subject",subject.substring(0,Math.min(180,subject.length())));
    p.put("body","Kính gửi Nhà trường "+school.name()+",\n\n"+reminder.description()+"\n\nXem gói và hạn mức: "+config.applicationUrl()+"/school/billing\nCần hỗ trợ: "+config.applicationUrl()+"/support\n\nĐây là email nhắc tự động từ PhysLive.");
    count+=jdbc.update("""
     INSERT INTO school_customer_emails(id,school_id,actor_id,actor_name,request_id,recipient,subject,body,reason,reply_token,reminder_key)
     VALUES(:id,:school,NULL,'Hệ thống PhysLive',:request,:to,:subject,:body,:reason,:token,:key)
     ON CONFLICT(school_id,reminder_key) WHERE reminder_key IS NOT NULL DO NOTHING
     """,p);
   }
  }
  if(count>0)changes.changed("/api/reports/customer-usage");
 }
 // Retry unknown results using the same immutable payload and provider idempotency key.
 boolean shouldSend(Map<String,Object> email){
  if(email.get("reminder_key")==null)return false;
  if(((Number)email.get("attempts")).intValue()>1)return true;
  if(!config.enabled())return false;
  return schools(" WHERE s.id=:id",Map.of("id",email.get("school_id"))).stream().anyMatch(school->
   Objects.equals(school.recipient()==null?null:school.recipient().trim(),email.get("recipient"))&&due(school,LocalDate.now(ZONE)).stream().anyMatch(reminder->reminder.key().equals(email.get("reminder_key"))));
 }
}
