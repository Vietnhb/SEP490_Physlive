package com.example.backend.system.school.service;
import com.example.backend.config.CustomerEmailProperties;
import com.example.backend.system.realtime.controller.RealtimeChangePublisher;
import java.util.*;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
@Component
public class CustomerEmailWorker {
 private final CustomerEmailProperties config;private final CustomerEmailGateway gateway;private final NamedParameterJdbcTemplate jdbc;private final RealtimeChangePublisher changes;private final TransactionTemplate tx;private final SchoolEmailReminderService reminders;
 public CustomerEmailWorker(CustomerEmailProperties c,CustomerEmailGateway g,NamedParameterJdbcTemplate j,RealtimeChangePublisher p,PlatformTransactionManager manager,SchoolEmailReminderService reminders){this.reminders=reminders;config=c;gateway=g;jdbc=j;changes=p;tx=new TransactionTemplate(manager);}
 @Scheduled(fixedDelay=5000,initialDelay=10000) public void tick(){
  if(!config.configured())return;
  var row=tx.execute(status->{
   jdbc.update("UPDATE school_customer_emails SET status='UNKNOWN',lease_until=NULL,last_error='Chưa xác nhận được kết quả gửi sau các lần kiểm tra tự động. Xem nhật ký dịch vụ email để tra cứu.' WHERE (status='SENDING' AND lease_until<now() AND attempts>=5) OR (status IN('SENDING','QUEUED') AND created_at<=now()-interval '23 hours')",Map.of());
   var list=jdbc.queryForList("""
    WITH candidate AS (SELECT id FROM school_customer_emails WHERE created_at>now()-interval '23 hours'
     AND ((status IN('QUEUED','UNKNOWN') AND attempts<5 AND next_attempt_at<=now()) OR (status='SENDING' AND lease_until<now() AND attempts<5))
     ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED)
    UPDATE school_customer_emails e SET status='SENDING',attempts=attempts+1,lease_until=now()+interval '60 seconds'
    FROM candidate c WHERE e.id=c.id RETURNING e.*
    """,Map.of());return list.isEmpty()?null:list.getFirst();});
  if(row==null)return;var id=(UUID)row.get("id");
  if(!reminders.shouldSend(row)){
   tx.execute(status->{jdbc.update("UPDATE school_customer_emails SET status='SKIPPED',lease_until=NULL,last_error='Điều kiện nhắc đã thay đổi hoặc gửi tự động đang tắt.' WHERE id=:id AND status='SENDING'",Map.of("id",id));changes.changed("/api/reports/customer-usage");return null;});return;
  }
  try{
   var provider=gateway.send(id,(String)row.get("recipient"),(String)row.get("subject"),(String)row.get("body"),(UUID)row.get("reply_token"));
   tx.execute(status->{jdbc.update("UPDATE school_customer_emails SET provider_id=:provider,status=CASE WHEN delivery_rank>10 THEN status ELSE 'ACCEPTED' END,delivery_rank=greatest(delivery_rank,10),sent_at=coalesce(sent_at,now()),last_error=NULL,lease_until=NULL WHERE id=:id",Map.of("id",id,"provider",provider));project(jdbc,provider);changes.changed("/api/reports/customer-usage");return null;});
  }catch(CustomerEmailGateway.GatewayException e){
   tx.execute(status->{jdbc.update("UPDATE school_customer_emails SET status=:status,last_error=:error,lease_until=NULL,next_attempt_at=now()+interval '60 seconds' WHERE id=:id AND provider_id IS NULL AND status='SENDING'",Map.of("id",id,"status",e.retryable?"UNKNOWN":"FAILED","error",e.retryable?"Chưa xác định kết quả gửi. Hệ thống sẽ kiểm tra lại với cùng mã thư để tránh gửi trùng.":"Dịch vụ từ chối yêu cầu. Kiểm tra cấu hình gửi và địa chỉ người nhận."));changes.changed("/api/reports/customer-usage");return null;});
  }
 }
 static void project(NamedParameterJdbcTemplate jdbc,UUID provider){jdbc.update("""
  UPDATE school_customer_emails e SET status=v.delivery_status,delivery_rank=v.delivery_rank,status_at=v.occurred_at,last_error=NULL
  FROM (SELECT delivery_status,delivery_rank,occurred_at FROM school_customer_email_events WHERE provider_id=:provider AND delivery_status IS NOT NULL ORDER BY delivery_rank DESC,occurred_at DESC LIMIT 1) v
  WHERE e.provider_id=:provider AND (v.delivery_rank>e.delivery_rank OR (v.delivery_rank=e.delivery_rank AND (e.status_at IS NULL OR v.occurred_at>e.status_at)))
  """,Map.of("provider",provider));}
}
