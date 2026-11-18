package com.example.backend.integration.ai;

import com.example.backend.config.AIProperties;
import com.example.backend.config.JevProperties;
import com.example.backend.exception.ApiException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.function.Supplier;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;

/** Provider protocols and transport; simulation planning stays in its business service. */
@Component
@lombok.extern.slf4j.Slf4j
public class AIClient {
    private static final String CHAT_COMPLETIONS = "chat/completions";
    private static final String CHOICES = "choices";
    private static final String CONTENT = "content";
    private static final String ERROR = "error";
    private static final String JSON_OBJECT = "json_object";
    private static final String MESSAGE = "message";
    private static final String MESSAGES = "messages";
    private static final String MODEL = "model";
    private static final String RESPONSE_FORMAT = "response_format";
    private static final String SCENE_OPERATION = "SCENE";
    private static final String SYSTEM = "system";
    private static final String TEMPERATURE = "temperature";
    private final AIProperties ai;
    private final JevProperties jev;
    private final ObjectMapper json;
    private final HttpClient http;
    /** Counts each provider call against the caller's allowance; absent where nothing is metered. */
    private AiUsageMeter meter;

    public AIClient(AIProperties ai, JevProperties jev, ObjectMapper json) {
        this.ai = ai;
        this.jev = jev;
        this.json = json;
        this.http = HttpClient.newBuilder().connectTimeout(ai.provider().connectTimeout()).build();
    }

    @org.springframework.beans.factory.annotation.Autowired(required = false)
    public void setUsageMeter(AiUsageMeter meter) { this.meter = meter; }

    public JsonNode route(String state, JsonNode questions) {
        ObjectNode body = json.createObjectNode();
        body.put(MODEL, jev.model());
        body.put("state", state);
        body.set("questions", questions);
        if (body.toString().length() > jev.maximumPromptCharacters())
            throw ApiException.unprocessable("Dữ liệu chọn mô hình vượt quá giới hạn xử lý");
        return post("ROUTE", endpoint(jev.baseUrl(), "systemone"), jev.apiKey(), body, jev.timeout()).path("answers");
    }

    public JsonNode text(JsonNode input, Supplier<String> prompt) {
        if (ai.provider().apiKey() == null || ai.provider().apiKey().isBlank())
            throw ApiException.unavailable("Dịch vụ phân tích AI chưa được cấu hình");
        try {
            ObjectNode body = json.createObjectNode();
            body.put(MODEL, ai.provider().textModel());
            body.put(TEMPERATURE, ai.provider().understandingTemperature());
            var messages = body.putArray(MESSAGES);
            messages.addObject().put("role", SYSTEM).put(CONTENT, prompt.get());
            messages.addObject().put("role", "user").put(CONTENT, json.writeValueAsString(input));
            body.set(RESPONSE_FORMAT, json.createObjectNode().put("type", JSON_OBJECT));
            JsonNode completion = post("MODEL", endpoint(ai.provider().baseUrl(), CHAT_COMPLETIONS), ai.provider().apiKey(),
                    body, ai.provider().readTimeout());
            return json.readTree(completion.path(CHOICES).path(0).path(MESSAGE).path(CONTENT).asText(""));
        } catch (IOException ex) {
            throw ApiException.internal("Không thể chuẩn bị yêu cầu phân tích mô phỏng");
        }
    }

