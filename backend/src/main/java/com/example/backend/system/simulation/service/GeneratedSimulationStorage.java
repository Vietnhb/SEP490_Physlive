package com.example.backend.system.simulation.service;

import com.example.backend.exception.ApiException;
import com.example.backend.system.account.service.CurrentUserService;
import com.example.backend.system.curriculum.repository.LessonRepository;
import com.example.backend.system.library.dto.LibraryItemResponse;
import com.example.backend.system.library.dto.LibraryRequests.Save;
import com.example.backend.system.library.dto.LibraryRequests;
import com.example.backend.system.library.model.enums.Visibility;
import com.example.backend.system.library.service.LibraryService;
import com.example.backend.system.physics.model.entity.SchemaVersion;
import com.example.backend.system.problem.model.entity.ExtractionRun;
import com.example.backend.system.problem.model.entity.ProblemSubmission;
import com.example.backend.system.problem.model.entity.Specification;
import com.example.backend.system.problem.model.enums.ConfirmationState;
import com.example.backend.system.problem.model.enums.ExtractionPath;
import com.example.backend.system.problem.model.enums.ExtractionRunStatus;
import com.example.backend.system.problem.model.enums.SourceMode;
import com.example.backend.system.problem.model.enums.SubmissionStatus;
import com.example.backend.system.simulation.dto.SimulationRequests;
import com.example.backend.system.simulation.model.entity.Simulation;
import com.example.backend.system.simulation.model.entity.SimulationRun;
import com.example.backend.system.simulation.model.enums.SimulationStatus;
import com.example.backend.system.simulation.repository.SimulationRepository;
import com.example.backend.system.simulation.repository.SimulationRunRepository;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.persistence.EntityManager;
import java.math.BigDecimal;
import java.util.UUID;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import static com.example.backend.system.physics.model.SpecKeys.PARAMETERS;
import static com.example.backend.system.physics.model.SpecKeys.SIMULATION_SPEC;
import static com.example.backend.system.physics.model.SpecKeys.SOLVER_TIMELINE;
import static com.example.backend.system.physics.model.SpecKeys.VALIDATION;
import static com.example.backend.system.physics.model.SpecKeys.VISUAL_DESIGN;
import static com.example.backend.system.physics.model.SpecKeys.VISUAL_PROGRAM;

/** Stores the generated scene and verified timeline in the existing library/run model. */
@Service
@RequiredArgsConstructor
public class GeneratedSimulationStorage {
    private final EntityManager entities;
    private final CurrentUserService currentUser;
    private final LessonRepository lessons;
    private final SimulationRepository simulations;
    private final SimulationRunRepository runs;
    private final LibraryService library;

    /**
     * Verified by laws, partly verified, an illustration no approved law covers, or a run the checks flagged. A flagged
     * run is the teacher's own work all the same: it is kept and used like any other (status FLAGGED), and the
     * "needs review" warning travels with its validation result wherever it is shown.
     */
    static boolean isSaveable(String status) {
        return status.startsWith("VERIFIED") || "ILLUSTRATIVE".equals(status) || "VISUAL_ONLY_UNVERIFIED".equals(status)
                || FLAGGED.equals(status);
    }

    static final String FLAGGED = "FLAGGED";

