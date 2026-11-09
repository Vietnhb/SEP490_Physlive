package com.example.backend.system.realtime;

import com.example.backend.system.realtime.controller.RealtimeEvents;
import com.example.backend.system.realtime.dto.RealtimeEvent;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.springframework.context.annotation.*;
import org.springframework.transaction.*;
import org.springframework.transaction.support.*;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;

class RealtimeCommitTest {
    @Configuration @org.springframework.transaction.annotation.EnableTransactionManagement static class Config {
        @Bean RealtimeEvents events() { return new RealtimeEvents(); }
        @Bean PlatformTransactionManager transactions() { return new AbstractPlatformTransactionManager() {
            protected Object doGetTransaction() { return new Object(); }
            protected void doBegin(Object transaction, TransactionDefinition definition) { }
            protected void doCommit(DefaultTransactionStatus status) { }
            protected void doRollback(DefaultTransactionStatus status) { }
        }; }
    }
    @Test void transactionalChangesArePublishedOnlyAfterSuccessfulCommit() {
        try (var context = new AnnotationConfigApplicationContext(Config.class)) {
            var revision = (AtomicLong) ReflectionTestUtils.getField(context.getBean(RealtimeEvents.class), "revision");
            var transactions = new TransactionTemplate(context.getBean(PlatformTransactionManager.class));
            transactions.executeWithoutResult(status -> {
                context.publishEvent(new RealtimeEvent.Change("/api/assignments/1", "test"));
                assertEquals(0, revision.get());
            });
            assertEquals(1, revision.get());
            transactions.executeWithoutResult(status -> {
                context.publishEvent(new RealtimeEvent.Change("/api/assignments/2", "test"));
                status.setRollbackOnly();
            });
            assertEquals(1, revision.get());
            context.publishEvent(new RealtimeEvent.Change("/api/library/1", "test"));
            assertEquals(2, revision.get());
        }
    }
}
