package com.example.backend.system.simulation.service;

import com.example.backend.config.AIProperties;
import com.example.backend.config.JevProperties;
import com.example.backend.config.UploadProperties;
import com.example.backend.exception.ApiException;
import com.example.backend.integration.ai.AIClient;
import com.example.backend.system.library.dto.LibraryItemResponse;
import com.example.backend.system.physics.model.entity.SchemaVersion;
import com.example.backend.system.physics.service.FreeModel;
import com.example.backend.system.physics.service.LawChecks;
import com.example.backend.system.physics.service.SchemaDefinitionService;
import com.example.backend.system.physics.service.SchemaEquationRuntime;
import com.example.backend.system.simulation.dto.SimulationRequests;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.DefaultResourceLoader;
import org.springframework.stereotype.Service;
import static com.example.backend.system.physics.model.SpecKeys.CAPABILITIES;
import static com.example.backend.system.physics.model.SpecKeys.CAPABILITY_ID;
import static com.example.backend.system.physics.model.SpecKeys.CONTENTS;
import static com.example.backend.system.physics.model.SpecKeys.CURRICULUM;
import static com.example.backend.system.physics.model.SpecKeys.DESCRIPTION;
import static com.example.backend.system.physics.model.SpecKeys.DURATION_PARAMETER;
import static com.example.backend.system.physics.model.SpecKeys.DURATION_SECONDS;
import static com.example.backend.system.physics.model.SpecKeys.EXPLANATION;
import static com.example.backend.system.physics.model.SpecKeys.FRAMES;
import static com.example.backend.system.physics.model.SpecKeys.GRADE;
import static com.example.backend.system.physics.model.SpecKeys.LABEL;
import static com.example.backend.system.physics.model.SpecKeys.LAW_CATALOGUE;
import static com.example.backend.system.physics.model.SpecKeys.MESSAGE;
import static com.example.backend.system.physics.model.SpecKeys.MODEL;
import static com.example.backend.system.physics.model.SpecKeys.OBJECTS;
import static com.example.backend.system.physics.model.SpecKeys.OBSERVABLES;
import static com.example.backend.system.physics.model.SpecKeys.PARAMETERS;
import static com.example.backend.system.physics.model.SpecKeys.PARTICIPANT_ID;
import static com.example.backend.system.physics.model.SpecKeys.PARTICIPANT_LABEL;
import static com.example.backend.system.physics.model.SpecKeys.PLAN_SIGNATURE;
import static com.example.backend.system.physics.model.SpecKeys.PRESENTATION;
import static com.example.backend.system.physics.model.SpecKeys.QUANTITIES;
import static com.example.backend.system.physics.model.SpecKeys.RELATED_SCHEMAS;
import static com.example.backend.system.physics.model.SpecKeys.RENDER_DIAGNOSTICS;
import static com.example.backend.system.physics.model.SpecKeys.SCHEMA_ID;
import static com.example.backend.system.physics.model.SpecKeys.SCHEMA_VERSION;
import static com.example.backend.system.physics.model.SpecKeys.SESSION_ID;
import static com.example.backend.system.physics.model.SpecKeys.SIMULATION_SPEC;
import static com.example.backend.system.physics.model.SpecKeys.SOLVER_FIELD_META;
import static com.example.backend.system.physics.model.SpecKeys.SOLVER_TIMELINE;
import static com.example.backend.system.physics.model.SpecKeys.STAGE;
import static com.example.backend.system.physics.model.SpecKeys.STATUS;
import static com.example.backend.system.physics.model.SpecKeys.TITLE;
import static com.example.backend.system.physics.model.SpecKeys.TOPIC;
import static com.example.backend.system.physics.model.SpecKeys.TOPIC_VERSION;
import static com.example.backend.system.physics.model.SpecKeys.VALIDATION;
import static com.example.backend.system.physics.model.SpecKeys.VALUE;
import static com.example.backend.system.physics.model.SpecKeys.VALUES;
import static com.example.backend.system.physics.model.SpecKeys.VISUAL_PROGRAM;

@Service
public class AIService {
    private static final String EXPLAIN_STAGE = "EXPLAIN";
    private static final org.slf4j.Logger log = org.slf4j.LoggerFactory.getLogger(AIService.class);
    /** The reviewers' list of what the law catalogues are missing; absent where no such list is kept. */
    private final LawGapSink gaps;
    /** Solved results by request; absent where nothing is kept. */
    private final ComputeResultCache resultCache;
    /** The merged law catalogue and the approved topic versions, kept while the approved schemas stay the same. */
    private record Approved(String mark, ObjectNode catalogue, java.util.concurrent.ConcurrentHashMap<String, SchemaVersion> versions) {}
    private final java.util.concurrent.atomic.AtomicReference<Approved> approved = new java.util.concurrent.atomic.AtomicReference<>();
    private static final String NO_MATCH = "NO_MATCH";
    /** How many times a model the solver or a law refuses goes back to its author before the best one stands. */
    private static final int MAX_MODEL_REPAIRS = 2;
    private final SchemaDefinitionService schemas;
    private final SchemaEquationRuntime equations;
    private final FreeModel models;
    private final GeneratedSimulationStorage storage;
    private static final int ROUTING_SUMMARY_MAX = 1400;
    private final JevProperties jev;
    private final ObjectMapper json;
    private final AIClient client;
    private final AIProperties ai;
    private final UploadProperties upload;
    private final byte[] signingKey;
    private final int maxProgramCharacters;

    public AIService(SchemaDefinitionService schemas, SchemaEquationRuntime equations,
            GeneratedSimulationStorage storage, JevProperties jev, ObjectMapper json,
            AIProperties ai, AIClient client, UploadProperties upload, @Value("${jwt.secret}") String signingKey,
            @Value("${physlive.simulation.runtime.max-program-part-characters}") int maxProgramCharacters,
            org.springframework.beans.factory.ObjectProvider<LawGapSink> gaps,
            org.springframework.beans.factory.ObjectProvider<ComputeResultCache> resultCache) {
        this.schemas = schemas;
        this.gaps = gaps.getIfAvailable();
        this.resultCache = resultCache.getIfAvailable();
        this.equations = equations;
        this.models = new FreeModel(json, equations);
        this.storage = storage;
        this.jev = jev;
        this.json = json;
        this.ai = ai;
        this.upload = upload;
        this.signingKey = signingKey.getBytes(StandardCharsets.UTF_8);
        this.maxProgramCharacters = maxProgramCharacters;
        this.client = client;
    }

    public JsonNode understandText(String description, String sessionId, String recognizedText, String correctedText) {
        if (sessionId != null && !sessionId.isBlank()) {
            String confirmedText = correctedText == null || correctedText.isBlank() ? recognizedText : correctedText;
            if (confirmedText == null || confirmedText.isBlank()) {
                throw ApiException.badRequest("Vui lòng xác nhận nội dung nhận dạng từ ảnh");
            }
            return understand(confirmedText, sessionId);
        }
        if (description == null || description.isBlank()) {
            throw ApiException.badRequest("Vui lòng nhập mô tả mô phỏng");
        }
        return understand(description, UUID.randomUUID().toString());
    }

    /** The backend interprets a correction; the client submits the prior contract and raw user input. */
    public JsonNode revise(JsonNode intent, String text) {
        if (EXPLAIN_STAGE.equals(intent.path(STAGE).asText())) requireSignedPlan(intent);
        String description = intent.path(DESCRIPTION).asText("");
        String question = intent.path("question").asText("");
        String revised = "CLARIFY".equals(intent.path(STAGE).asText()) && !question.isBlank()
                ? description + "\n\nCâu hỏi đã hỏi người dùng: " + question + "\nNgười dùng trả lời: " + text
                : description + "\n\nYêu cầu bổ sung/chỉnh sửa của người dùng: " + text;
        return understandText(revised, null, null, null);
    }

