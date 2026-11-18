package com.example.backend.bootstrap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.core.io.Resource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;
import static com.example.backend.system.physics.model.SpecKeys.ALIASES;
import static com.example.backend.system.physics.model.SpecKeys.APPLIES_TO;
import static com.example.backend.system.physics.model.SpecKeys.ASSUMPTIONS;
import static com.example.backend.system.physics.model.SpecKeys.CANONICAL_INPUTS;
import static com.example.backend.system.physics.model.SpecKeys.CURRICULUM;
import static com.example.backend.system.physics.model.SpecKeys.DESCRIPTION;
import static com.example.backend.system.physics.model.SpecKeys.GRADE;
import static com.example.backend.system.physics.model.SpecKeys.LABEL;
import static com.example.backend.system.physics.model.SpecKeys.OBJECT_TYPES;
import static com.example.backend.system.physics.model.SpecKeys.OUTPUTS;
import static com.example.backend.system.physics.model.SpecKeys.RELATION_TYPES;
import static com.example.backend.system.physics.model.SpecKeys.SCHEMA_ID;

/**
 * Compiles the checked-in schema library into topic schema definitions.
 *
 * <pre>
 * schemas/library/defaults.json                     shared policy (vocabulary, visual contract, relations…)
 * schemas/library/quantities.json                   quantity key → Vietnamese label/description/aliases
 * schemas/library/capabilities/&lt;area&gt;/&lt;id&gt;.json   one executable capability (equation AST) per file
 * schemas/laws/&lt;strand&gt;.json                       the laws of a curriculum strand: roles and the relations between them
 * schemas/topics/grade-NN/&lt;nn&gt;-&lt;slug&gt;.json          topic manifest: curriculum strand, law catalogues, worked examples
 * </pre>
 *
 * A topic's law catalogue is what a simulation is checked against: any model whose quantities carry its roles.
 * The capabilities a topic lists are worked examples of those laws (and compute the plans saved before models were
 * written per description); they do not limit what can be simulated.
 */
public final class SchemaCatalogCompiler {
    private static final String CLASSPATH_ALL = "classpath*:";
    private static final String SOURCE_FIELD = "_source";
    public static final String LIBRARY = "schemas/library/";
    public static final String TOPICS = "schemas/topics/";
    public static final String LAWS = "schemas/laws/";
    private static final JsonNodeFactory NODES = JsonNodeFactory.instance;

    private SchemaCatalogCompiler() { }

    /** Loads and compiles every topic manifest found on the classpath. */
    public static ArrayNode loadFromClasspath(ObjectMapper json) throws IOException {
        PathMatchingResourcePatternResolver resolver = new PathMatchingResourcePatternResolver();
        JsonNode defaults = read(json, resolver.getResource("classpath:" + LIBRARY + "defaults.json"));
        JsonNode quantities = read(json, resolver.getResource("classpath:" + LIBRARY + "quantities.json"));
        List<JsonNode> capabilities = new ArrayList<>();
        for (Resource resource : resolver.getResources(CLASSPATH_ALL + LIBRARY + "capabilities/**/*.json"))
            capabilities.add(read(json, resource));
        List<JsonNode> topics = new ArrayList<>();
        for (Resource resource : resolver.getResources(CLASSPATH_ALL + TOPICS + "**/*.json")) {
            ObjectNode topic = (ObjectNode) read(json, resource);
            topic.put(SOURCE_FIELD, String.valueOf(resource.getFilename()));
            topics.add(topic);
        }
        List<JsonNode> laws = new ArrayList<>();
        for (Resource resource : resolver.getResources(CLASSPATH_ALL + LAWS + "*.json")) laws.add(read(json, resource));
        return compile(defaults, quantities, capabilities, topics, laws);
    }

    /** Pure compilation step (no I/O) so it can be unit-tested with in-memory documents. */
    public static ArrayNode compile(JsonNode defaults, JsonNode quantities, List<JsonNode> capabilities, List<JsonNode> topics) {
        return compile(defaults, quantities, capabilities, topics, List.of());
    }

