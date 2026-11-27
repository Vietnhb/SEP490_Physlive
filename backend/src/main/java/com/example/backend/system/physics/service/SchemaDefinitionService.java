package com.example.backend.system.physics.service;

import com.example.backend.base.crud.model.enums.LifecycleStatus;
import com.example.backend.exception.ApiException;
import com.example.backend.exception.SchemaCompilationException;
import com.example.backend.system.curriculum.model.entity.Topic;
import com.example.backend.system.curriculum.repository.TopicRepository;
import com.example.backend.system.physics.model.entity.SchemaVersion;
import com.example.backend.system.physics.repository.SchemaVersionRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.math.BigDecimal;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/** Access and integrity boundary for reviewer-managed topic definitions. */
@Service
public class SchemaDefinitionService {
    private final SchemaVersionRepository schemas;
    private final TopicRepository topics;
    private final ObjectMapper json;
    /** The approved schemas as of a change mark; reloaded only when the mark moves (their definitions are large). */
    private final java.util.concurrent.atomic.AtomicReference<Approved> approved = new java.util.concurrent.atomic.AtomicReference<>();

    private record Approved(String mark, List<SchemaVersion> schemas) { }

    public SchemaDefinitionService(SchemaVersionRepository schemas, TopicRepository topics, ObjectMapper json) {
        this.schemas = schemas;
        this.topics = topics;
        this.json = json;
    }

    @Transactional(readOnly = true)
    /**
     * A mark that changes whenever the approved schemas could have changed (a schema version or a topic added or
     * changed), cheap enough to read on every request: what is built from the approved schemas can be kept until it moves.
     */
    public String approvedFingerprint() {
        var s = schemas.changeMark();
        var t = topics.changeMark();
        return (s == null ? "-" : s.getCount() + "@" + s.getUpdated()) + "|" + (t == null ? "-" : t.getCount() + "@" + t.getUpdated());
    }

    /** The current approved version of each enabled topic's schemas, kept between calls until the change mark moves. */
    public List<SchemaVersion> approvedSchemas() {
        String mark = approvedFingerprint();
        Approved now = approved.get();
        if (now != null && now.mark().equals(mark)) return now.schemas();
        List<SchemaVersion> loaded = loadApprovedSchemas();
        approved.set(new Approved(mark, loaded));
        return loaded;
    }

    private List<SchemaVersion> loadApprovedSchemas() {
        List<String> enabledTopics = topics.findByEnabledTrueOrderBySortOrderAsc().stream().map(Topic::getCode).toList();
        if (enabledTopics.isEmpty()) return List.of();
        Map<String, SchemaVersion> latest = schemas
                .findAllByLifecycleStatusAndTopicInOrderByTopicAscSchemaIdAscCreatedAtDesc(
                        LifecycleStatus.APPROVED, enabledTopics).stream()
                .collect(java.util.stream.Collectors.toMap(s -> s.getSchemaId().toLowerCase(), s -> s,
                        SchemaVersionOrdering::newer));
        return List.copyOf(new java.util.TreeMap<>(latest).values());
    }

    @Transactional(readOnly = true)
    public SchemaVersion requireCurrentApproved(String schemaId, String version) {
        // the current approved versions are already held; only a version outside them needs a (light) look at the table
        SchemaVersion schema = approvedSchemas().stream()
                .filter(s -> s.getSchemaId().equalsIgnoreCase(schemaId) && s.getVersion().equals(version))
                .findFirst()
                .orElse(null);
        if (schema == null) {
            if (!schemas.existsBySchemaIdAndVersion(schemaId, version))
                throw ApiException.conflict("Mô hình đã chọn không còn được phê duyệt: " + schemaId + "@" + version);
            throw ApiException.conflict("Phiên bản mô hình đã chọn không còn hiện hành hoặc đã bị vô hiệu hóa");
        }
        validateDefinition(schema.getDefinition(), schema.getSchemaId(), schema.getVersion(), schema.getTopic());
        return schema;
    }

    public void validateDefinition(JsonNode definition, String schemaId) {
        validateDefinition(definition, schemaId, "unspecified", "unspecified");
    }

    public void validateDefinition(JsonNode definition, String schemaId, String version, String topic) {
        if (!StringUtils.hasText(schemaId) || !StringUtils.hasText(version) || !StringUtils.hasText(topic)
                || definition == null || !definition.isObject()) {
            throw new SchemaCompilationException("Topic definition and schema identity are required");
        }
        JsonNode metaVersion = definition.path("metaSchemaVersion");
        if (metaVersion.isTextual() && !metaVersion.asText().isBlank()
                && !metaVersion.asText().matches("\\d+\\.\\d+")) {
            throw new SchemaCompilationException("Topic definition metaSchemaVersion must use MAJOR.MINOR format");
        }
    }

    public void validateTopicPackForAuthoring(JsonNode definition, String schemaId) {
        validateDefinition(definition, schemaId);
    }


    public String compiledChecksum(JsonNode definition) { return checksum(definition); }

    private String checksum(JsonNode definition) {
        try {
            byte[] canonical = json.writeValueAsBytes(canonicalize(definition));
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(canonical));
        } catch (Exception exception) { throw new IllegalStateException("Cannot checksum topic definition", exception); }
    }

    private JsonNode canonicalize(JsonNode node) {
        if (node == null || node.isNull()) return JsonNodeFactory.instance.nullNode();
        if (node.isObject()) {
            ObjectNode result = JsonNodeFactory.instance.objectNode();
            List<String> names = new ArrayList<>(); node.fieldNames().forEachRemaining(names::add);
            names.sort(String::compareTo);
            for (String name : names) result.set(name, canonicalize(node.get(name)));
            return result;
        }
        if (node.isArray()) {
            ArrayNode result = JsonNodeFactory.instance.arrayNode();
            for (JsonNode value : node) result.add(canonicalize(value));
            return result;
        }
        if (node.isNumber()) {
            BigDecimal value = node.decimalValue().stripTrailingZeros();
            if (value.scale() < 0) value = value.setScale(0);
            return JsonNodeFactory.instance.numberNode(value);
        }
        return node.deepCopy();
    }
}