    /** Runtime reports are diagnostics, never a new physics-validation result or a client-selected repair policy. */
    public void reportRenderDiagnostic(JsonNode simulation, String message, JsonNode runtime) {
        requireSignedPlan(simulation);
        String code = simulation.path(SIMULATION_SPEC).path(VISUAL_PROGRAM).path("code").asText("");
        if (code.length() > maxProgramCharacters) throw ApiException.badRequest("Mã trình bày vượt quá giới hạn");
        ObjectNode diagnostic = json.createObjectNode();
        diagnostic.put("event", "SIMULATION_RENDER_FAILURE");
        diagnostic.put(SESSION_ID, simulation.path(SESSION_ID).asText());
        diagnostic.put(SCHEMA_ID, simulation.path(SCHEMA_ID).asText());
        diagnostic.put(SCHEMA_VERSION, simulation.path(SCHEMA_VERSION).asText());
        diagnostic.put(PLAN_SIGNATURE, simulation.path(PLAN_SIGNATURE).asText());
        diagnostic.put("sourceChecksum", schemas.compiledChecksum(json.createObjectNode().put("code", code)));
        diagnostic.put(MESSAGE, message);
        // A client-reported snapshot is diagnostic evidence, not an approved plan or solver result.
        if (runtime != null && runtime.isObject()) {
            diagnostic.set("reportedParameters", runtime.path(PARAMETERS));
            if (runtime.path("timeline").isObject())
                diagnostic.put("reportedTimelineChecksum", schemas.compiledChecksum(runtime.path("timeline")));
        }
        log.warn("{}", diagnostic);
    }

    public ObjectNode generate(JsonNode request) {
        requireSignedPlan(request);
        SchemaVersion schema = selectedSchema(request);
        JsonNode brief = request.path(SIMULATION_SPEC);
        boolean written = written(brief);
        JsonNode definition = written ? context(schema) : definition(request, schema);
        ObjectNode computed = solve(request, schema, json.createObjectNode());
        ObjectNode fieldMeta = written ? models.fieldMeta(brief) : solverFieldMeta(definition, brief);
        ObjectNode input = completeVisualInput(json, request, definition, fieldMeta, computed);
        JsonNode diagnostics = request.path(RENDER_DIAGNOSTICS);
        if (!diagnostics.isMissingNode()) {
            if (!diagnostics.path("code").isTextual() || !diagnostics.path(MESSAGE).isTextual()
                    || diagnostics.path("code").asText().length() > 3 * maxProgramCharacters
                    || diagnostics.path(MESSAGE).asText().length() > 4000)
                throw ApiException.badRequest("Thông tin chẩn đoán hiển thị không hợp lệ");
            input.set(RENDER_DIAGNOSTICS, diagnostics);
        }
        JsonNode program = client.visual(input, resource("prompts/simulation-visual-system.txt"),
                jsonResource("prompts/simulation-response-schema.json")).path(VISUAL_PROGRAM);
        asExpression(program);
        // The LLM owns the presentation. The frontend executes its lifecycle without assembling or correcting a scene.
        requireVisualProgram(program, maxProgramCharacters);
        // A drawing that breaks a rule it was given goes back to its author once, with the rule named; what comes
        // back stands if it is a program at all, so this never keeps a teacher from a simulation.
        java.util.List<String> slips = drawingSlips(program.path("code").asText(), brief, computed.path(SOLVER_TIMELINE));
        if (!slips.isEmpty() && diagnostics.isMissingNode()) {
            try {
                ObjectNode again = input.deepCopy();
                again.putObject(RENDER_DIAGNOSTICS).put("code", program.path("code").asText()).put(MESSAGE, String.join(" ", slips));
                JsonNode repaired = client.visual(again, resource("prompts/simulation-visual-system.txt"),
                        jsonResource("prompts/simulation-response-schema.json")).path(VISUAL_PROGRAM);
                asExpression(repaired);
                requireVisualProgram(repaired, maxProgramCharacters);
                if (drawingSlips(repaired.path("code").asText(), brief, computed.path(SOLVER_TIMELINE)).size() < slips.size())
                    program = repaired;
            } catch (RuntimeException unavailable) {
                log.warn("VISUAL_REPAIR_UNAVAILABLE {}", unavailable.getMessage());
            }
        }
        ObjectNode spec = (ObjectNode) brief.deepCopy();
        spec.remove("scene");
        spec.set(VISUAL_PROGRAM, program);
        spec.set(SOLVER_TIMELINE, computed.path(SOLVER_TIMELINE));
        spec.set(SOLVER_FIELD_META, fieldMeta);
        if (program.path("design").isObject())
            spec.set("visualDesign", program.path("design"));
        spec.put("runtimeKind", "SVG_PIXI");
        ObjectNode response = json.createObjectNode();
        response.put(SESSION_ID, request.path(SESSION_ID).asText(UUID.randomUUID().toString()));
        response.put(STAGE, "SIMULATION");
        response.put(SCHEMA_ID, schema.getSchemaId());
        response.put(SCHEMA_VERSION, schema.getVersion());
        response.put(DESCRIPTION, request.path(DESCRIPTION).asText());
        response.set(PLAN_SIGNATURE, request.path(PLAN_SIGNATURE));
        response.set(PARAMETERS, spec.path(PARAMETERS));
        response.set(SIMULATION_SPEC, spec);
        response.set(VALIDATION, computed.path(VALIDATION));
        response.set(PRESENTATION, TeacherSimulationPresentation.create((ObjectNode) computed.path(SOLVER_TIMELINE), spec, perMember(fieldMeta), null));
        return response;
    }

    private static final java.util.regex.Pattern LEGACY_DRAWING = java.util.regex.Pattern.compile("\\.(beginFill|endFill|drawCircle|drawRect|drawRoundedRect|drawEllipse|drawPolygon|lineStyle)\\s*\\(");
    private static final java.util.regex.Pattern BUILT_KEY = java.util.regex.Pattern.compile("\\$\\{[^}]*\\}\\.|[\"'`]\\s*\\+[^;\\n]*\\+\\s*[\"'`]\\.");

    /** What a drawing program does against the rules it was given, said the way its author can act on. */
    static java.util.List<String> drawingSlips(String code, JsonNode plan, JsonNode timeline) {
        java.util.List<String> slips = new java.util.ArrayList<>();
        java.util.Set<String> legacy = new java.util.TreeSet<>();
        java.util.regex.Matcher old = LEGACY_DRAWING.matcher(code);
        while (old.find()) legacy.add(old.group(1));
        if (!legacy.isEmpty()) slips.add("The code uses PixiJS calls that PixiJS 8 does not draw with (" + String.join(", ", legacy)
                + "). Use only the PixiJS 8 forms: graphics.circle(x,y,r).fill({color}), graphics.rect(x,y,w,h).fill({color}), graphics.moveTo(x,y).lineTo(x,y).stroke({color,width}).");
        if (com.example.backend.common.text.CodeText.mathOfTime(code))
            slips.add("The code works out a motion from the time itself (a sine, cosine or exponential of t). Every physical state must be read from frame.fields or api.sample(); the drawing never computes physics. If a value you need is not among the backend fields, draw only what is there.");
        if (java.util.regex.Pattern.compile("\\)\\s*\\.alpha\\s*\\(").matcher(code).find())
            slips.add("The code calls .alpha(...) as a method in a drawing chain; alpha is not a method there. Give the transparency in the fill or stroke itself: .fill({color, alpha: 0.3}).");
        // every object of the plan has values of its own; a drawing that never reads them shows it with another's motion
        java.util.Set<String> reported = new java.util.LinkedHashSet<>();
        timeline.path(FRAMES).path(0).path(VALUES).fieldNames().forEachRemaining(key -> { int dot = key.indexOf('.'); if (dot > 0) reported.add(key.substring(0, dot)); });
        if (!BUILT_KEY.matcher(code).find()) {
            java.util.List<String> unread = new java.util.ArrayList<>();
            for (JsonNode object : plan.path(OBJECTS)) {
                String id = object.path("id").asText();
                if (reported.contains(id) && !code.contains(id + ".")) unread.add(id + " (" + object.path(LABEL).asText(id) + ")");
            }
            if (!unread.isEmpty() && unread.size() < Math.max(1, reported.size())) slips.add("The code never reads the backend values of " + String.join(", ", unread)
                    + ": each object must be drawn from its own fields in frame.fields (keys begin with its id and a dot) and its own sliders, never from another object's values.");
        }
        return slips;
    }

