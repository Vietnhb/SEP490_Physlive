package com.example.backend.system.physics.service;

import com.example.backend.base.crud.model.enums.LifecycleStatus;
import com.example.backend.exception.ApiException;
import com.example.backend.system.physics.model.entity.SchemaVersion;
import com.example.backend.system.physics.repository.SchemaVersionRepository;
import com.example.backend.system.physics.dto.SchemaContracts;
import com.example.backend.bootstrap.PhysicsCatalogInitializer;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.time.Instant;
import java.util.*;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class SchemaPublicationTest {
    final SchemaVersionRepository repository = mock(SchemaVersionRepository.class);
    final SchemaDefinitionService definitions = mock(SchemaDefinitionService.class);
    final SchemaService service = new SchemaService(repository, definitions, null, null);
    SchemaVersion version(String version, LifecycleStatus status) {
        SchemaVersion schema = new SchemaVersion(); schema.setId(UUID.randomUUID()); schema.setSchemaId("alternating_current"); schema.setVersion(version);
        schema.setTopic("AC"); schema.setName("Dòng điện xoay chiều"); schema.setDefinition(JsonNodeFactory.instance.objectNode()); schema.setLifecycleStatus(status); schema.setCreatedAt(Instant.now());
        when(repository.schemaIdOf(schema.getId())).thenReturn(Optional.of(schema.getSchemaId())); when(repository.save(schema)).thenReturn(schema); return schema;
    }
    @Test void approvingNewVersionRetiresPreviousBeforePublishingAndKeepsItsDefinition() {
        var old = version("1.0", LifecycleStatus.APPROVED); var next = version("1.1", LifecycleStatus.DRAFT); var snapshot = old.getDefinition();
        when(repository.lockFamily("alternating_current")).thenReturn(List.of(old, next)); when(definitions.compiledChecksum(any())).thenReturn("checksum");
        assertSame(next, service.changeVersionLifecycle(next.getId(), LifecycleStatus.APPROVED));
        assertEquals(LifecycleStatus.RETIRED, old.getLifecycleStatus()); assertEquals(LifecycleStatus.APPROVED, next.getLifecycleStatus()); assertSame(snapshot, old.getDefinition());
        var order = inOrder(repository); order.verify(repository).lockFamily("alternating_current"); order.verify(repository).saveAll(List.of(old)); order.verify(repository).flush(); order.verify(repository).save(next);
    }
    @Test void naturalVersionOrderingTreatsOnePointTenAsNewerThanOnePointNine() {
        var old = version("1.9", LifecycleStatus.APPROVED); var next = version("1.10", LifecycleStatus.DRAFT);
        when(repository.lockFamily("alternating_current")).thenReturn(List.of(old, next)); service.changeVersionLifecycle(next.getId(), LifecycleStatus.APPROVED);
        assertEquals(LifecycleStatus.RETIRED, old.getLifecycleStatus());
    }
    @Test void creatingDraftDoesNotRetirePublishedVersion() {
        var current = version("1.0", LifecycleStatus.APPROVED);
        when(repository.save(any())).thenAnswer(call -> call.getArgument(0));
        var draft = service.create(new SchemaContracts.Request("alternating_current", "AC", "AC", "1.1", JsonNodeFactory.instance.objectNode(), LifecycleStatus.APPROVED));
        assertEquals(LifecycleStatus.DRAFT, draft.getLifecycleStatus()); assertEquals(LifecycleStatus.APPROVED, current.getLifecycleStatus()); verify(repository, never()).saveAll(any());
    }
    @Test void invalidOrOlderDraftCannotRetireWorkingVersionAndRetiredVersionsCannotReopen() {
        var old = version("1.0", LifecycleStatus.DRAFT); var current = version("1.1", LifecycleStatus.APPROVED);
        when(repository.lockFamily("alternating_current")).thenReturn(List.of(old, current));
        assertThrows(ApiException.class, () -> service.changeVersionLifecycle(old.getId(), LifecycleStatus.APPROVED)); assertEquals(LifecycleStatus.APPROVED, current.getLifecycleStatus());
        old.setLifecycleStatus(LifecycleStatus.RETIRED);
        assertThrows(ApiException.class, () -> service.changeVersionLifecycle(old.getId(), LifecycleStatus.APPROVED));
        old.setLifecycleStatus(LifecycleStatus.DRAFT); old.setVersion("1.2"); old.setDefinitionChecksum("previous"); when(definitions.compiledChecksum(any())).thenReturn("changed");
        assertThrows(ApiException.class, () -> service.changeVersionLifecycle(old.getId(), LifecycleStatus.APPROVED)); assertEquals(LifecycleStatus.APPROVED, current.getLifecycleStatus()); verify(repository, never()).saveAll(any());
    }
    @Test void startupNeverReactivatesOrRewritesRetiredBundledVersion() {
        var old = version("1.0", LifecycleStatus.RETIRED);
        when(repository.findFirstBySchemaIdAndVersion("alternating_current", "1.0")).thenReturn(Optional.of(old));
        var entry = JsonNodeFactory.instance.objectNode().put("schemaId", "alternating_current").put("version", "1.0").put("topic", "AC"); entry.set("definition", JsonNodeFactory.instance.objectNode());
        var initializer = new PhysicsCatalogInitializer(repository, new ObjectMapper(), definitions);
        ReflectionTestUtils.invokeMethod(initializer, "upsert", entry);
        assertEquals(LifecycleStatus.RETIRED, old.getLifecycleStatus()); verify(repository, never()).save(any());
    }
}
