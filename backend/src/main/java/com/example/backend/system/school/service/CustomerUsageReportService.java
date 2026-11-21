package com.example.backend.system.school.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.service.CurrentUserService;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.*;
import java.util.*;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.RowMapper;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.*;

/** Usage derives from persisted business records, never from current account membership. */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
public class CustomerUsageReportService {
    private final CurrentUserService current;
    private final NamedParameterJdbcTemplate jdbc;
    static final ZoneId ZONE = ZoneId.of("Asia/Ho_Chi_Minh");
    public record Row(UUID id, String name, String code, String plan, LocalDate licenseEnd,
        long activeUsers, long aiCalls, long assignments, long submissions, long tokens, long revenue,
        Instant lastActivity, String attention) {}
    public record Point(String label, long activeUsers, long aiCalls, long assignments, long submissions, long revenue) {}
    public record Group(String key, long count) {}
    public record Summary(long schools, long activeSchools, long activeUsers, long aiCalls, long assignments,
        long submissions, long tokens, long revenue) {}
    public record Report(int year, Integer month, Summary summary, List<Point> trend, List<Row> ranking,
        List<Group> attention, List<Row> items, long totalElements, int page, int size, int totalPages,
        List<String> plans, Instant firstRecordedAt, Instant asOf) {}
    record Context(Map<String,Object> params, Instant now) {}
    static final String SOURCES = """
        WITH school_scope AS (
          SELECT * FROM schools WHERE (CAST(:schoolId AS uuid) IS NULL OR id=CAST(:schoolId AS uuid))
            AND (:plan='' OR coalesce(plan_code,'')=:plan)
            AND strpos(lower(name||' '||code),:query)>0
        ), events AS (
          SELECT t.school_id,t.user_id AS actor,t.recorded_at AS at,'AI' AS kind,t.tokens,0::bigint AS revenue
          FROM token_usage_audits t JOIN school_scope s ON s.id=t.school_id
          UNION ALL
          SELECT c.school_id,a.teacher_id,a.assigned_at,'ASSIGNED',0,0
          FROM assignments a JOIN school_classes c ON c.id=a.school_class_id JOIN school_scope s ON s.id=c.school_id
          UNION ALL
          SELECT c.school_id,u.student_id,u.completed_at,'SUBMITTED',0,0
          FROM assignment_submissions u JOIN assignments a ON a.id=u.assignment_id
          JOIN school_classes c ON c.id=a.school_class_id JOIN school_scope s ON s.id=c.school_id
          WHERE u.completed_at IS NOT NULL
          UNION ALL
          SELECT p.school_id,NULL::integer,coalesce(p.paid_at,p.created_at),'PAYMENT',0,p.amount_vnd
          FROM school_payments p JOIN school_scope s ON s.id=p.school_id
          WHERE p.status='PAID' AND coalesce(p.paid_at,p.created_at) IS NOT NULL
        )
        """;
    static final String ROWS = SOURCES + """
        , totals AS (
          SELECT school_id,
            count(DISTINCT actor) FILTER(WHERE at>=:from AND at<:until) AS active_users,
            count(*) FILTER(WHERE kind='AI' AND at>=:from AND at<:until) AS ai_calls,
            count(*) FILTER(WHERE kind='ASSIGNED' AND at>=:from AND at<:until) AS assignments,
            count(*) FILTER(WHERE kind='SUBMITTED' AND at>=:from AND at<:until) AS submissions,
            coalesce(sum(tokens) FILTER(WHERE at>=:from AND at<:until),0) AS tokens,
            coalesce(sum(revenue) FILTER(WHERE at>=:from AND at<:until),0) AS revenue,
            max(at) FILTER(WHERE kind<>'PAYMENT' AND at<=:now) AS last_activity,
            coalesce(sum(tokens) FILTER(WHERE at>=:quotaFrom AND at<:quotaUntil),0) AS month_tokens
          FROM events GROUP BY school_id
        )
        SELECT s.id,s.name,s.code,s.plan_code,s.license_end,
          coalesce(t.active_users,0) AS active_users,coalesce(t.ai_calls,0) AS ai_calls,
          coalesce(t.assignments,0) AS assignments,coalesce(t.submissions,0) AS submissions,
          coalesce(t.tokens,0) AS tokens,coalesce(t.revenue,0) AS revenue,t.last_activity,
          CASE WHEN s.active AND s.license_end BETWEEN :today AND :soon THEN 'EXPIRING'
            WHEN s.monthly_token_quota IS NOT NULL AND s.monthly_token_quota>0
              AND coalesce(t.month_tokens,0)>=s.monthly_token_quota*0.8 THEN 'QUOTA'
            WHEN t.last_activity<:idle THEN 'IDLE'
            WHEN t.last_activity IS NULL THEN 'UNKNOWN' ELSE 'NONE' END AS attention
        FROM school_scope s LEFT JOIN totals t ON t.school_id=s.id
        """;
    static final RowMapper<Row> ROW = (rs,i) -> new Row(rs.getObject("id",UUID.class),rs.getString("name"),
        rs.getString("code"),rs.getString("plan_code"),rs.getObject("license_end",LocalDate.class),
        rs.getLong("active_users"),rs.getLong("ai_calls"),rs.getLong("assignments"),rs.getLong("submissions"),
        rs.getLong("tokens"),rs.getLong("revenue"),rs.getTimestamp("last_activity")==null?null:rs.getTimestamp("last_activity").toInstant(),rs.getString("attention"));