    /**
     * The page runs the program as one function expression. A program wrapped in a Markdown fence, or followed by a
     * semicolon, is the same program and would only fail to parse there.
     */
    static void asExpression(JsonNode program) {
        if (!(program instanceof ObjectNode holder) || !program.path("code").isTextual()) return;
        String code = program.path("code").asText().strip();
        if (code.startsWith("```")) code = com.example.backend.common.text.CodeText.withoutClosingFence(
                com.example.backend.common.text.CodeText.withoutOpeningFence(code, c -> c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z')).strip();
        if (code.startsWith("export default ")) code = code.substring("export default ".length()).strip();
        while (code.endsWith(";")) code = code.substring(0, code.length() - 1).stripTrailing();
        holder.put("code", code);
    }

    static void requireVisualProgram(JsonNode program, int maxCharacters) {
        if (!program.path("code").isTextual() || program.path("code").asText().isBlank())
            throw ApiException.upstream("Mô phỏng được tạo chưa có mã hình minh họa");
        if (program.path("code").asText().length() > maxCharacters)
            throw ApiException.upstream("Mã hình minh họa được tạo vượt quá giới hạn tài nguyên");
        double rate = program.path("playbackRate").asDouble(Double.NaN);
        if (!program.path("playbackRate").isNumber() || !Double.isFinite(rate) || rate <= 0 || rate < 1e-15 || rate > 1e15)
            throw ApiException.upstream("Tỉ lệ thời gian hiển thị không hợp lệ");
    }

    public ObjectNode compute(JsonNode request) {
        requireSignedPlan(request);
        SchemaVersion schema = selectedSchema(request);
        String key = computeKey(request, schema);
        byte[] kept = key == null ? null : resultCache.get(key);
        if (kept != null) {
            try { return (ObjectNode) json.readTree(kept); } catch (java.io.IOException ignored) { /* solved again below */ }
        }
        ObjectNode result = solve(request, schema, request.path(PARAMETERS));
        JsonNode spec = request.path(SIMULATION_SPEC);
        JsonNode fieldMeta = written(spec) ? models.fieldMeta(spec) : solverFieldMeta(definition(request, schema), spec);
        result.set(PRESENTATION, TeacherSimulationPresentation.create((ObjectNode) result.path(SOLVER_TIMELINE), spec, perMember(fieldMeta), request.path(PARAMETERS)));
        if (key != null) {
            try { resultCache.put(key, json.writeValueAsBytes(result)); } catch (java.io.IOException ignored) { /* not kept */ }
        }
        return result;
    }

    /**
     * What decides a solved result: the signed plan, the topic version, the slider values and the approved laws it is
     * checked against. Null when results are not kept.
     */
    private String computeKey(JsonNode request, SchemaVersion schema) {
        Approved now = current();
        if (resultCache == null || now == null) return null;
        java.util.TreeMap<String, String> sliders = new java.util.TreeMap<>();
        request.path(PARAMETERS).fields().forEachRemaining(entry -> sliders.put(entry.getKey(), entry.getValue().asText()));
        try {
            var digest = java.security.MessageDigest.getInstance("SHA-256");
            for (String part : java.util.List.of(schema.getSchemaId() + "@" + schema.getVersion(), now.mark(), request.path(PLAN_SIGNATURE).asText(),
                    request.path(SIMULATION_SPEC).toString(), sliders.toString())) {
                digest.update(part.getBytes(StandardCharsets.UTF_8));
                digest.update((byte) 0);
            }
            return java.util.HexFormat.of().formatHex(digest.digest());
        } catch (java.security.NoSuchAlgorithmException impossible) {
            return null;
        }
    }

    /** The approved schemas as they are now: rebuilt only when their change mark moves. Null where no mark is kept. */
    private Approved current() {
        String mark = schemas.approvedFingerprint();
        if (mark == null) return null;
        Approved now = approved.get();
        if (now == null || !now.mark().equals(mark)) {
            now = new Approved(mark, mergedCatalogue(), new java.util.concurrent.ConcurrentHashMap<>());
            approved.set(now);
        }
        return now;
    }

    /** The description of a group's quantity ("hat[i].x") once for each member ("hat[0].x", "hat[1].x"…), as the timeline names them. */
    private ObjectNode perMember(JsonNode fieldMeta) {
        ObjectNode all = json.createObjectNode();
        fieldMeta.fields().forEachRemaining(entry -> {
            int members = entry.getValue().path("members").asInt(0);
            if (members < 2 || !entry.getKey().contains("[i]")) { all.set(entry.getKey(), entry.getValue()); return; }
            for (int i = 0; i < members; i++) {
                ObjectNode one = (ObjectNode) entry.getValue().deepCopy();
                one.put(PARTICIPANT_ID, one.path(PARTICIPANT_ID).asText() + "[" + i + "]");
                one.put(PARTICIPANT_LABEL, one.path(PARTICIPANT_LABEL).asText() + " " + (i + 1));
                all.set(entry.getKey().replace("[i]", "[" + i + "]"), one);
            }
        });
        return all;
    }

    public LibraryItemResponse save(SimulationRequests.Save request) {
        requireSignedPlan(request.simulation());
        SchemaVersion schema = selectedSchema(request.simulation());
        return storage.save(request, schema, solve(request.simulation(), schema, request.parameters()));
    }

    public ObjectNode openSaved(UUID id) {
        ObjectNode opened = storage.open(id);
        JsonNode spec = opened.path(SIMULATION_SPEC);
        if (spec.path(SOLVER_TIMELINE).path(FRAMES).isArray() && !spec.path(SOLVER_TIMELINE).path(FRAMES).isEmpty())
            opened.set(PRESENTATION, TeacherSimulationPresentation.create((ObjectNode) spec.path(SOLVER_TIMELINE), spec,
                    perMember(spec.path(SOLVER_FIELD_META)), opened.path("savedParameters").isObject() ? opened.path("savedParameters") : null));
        return opened;
    }

    public void updateSavedVisual(UUID id, ObjectNode generated) {
        requireSignedPlan(generated);
        storage.updateVisual(id, generated);
    }

    /** True for a plan whose physics was written for its description; false for a plan saved when plans bound library laws. */
    private static boolean written(JsonNode spec) {
        return spec.path(MODEL).isObject();
    }

    /** Computes a signed plan with the given slider values and checks the run against the laws of every approved topic. */
    private ObjectNode solve(JsonNode request, SchemaVersion schema, JsonNode sliders) {
        JsonNode spec = request.path(SIMULATION_SPEC);
        ObjectNode result = written(spec) ? models.compute(catalogue(), spec, sliders)
                : equations.compute(definition(request, schema), spec, sliders);
        ((ObjectNode) result.path(VALIDATION)).put(TOPIC_VERSION, schema.getVersion());
        return result;
    }

    /**
     * The laws a run is checked against: those of every approved topic together. A description is routed to one
     * topic for its curriculum context, but nothing it describes is outside the reach of another topic's laws.
     */
    private ObjectNode catalogue() {
        Approved now = current();
        return now == null ? mergedCatalogue() : now.catalogue();
    }

    private ObjectNode mergedCatalogue() {
        java.util.List<JsonNode> all = new java.util.ArrayList<>();
        for (SchemaVersion schema : schemas.approvedSchemas())
            if (schema.getDefinition().path(LAW_CATALOGUE).isObject())
                all.add(schema.getDefinition().path(LAW_CATALOGUE));
        return LawChecks.merge(json, all);
    }

    /** What the drawing model is told about the topic of a written plan: its place in the curriculum, not a law library. */
    private JsonNode context(SchemaVersion schema) {
        ObjectNode context = json.createObjectNode().put("name", schema.getName());
        JsonNode definition = schema.getDefinition();
        for (String field : java.util.List.of(GRADE, DESCRIPTION, CURRICULUM))
            if (definition.has(field))
                context.set(field, definition.get(field));
        return context;
    }

    private SchemaVersion selectedSchema(JsonNode request) {
        String id = request.path(SCHEMA_ID).asText();
        String version = request.path(SCHEMA_VERSION).asText();
        Approved now = current();
        if (now == null) return schemas.requireCurrentApproved(id, version);
        return now.versions().computeIfAbsent(id + "@" + version, ignored -> schemas.requireCurrentApproved(id, version));
    }

    /**
     * Plans saved before models were written per description: the library laws such a plan binds, from its own
     * topic and every further topic it names (simulationSpec.relatedSchemas).
     */
    private JsonNode definition(JsonNode request, SchemaVersion schema) {
        JsonNode related = request.path(SIMULATION_SPEC).path(RELATED_SCHEMAS);
        if (!related.isArray() || related.isEmpty())
            return schema.getDefinition();
        java.util.List<JsonNode> more = new java.util.ArrayList<>();
        for (JsonNode entry : related)
            more.add(schemas.requireCurrentApproved(entry.path(SCHEMA_ID).asText(), entry.path(SCHEMA_VERSION).asText())
                    .getDefinition());
        return merged(schema.getDefinition(), more);
    }

    /** One definition holding the laws and vocabulary of several topics; what the first topic defines stands. */
    static JsonNode merged(JsonNode primary, java.util.List<JsonNode> more) {
        if (more.isEmpty())
            return primary;
        ObjectNode all = primary.deepCopy();
        Map<String, String> identity = Map.of(CAPABILITIES, CAPABILITY_ID, "quantityDefinitions", "key", "objectTypes",
                "type", "unitCatalog", "symbol", "laws", "id");
        identity.forEach((list, key) -> {
            ArrayNode target = all.withArray(list);
            java.util.Set<String> present = new java.util.HashSet<>();
            target.forEach(item -> present.add(item.path(key).asText()));
            for (JsonNode definition : more)
                for (JsonNode item : definition.path(list))
                    if (present.add(item.path(key).asText()))
                        target.add(item.deepCopy());
        });
        return all;
    }

    /**
     * The plan's signature. What the learner watches is part of the confirmed plan
     * (the renderer checks the stage against it); plans signed before it was
     * (version 1) carry a signature without it.
     */
    private String signPlan(JsonNode request, boolean watched) {
        ObjectNode contract = json.createObjectNode();
        JsonNode spec = request.path(SIMULATION_SPEC);
        // a written plan is its model; what the server derives from it for the page is not part of the contract
        for (String field : written(spec) ? java.util.List.of(DURATION_SECONDS, DURATION_PARAMETER, PARAMETERS, OBJECTS, MODEL)
                : java.util.List.of(DURATION_SECONDS, DURATION_PARAMETER, PARAMETERS, "physicsModels", "physicsCoverage"))
            contract.set(field, spec.path(field));
        if (watched && spec.has(OBSERVABLES))
            contract.set(OBSERVABLES, spec.get(OBSERVABLES));
        // the further topics whose laws the plan uses; a plan made from one topic signs as before
        if (spec.path(RELATED_SCHEMAS).isArray() && !spec.path(RELATED_SCHEMAS).isEmpty())
            contract.set(RELATED_SCHEMAS, spec.get(RELATED_SCHEMAS));
        String payload = "physlive-simulation-plan-v" + (watched ? 2 : 1) + "\n" + request.path(SCHEMA_ID).asText() + "\n"
                + request.path(SCHEMA_VERSION).asText() + "\n" + request.path(DESCRIPTION).asText() + "\n"
                + schemas.compiledChecksum(contract);
        try {
            javax.crypto.Mac mac = javax.crypto.Mac.getInstance("HmacSHA256");
            mac.init(new javax.crypto.spec.SecretKeySpec(signingKey, "HmacSHA256"));
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(mac.doFinal(payload.getBytes(StandardCharsets.UTF_8)));
        } catch (java.security.GeneralSecurityException ex) {
            throw new IllegalStateException("Cannot sign simulation plan", ex);
        }
    }

    private void requireSignedPlan(JsonNode request) {
        byte[] actual = request.path(PLAN_SIGNATURE).asText().getBytes(StandardCharsets.UTF_8);
        if (!java.security.MessageDigest.isEqual(signPlan(request, true).getBytes(StandardCharsets.UTF_8), actual)
                && !java.security.MessageDigest.isEqual(signPlan(request, false).getBytes(StandardCharsets.UTF_8), actual))
            throw ApiException
                    .conflict("Kế hoạch mô phỏng đã thay đổi. Vui lòng gửi lại mô tả đã sửa để phân tích trước");
    }

    public ObjectNode understandImage(byte[] imageBytes, String mediaType, String text) {
        if (imageBytes == null || imageBytes.length == 0 || imageBytes.length > upload.maxImageBytes()) {
            throw ApiException.badRequest("Ảnh trống hoặc vượt quá giới hạn dung lượng");
        }
        if (mediaType == null || !upload.allowedImageTypes().contains(mediaType.toLowerCase(java.util.Locale.ROOT))) {
            throw ApiException.unsupportedMedia("Định dạng ảnh không được hỗ trợ");
        }
        if (text != null && text.length() > jev.maximumQueryCharacters()) {
            throw ApiException.badRequest("Nội dung mô tả kèm ảnh quá dài");
        }
        JsonNode transcription = client.transcribe(imageBytes, mediaType, text, () -> {
            try {
                return new DefaultResourceLoader().getResource(ai.provider().ocrPromptResource())
                        .getContentAsString(StandardCharsets.UTF_8);
            } catch (IOException ex) {
                throw ApiException.upstream("Kết quả nhận dạng ảnh không hợp lệ");
            }
        });
        String recognized = transcription.path("text").asText("").trim();
        ObjectNode result = json.createObjectNode();
        result.put(SESSION_ID, UUID.randomUUID().toString());
        result.put(STAGE, recognized.isEmpty() ? "RECOGNITION_FAILED" : "RECOGNITION");
        result.put("recognizedText", recognized);
        result.put("displayText", recognized);
        result.put("sourceMode", "IMAGE");
        result.putNull("confidence");
        if (recognized.isEmpty())
            result.put(MESSAGE, "Không nhận diện được nội dung rõ ràng từ ảnh.");
        return result;
    }

    private JsonNode understand(String description, String sessionId) {
        if (description.length() > jev.maximumQueryCharacters()) {
            throw ApiException.badRequest("Mô tả mô phỏng vượt quá giới hạn độ dài");
        }
        var approvedSchemas = schemas.approvedSchemas();
        if (approvedSchemas.isEmpty()) {
            throw ApiException.unprocessable("Chưa có mô hình chủ đề được phê duyệt");
        }
        Map<String, SchemaVersion> byId = new LinkedHashMap<>();
        ObjectNode criteria = json.createObjectNode();
        // Reserve room for the JSON envelope/instructions; never spend more than
        // ROUTING_SUMMARY_MAX characters per topic even when the limit would allow it.
        int schemaTextBudget = Math.clamp(
                (jev.maximumPromptCharacters() - description.length() - 2048) / (approvedSchemas.size() + 1) - 64L, 0, ROUTING_SUMMARY_MAX);
        if (schemaTextBudget == 0) {
            throw ApiException.unprocessable("Mô tả quá dài để phân tích và chọn mô hình. Vui lòng rút gọn nội dung");
        }
        approvedSchemas.forEach(schema -> {
            byId.put(schema.getSchemaId(), schema);
            criteria.put(schema.getSchemaId(), schemaDescription(schema, schemaTextBudget));
        });
        criteria.put(NO_MATCH, "The description has no suitable physical topic among the available schemas.");

        ObjectNode question = json.createObjectNode();
        question.put("type", "choice");
        question.put("instructions",
                "Choose the one approved physics topic schema that best covers the physical laws and relationships described. Choose NO_MATCH when none is suitable.");
        question.set("criteria", criteria);
        ObjectNode questions = json.createObjectNode();
        questions.set("topic_schema", question);
        JsonNode answer = client.route(description, questions).path("topic_schema");
        String selectedId = answer.path("choice").asText("");
        double confidence = answer.path("confidence").asDouble(0);
        double margin = margin(answer.path("probabilities"), selectedId);
        SchemaVersion selected = byId.get(selectedId);
        // Topic schemas follow the curriculum strands and deliberately share
        // capabilities
        // (e.g. free fall is taught in both kinematics and dynamics), so a narrow
        // margin between
        // two real topics is not ambiguity. Only a narrow margin against NO_MATCH is.
        boolean ambiguousWithNoMatch = margin < jev.minimumMargin()
                && NO_MATCH.equals(runnerUp(answer.path("probabilities"), selectedId));
        if (selectedId.isBlank() || NO_MATCH.equals(selectedId) || selected == null
                || confidence < jev.minimumConfidence() || ambiguousWithNoMatch) {
            ObjectNode clarify = json.createObjectNode();
            clarify.put(SESSION_ID, sessionId);
            clarify.put(DESCRIPTION, description);
            clarify.put(STAGE, "CLARIFY");
            clarify.put("question",
                    "Thư viện hiện chưa có chủ đề vật lý nào khớp với mô tả này: hiện tượng có thể chưa được hỗ trợ, hoặc mô tả chưa nêu rõ hiện tượng. Bạn có thể mô tả lại hiện tượng hoặc quy luật muốn mô phỏng không?");
            clarify.put("schemaConfidence", confidence);
            return clarify;
        }

        JsonNode answer0 = askModel(description, selected, null);
        ObjectNode response = answer0.deepCopy();
        if (!response.hasNonNull(STAGE))
            response.set(STAGE, response.path(STATUS).deepCopy());
        response.put(SESSION_ID, sessionId);
        response.put(SCHEMA_ID, selected.getSchemaId());
        response.put(TOPIC, selected.getTopic());
        response.put(SCHEMA_VERSION, selected.getVersion());
        response.put(DESCRIPTION, description);
        if (!EXPLAIN_STAGE.equals(stageOf(response)))
            return response;
        if (!response.path(SIMULATION_SPEC).isObject())
            throw ApiException.upstream("Kết quả phân tích mô phỏng của AI không hợp lệ");
        ObjectNode computed = settleModel(description, selected, response);
        ObjectNode spec = (ObjectNode) response.path(SIMULATION_SPEC);
        spec.put(SCHEMA_ID, selected.getSchemaId());
        spec.put(TOPIC, selected.getTopic());
        spec.put(TOPIC_VERSION, selected.getVersion());
        String status = computed.path(VALIDATION).path(STATUS).asText();
        String coverage = switch (status) {
            case FreeModel.VERIFIED -> "COMPLETE";
            case FreeModel.ILLUSTRATIVE -> "NONE";
            default -> "PARTIAL";
        };
        spec.put("physicsCoverage", coverage);
        ((ObjectNode) computed.path(VALIDATION)).put(TOPIC_VERSION, selected.getVersion());
        // What no law could check goes on the reviewers' list, and the teacher is told that it did.
        if (gaps != null && gaps.recordGaps(selected.getSchemaId(), selected.getTopic(), description, spec, computed.path(VALIDATION)) > 0) {
            ObjectNode checked = (ObjectNode) computed.path(VALIDATION);
            String notice = status.equals(FreeModel.FLAGGED)
                    ? "Trường hợp này đã được gửi cho bộ phận biên soạn xem lại định luật liên quan; bạn có thể diễn đạt lại mô tả rồi thử lại."
                    : "Phần chưa có định luật đối chiếu đã được gửi cho bộ phận biên soạn để bổ sung; mô phỏng vẫn dùng được.";
            checked.put("reviewNotice", notice);
            checked.put("verificationScope", checked.path("verificationScope").asText() + ". " + notice);
        }
        response.set(VALIDATION, computed.path(VALIDATION));
        response.put(PLAN_SIGNATURE, signPlan(response, true));
        response.set("formulas", models.formulas(spec));
        return response;
    }

    /** One attempt at a model: what the solver computed, and what the solver or the laws object to. */
    private record Attempt(ObjectNode spec, ObjectNode computed, java.util.List<String> problems) {
    }

    private Attempt attempt(ObjectNode spec) {
        java.util.List<String> problems = new java.util.ArrayList<>();
        try {
            normalizePlan(spec);
            models.tidy(spec, catalogue());
            models.project(spec);
            ObjectNode computed = models.compute(catalogue(), spec, json.createObjectNode());
            if (computed.path(VALIDATION).path(STATUS).asText().equals(FreeModel.FLAGGED))
                computed.path(VALIDATION).path("flags").forEach(flag -> problems.add(flag.asText()));
            reportIdleObjects(spec, problems);
            reportStillMotion(spec, computed, problems);
            reportUnevenKinds(spec, problems);
            return new Attempt(spec, computed, problems);
        } catch (ApiException error) {
            problems.add(String.valueOf(error.getMessage()));
            return new Attempt(spec, null, problems);
        }
    }

    /**
     * A thing the learner can set but of which nothing is computed is a model left unfinished: the drawing would then
     * have to invent its motion. The author is told; the model stands if nothing better comes.
     */
    private static void reportIdleObjects(ObjectNode spec, java.util.List<String> problems) {
        java.util.Set<String> computedFor = new java.util.LinkedHashSet<>();
        spec.path(MODEL).path(QUANTITIES).forEach(quantity -> computedFor.add(quantity.path("of").asText("")));
        java.util.List<String> idle = new java.util.ArrayList<>();
        for (JsonNode object : spec.path(OBJECTS)) {
            String id = object.path("id").asText();
            boolean set = false;
            for (JsonNode parameter : spec.path(PARAMETERS)) set |= parameter.path("of").asText("").equals(id);
            if (set && !computedFor.contains(id)) idle.add(id + " (" + object.path(LABEL).asText(id) + ")");
        }
        if (!idle.isEmpty()) problems.add("Mô hình chưa tính đại lượng nào cho " + String.join(", ", idle)
                + ": mỗi đối tượng cần các đại lượng của riêng nó (of = id của nó), tính từ thanh trượt của chính nó — ít nhất là vị trí hoặc góc theo thời gian và những gì mô tả muốn xem. Phần vẽ chỉ được dùng số liệu đã tính ở đây, không tự tính chuyển động.");
    }

    /**
     * Something has a velocity and yet nothing in the run changes: its position was left out, and the learner would
     * watch a still picture.
     */
    private static void reportStillMotion(ObjectNode spec, ObjectNode computed, java.util.List<String> problems) {
        JsonNode frames = computed.path(SOLVER_TIMELINE).path(FRAMES);
        boolean still = frames.size() > 1;
        for (int i = 1; still && i < frames.size(); i++) still = sameAsFirst(frames, i);
        java.util.List<String> moving = new java.util.ArrayList<>();
        if (still) {
            for (JsonNode quantity : spec.path(MODEL).path(QUANTITIES)) {
                if (quantity.path("role").asText().equals("velocity") && Math.abs(frames.get(0).path(VALUES).path(FreeModel.key(quantity)).asDouble()) > 0) moving.add(quantity.path("id").asText());
            }
        }
        if (!moving.isEmpty()) problems.add("Mô hình có vận tốc khác không (" + String.join(", ", moving) + ") nhưng không đại lượng nào thay đổi theo thời gian, nên mô phỏng sẽ đứng yên. "
                + "Thêm toạ độ của vật chuyển động theo từng trục (role position, initial là vị trí đầu, rate là vận tốc trên trục đó) và chọn durationSeconds đủ để thấy vật đi được một quãng.");
    }

    /** Whether every value of a frame equals the first frame's value of the same name. */
    private static boolean sameAsFirst(JsonNode frames, int i) {
        var values = frames.get(i).path(VALUES).fields();
        boolean same = true;
        while (same && values.hasNext()) {
            var value = values.next();
            same = Math.abs(value.getValue().asDouble() - frames.get(0).path(VALUES).path(value.getKey()).asDouble()) <= 1e-12;
        }
        return same;
    }

    /**
     * Things of one kind (their names differ only by a number) are modelled alike: the same sliders and the same
     * quantities for each. One written in full and the others in part is a model left unfinished.
     */
    private static void reportUnevenKinds(ObjectNode spec, java.util.List<String> problems) {
        java.util.Map<String, java.util.List<JsonNode>> kinds = new java.util.LinkedHashMap<>();
        for (JsonNode object : spec.path(OBJECTS))
            kinds.computeIfAbsent(object.path(LABEL).asText(object.path("id").asText()).replaceAll("\\d", "").trim().toLowerCase(), kind -> new java.util.ArrayList<>()).add(object);
        for (java.util.List<JsonNode> alike : kinds.values()) {
            if (alike.size() < 2) continue;
            java.util.Map<String, int[]> size = new java.util.LinkedHashMap<>();
            int[] most = {0, 0};
            for (JsonNode object : alike) {
                String id = object.path("id").asText();
                int[] own = ownCounts(spec, id);
                size.put(object.path(LABEL).asText(id), own);
                most[0] = Math.max(most[0], own[0]);
                most[1] = Math.max(most[1], own[1]);
            }
            java.util.List<String> less = new java.util.ArrayList<>();
            for (var entry : size.entrySet()) {
                if (entry.getValue()[0] < most[0] || entry.getValue()[1] < most[1])
                    less.add(entry.getKey() + " (" + entry.getValue()[0] + " thanh trượt, " + entry.getValue()[1] + " đại lượng)");
            }
            if (!less.isEmpty()) problems.add("Các đối tượng cùng loại phải được viết như nhau, mỗi cái có đủ thanh trượt riêng và đủ đại lượng riêng (đầy đủ nhất hiện có "
                    + most[0] + " thanh trượt, " + most[1] + " đại lượng). Còn thiếu ở: " + String.join("; ", less)
                    + ". Viết lại đầy đủ cho từng đối tượng, mỗi đại lượng tính từ thanh trượt của chính đối tượng đó.");
        }
    }

    /** How many sliders and how many quantities are written as an object's own. */
    private static int[] ownCounts(ObjectNode spec, String id) {
        int[] own = {0, 0};
        for (JsonNode parameter : spec.path(PARAMETERS)) {
            if (parameter.path("of").asText("").equals(id)) own[0]++;
        }
        for (JsonNode quantity : spec.path(MODEL).path(QUANTITIES)) {
            if (quantity.path("of").asText("").equals(id)) own[1]++;
        }
        return own;
    }

    /**
     * The author's model written again with the objections to the latest one in hand; empty where the author cannot
     * be reached or answers with something other than a model.
     */
    private java.util.Optional<JsonNode> correctedAnswer(String description, SchemaVersion selected, Attempt latest) {
        ObjectNode feedback = json.createObjectNode();
        feedback.put("error", String.join(" ", latest.problems()));
        feedback.set("previousModel", latest.spec());
        JsonNode retry;
        try {
            retry = askModel(description, selected, feedback);
        } catch (ApiException unavailable) {
            return java.util.Optional.empty();
        }
        boolean model = EXPLAIN_STAGE.equals(stageOf(retry)) && retry.path(SIMULATION_SPEC).isObject();
        return model ? java.util.Optional.of(retry) : java.util.Optional.empty();
    }

    /**
     * Solves and checks the model; while the solver cannot compute it or a law refuses it, the author gets the
     * reason and writes it again. The best model stands (computable before not, then fewer objections), so the
     * teacher is shown a model that breaks a law, with that law named, sooner than nothing.
     */
    private ObjectNode settleModel(String description, SchemaVersion selected, ObjectNode response) {
        JsonNode answerAsWritten = response.path(SIMULATION_SPEC).deepCopy();
        Attempt best = attempt((ObjectNode) response.path(SIMULATION_SPEC));
        Attempt latest = best;
        for (int round = 0; round < MAX_MODEL_REPAIRS && !latest.problems().isEmpty(); round++) {
            java.util.Optional<JsonNode> answer = correctedAnswer(description, selected, latest);
            if (answer.isEmpty())
                break;
            JsonNode retry = answer.get();
            latest = attempt((ObjectNode) retry.path(SIMULATION_SPEC).deepCopy());
            boolean better = latest.computed() != null
                    && (best.computed() == null || latest.problems().size() < best.problems().size());
            if (better) {
                best = latest;
                response.set(SIMULATION_SPEC, latest.spec());
                for (String field : java.util.List.of(EXPLANATION, "defaults"))
                    if (retry.has(field))
                        response.set(field, retry.get(field));
            }
        }
        if (best.computed() == null) {
            // Corrections that go nowhere usually circle around the first broken answer: one answer written afresh,
            // without it, before the teacher is told anything.
            try {
                JsonNode fresh = askModel(description, selected, null);
                if (EXPLAIN_STAGE.equals(stageOf(fresh)) && fresh.path(SIMULATION_SPEC).isObject()) {
                    Attempt again = attempt((ObjectNode) fresh.path(SIMULATION_SPEC).deepCopy());
                    if (again.computed() != null) {
                        best = again;
                        response.set(SIMULATION_SPEC, again.spec());
                        for (String field : java.util.List.of(EXPLANATION, "defaults"))
                            if (fresh.has(field))
                                response.set(field, fresh.get(field));
                    } else latest = again;
                }
            } catch (RuntimeException unavailable) {
                // the message below stands
            }
        }
        if (best.computed() == null) {
            // what the author actually wrote, for whoever has to find out why no model could be computed
            log.warn("MODEL_NOT_COMPUTABLE problems={} answer={}", latest.problems(), latest.spec());
            try {
                ObjectNode diagnosis = json.createObjectNode().put(DESCRIPTION, description).put("problems", String.join(" | ", latest.problems()));
                diagnosis.set("firstAnswer", answerAsWritten);
                diagnosis.set("lastAnswerAfterTidying", latest.spec());
                java.nio.file.Files.createDirectories(java.nio.file.Path.of("logs"));
                java.nio.file.Files.writeString(java.nio.file.Path.of("logs", "model-not-computable.json"), diagnosis.toPrettyString(), StandardCharsets.UTF_8);
            } catch (java.io.IOException | RuntimeException ignored) {
                // a diagnostic file that cannot be written changes nothing for the teacher
            }
        }
        if (best.computed() == null)
            throw ApiException.unprocessable(
                    "AI chưa viết được mô hình tính toán hợp lệ cho mô tả này sau nhiều lần thử. Mô tả của bạn không sai; hãy bấm thử lại, hoặc chia tình huống thành phần đơn giản hơn. (Chi tiết kỹ thuật: "
                            + String.join(" ", best.problems()) + ")");
        return best.computed();
    }

    /**
     * Resolves what the plan states twice (a parameter's value and its range; the
     * duration and its slider)
     * without guessing intent: the stated value wins.
     */
    private void normalizePlan(ObjectNode spec) {
        Map<String, ObjectNode> parameters = new LinkedHashMap<>();
        for (JsonNode parameter : spec.path(PARAMETERS))
            if (parameter instanceof ObjectNode p)
                parameters.put(p.path("name").asText(), p);
        ObjectNode control = parameters.get(spec.path(DURATION_PARAMETER).asText(""));
        String unit = control == null ? "" : control.path("unit").asText();
        if (control == null || !equations.sameQuantity(unit, "s"))
            spec.remove(DURATION_PARAMETER);
        else if (spec.path(DURATION_SECONDS).asDouble(0) > 0)
            control.put(VALUE, equations.convert(spec.path(DURATION_SECONDS).asDouble(), "s", unit));
        else
            spec.put(DURATION_SECONDS, equations.convert(control.path(VALUE).asDouble(), unit, "s"));
        for (ObjectNode p : parameters.values()) {
            double value = p.path(VALUE).asDouble(Double.NaN);
            if (!Double.isFinite(value))
                continue;
            if (p.has("min") && p.path("min").asDouble() > value)
                p.put("min", value);
            if (p.has("max") && p.path("max").asDouble() < value)
                p.put("max", value);
        }
    }

    private static String stageOf(JsonNode result) {
        return result.path(STAGE).asText(result.path(STATUS).asText());
    }

    private static JsonNode capabilityOf(JsonNode definition, String capabilityId) {
        for (JsonNode capability : definition.path(CAPABILITIES))
            if (capability.path(CAPABILITY_ID).asText().equals(capabilityId))
                return capability;
        return null;
    }

    /**
     * Asks for the model of a description. The author is told the roles of every approved topic (a quantity of any
     * of them can be declared and will be checked), the laws and curriculum of the routed topic, worked examples of
     * that topic, and how units may be written.
     */
    private JsonNode askModel(String description, SchemaVersion selected, JsonNode planFeedback) {
        ObjectNode input = json.createObjectNode();
        input.put(DESCRIPTION, description);
        JsonNode definition = selected.getDefinition();
        ObjectNode topic = input.putObject(TOPIC).put("name", selected.getName());
        for (String field : java.util.List.of(GRADE, DESCRIPTION))
            if (definition.has(field))
                topic.set(field, definition.get(field));
        JsonNode own = definition.path(LAW_CATALOGUE);
        if (own.path(CONTENTS).isArray())
            topic.set(CONTENTS, own.path(CONTENTS));
        ObjectNode all = catalogue();
        ObjectNode laws = input.putObject("laws");
        for (String part : java.util.List.of("axes", "roles", "kinds", "forceKinds", "constants"))
            if (all.has(part))
                laws.set(part, all.get(part));
        own.path("laws").forEach(law -> laws.withArray("laws").add(law.path(TITLE).asText() + " [" + law.path(CURRICULUM).asText() + "]"));
        for (JsonNode capability : definition.path(CAPABILITIES)) {
            ObjectNode example = input.withArray("examples").addObject().put(TITLE, capability.path(TITLE).asText());
            example.set("equations", capability.path("equationSet").path("canonical"));
            example.set("assumptions", capability.path("assumptions"));
        }
        ObjectNode units = input.putObject("units");
        equations.unitSpellings().forEach((unit, spellings) -> spellings.forEach(units.withArray(unit)::add));
        if (planFeedback != null)
            input.set("planFeedback", planFeedback);
        JsonNode result = client.text(input, () -> resource("prompts/simulation-model-system.txt")
                + resource("prompts/simulation-model-response-schema.json"));
        if (result == null || !result.isObject() || !result.path(STATUS).isTextual())
            throw ApiException.upstream("Kết quả phân tích mô phỏng của AI không hợp lệ");
        return result;
    }

    private String resource(String path) {
        try {
            return new ClassPathResource(path).getContentAsString(StandardCharsets.UTF_8);
        } catch (IOException ex) {
            throw new IllegalStateException("Required simulation contract is unavailable: " + path, ex);
        }
    }

    private JsonNode jsonResource(String path) {
        try {
            return json.readTree(resource(path));
        } catch (IOException ex) {
            throw new IllegalStateException("Invalid simulation response contract: " + path, ex);
        }
    }

    /**
     * For plans saved before models were written per description: each solver field ("participant.output")
     * described from the library law the plan binds.
     */
    private ObjectNode solverFieldMeta(JsonNode definition, JsonNode brief) {
        ObjectNode result = json.createObjectNode();
        Map<String, JsonNode> quantities = new LinkedHashMap<>();
        for (JsonNode quantity : definition.path("quantityDefinitions"))
            quantities.put(quantity.path("key").asText(), quantity);
        for (JsonNode model : brief.path("physicsModels")) {
            String id = model.path("id").asText();
            JsonNode capability = capabilityOf(definition, model.path(CAPABILITY_ID).asText());
            if (id.isBlank() || capability == null)
                continue;
            Map<String, String> roles = new LinkedHashMap<>();
            for (JsonNode binding : capability.path("rendererBindings"))
                roles.put(binding.path("source").asText(), binding.path("role").asText());
            for (JsonNode output : capability.path("outputs")) {
                String key = output.path("key").asText();
                ObjectNode field = result.putObject(id + "." + key);
                field.put(PARTICIPANT_ID, id);
                field.put(PARTICIPANT_LABEL, model.path(LABEL).asText(id));
                field.put("quantity", key);
                field.put("unit", output.path("unit").asText(""));
                JsonNode quantity = quantities.get(key);
                if (quantity != null)
                    field.put(LABEL, quantity.path(LABEL).asText(key));
                if (quantity != null && !quantity.path("aliases").path(0).asText("").isBlank())
                    field.put("symbol", quantity.path("aliases").path(0).asText());
                String role = roles.get(key);
                if (role != null)
                    field.put("rendererRole", role);
            }
            // A value the plan fixes (an input bound to a number) can be shown beside its object as well.
            Map<String, String> units = new LinkedHashMap<>();
            capability.path("canonicalInputs").forEach(input -> units.put(input.path("key").asText(), input.path("unit").asText("")));
            model.path("inputs").fields().forEachRemaining(input -> {
                String key = id + "." + input.getKey();
                if (!input.getValue().isNumber() || result.has(key))
                    return;
                ObjectNode field = result.putObject(key);
                field.put(PARTICIPANT_ID, id);
                field.put(PARTICIPANT_LABEL, model.path(LABEL).asText(id));
                field.put("quantity", input.getKey());
                field.put("unit", units.getOrDefault(input.getKey(), ""));
                JsonNode quantity = quantities.get(input.getKey());
                if (quantity != null)
                    field.put(LABEL, quantity.path(LABEL).asText(input.getKey()));
                field.set("constant", input.getValue());
            });
        }
        return result;
    }

    /** Preserve the signed plan and solver data without field filtering, rounding or resampling. */
    static ObjectNode completeVisualInput(ObjectMapper json, JsonNode request, JsonNode schemaDefinition,
            JsonNode fieldMeta, JsonNode computed) {
        ObjectNode input = json.createObjectNode();
        input.set(DESCRIPTION, request.path(DESCRIPTION).deepCopy());
        if (request.has(EXPLANATION))
            input.set("planExplanation", request.get(EXPLANATION).deepCopy());
        input.set("confirmedPlan", request.path(SIMULATION_SPEC).deepCopy());
        input.set("physicsSchema", schemaDefinition.deepCopy());
        input.set(SOLVER_FIELD_META, fieldMeta.deepCopy());
        input.set(SOLVER_TIMELINE, timelinePreview(json, computed.path(SOLVER_TIMELINE)));
        input.set("solverValidation", computed.path(VALIDATION).deepCopy());
        return input;
    }

    private static final int PREVIEW_FRAMES = 160;
    private static final int PREVIEW_MEMBERS = 3;
    private static final int PREVIEW_CELLS = 400;

    /**
     * What the drawing model studies of a run: an even sample of the frames, the frames at every stage
     * boundary and the exact extremes of every field. The page still receives every frame; sending them all
     * to the model only multiplies its input (thousands of frames for a refined run) without telling it more.
     */
    static ObjectNode timelinePreview(ObjectMapper json, JsonNode timeline) {
        ObjectNode preview = (ObjectNode) timeline.deepCopy();
        JsonNode frames = timeline.path(FRAMES);
        ObjectNode ranges = json.createObjectNode();
        for (JsonNode frame : frames)
            frame.path(VALUES).fields().forEachRemaining(field -> {
                double value = field.getValue().asDouble();
                ObjectNode range = ranges.has(field.getKey()) ? (ObjectNode) ranges.get(field.getKey())
                        : ranges.putObject(field.getKey()).put("min", value).put("max", value);
                range.put("min", Math.min(range.path("min").asDouble(), value));
                range.put("max", Math.max(range.path("max").asDouble(), value));
            });
        // a group is studied through its first members and the extremes over all of them; a quantity over space
        // through its axes, its extremes and one instant
        java.util.Set<String> beyond = new java.util.LinkedHashSet<>();
        for (String key : (Iterable<String>) ranges::fieldNames) {
            com.example.backend.common.text.CodeText.memberKey(key)
                    .filter(member -> Integer.parseInt(member.index()) >= PREVIEW_MEMBERS)
                    .ifPresent(member -> beyond.add(key));
        }
        for (String key : beyond) {
            com.example.backend.common.text.CodeText.Member member = com.example.backend.common.text.CodeText.memberKey(key).orElseThrow();
            String all = member.group() + "[i]." + member.quantity();
            JsonNode own = ranges.get(key);
            ObjectNode range = ranges.has(all) ? (ObjectNode) ranges.get(all) : ranges.putObject(all).put("min", own.path("min").asDouble()).put("max", own.path("max").asDouble());
            range.put("min", Math.min(range.path("min").asDouble(), own.path("min").asDouble())).put("max", Math.max(range.path("max").asDouble(), own.path("max").asDouble()));
            ranges.remove(key);
        }
        if (!beyond.isEmpty()) for (JsonNode frame : preview.path(FRAMES)) ((ObjectNode) frame.path(VALUES)).remove(beyond);
        for (JsonNode space : preview.path("fields")) {
            com.fasterxml.jackson.databind.node.ArrayNode instants = (com.fasterxml.jackson.databind.node.ArrayNode) space.path(FRAMES);
            ((ObjectNode) space).put("instants", instants.size());
            while (instants.size() > 1) instants.remove(1);
            if (instants.size() == 1 && instants.get(0).size() > PREVIEW_CELLS) ((ObjectNode) space).remove(FRAMES);
        }
        preview.set("fieldRanges", ranges);
        preview.put("frameCount", frames.size());
        if (frames.size() <= PREVIEW_FRAMES)
            return preview;
        java.util.TreeSet<Integer> kept = new java.util.TreeSet<>();
        for (int i = 0; i < PREVIEW_FRAMES; i++)
            kept.add((int) Math.round(i * (frames.size() - 1) / (double) (PREVIEW_FRAMES - 1)));
        for (JsonNode phase : timeline.path("phases"))
            for (String edge : java.util.List.of("start", "end")) {
                if (!phase.path(edge).isNumber())
                    continue;
                int nearest = 0;
                for (int i = 1; i < frames.size(); i++)
                    if (Math.abs(frames.get(i).path("t").asDouble() - phase.path(edge).asDouble())
                            < Math.abs(frames.get(nearest).path("t").asDouble() - phase.path(edge).asDouble()))
                        nearest = i;
                kept.add(nearest);
                kept.add(Math.max(0, nearest - 1));
                kept.add(Math.min(frames.size() - 1, nearest + 1));
            }
        com.fasterxml.jackson.databind.node.ArrayNode sample = preview.putArray(FRAMES);
        kept.forEach(index -> sample.add(frames.get(index)));
        return preview;
    }

    /**
     * Routing needs only what distinguishes one topic from another: its name, grade, the curriculum description
     * written for routing, the curriculum contents and the titles of its worked examples.
     */
    private String schemaDescription(SchemaVersion schema, int characterBudget) {
        JsonNode definition = schema.getDefinition();
        StringBuilder summary = new StringBuilder();
        appendBounded(summary, schema.getName(), characterBudget);
        if (definition.hasNonNull(GRADE))
            appendBounded(summary, "(lớp " + definition.path(GRADE).asText() + ").", characterBudget);
        appendBounded(summary, definition.path(DESCRIPTION).asText(""), characterBudget);
        for (JsonNode content : definition.path(CURRICULUM))
            appendBounded(summary, content.path("name").asText("") + ": " + content.path("summary").asText(""),
                    characterBudget);
        StringBuilder examples = new StringBuilder();
        for (JsonNode capability : definition.path(CAPABILITIES)) {
            String title = capability.path(TITLE).asText("");
            if (!title.isBlank())
                examples.append(examples.isEmpty() ? "Ví dụ: " : "; ").append(title);
        }
        appendBounded(summary, examples.toString(), characterBudget);
        return summary.toString();
    }

    private void appendBounded(StringBuilder target, String value, int characterBudget) {
        if (value == null || value.isBlank() || target.length() >= characterBudget)
            return;
        if (!target.isEmpty())
            target.append(' ');
        int remaining = characterBudget - target.length();
        target.append(value, 0, Math.min(value.length(), remaining));
    }

    private String runnerUp(JsonNode probabilities, String selectedId) {
        String best = "";
        double bestValue = -1;
        var fields = probabilities.fields();
        while (fields.hasNext()) {
            var field = fields.next();
            if (!field.getKey().equals(selectedId) && field.getValue().asDouble(0) > bestValue) {
                best = field.getKey();
                bestValue = field.getValue().asDouble(0);
            }
        }
        return best;
    }

    private double margin(JsonNode probabilities, String selectedId) {
        double selected = probabilities.path(selectedId).asDouble(0);
        double second = 0;
        var fields = probabilities.fields();
        while (fields.hasNext()) {
            var field = fields.next();
            if (!field.getKey().equals(selectedId))
                second = Math.max(second, field.getValue().asDouble(0));
        }
        return selected - second;
    }

}