    public static ArrayNode compile(JsonNode defaults, JsonNode quantities, List<JsonNode> capabilities, List<JsonNode> topics, List<JsonNode> laws) {
        Map<String, JsonNode> strands = new LinkedHashMap<>();
        for (JsonNode catalogue : laws)
            if (strands.put(catalogue.path("id").asText(), catalogue) != null) throw new IllegalStateException("Duplicate law catalogue: " + catalogue.path("id").asText());
        Map<String, JsonNode> library = new LinkedHashMap<>();
        for (JsonNode capability : capabilities) {
            String id = capability.path("capabilityId").asText();
            if (id.isBlank()) throw new IllegalStateException("Capability without capabilityId in schema library");
            if (library.put(id, capability) != null) throw new IllegalStateException("Duplicate capability in schema library: " + id);
        }
        List<JsonNode> ordered = new ArrayList<>(topics);
        ordered.sort(Comparator.comparingInt((JsonNode t) -> t.path(GRADE).asInt())
                .thenComparing(t -> t.path(SOURCE_FIELD).asText(t.path(SCHEMA_ID).asText())));
        ArrayNode catalog = NODES.arrayNode();
        Set<String> seen = new LinkedHashSet<>();
        for (JsonNode topic : ordered) {
            String schemaId = require(topic, SCHEMA_ID);
            if (!seen.add(schemaId)) throw new IllegalStateException("Duplicate topic schemaId: " + schemaId);
            ObjectNode entry = catalog.addObject();
            entry.put(SCHEMA_ID, schemaId);
            entry.put("model", defaults.path("model").asText("generated_visual"));
            entry.put("name", require(topic, "name"));
            entry.put("topic", require(topic, "topic"));
            entry.put("version", require(topic, "version"));
            ObjectNode definition = definition(defaults, quantities, library, topic);
            List<JsonNode> own = new ArrayList<>();
            for (JsonNode id : topic.path("lawCatalogues")) {
                if (!strands.containsKey(id.asText())) throw new IllegalStateException("Topic " + schemaId + " references unknown law catalogue " + id.asText());
                own.add(strands.get(id.asText()));
            }
            if (!own.isEmpty())
                definition.set("lawCatalogue", com.example.backend.system.physics.service.LawChecks.merge(new ObjectMapper(), own));
            entry.set("definition", definition);
        }
        return catalog;
    }

    private static ObjectNode definition(JsonNode defaults, JsonNode quantities, Map<String, JsonNode> library, JsonNode topic) {
        String schemaId = topic.path(SCHEMA_ID).asText();
        ArrayNode objectTypes = topic.path(OBJECT_TYPES).deepCopy();
        if (!objectTypes.isArray() || objectTypes.isEmpty())
            throw new IllegalStateException("Topic " + schemaId + " declares no object types");
        ArrayNode typeNames = NODES.arrayNode();
        objectTypes.forEach(type -> typeNames.add(type.path("type").asText()));

        List<JsonNode> capabilities = new ArrayList<>();
        for (JsonNode id : topic.path("capabilities")) {
            JsonNode capability = library.get(id.asText());
            if (capability == null)
                throw new IllegalStateException("Topic " + schemaId + " references unknown capability " + id.asText());
            ObjectNode copy = capability.deepCopy();
            ObjectNode applicability = copy.get("applicability") instanceof ObjectNode existing
                    ? existing : copy.putObject("applicability");
            applicability.set(OBJECT_TYPES, typeNames.deepCopy());
            capabilities.add(copy);
        }
        if (capabilities.isEmpty()) throw new IllegalStateException("Topic " + schemaId + " lists no capabilities");

        ObjectNode definition = NODES.objectNode();
        definition.put("metaSchemaVersion", defaults.path("metaSchemaVersion").asText("2.0"));
        definition.put(DESCRIPTION, require(topic, DESCRIPTION));
        definition.put(GRADE, topic.path(GRADE).asInt());
        definition.set(OBJECT_TYPES, objectTypes);
        definition.set(RELATION_TYPES, relations(defaults, typeNames));
        definition.set("quantityDefinitions", quantityDefinitions(quantities, capabilities, typeNames, schemaId));
        definition.set("unitCatalog", unitCatalog(defaults, capabilities));
        definition.set("laws", laws(capabilities, typeNames));
        definition.set("capabilities", NODES.arrayNode().addAll(capabilities));
        ArrayNode requirements = definition.putArray("applicationRequirements");
        for (JsonNode requirement : defaults.path("applicationRequirements")) {
            ObjectNode item = requirement.deepCopy();
            ObjectNode appliesTo = item.putObject(APPLIES_TO);
            appliesTo.set(OBJECT_TYPES, typeNames.deepCopy());
            appliesTo.putArray(RELATION_TYPES);
            appliesTo.putArray("quantities");
            requirements.add(item);
        }
        for (String field : List.of("simulationCapability", "limitations", "conceptVocabulary", "visualCapability"))
            if (defaults.has(field)) definition.set(field, defaults.get(field).deepCopy());
        if (topic.has(CURRICULUM)) definition.set(CURRICULUM, topic.get(CURRICULUM).deepCopy());
        return definition;
    }

