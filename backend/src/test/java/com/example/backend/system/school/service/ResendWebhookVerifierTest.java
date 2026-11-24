package com.example.backend.system.school.service;
import com.example.backend.config.CustomerEmailProperties;
import com.example.backend.exception.ApiException;
import org.junit.jupiter.api.Test;
import java.nio.charset.StandardCharsets;import java.time.Instant;import java.util.Base64;
import javax.crypto.Mac;import javax.crypto.spec.SecretKeySpec;
import static org.junit.jupiter.api.Assertions.*;
class ResendWebhookVerifierTest {
 final byte[] key="fixture-secret-only-no-production-key".getBytes(StandardCharsets.UTF_8);
 final ResendWebhookVerifier verifier=new ResendWebhookVerifier(new CustomerEmailProperties(true,"https://example.com/function","x".repeat(32),"whsec_"+Base64.getEncoder().encodeToString(key)));
 String sign(String id,String time,byte[] body)throws Exception{var mac=Mac.getInstance("HmacSHA256");mac.init(new SecretKeySpec(key,"HmacSHA256"));mac.update((id+"."+time+".").getBytes(StandardCharsets.UTF_8));return "v1,"+Base64.getEncoder().encodeToString(mac.doFinal(body));}
 @Test void verifiesExactUnicodeBodyAndMultipleSignatures()throws Exception{var body="{\"message\":\"Trường học phản hồi\"}".getBytes(StandardCharsets.UTF_8);var time=""+Instant.now().getEpochSecond();assertDoesNotThrow(()->verifier.verify(body,"evt_1",time,"v1,aW52YWxpZA== "+sign("evt_1",time,body)));}
 @Test void rejectsTamperedBodyAndChangedEventId()throws Exception{var body="{}".getBytes();var time=""+Instant.now().getEpochSecond();var sig=sign("evt_1",time,body);assertThrows(ApiException.class,()->verifier.verify("{ }".getBytes(),"evt_1",time,sig));assertThrows(ApiException.class,()->verifier.verify(body,"evt_2",time,sig));}
 @Test void rejectsExpiredAndFutureTimestamps()throws Exception{for(long offset:new long[]{-600,600}){var time=""+(Instant.now().getEpochSecond()+offset);assertThrows(ApiException.class,()->verifier.verify("{}".getBytes(),"evt",time,sign("evt",time,"{}".getBytes())));}}
 @Test void rejectsMissingHeadersOversizedBodyAndDisabledIntegration(){assertThrows(ApiException.class,()->verifier.verify(new byte[0],null,null,null));assertThrows(ApiException.class,()->verifier.verify(new byte[262145],"evt","1","v1,aA=="));var off=new ResendWebhookVerifier(new CustomerEmailProperties(false,"","",""));assertThrows(ApiException.class,()->off.verify(new byte[0],"evt","1","v1,aA=="));}
}
