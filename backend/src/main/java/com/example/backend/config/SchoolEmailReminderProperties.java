package com.example.backend.config;
import java.net.URI;
import org.springframework.boot.context.properties.ConfigurationProperties;
@ConfigurationProperties(prefix="physlive.school-email-reminders")
public record SchoolEmailReminderProperties(boolean enabled, String applicationUrl, java.util.List<String> schoolCodes) {
 public SchoolEmailReminderProperties(boolean enabled,String applicationUrl){this(enabled,applicationUrl,java.util.List.of());}
 @org.springframework.boot.context.properties.bind.ConstructorBinding
 public SchoolEmailReminderProperties { schoolCodes=schoolCodes==null?java.util.List.of():schoolCodes.stream().filter(code->code!=null&&!code.isBlank()).map(String::trim).toList(); applicationUrl=applicationUrl==null?"":applicationUrl.trim().replaceAll("/+$",""); }
 public boolean validUrl(){try{var uri=URI.create(applicationUrl);return uri.getHost()!=null&&uri.getUserInfo()==null&&uri.getQuery()==null&&uri.getFragment()==null&&("https".equals(uri.getScheme())||("http".equals(uri.getScheme())&&java.util.Set.of("localhost","127.0.0.1").contains(uri.getHost())));}catch(IllegalArgumentException e){return false;}}
}
