package com.example.backend.system.school.service;
import com.example.backend.system.realtime.controller.RealtimeChangePublisher;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import java.time.Instant;import java.util.*;
import static org.junit.jupiter.api.Assertions.*;import static org.mockito.Mockito.*;import static org.mockito.ArgumentMatchers.*;
class CustomerEmailWebhookTest {
 final NamedParameterJdbcTemplate jdbc=mock(NamedParameterJdbcTemplate.class);final CustomerEmailGateway gateway=mock(CustomerEmailGateway.class);final ObjectMapper json=new ObjectMapper();
 final CustomerEmailWebhook webhook=new CustomerEmailWebhook(jdbc,gateway,json,mock(RealtimeChangePublisher.class),mock(PlatformTransactionManager.class));
 final UUID provider=UUID.randomUUID(),token=UUID.randomUUID(),mail=UUID.randomUUID();
 com.fasterxml.jackson.databind.node.ObjectNode reply(String sender,String dmarc){var r=json.createObjectNode().put("id",provider.toString()).put("from",sender).put("subject","Re: hỗ trợ").put("text","Phản hồi của trường");r.putArray("to").add("reply+"+token+"@reply.example.com");r.putObject("authentication").put("dmarc",dmarc);r.putArray("attachments");return r;}
 void thread(){when(jdbc.queryForList(anyString(),anyMap())).thenReturn(List.of(Map.of("id",mail,"recipient","school@example.com")));}
 @Test void storesReplyOnlyForMatchingTokenAndOriginalRecipient(){thread();webhook.attach(provider,reply("School <SCHOOL@example.com>","pass"),Instant.now());verify(jdbc).update(contains("ON CONFLICT(provider_id) DO NOTHING"),argThat((Map<String,?> p)->mail.equals(p.get("email"))&&"school@example.com".equals(p.get("sender"))));}
 @Test void rejectsWrongSenderAndFailedAuthentication(){thread();webhook.attach(provider,reply("other@example.com","pass"),Instant.now());webhook.attach(provider,reply("school@example.com","fail"),Instant.now());verify(jdbc,never()).update(anyString(),anyMap());}
 @Test void ignoresUnknownTokenAndUnrelatedRecipient(){when(jdbc.queryForList(anyString(),anyMap())).thenReturn(List.of());webhook.attach(provider,reply("school@example.com","pass"),Instant.now());var r=reply("school@example.com","pass");r.putArray("to").add("support@reply.example.com");webhook.attach(provider,r,Instant.now());verify(jdbc,never()).update(anyString(),anyMap());}
 @Test void duplicateEventDoesNotFetchOrApplyAgain(){when(jdbc.queryForObject(anyString(),anyMap(),eq(Boolean.class))).thenReturn(true);webhook.handle("evt_duplicate",new byte[0]);verifyNoInteractions(gateway);verify(jdbc,never()).update(anyString(),anyMap());}
 @Test void validatesAddressesAndDeliveryPrecedence(){assertFalse(CustomerEmailService.validAddress("a@example.invalid"));assertFalse(CustomerEmailService.validAddress("a@example.com\r\nBcc: victim@example.com"));assertTrue(CustomerEmailService.validAddress("school@example.com"));assertTrue(CustomerEmailWebhook.RANK.get("email.bounced")>CustomerEmailWebhook.RANK.get("email.delivered"));}
}