    @Transactional
    public LibraryItemResponse save(SimulationRequests.Save request, SchemaVersion schema, ObjectNode computed) {
        var user = currentUser.requireCurrentUser();
        var lesson = lessons.findById(request.lessonId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy bài học"));
        if (!lesson.isActive() || !lesson.getLevel().isActive() || !lesson.getLevel().getModule().isActive()
                || !lesson.getLevel().getModule().getTopic().isEnabled())
            throw ApiException.conflict("Bài học này không còn được sử dụng");
        // a simulation built from the laws of several topics belongs to a lesson of any of them
        var lessonTopic = lesson.getLevel().getModule().getTopic();
        boolean ownTopic = lessonTopic.matchesCode(schema.getTopic());
        for (var related : request.simulation().path(SIMULATION_SPEC).path("relatedSchemas"))
            ownTopic |= lessonTopic.matchesCode(related.path("topic").asText());
        if (!ownTopic)
            throw ApiException.conflict("Bài học không thuộc chủ đề của mô phỏng");
        String status = computed.path(VALIDATION).path("status").asText();
        // A run that breaks a law or that the solver could not settle is not kept; a run no law covers is kept as
        // what it is — an illustration — and carries that status wherever it is shown.
        // The topic-equation runtime reports a run whose description is only partly covered by approved equations
        // as VISUAL_ONLY_UNVERIFIED; the workspace shows it as "Minh hoạ", so it is kept exactly like ILLUSTRATIVE.
        if (!isSaveable(status))
            throw ApiException.conflict("Mô phỏng chưa có kết quả tính hợp lệ nên chưa lưu được. Hãy phân tích lại mô tả");
        boolean flagged = FLAGGED.equals(status);
        ObjectNode snapshot = request.simulation().deepCopy();
        ObjectNode spec = (ObjectNode) snapshot.path(SIMULATION_SPEC);
        spec.put("topic", schema.getTopic());
        spec.set(SOLVER_TIMELINE, computed.path(SOLVER_TIMELINE));
        snapshot.set(PARAMETERS, spec.path(PARAMETERS).deepCopy());
        snapshot.set(VALIDATION, computed.path(VALIDATION));
        ObjectNode savedParameters = snapshot.putObject("savedParameters");
        for (var parameter : spec.path(PARAMETERS)) {
            String name = parameter.path("name").asText();
            savedParameters.set(name, request.parameters().has(name) ? request.parameters().get(name).deepCopy() : parameter.path("value").deepCopy());
        }

        var submission = new ProblemSubmission();
        submission.setOwner(user);
        submission.setLesson(lesson);
        submission.setSourceMode(SourceMode.TEXT);
        submission.setOriginalText(snapshot.path("description").asText());
        submission.setEditableText(submission.getOriginalText());
        submission.setStatus(SubmissionStatus.READY_FOR_VALIDATION);
        entities.persist(submission);
        var extraction = new ExtractionRun();
        extraction.setSubmission(submission);
        extraction.setExtractionPath(ExtractionPath.AI_PROVIDER);
        extraction.setProviderName("schema-driven-simulation");
        extraction.setStatus(ExtractionRunStatus.SUCCEEDED);
        entities.persist(extraction);
        var specification = new Specification();
        specification.setSubmission(submission);
        specification.setExtractionRun(extraction);
        specification.setSchemaId(schema.getSchemaId());
        specification.setSchemaVersion(schema.getVersion());
        specification.setTopic(schema.getTopic());
        specification.setConfidence(BigDecimal.ONE);
        specification.setObjects(spec.path("physicsModels").deepCopy());
        specification.setQuantities(spec.path(PARAMETERS).deepCopy());
        specification.setRelations(snapshot.arrayNode());
        specification.setAmbiguity(snapshot.arrayNode());
        specification.setConfirmationState(ConfirmationState.CONFIRMED);
        specification.setValidationStatus(flagged ? FLAGGED : "PASSED");
        specification.setValidationResult(computed.path(VALIDATION).deepCopy());
        entities.persist(specification);
        submission.setCurrentSpecification(specification);
        var simulation = new Simulation();
        simulation.setOwner(user);
        simulation.setSpecification(specification);
        simulation.setSchemaId(schema.getSchemaId());
        simulation.setSolverVersion("schema-equations");
        simulation.setStatus(SimulationStatus.READY);
        entities.persist(simulation);
        var run = new SimulationRun();
        run.setSimulation(simulation);
        run.setRunType("GENERATED");
        run.setSchemaId(schema.getSchemaId());
        run.setSchemaVersion(schema.getVersion());
        run.setValidationPassed(!flagged);
        run.setValidationCheckpoints(computed.path(VALIDATION).deepCopy());
        run.setDurationSeconds(computed.path(SOLVER_TIMELINE).path("durationSeconds").asDouble(spec.path("durationSeconds").asDouble()));
        run.setResult(snapshot);
        entities.persist(run);
        simulation.setLatestRun(run);
        entities.flush();
        return library.save(new LibraryRequests.Save(simulation.getId(), request.folderId(), request.lessonId(), request.title(), Visibility.PERSONAL));
    }

    @Transactional(readOnly = true)
    public ObjectNode open(UUID id) {
        var user = currentUser.requireCurrentUser();
        var simulation = simulations.findByIdAndOwnerId(id, user.getId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy mô phỏng"));
        var run = runs.findFirstBySimulationIdOrderByCreatedAtDesc(simulation.getId())
                .orElseThrow(() -> ApiException.notFound("Không có dữ liệu mô phỏng đã lưu"));
        if (!run.getResult().path(SIMULATION_SPEC).path(VISUAL_PROGRAM).isObject())
            throw ApiException.conflict("Bài lưu cũ chưa có cảnh SVG/PixiJS để mở trong trình mô phỏng này");
        return ((ObjectNode) run.getResult()).deepCopy();
    }

    @Transactional
    public void updateVisual(UUID id, ObjectNode generated) {
        var user = currentUser.requireCurrentUser();
        var simulation = simulations.findByIdAndOwnerId(id, user.getId())
                .orElseThrow(() -> ApiException.notFound("Không tìm thấy mô phỏng"));
        var previous = runs.findFirstBySimulationIdOrderByCreatedAtDesc(id)
                .orElseThrow(() -> ApiException.notFound("Không có dữ liệu mô phỏng đã lưu"));
        ObjectNode snapshot = ((ObjectNode) previous.getResult()).deepCopy();
        for (String key : java.util.List.of("schemaId", "schemaVersion", "description", "planSignature")) {
            if (!snapshot.path(key).equals(generated.path(key)))
                throw ApiException.conflict("Thiết kế mới không thuộc kế hoạch vật lý của bài đã lưu");
        }
        var program = generated.path(SIMULATION_SPEC).path(VISUAL_PROGRAM);
        if (!program.isObject() || (program.path("code").asText().isBlank() && !program.path("scene").isObject()))
            throw ApiException.badRequest("Thiếu cảnh minh họa mới");
        ObjectNode spec = (ObjectNode) snapshot.path(SIMULATION_SPEC);
        spec.set(VISUAL_PROGRAM, program.deepCopy());
        snapshot.put("code", program.path("code").asText(""));
        var design = generated.path(SIMULATION_SPEC).get(VISUAL_DESIGN);
        if (design == null) spec.remove(VISUAL_DESIGN); else spec.set(VISUAL_DESIGN, design.deepCopy());
        // Preserve pinned historical runs and all saved physics/parameter data.
        var next = new SimulationRun();
        org.springframework.beans.BeanUtils.copyProperties(previous, next, "id", "createdAt", "updatedAt", "result");
        next.setResult(snapshot);
        entities.persist(next);
        simulation.setLatestRun(next);
        entities.flush();
    }
}
