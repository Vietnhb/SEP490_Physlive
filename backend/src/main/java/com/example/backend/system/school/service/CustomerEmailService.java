package com.example.backend.system.school.service;
import com.example.backend.config.CustomerEmailProperties;
import com.example.backend.exception.ApiException;
import com.example.backend.system.school.dto.CustomerEmailContracts.*;
import com.example.backend.system.realtime.controller.RealtimeChangePublisher;
import java.sql.*;import java.time.*;import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
@Service @RequiredArgsConstructor
public class CustomerEmailService {
 private final CustomerContactService contacts;private final NamedParameterJdbcTemplate jdbc;private final CustomerEmailProperties config;private final RealtimeChangePublisher changes;
 static Instant instant(ResultSet r,String column)throws SQLException{return r.getTimestamp(column)==null?null:r.getTimestamp(column).toInstant();}
 static final RowMapper<Mail> MAIL=(r,i)->new Mail(r.getObject("id",UUID.class),r.getString("actor_name"),r.getString("recipient"),r.getString("subject"),r.getString("body"),r.getString("reason"),r.getString("status"),r.getString("last_error"),r.getInt("attempts"),instant(r,"created_at"),instant(r,"sent_at"),instant(r,"status_at"),r.getLong("reply_count"),false);
 static final String SELECT="SELECT e.*,(SELECT count(*) FROM school_customer_email_replies r WHERE r.email_id=e.id) AS reply_count FROM school_customer_emails e ";
 static boolean validAddress(String address){return address!=null&&address.length()<=255&&address.matches("[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+")&&!address.contains("\r")&&!address.contains("\n")&&!address.toLowerCase(Locale.ROOT).endsWith(".invalid");}
 @Transactional(readOnly=true) public Page list(UUID schoolId,int page,int size){contacts.manager();contacts.school(schoolId);var p=new HashMap<String,Object>();p.put("school",schoolId);long total=Objects.requireNonNullElse(jdbc.queryForObject("SELECT count(*) FROM school_customer_emails WHERE school_id=:school",p,Long.class),0L);size=Math.clamp(size,1,50);int pages=Math.max(1,(int)((total+size-1)/size));page=Math.clamp(page,0,pages-1);p.put("limit",size);p.put("offset",page*size);return new Page(jdbc.query(SELECT+"WHERE e.school_id=:school ORDER BY e.created_at DESC,e.id DESC LIMIT :limit OFFSET :offset",p,MAIL),total,page,size,pages,config.configured());}
 Mail find(UUID schoolId,UUID emailId){return jdbc.query(SELECT+"WHERE e.school_id=:school AND e.id=:id",Map.of("school",schoolId,"id",emailId),MAIL).stream().findFirst().orElseThrow(()->ApiException.notFound("Không tìm thấy email của trường."));}
 @Transactional(readOnly=true) public ThreadDetail thread(UUID schoolId,UUID emailId,int page){contacts.manager();var email=find(schoolId,emailId);var p=new HashMap<String,Object>();p.put("id",emailId);long total=Objects.requireNonNullElse(jdbc.queryForObject("SELECT count(*) FROM school_customer_email_replies WHERE email_id=:id",p,Long.class),0L);int pages=Math.max(1,(int)((total+19)/20));page=Math.clamp(page,0,pages-1);p.put("offset",page*20);var replies=jdbc.query("SELECT * FROM school_customer_email_replies WHERE email_id=:id ORDER BY created_at DESC,id DESC LIMIT 20 OFFSET :offset",p,(r,i)->new Reply(r.getObject("id",UUID.class),r.getString("sender"),r.getString("subject"),r.getString("body"),r.getString("attachments"),instant(r,"received_at")));return new ThreadDetail(email,replies,total,page,20,pages);}
 @Transactional public Mail compose(UUID schoolId,Compose input){contacts.manager();throw ApiException.forbidden("Email nhắc được gửi tự động. Manager chỉ được xem nhật ký.");}
 @Transactional public Mail retry(UUID schoolId,UUID id){contacts.manager();throw ApiException.forbidden("Hệ thống tự thử lại email. Manager chỉ được xem nhật ký.");}
}