    public JsonNode transcribe(byte[] bytes, String mediaType, String context, Supplier<String> prompt) {
        if (ai.provider().apiKey() == null || ai.provider().apiKey().isBlank())
            throw ApiException.unavailable("Dịch vụ nhận dạng ảnh chưa được cấu hình");
        try {
            String dataUrl = "data:" + mediaType + ";base64," + Base64.getEncoder().encodeToString(bytes);
            ObjectNode body = json.createObjectNode();
            body.put(MODEL, ai.provider().visionModel());
            body.put(TEMPERATURE, ai.provider().understandingTemperature());
            var messages = body.putArray(MESSAGES);
            messages.addObject().put("role", SYSTEM).put(CONTENT, prompt.get());
            ObjectNode user = messages.addObject();
            user.put("role", "user");
            var content = user.putArray(CONTENT);
            content.addObject().put("type", "text").put("text", context == null || context.isBlank()
                    ? "Transcribe the image."
                    : "Transcribe the image. User context, only to help read unclear symbols: " + context);
            content.addObject().put("type", "image_url").putObject("image_url").put("url", dataUrl);
            body.set(RESPONSE_FORMAT, json.createObjectNode().put("type", JSON_OBJECT));
            JsonNode completion = post("OCR", endpoint(ai.provider().baseUrl(), CHAT_COMPLETIONS), ai.provider().apiKey(),
                    body, ai.provider().readTimeout());
            return json.readTree(completion.path(CHOICES).path(0).path(MESSAGE).path(CONTENT).asText(""));
        } catch (IOException ex) {
            throw ApiException.upstream("Kết quả nhận dạng ảnh không hợp lệ");
        }
    }

    public JsonNode visual(JsonNode input, String system, JsonNode contract) {
        if (ai.visual().apiKey() == null || ai.visual().apiKey().isBlank())
            throw ApiException.unavailable("Dịch vụ tạo cảnh minh họa AI chưa được cấu hình. Vui lòng liên hệ quản trị viên");
        if ("gemini_interactions".equalsIgnoreCase(ai.visual().provider())) {
            return askGeminiInteraction(input, system, contract);
        }
        try {
            boolean openRouter = "openrouter".equalsIgnoreCase(ai.visual().provider());
            ObjectNode body = json.createObjectNode();
            body.put(MODEL, ai.visual().model());
            body.put(TEMPERATURE, ai.visual().temperature());
            // OpenRouter normalises max_tokens across providers; reasoning tokens count
            // toward it.
            body.put(openRouter ? "max_tokens" : "max_completion_tokens", ai.visual().maxCompletionTokens());
            if (!ai.visual().reasoningEffort().isEmpty()) {
                if (openRouter)
                    body.putObject("reasoning").put("effort", ai.visual().reasoningEffort()).put("exclude", true);
                else
                    body.put("reasoning_effort", ai.visual().reasoningEffort());
            }
            // The JSON contract is written into the prompt only for requests where the
            // provider
            // does not enforce it (json_object / plain fallback); strict json_schema
            // requests carry
            // it once, in response_format, instead of twice.
            String withContract = system + "\n\nRESPONSE CONTRACT (JSON Schema):\n" + contract;
            String user = json.writeValueAsString(input);
            var messages = body.putArray(MESSAGES);
            messages.addObject().put("role", SYSTEM).put(CONTENT, withContract);
            messages.addObject().put("role", "user").put(CONTENT, user);
            // Providers may opt out of response_format; the contract remains in
            // the prompt and the response is parsed and validated server-side.
            JsonNode completion;
            if (ai.visual().supportsResponseFormat()) {
                ObjectNode structured = body.deepCopy();
                ObjectNode format = structured.putObject(RESPONSE_FORMAT);
                if (ai.visual().strictStructuredOutput()) {
                    var strictMessages = structured.putArray(MESSAGES);
                    strictMessages.addObject().put("role", SYSTEM).put(CONTENT, system);
                    strictMessages.addObject().put("role", "user").put(CONTENT, user);
                    format.put("type", "json_schema");
                    format.putObject("json_schema").put("name", "simulation_visual").put("strict", true).set("schema",
                            contract);
                } else
                    format.put("type", JSON_OBJECT);
                // Route only to endpoints that honour structured output (free models have many
                // hosts).
                if (openRouter)
                    structured.putObject("provider").put("require_parameters", true);
                completion = postStructured(structured, body);
            } else {
                completion = post(SCENE_OPERATION, endpoint(ai.visual().baseUrl(), CHAT_COMPLETIONS), ai.visual().apiKey(), body, ai.visual().readTimeout());
            }
            JsonNode choice = completion.path(CHOICES).path(0);
            if ("length".equals(choice.path("finish_reason").asText()))
                throw ApiException.upstream("Cảnh minh họa AI chưa được tạo đầy đủ. Vui lòng thử lại hoặc rút gọn mô tả");
            if (completion.has(ERROR) && choice.isMissingNode()) {
                log.warn("Visual AI provider error: {}", completion.path(ERROR).path(MESSAGE)
                        .asText("unknown").replace(ai.visual().apiKey(), "[redacted]"));
                throw ApiException.upstream("Dịch vụ tạo cảnh minh họa AI gặp lỗi. Vui lòng thử lại.");
            }
            // parseModelJson returns a JSON object or throws
            return parseModelJson(choice.path(MESSAGE).path(CONTENT));
        } catch (IOException ex) {
            throw ApiException.upstream("Dữ liệu cảnh minh họa của AI không hợp lệ");
        }
    }

