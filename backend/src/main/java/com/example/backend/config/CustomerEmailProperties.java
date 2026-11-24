package com.example.backend.config;
import org.springframework.boot.context.properties.ConfigurationProperties;
@ConfigurationProperties(prefix="physlive.customer-email")
public record CustomerEmailProperties(boolean enabled,String edgeUrl,String bridgeSecret,String webhookSecret) {
 public CustomerEmailProperties {edgeUrl=edgeUrl==null?"":edgeUrl.trim();bridgeSecret=bridgeSecret==null?"":bridgeSecret.trim();webhookSecret=webhookSecret==null?"":webhookSecret.trim();}
 public boolean configured(){return enabled&&!edgeUrl.isBlank()&&bridgeSecret.length()>=32&&!webhookSecret.isBlank();}
}
