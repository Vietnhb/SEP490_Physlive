package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.service.CurrentUserService;
import jakarta.validation.constraints.*;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class CustomerContactService {
 private final CurrentUserService current;
 private final NamedParameterJdbcTemplate jdbc;
 public enum Channel { EMAIL, PHONE, OTHER }
 public enum Reason { LICENSE, AI_QUOTA, USAGE, OTHER }
 public enum Outcome { NO_ANSWER, WAITING, CONTACTED, RESOLVED }
 public record Save(@NotNull Channel channel,@NotNull Reason reason,@NotNull Outcome outcome,
   @NotBlank @Size(max=2000) String note,@NotNull Instant contactedAt,Instant nextFollowUpAt) {}
 public record Entry(UUID id,String actorName,String channel,String reason,String outcome,String recipient,String note,
   Instant contactedAt,Instant nextFollowUpAt,Instant createdAt) {}
 public record SchoolInfo(UUID id,String name,String code,String contactName,String email,String phone) {}
 public record Page(SchoolInfo school,List<Entry> items,long totalElements,int page,int size,int totalPages) {}
 static final RowMapper<SchoolInfo> SCHOOL=(r,i)->new SchoolInfo(r.getObject("id",UUID.class),r.getString("name"),r.getString("code"),r.getString("contact_name"),r.getString("email"),r.getString("phone_number"));
 static final RowMapper<Entry> ENTRY=(r,i)->new Entry(r.getObject("id",UUID.class),r.getString("actor_name"),r.getString("channel"),r.getString("reason"),r.getString("outcome"),r.getString("recipient"),r.getString("note"),r.getTimestamp("contacted_at").toInstant(),r.getTimestamp("next_follow_up_at")==null?null:r.getTimestamp("next_follow_up_at").toInstant(),r.getTimestamp("created_at").toInstant());
 com.example.backend.system.account.model.entity.User manager(){
  var user=current.requireCurrentUser();
  if(user.getRole()==null || !"MANAGER".equals(user.getRole().getName()) || !Boolean.TRUE.equals(user.getActive()) || user.isSuspendedReadOnly())
   throw ApiException.forbidden("Chỉ Manager đang hoạt động được quản lý liên hệ trường.");
  return user;
 }
 SchoolInfo school(UUID id){
  return jdbc.query("""
   SELECT s.id,s.name,s.code,s.phone_number,m.full_name AS contact_name,
    coalesce(nullif(trim(s.contact_email),''),m.email) AS email
   FROM schools s LEFT JOIN LATERAL (
    SELECT u.full_name,u.email FROM users u JOIN roles r ON r.id=u.role_id
    WHERE u.school_id=s.id AND r.name='SCHOOL' AND u.active=true ORDER BY u.id LIMIT 1
   ) m ON true WHERE s.id=:schoolId
   """,Map.of("schoolId",id),SCHOOL).stream().findFirst().orElseThrow(()->ApiException.notFound("Không tìm thấy trường học."));
 }
 @Transactional(readOnly=true)
 public Page list(UUID schoolId,int page,int size){
  manager();var school=school(schoolId);var p=new HashMap<String,Object>();p.put("schoolId",schoolId);
  long total=Objects.requireNonNullElse(jdbc.queryForObject("SELECT count(*) FROM school_customer_contacts WHERE school_id=:schoolId",p,Long.class),0L);
  size=Math.clamp(size,1,50);int pages=Math.max(1,(int)((total+size-1)/size));page=Math.clamp(page,0,pages-1);
  p.put("limit",size);p.put("offset",page*size);
  var entries=jdbc.query("SELECT * FROM school_customer_contacts WHERE school_id=:schoolId ORDER BY contacted_at DESC,created_at DESC,id DESC LIMIT :limit OFFSET :offset",p,ENTRY);
  return new Page(school,entries,total,page,size,pages);
 }
 @Transactional
 public Entry save(UUID schoolId,Save input){
  var actor=manager();
  if(input==null || input.channel()==null || input.reason()==null || input.outcome()==null || input.contactedAt()==null || input.note()==null || input.note().isBlank() || input.note().length()>2000)
   throw ApiException.badRequest("Vui lòng nhập đầy đủ thông tin và ghi chú tối đa 2.000 ký tự.");
  var now=Instant.now();
  if(input.contactedAt().isAfter(now))throw ApiException.badRequest("Thời gian liên hệ không được ở tương lai.");
  if(input.nextFollowUpAt()!=null && (!input.nextFollowUpAt().isAfter(now) || !input.nextFollowUpAt().isAfter(input.contactedAt())))
   throw ApiException.badRequest("Ngày nhắc lại phải sau thời điểm hiện tại và thời gian liên hệ.");
  if(input.outcome()==Outcome.RESOLVED && input.nextFollowUpAt()!=null)throw ApiException.badRequest("Liên hệ đã hoàn tất không cần ngày nhắc lại.");
  var school=school(schoolId);
  String recipient=switch(input.channel()){case EMAIL->school.email();case PHONE->school.phone();case OTHER->null;};
  var id=UUID.randomUUID();var p=new HashMap<String,Object>();
  p.put("id",id);p.put("schoolId",schoolId);p.put("actor",actor.getId());p.put("name",actor.getFullName());
  p.put("channel",input.channel().name());p.put("reason",input.reason().name());p.put("outcome",input.outcome().name());p.put("recipient",recipient);p.put("note",input.note().trim());
  p.put("at",Timestamp.from(input.contactedAt()));p.put("followup",input.nextFollowUpAt()==null?null:Timestamp.from(input.nextFollowUpAt()));p.put("now",Timestamp.from(now));
  jdbc.update("""
   INSERT INTO school_customer_contacts(id,school_id,actor_id,actor_name,channel,reason,outcome,recipient,note,contacted_at,next_follow_up_at,created_at)
   VALUES(:id,:schoolId,:actor,:name,:channel,:reason,:outcome,:recipient,:note,:at,:followup,:now)
   """,p);
  return new Entry(id,actor.getFullName(),input.channel().name(),input.reason().name(),input.outcome().name(),recipient,input.note().trim(),input.contactedAt(),input.nextFollowUpAt(),now);
 }
}