    /**
     * Asks with the structured-output parameters. Where no endpoint accepts them, asks again with the prompt-level
     * contract alone, which is still parsed and validated afterwards.
     */
    private JsonNode postStructured(ObjectNode structured, ObjectNode plain) {
        URI uri = endpoint(ai.visual().baseUrl(), CHAT_COMPLETIONS);
        try {
            return post(SCENE_OPERATION, uri, ai.visual().apiKey(), structured, ai.visual().readTimeout());
        } catch (ApiException ex) {
            String message = String.valueOf(ex.getMessage());
            if (!(message.contains("HTTP 400") || message.contains("HTTP 404") || message.contains("HTTP 422")))
                throw ex;
            return post(SCENE_OPERATION, uri, ai.visual().apiKey(), plain, ai.visual().readTimeout());
        }
    }

    /**
     * Decode the documented OpenAI-compatible message content and parse its JSON
     * contract.
     */
    private JsonNode parseModelJson(JsonNode content) throws IOException {
        if (content == null || content.isNull())
            throw new IOException("Provider returned empty message content");
        String text;
        if (content.isTextual())
            text = content.textValue();
        else if (content.isArray()) {
            StringBuilder joined = new StringBuilder();
            for (JsonNode part : content) {
                if (!part.isObject() || !part.path("text").isTextual())
                    throw new IOException("Provider returned an unsupported message content part");
                joined.append(part.path("text").textValue());
            }
            text = joined.toString();
        } else
            throw new IOException("Provider returned unsupported message content");
        return parseJsonObject(text);
    }