    Context prepare(int year,Integer month,String query,String plan,String sort,String attention,UUID schoolId) {
        var user=current.requireCurrentUser();
        if(user.getRole()==null || !"MANAGER".equals(user.getRole().getName())
            || !Boolean.TRUE.equals(user.getActive()) || user.isSuspendedReadOnly())
            throw ApiException.forbidden("Chỉ Manager được xem báo cáo khách hàng.");
        if(year<2000 || year>2100 || (month!=null && (month<1 || month>12)))
            throw ApiException.badRequest("Năm hoặc tháng không hợp lệ.");
        if(query==null || query.length()>200 || plan==null || plan.length()>80)
            throw ApiException.badRequest("Bộ lọc quá dài.");
        if(!Set.of("aiCalls","activeUsers","assignments","submissions","tokens","revenue").contains(sort)
            || !Set.of("ALL","EXPIRING","QUOTA","IDLE","UNKNOWN","NONE").contains(attention))
            throw ApiException.badRequest("Bộ lọc chăm sóc hoặc sắp xếp không hợp lệ.");
        var now=Instant.now();var today=now.atZone(ZONE).toLocalDate();
        LocalDate start=LocalDate.of(year,month==null?1:month,1);
        LocalDate end=month==null?start.plusYears(1):start.plusMonths(1);
        Map<String,Object> p=new HashMap<>();
        p.put("query",query.trim().toLowerCase(Locale.ROOT));p.put("plan",plan);p.put("schoolId",schoolId==null?null:schoolId.toString());
        p.put("from",stamp(start));p.put("until",stamp(end));p.put("now",Timestamp.from(now));
        p.put("today",java.sql.Date.valueOf(today));p.put("soon",java.sql.Date.valueOf(today.plusDays(30)));
        p.put("idle",Timestamp.from(now.minus(Duration.ofDays(30))));
        p.put("quotaFrom",stamp(today.withDayOfMonth(1)));p.put("quotaUntil",stamp(today.withDayOfMonth(1).plusMonths(1)));
        return new Context(p,now);
    }
    private static Timestamp stamp(LocalDate day){return Timestamp.from(day.atStartOfDay(ZONE).toInstant());}
    static Comparator<Row> order(String sort){
        java.util.function.ToLongFunction<Row> value=switch(sort){case "activeUsers"->Row::activeUsers;case "assignments"->Row::assignments;
            case "submissions"->Row::submissions;case "tokens"->Row::tokens;case "revenue"->Row::revenue;default->Row::aiCalls;};
        return Comparator.comparingLong(value).reversed().thenComparing(Row::name).thenComparing(Row::id);
    }
    public Report report(int year,Integer month,String query,String plan,String sort,String attention,UUID schoolId,int page,int size){
        Context ctx=prepare(year,month,query,plan,sort,attention,schoolId);
        List<Row> all=jdbc.query(ROWS,ctx.params(),ROW);
        List<Row> filtered=all.stream().filter(row->"ALL".equals(attention)||attention.equals(row.attention())).sorted(order(sort)).toList();
        // Use the same school set for every chart, total, export and table (not just the visible page).
        ctx.params().put("ids",filtered.stream().map(Row::id).toList());
        long users=0;Instant first=null;List<Point> trend=new ArrayList<>();
        if(!filtered.isEmpty()){
            var meta=jdbc.queryForMap(SOURCES+"SELECT count(DISTINCT actor) FILTER(WHERE at>=:from AND at<:until) AS users,min(at) AS first FROM events WHERE school_id IN (:ids)",ctx.params());
            users=((Number)meta.get("users")).longValue();if(meta.get("first") instanceof Timestamp time)first=time.toInstant();
            String bucket=month==null?"YYYY-MM":"YYYY-MM-DD";
            var points=jdbc.queryForList(SOURCES+"SELECT to_char(at AT TIME ZONE 'Asia/Ho_Chi_Minh','"+bucket+"') AS label,count(DISTINCT actor) AS users,count(*) FILTER(WHERE kind='AI') AS calls,count(*) FILTER(WHERE kind='ASSIGNED') AS assigned,count(*) FILTER(WHERE kind='SUBMITTED') AS submitted,coalesce(sum(revenue),0) AS revenue FROM events WHERE school_id IN (:ids) AND at>=:from AND at<:until GROUP BY label ORDER BY label",ctx.params());
            for(var p:points)trend.add(new Point((String)p.get("label"),num(p,"users"),num(p,"calls"),num(p,"assigned"),num(p,"submitted"),num(p,"revenue")));
        }
        int count=month==null?12:YearMonth.of(year,month).lengthOfMonth();Map<String,Point> points=new HashMap<>();trend.forEach(point->points.put(point.label(),point));trend.clear();
        for(int i=1;i<=count;i++){String key=month==null?String.format(Locale.ROOT,"%04d-%02d",year,i):String.format(Locale.ROOT,"%04d-%02d-%02d",year,month,i);trend.add(points.getOrDefault(key,new Point(key,0,0,0,0,0)));}
        Summary summary=new Summary(filtered.size(),filtered.stream().filter(r->r.activeUsers()>0).count(),users,
            filtered.stream().mapToLong(Row::aiCalls).sum(),filtered.stream().mapToLong(Row::assignments).sum(),filtered.stream().mapToLong(Row::submissions).sum(),
            filtered.stream().mapToLong(Row::tokens).sum(),filtered.stream().mapToLong(Row::revenue).sum());
        var groups=List.of("EXPIRING","QUOTA","IDLE","UNKNOWN","NONE").stream().map(key->new Group(key,filtered.stream().filter(r->key.equals(r.attention())).count())).toList();
        size=Math.clamp(size,1,50);int pages=Math.max(1,(filtered.size()+size-1)/size);page=Math.clamp(page,0,pages-1);
        List<String> plans=jdbc.queryForList("SELECT DISTINCT plan_code FROM schools WHERE plan_code IS NOT NULL ORDER BY plan_code",Map.of(),String.class);
        return new Report(year,month,summary,trend,filtered.stream().filter(r->metric(r,sort)>0).limit(5).toList(),groups,
            filtered.subList(page*size,Math.min(filtered.size(),(page+1)*size)),filtered.size(),page,size,pages,plans,first,ctx.now());
    }
    private static long num(Map<String,Object> row,String key){return ((Number)row.get(key)).longValue();}
    private static long metric(Row row,String sort){return switch(sort){case "activeUsers"->row.activeUsers();case "assignments"->row.assignments();case "submissions"->row.submissions();case "tokens"->row.tokens();case "revenue"->row.revenue();default->row.aiCalls();};}
    public byte[] csv(int year,Integer month,String query,String plan,String sort,String attention){
        Context ctx=prepare(year,month,query,plan,sort,attention,null);
        var rows=jdbc.query(ROWS,ctx.params(),ROW).stream().filter(r->"ALL".equals(attention)||attention.equals(r.attention())).sorted(order(sort)).toList();
        StringBuilder csv=new StringBuilder("\uFEFF");
        ClassAssignmentReportService.csvRow(csv,"Năm","Tháng","Trường","Mã trường","Gói hiện tại","Người dùng hoạt động","Lượt dùng AI","Bài giao","Bài nộp","Token AI","Doanh thu đã thanh toán (đ)","Hoạt động gần nhất","Chăm sóc hiện tại");
        for(var row:rows)ClassAssignmentReportService.csvRow(csv,year,month==null?"Cả năm":month,row.name(),row.code(),row.plan(),row.activeUsers(),row.aiCalls(),row.assignments(),row.submissions(),row.tokens(),row.revenue(),row.lastActivity()==null?"Chưa ghi nhận":row.lastActivity().atZone(ZONE).toLocalDateTime(),attentionLabel(row.attention()));
        return csv.toString().getBytes(StandardCharsets.UTF_8);
    }
    private static String attentionLabel(String key){return switch(key){case "EXPIRING"->"Hết hạn trong 30 ngày";case "QUOTA"->"Đã dùng từ 80% token tháng hiện tại";case "IDLE"->"Không hoạt động 30 ngày";case "UNKNOWN"->"Chưa ghi nhận hoạt động";default->"Đang theo dõi";};}
}