    private static ArrayNode relations(JsonNode defaults, ArrayNode typeNames) {
        ArrayNode relations = NODES.arrayNode();
        for (JsonNode relation : defaults.path(RELATION_TYPES)) {
            ObjectNode item = relation.deepCopy();
            item.set("subjectTypes", typeNames.deepCopy());
            item.set(OBJECT_TYPES, typeNames.deepCopy());
            item.putObject(APPLIES_TO).set(OBJECT_TYPES, typeNames.deepCopy());
            relations.add(item);
        }
        return relations;
    }

    private static ArrayNode quantityDefinitions(JsonNode vocabulary, List<JsonNode> capabilities, ArrayNode typeNames, String schemaId) {
        Map<String, Set<String>> units = new LinkedHashMap<>();
        for (JsonNode capability : capabilities)
            for (String section : List.of(CANONICAL_INPUTS, OUTPUTS))
                for (JsonNode item : capability.path(section))
                    units.computeIfAbsent(item.path("key").asText(), k -> new LinkedHashSet<>()).add(item.path("unit").asText());
        ArrayNode result = NODES.arrayNode();
        units.forEach((key, allowed) -> {
            JsonNode known = vocabulary.path(key);
            if (!known.hasNonNull(LABEL))
                throw new IllegalStateException("Quantity '" + key + "' used by " + schemaId + " has no entry in quantities.json");
            ObjectNode quantity = result.addObject();
            quantity.put("key", key);
            quantity.put(LABEL, known.path(LABEL).asText());
            quantity.put(DESCRIPTION, known.path(DESCRIPTION).asText(known.path(LABEL).asText()));
            quantity.set(ALIASES, known.path(ALIASES).isArray() ? known.get(ALIASES).deepCopy() : NODES.arrayNode());
            ArrayNode unitList = quantity.putArray("allowedUnits");
            allowed.forEach(unitList::add);
            quantity.putObject(APPLIES_TO).set(OBJECT_TYPES, typeNames.deepCopy());
        });
        return result;
    }

    private static ArrayNode unitCatalog(JsonNode defaults, List<JsonNode> capabilities) {
        Set<String> symbols = new LinkedHashSet<>();
        for (JsonNode capability : capabilities)
            for (String section : List.of(CANONICAL_INPUTS, OUTPUTS))
                for (JsonNode item : capability.path(section)) symbols.add(item.path("unit").asText());
        ArrayNode result = NODES.arrayNode();
        for (String symbol : symbols) {
            ObjectNode unit = result.addObject();
            unit.put("symbol", symbol);
            unit.put("dimension", defaults.path("unitDimensions").path(symbol).asText("derived"));
        }
        return result;
    }

    /** One conceptual law per capability, derived from its declared equations and assumptions. */
    private static ArrayNode laws(List<JsonNode> capabilities, ArrayNode typeNames) {
        ArrayNode laws = NODES.arrayNode();
        for (JsonNode capability : capabilities) {
            ObjectNode law = laws.addObject();
            String id = capability.path("capabilityId").asText();
            law.put("id", id);
            law.put("name", capability.path("title").asText(id));
            ArrayNode inputs = law.putArray("inputs");
            capability.path(CANONICAL_INPUTS).forEach(i -> inputs.add(i.path("key").asText()));
            ArrayNode outputs = law.putArray(OUTPUTS);
            capability.path(OUTPUTS).forEach(o -> outputs.add(o.path("key").asText()));
            ObjectNode appliesTo = law.putObject(APPLIES_TO);
            appliesTo.set(OBJECT_TYPES, typeNames.deepCopy());
            ArrayNode quantities = appliesTo.putArray("quantities");
            quantities.addAll(inputs.deepCopy()).addAll(outputs.deepCopy());
            law.set(ASSUMPTIONS, capability.path(ASSUMPTIONS).isArray()
                    ? capability.get(ASSUMPTIONS).deepCopy() : NODES.arrayNode());
            List<String> equations = new ArrayList<>();
            capability.path("equationSet").path("canonical").forEach(e -> equations.add(e.asText()));
            law.put(DESCRIPTION, String.join("; ", equations));
        }
        return laws;
    }

    private static String require(JsonNode node, String field) {
        String value = node.path(field).asText("");
        if (value.isBlank()) throw new IllegalStateException("Topic manifest is missing '" + field + "': " + node.path(SOURCE_FIELD).asText());
        return value;
    }

    private static JsonNode read(ObjectMapper json, Resource resource) throws IOException {
        try (InputStream input = resource.getInputStream()) {
            return json.readTree(input);
        }
    }
}