    /**
     * Providers without response_format support often wrap JSON in markdown fences
     * or add a sentence around it; accept the single outermost JSON object only.
     */
    private JsonNode parseJsonObject(String text) throws IOException {
        String trimmed = text == null ? "" : text.trim();
        if (trimmed.startsWith("```"))
            trimmed = com.example.backend.common.text.CodeText.withoutClosingFence(com.example.backend.common.text.CodeText.withoutOpeningFence(trimmed,
                    c -> c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_' || c == '-'));
        JsonNode result;
        try {
            result = json.readTree(trimmed);
        } catch (IOException direct) {
            int first = trimmed.indexOf('{');
            int last = trimmed.lastIndexOf('}');
            if (first < 0 || last <= first)
                throw direct;
            result = json.readTree(trimmed.substring(first, last + 1));
        }
        if (result == null || !result.isObject())
            throw new IOException("Provider response does not match the JSON object contract");
        return result;
    }

    private JsonNode askGeminiInteraction(JsonNode input, String system, JsonNode contract) {
        try {
            ObjectNode body = json.createObjectNode();
            body.put(MODEL, ai.visual().model());
            body.put("store", false);
            body.put("input", system + "\n\nUSER_INPUT_JSON:\n" + json.writeValueAsString(input));
            ObjectNode format = body.putObject(RESPONSE_FORMAT);
            format.put("type", "text");
            format.put("mime_type", "application/json");
            format.set("schema", contract);
            JsonNode completion = post(SCENE_OPERATION, ai.visual().baseUrl(), ai.visual().apiKey(), body, ai.visual().readTimeout(), true);
            // parseJsonObject returns a JSON object or throws
            return parseJsonObject(geminiInteractionText(completion));
        } catch (IOException ex) {
            throw ApiException.upstream("Dữ liệu cảnh minh họa của AI không hợp lệ");
        }
    }

    private String geminiInteractionText(JsonNode completion) {
        JsonNode steps = completion.path("steps");
        if (steps.isArray()) {
            for (JsonNode step : steps) {
                JsonNode content = step.path(CONTENT);
                if ("model_output".equals(step.path("type").asText()) && content.isArray()) {
                    for (JsonNode part : content) {
                        String text = part.path("text").asText("");
                        if (!text.isBlank())
                            return text;
                    }
                }
            }
        }
        String output = completion.path("output_text").asText("");
        if (!output.isBlank())
            return output;
        throw ApiException.upstream("Dịch vụ AI không trả về nội dung");
    }

    private JsonNode post(String operation, URI uri, String apiKey, JsonNode payload, Duration timeout) {
        return post(operation, uri, apiKey, payload, timeout, false);
    }

    private JsonNode post(String operation, URI uri, String apiKey, JsonNode payload, Duration timeout, boolean gemini) {
        if (apiKey == null || apiKey.isBlank())
            throw ApiException.unavailable("Dịch vụ AI chưa được cấu hình");
        if (meter != null) meter.requireAllowance();
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(uri).timeout(timeout)
                    .header("Content-Type", MediaType.APPLICATION_JSON_VALUE);
            if (gemini) builder.header("x-goog-api-key", apiKey).header("Api-Revision", "2026-05-20");
            else builder.header("Authorization", "Bearer " + apiKey);
            HttpRequest request = builder.POST(HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload))).build();
            HttpResponse<String> response = http.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                log.warn("AI provider returned HTTP {}{}", response.statusCode(), errorDetail(response.body(), apiKey));
                throw ApiException.upstream("Yêu cầu đến dịch vụ AI thất bại với mã HTTP " + response.statusCode() + ". Vui lòng thử lại.");
            }
            JsonNode answer = json.readTree(response.body());
            if (meter != null) recordUsage(operation, answer, request, response.body());
            return answer;
        } catch (InterruptedException ex) {
            Thread.currentThread().interrupt();
            throw ApiException.unavailable("Yêu cầu AI bị gián đoạn. Vui lòng thử lại");
        } catch (IOException ex) {
            throw ApiException.upstream("Không thể hoàn tất yêu cầu AI. Vui lòng thử lại");
        }
    }

    /** The provider's own error message for the log, without the key; empty where the body holds none. */
    private String errorDetail(String body, String apiKey) {
        try {
            String message = json.readTree(body).path(ERROR).path(MESSAGE).asText("").replace(apiKey, "[redacted]");
            return message.isBlank() ? "" : ": " + message.substring(0, Math.min(400, message.length()));
        } catch (IOException ignored) {
            // Provider errors need not be JSON; never return the raw response body.
            return "";
        }
    }

    private void recordUsage(String operation, JsonNode answer, HttpRequest request, String body) {
        try {
            meter.recordUsage(operation, tokensUsed(answer, request, body));
        } catch (RuntimeException failure) {
            // the answer is paid for already; a count that cannot be written must not lose it
            log.warn("AI_USAGE_NOT_RECORDED {}", failure.getMessage());
        }
    }

    /** The provider's own count where it reports one, otherwise an estimate of about four characters per token. */
    private static long tokensUsed(JsonNode answer, HttpRequest request, String body) {
        JsonNode usage = answer.path("usage");
        if (usage.path("total_tokens").canConvertToLong()) return usage.path("total_tokens").asLong();
        if (usage.path("prompt_tokens").canConvertToLong() || usage.path("completion_tokens").canConvertToLong())
            return usage.path("prompt_tokens").asLong(0) + usage.path("completion_tokens").asLong(0);
        if (answer.path("usageMetadata").path("totalTokenCount").canConvertToLong()) return answer.path("usageMetadata").path("totalTokenCount").asLong();
        long sent = request.bodyPublisher().map(HttpRequest.BodyPublisher::contentLength).orElse(0L);
        return Math.max(1, (Math.max(0, sent) + (body == null ? 0 : body.length())) / 4);
    }

    private URI endpoint(URI base, String path) {
        String value = com.example.backend.common.text.CodeText.withoutTrailingSlashes(base.toString());
        return URI.create(value + "/" + path);
    }

}
