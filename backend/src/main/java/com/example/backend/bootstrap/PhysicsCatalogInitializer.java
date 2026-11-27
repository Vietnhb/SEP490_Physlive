package com.example.backend.bootstrap;

import com.example.backend.base.crud.model.enums.LifecycleStatus;
import com.example.backend.system.physics.model.entity.SchemaVersion;
import com.example.backend.system.physics.repository.SchemaVersionRepository;
import com.example.backend.system.physics.service.SchemaDefinitionService;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.InputStream;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import static com.example.backend.system.physics.model.SpecKeys.TOPIC;

/** Publishes the curriculum-aligned topic schemas compiled from schemas/library + schemas/topics. */
@Component
@ConditionalOnProperty(prefix = "physlive.bootstrap", name = "catalogs-enabled", havingValue = "true")
@RequiredArgsConstructor
public class PhysicsCatalogInitializer implements CommandLineRunner {
    private static final Logger log = LoggerFactory.getLogger(PhysicsCatalogInitializer.class);
    private final SchemaVersionRepository schemaRepository;
    private final ObjectMapper objectMapper;
    private final SchemaDefinitionService schemaDefinitions;

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        // the catalogue source files are kept out of the repository; the database already holds the topics and laws
        if (!new ClassPathResource(SchemaCatalogCompiler.LIBRARY + "defaults.json").exists()) {
            log.info("Physics catalogue files are not on the classpath; using the topics and laws stored in the database");
            return;
        }
        JsonNode activeCatalog = SchemaCatalogCompiler.loadFromClasspath(objectMapper);
        if (!activeCatalog.isArray() || activeCatalog.isEmpty()) {
            throw new IllegalStateException("Conceptual topic catalog must contain approved templates");
        }
        java.util.Set<String> active = new java.util.HashSet<>();
        for (JsonNode entry : activeCatalog) {
            upsert(entry);
            active.add(entry.path("schemaId").asText());
        }
        retireSuperseded(active);
    }

    /**
     * Schema ids listed in defaults.json "supersededSchemaIds" were replaced by the curriculum-aligned
     * library. They are retired (still replayable for saved runs) so routing only sees current topics.
     */
    private void retireSuperseded(java.util.Set<String> active) throws java.io.IOException {
        JsonNode defaults;
        try (InputStream input = new ClassPathResource(SchemaCatalogCompiler.LIBRARY + "defaults.json").getInputStream()) {
            defaults = objectMapper.readTree(input);
        }
        java.util.Set<String> superseded = new java.util.HashSet<>();
        defaults.path("supersededSchemaIds").forEach(id -> superseded.add(id.asText()));
        superseded.removeAll(active);
        if (superseded.isEmpty()) return;
        // only the superseded ids are read: their definitions are large and this runs on every start
        for (SchemaVersion schema : schemaRepository.findBySchemaIdInAndLifecycleStatus(superseded, LifecycleStatus.APPROVED)) {
            schema.setLifecycleStatus(LifecycleStatus.RETIRED);
            schemaRepository.save(schema);
        }
    }

    private void upsert(JsonNode entry) {
        String id = entry.path("schemaId").asText();
        String version = entry.path("version").asText();
        JsonNode definition = entry.path("definition").deepCopy();
        if (!(definition instanceof ObjectNode object)) {
            throw new IllegalStateException("Catalog template has no definition: " + id + "@" + version);
        }
        object.put("model", entry.path("model").asText());
        schemaDefinitions.validateDefinition(definition, id, version, entry.path(TOPIC).asText());
        String checksum = schemaDefinitions.compiledChecksum(definition);

        // an existence check, not a load: the stored definition is hundreds of kilobytes and this runs on every start
        if (schemaRepository.existsBySchemaIdAndVersion(id, version)) return;
        SchemaVersion schema = new SchemaVersion();
        schema.setSchemaId(id); schema.setName(entry.path("name").asText()); schema.setTopic(entry.path(TOPIC).asText());
        schema.setVersion(version); schema.setDefinition(definition); schema.setDefinitionChecksum(checksum);
        boolean hasPublished = schemaRepository.lockFamily(id).stream().anyMatch(item -> item.getLifecycleStatus() == LifecycleStatus.APPROVED);
        schema.setLifecycleStatus(hasPublished ? LifecycleStatus.DRAFT : LifecycleStatus.APPROVED);
        schemaRepository.save(schema);
    }
}
