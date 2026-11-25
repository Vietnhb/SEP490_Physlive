package com.example.backend.system.physics.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import static com.example.backend.system.physics.model.SpecKeys.ATTRIBUTES;
import static com.example.backend.system.physics.model.SpecKeys.CONTENTS;
import static com.example.backend.system.physics.model.SpecKeys.SCOPE;
import static com.example.backend.system.physics.model.SpecKeys.STATUS;
import static com.example.backend.system.physics.model.SpecKeys.STRANDS;
import static com.example.backend.system.physics.model.SpecKeys.TITLE;
import static com.example.backend.system.physics.model.SpecKeys.VALUE;

/**
 * Checks a computed run against the laws of the curriculum. A law is data (schemas/laws): it names the
 * roles it relates (mass, velocity, the forces on a body…) and the relation that must hold at every instant.
 * Which laws apply to a model follows from the roles its quantities declare, never from the kind of situation.
 */
public final class LawChecks {
    private static final String RATE_PREFIX = "d/dt ";
    private static final String AMBIGUOUS = "\u0000ambiguous";
    /** System property that changes how far the two sides of a law may differ, for the research ablation only. */
    public static final String RELATIVE_TOLERANCE = "physlive.laws.relativeTolerance";
    private static final double RELATIVE = Double.parseDouble(System.getProperty(RELATIVE_TOLERANCE, "0.02"));
    private static final double FRACTION = 0;
    /** System property that switches starting-value disambiguation off, for the research ablation only. */
    public static final String ROLE_DISAMBIGUATION = "physlive.laws.roleDisambiguation";

    /** One quantity of the model over the run, with the role attributes laws match on; given: a slider or constant. */
    public record Symbol(String id, String label, String unit, Map<String, String> attributes, double[] values, boolean given) {
        String get(String attribute) { return attributes.get(attribute); }

        @Override
        public boolean equals(Object other) {
            return other instanceof Symbol(String otherId, String otherLabel, String otherUnit, Map<String, String> otherAttributes,
                    double[] otherValues, boolean otherGiven)
                    && given == otherGiven && java.util.Objects.equals(id, otherId)
                    && java.util.Objects.equals(label, otherLabel) && java.util.Objects.equals(unit, otherUnit)
                    && java.util.Objects.equals(attributes, otherAttributes) && java.util.Arrays.equals(values, otherValues);
        }

        @Override
        public int hashCode() {
            return 31 * java.util.Objects.hash(id, label, unit, attributes, given) + java.util.Arrays.hashCode(values);
        }

        @Override
        public String toString() {
            return "Symbol[id=" + id + ", label=" + label + ", unit=" + unit + ", attributes=" + attributes
                    + ", values=" + java.util.Arrays.toString(values) + ", given=" + given + "]";
        }
    }

    private final ObjectMapper json;
    private final Map<String, Double> worth = new LinkedHashMap<>();
    /** Universal constants the catalogue names (G, k, R, h…), usable in any law. */
    private JsonNode constants = com.fasterxml.jackson.databind.node.MissingNode.getInstance();
    /** Samples at which a new smooth piece of the run begins. */
    private boolean[] starts = new boolean[0];
    /** Per object that has an end of its own: the samples at which it is still under way. Laws hold while it is. */
    private Map<String, boolean[]> active = Map.of();

    /** Per quantity id: how far each sample can be off by chance, for a model that draws random numbers. */
    private Map<String, double[]> noise = Map.of();

    public LawChecks(ObjectMapper json) { this.json = json; }

    /** Instants at which quantities jumped, with the objects they belong to. */
    private Map<Double, Set<String>> impacts = Map.of();

    public LawChecks impacts(Map<Double, Set<String>> impacts) { this.impacts = impacts; return this; }

    private double[] noiseOf(Symbol symbol, int count) { double[] own = noise.get(symbol.id()); return own == null ? new double[count] : own; }

    /** The catalogues of several strands as one: their roles, kinds, attributes, constants and laws together. */
    public static ObjectNode merge(ObjectMapper json, Iterable<JsonNode> catalogues) {
        ObjectNode all = json.createObjectNode();
        ArrayNode laws = all.putArray("laws");
        ArrayNode strands = all.putArray(STRANDS);
        for (JsonNode catalogue : catalogues) {
            // a catalogue may itself be a merge (the catalogue of a topic): its strands and contents carry over
            for (JsonNode strand : catalogue.has(STRANDS) ? catalogue.path(STRANDS) : List.of((JsonNode) json.createObjectNode()
                    .put("id", catalogue.path("id").asText()).put(TITLE, catalogue.path(TITLE).asText()).put("source", catalogue.path("source").asText()))) {
                boolean known = false;
                for (JsonNode existing : strands) known |= existing.path("id").equals(strand.path("id"));
                if (!known) strands.add(strand);
            }
            for (JsonNode content : catalogue.path(CONTENTS)) {
                boolean known = false;
                for (JsonNode existing : all.withArray(CONTENTS)) known |= existing.path("name").equals(content.path("name"));
                if (!known) all.withArray(CONTENTS).add(content);
            }
            for (String part : List.of("roles", "kinds", "forceKinds", "constants"))
                catalogue.path(part).fields().forEachRemaining(entry -> { if (!all.withObject("/" + part).has(entry.getKey())) all.withObject("/" + part).set(entry.getKey(), entry.getValue()); });
            for (JsonNode attribute : catalogue.path(ATTRIBUTES)) {
                boolean known = false;
                for (JsonNode existing : all.withArray(ATTRIBUTES)) known |= existing.equals(attribute);
                if (!known) all.withArray(ATTRIBUTES).add(attribute);
            }
            if (catalogue.hasNonNull("axes") && !all.has("axes")) all.set("axes", catalogue.path("axes"));
            for (JsonNode law : catalogue.path("laws")) {
                boolean known = false;
                for (JsonNode existing : laws) known |= existing.path("id").equals(law.path("id"));
                if (!known) laws.add(law.has("strand") ? law : ((ObjectNode) law.deepCopy()).put("strand", catalogue.path("id").asText()));
            }
        }
        return all;
    }

    /** Every law of the catalogue against the run: PASSED, FAILED (with where and by how much) or not applicable (left out). */
    public ArrayNode check(JsonNode catalogue, List<Symbol> symbols, double[] time, double[] breaks, Map<String, boolean[]> active) {
        this.active = active;
        ArrayNode results = json.createArrayNode();
        constants = catalogue.path("constants");
        // what quantities of each unit are worth in this run: the yardstick for "differs by little"
        worth.clear();
        constants.fields().forEachRemaining(constant -> worth.put("constant " + constant.getKey(), Math.abs(constant.getValue().path(VALUE).asDouble())));
        worth.put("constant t", time.length > 0 ? time[time.length - 1] : 0);
        starts = new boolean[time.length];
        for (double at : breaks) for (int i = 0; i < time.length; i++) if (time[i] == at) { starts[i] = true; break; }
        double span = time.length > 1 ? time[time.length - 1] - time[0] : 0;
        for (Symbol symbol : symbols) {
            double[] values = symbol.values();
            for (int i = 0; i < values.length; i++) {
                // a value is measured against the quantity itself; a rate against how fast quantities of that kind
                // of the same object change (the energies of one body exchange while their sum stays still)
                worth.merge("own " + symbol.id(), Math.abs(values[i]), Math::max);
                if (span > 0) worth.merge(RATE_PREFIX + symbol.unit() + "@" + symbol.get("of"), Math.abs(values[i]) / span, Math::max);
                if (i > 0 && time[i] > time[i - 1]) worth.merge(RATE_PREFIX + symbol.unit() + "@" + symbol.get("of"), Math.abs(values[i] - values[i - 1]) / (time[i] - time[i - 1]), Math::max);
            }
        }
        // on by default; switched off only to measure what it changes (research ablation)
        Set<String> evolving = Boolean.parseBoolean(System.getProperty(ROLE_DISAMBIGUATION, "true")) ? evolvingRoles(catalogue) : null;
        for (JsonNode law : catalogue.path("laws")) {
            List<String> scope = new ArrayList<>();
            law.path(SCOPE).forEach(attribute -> scope.add(attribute.asText()));
            for (Map<String, String> where : scopes(scope, symbols)) {
                java.util.Optional<Map<String, List<Symbol>>> binding = bind(law, scope, where, symbols, evolving);
                if (binding.isEmpty()) continue;
                Map<String, List<Symbol>> bound = binding.get();
                // One object, several parts of it told apart by "kind" (the primary and the secondary coil of a
                // transformer): a law that does not name the kind holds for each part on its own, with the kind-less
                // quantities (the angular frequency) shared. Check it per part instead of calling it ambiguous.
                if (bound.containsKey(AMBIGUOUS) && !scope.contains("kind") && splitByKind(law, scope, where, symbols, evolving, time, results)) continue;
                // Bound without doubt but across parts (the secondary's rms voltage with the primary's amplitude): a law
                // that does not name the kind never relates two parts, so check it per part, or not at all.
                if (!bound.containsKey(AMBIGUOUS) && !scope.contains("kind") && !namesKinds(law) && mixesKinds(law, bound)) {
                    splitByKind(law, scope, where, symbols, evolving, time, results);
                    continue;
                }
                if (bound.containsKey(AMBIGUOUS)) {
                    ObjectNode note = results.addObject().put("law", law.path("id").asText()).put(TITLE, law.path(TITLE).asText()).put(STATUS, "AMBIGUOUS");
                    where.forEach(note.putObject(SCOPE)::put);
                    bound.get(AMBIGUOUS).forEach(symbol -> note.withArray("quantities").add(symbol.id()));
                } else {
                    ObjectNode result = evaluate(law, where, bound, time);
                    if (result != null) results.add(result);
                }
            }
        }
        return results;
    }

    /**
     * Binds an ambiguous law once per "kind" found among its candidates, each time with only the quantities of that
     * kind and those of no kind. Done only when every part then binds without doubt; otherwise nothing is added.
     */
    private boolean splitByKind(JsonNode law, List<String> scope, Map<String, String> where, List<Symbol> symbols,
                                Set<String> evolving, double[] time, ArrayNode results) {
        Set<String> kinds = new LinkedHashSet<>();
        for (Symbol symbol : symbols)
            if (symbol.get("kind") != null && (where.get("of") == null || where.get("of").equals(symbol.get("of")))) kinds.add(symbol.get("kind"));
        if (kinds.size() < 2) return false;
        List<ObjectNode> checked = new ArrayList<>();
        for (String kind : kinds) {
            List<Symbol> part = symbols.stream().filter(s -> s.get("kind") == null || kind.equals(s.get("kind"))).toList();
            java.util.Optional<Map<String, List<Symbol>>> binding = bind(law, scope, where, part, evolving);
            if (binding.isEmpty()) continue;
            if (binding.get().containsKey(AMBIGUOUS)) return false;
            // a part that only shares kind-less quantities says nothing of its own
            if (binding.get().values().stream().flatMap(List::stream).noneMatch(s -> kind.equals(s.get("kind")))) continue;
            Map<String, String> partWhere = new LinkedHashMap<>(where);
            partWhere.put("kind", kind);
            ObjectNode result = evaluate(law, partWhere, binding.get(), time);
            if (result != null) checked.add(result);
        }
        if (checked.isEmpty()) return false;
        checked.forEach(results::add);
        return true;
    }

    /** Whether the law itself says which part each quantity belongs to (the transformer's U1 primary, U2 secondary). */
    private static boolean namesKinds(JsonNode law) {
        for (JsonNode variable : law.path("bind")) if (variable.path("where").has("kind")) return true;
        return false;
    }

    /**
     * Whether the single quantities bound to one law come from more than one part (kind) of an object. Variables that
     * gather many quantities (the forces Newton's law adds up, each of its own kind) are meant to span kinds.
     */
    private static boolean mixesKinds(JsonNode law, Map<String, List<Symbol>> bound) {
        return bound.entrySet().stream().filter(entry -> !law.path("bind").path(entry.getKey()).path("many").asBoolean())
                .flatMap(entry -> entry.getValue().stream()).map(symbol -> symbol.get("kind"))
                .filter(java.util.Objects::nonNull).distinct().count() > 1;
    }

    private static Set<Map<String, String>> scopes(List<String> scope, List<Symbol> symbols) {
        Set<Map<String, String>> all = new LinkedHashSet<>();
        if (scope.isEmpty()) { all.add(Map.of()); return all; }
        for (Symbol symbol : symbols) {
            Map<String, String> values = new LinkedHashMap<>();
            for (String attribute : scope) if (symbol.get(attribute) != null) values.put(attribute, symbol.get(attribute));
            if (values.size() == scope.size()) all.add(values);
        }
        return all;
    }

    private static boolean matches(Symbol symbol, JsonNode rule, List<String> scope, Map<String, String> where) {
        if (!symbol.get("role").equals(rule.path("role").asText())) return false;
        // "scope": false binds across scopes; the variable then says itself how it relates to the scope ("$by")
        boolean scoped = !(rule.path(SCOPE).isBoolean() && !rule.path(SCOPE).asBoolean());
        boolean anyKind = rule.path("anyKind").asBoolean();
        for (String attribute : scope) {
            String own = symbol.get(attribute);
            boolean ignored = !scoped || attribute.equals("kind") && anyKind;
            if (!ignored && own != null && !own.equals(where.get(attribute))) return false;
        }
        var filters = rule.path("where").fields();
        while (filters.hasNext()) {
            var filter = filters.next();
            if (!fits(symbol.get(filter.getKey()), filter.getValue(), where)) return false;
        }
        return true;
    }

    /** Whether a symbol's own attribute value is what a "where" filter of a law asks for. */
    private static boolean fits(String own, JsonNode wanted, Map<String, String> where) {
        if (wanted.isNull()) return own == null;
        if (wanted.isArray()) {
            for (JsonNode option : wanted) {
                if (option.asText().equals(own)) return true;
            }
            return false;
        }
        if (wanted.asText().equals("*")) return own != null;
        if (wanted.asText().startsWith("$")) return own != null && own.equals(where.get(wanted.asText().substring(1)));
        return wanted.asText().equals(own);
    }

    /** The roles some law takes the rate of change of (a position, a velocity, a charge): what such a role names changes over a run. */
    private static Set<String> evolvingRoles(JsonNode catalogue) {
        Set<String> roles = new LinkedHashSet<>();
        for (JsonNode law : catalogue.path("laws")) {
            Set<String> varied = new LinkedHashSet<>();
            differentiated(law, varied);
            law.path("bind").fields().forEachRemaining(variable -> { if (varied.contains(variable.getKey())) roles.add(variable.getValue().path("role").asText()); });
        }
        return roles;
    }

    private static void differentiated(JsonNode node, Set<String> into) {
        if (node.isArray() && node.size() == 2 && "ddt".equals(node.get(0).asText()) && node.get(1).isTextual()) into.add(node.get(1).asText());
        for (JsonNode child : node) differentiated(child, into);
    }

    /**
     * A slider or constant beside a quantity the model computes, with the same role for the same thing, is where that
     * quantity starts or what it is set from (v0 beside v, T0 beside T): a law about one such quantity is about the
     * computed one. A law that adds them up (the components of a velocity) leaves out such a value of a role laws take
     * the rate of change of; given values of other roles (a force set by a slider) are real and stay in the sum.
     */
    private static List<Symbol> withoutStartingValues(List<Symbol> found, boolean many, Set<String> evolving) {
        List<Symbol> computed = found.stream().filter(symbol -> !symbol.given()).toList();
        if (!many) return found.size() > 1 && computed.size() == 1 ? computed : found;
        return found.stream().filter(symbol -> !symbol.given() || !evolving.contains(symbol.get("role")) || computed.stream()
                .noneMatch(other -> other.attributes().entrySet().containsAll(symbol.attributes().entrySet()))).toList();
    }

    /** The law's exceptions ("unless"), however many were written. */
    private static Iterable<JsonNode> exceptions(JsonNode law) {
        JsonNode unless = law.path("unless");
        if (unless.isArray()) return unless;
        return unless.isObject() ? List.of(unless) : List.of();
    }

    /**
     * The quantities each variable of the law stands for here; empty where the law does not apply: one of its
     * exceptions is met, or a quantity it needs is missing.
     */
    private static java.util.Optional<Map<String, List<Symbol>>> bind(JsonNode law, List<String> scope, Map<String, String> where, List<Symbol> symbols, Set<String> evolving) {
        if (excepted(law, scope, where, symbols)) return java.util.Optional.empty();
        Map<String, List<Symbol>> bound = new LinkedHashMap<>();
        List<Symbol> unclear = null;
        var variables = law.path("bind").fields();
        while (variables.hasNext()) {
            var variable = variables.next();
            boolean many = variable.getValue().path("many").asBoolean();
            List<Symbol> found = candidates(variable.getValue(), many, scope, where, symbols, evolving);
            if (!enough(found, variable.getValue(), many)) return java.util.Optional.empty();
            if (!many && found.size() > 1) unclear = found;
            bound.put(variable.getKey(), found);
        }
        // every quantity the law needs is there, but one of them more than once: the law cannot tell which is meant
        if (unclear != null) {
            bound.clear();
            bound.put(AMBIGUOUS, unclear);
        }
        return java.util.Optional.of(bound);
    }

    /** Whether a quantity here meets one of the law's exceptions in full. */
    private static boolean excepted(JsonNode law, List<String> scope, Map<String, String> where, List<Symbol> symbols) {
        for (JsonNode exception : exceptions(law)) {
            for (Symbol symbol : symbols) {
                if (matches(symbol, exception, scope, where) && scope.stream().allMatch(a -> symbol.get(a) != null)) return true;
            }
        }
        return false;
    }

    /** The quantities that can stand for one variable of a law. */
    private static List<Symbol> candidates(JsonNode variable, boolean many, List<String> scope, Map<String, String> where, List<Symbol> symbols, Set<String> evolving) {
        List<Symbol> found = new ArrayList<>();
        for (Symbol symbol : symbols) {
            if (matches(symbol, variable, scope, where)) found.add(symbol);
        }
        return evolving == null ? found : new ArrayList<>(withoutStartingValues(found, many, evolving));
    }

    /** Whether enough quantities stand for a variable: its least number when it takes many, else at least one. */
    private static boolean enough(List<Symbol> found, JsonNode variable, boolean many) {
        return many ? found.size() >= variable.path("min").asInt(0) : !found.isEmpty();
    }

    private ObjectNode evaluate(JsonNode law, Map<String, String> where, Map<String, List<Symbol>> bound, double[] time) {
        ObjectNode result = json.createObjectNode();
        result.put("law", law.path("id").asText()).put(TITLE, law.path(TITLE).asText()).put("curriculum", law.path("curriculum").asText());
        ObjectNode about = result.putObject(SCOPE);
        where.forEach(about::put);
        ArrayNode uses = result.putArray("quantities");
        bound.values().forEach(list -> list.forEach(symbol -> uses.add(symbol.id())));
        boolean equal = law.has("equal");
        JsonNode sides = law.path(equal ? "equal" : "atMost");
        Map<String, double[][]> single = new LinkedHashMap<>();
        double[][] leftSide = series(sides.get(0), bound, single, time);
        double[][] rightSide = series(sides.get(1), bound, single, time);
        double[] left = leftSide[0];
        double[] right = rightSide[0];
        double[] mask = law.has("when") ? series(law.path("when"), bound, single, time)[0] : null;
        // rounding of a conserved quantity against an exact zero is measured against what such quantities are worth here
        double floor = 1e-3 * Math.max(size(sides.get(0), bound, worth), size(sides.get(1), bound, worth));
        double scale = 0;
        double maskScale = 0;
        for (int i = 0; i < time.length; i++) {
            if (!Double.isNaN(left[i]) && !Double.isNaN(right[i])) scale = Math.max(scale, Math.max(Math.abs(left[i]), Math.abs(right[i])));
            if (mask != null) maskScale = Math.max(maskScale, Math.abs(mask[i]));
        }
        int counted = 0;
        int off = 0;
        int worst = -1;
        double worstBy = 0;
        for (int i = 0; i < time.length; i++) {
            if (!checkedAt(i, mask, maskScale, left[i], right[i], bound)) continue;
            counted++;
            double by = (equal ? Math.abs(left[i] - right[i]) : left[i] - right[i]) - 2 * (leftSide[1][i] + rightSide[1][i]);
            if (by > RELATIVE * scale + floor) off++;
            if (by > worstBy) { worstBy = by; worst = i; }
        }
        if (counted == 0) return null;
        boolean passed = off <= FRACTION * counted;
        // "the rate of X is Y" also says that X does not jump. Where several of the law's objects jump at one instant
        // (they act on each other there), X just after must be X just before; one object jumping alone met something
        // outside the model, and the law does not speak of that instant.
        JsonNode rated = equal ? ratedQuantity(sides) : null;
        if (passed && rated != null && !impacts.isEmpty()) {
            double[] kept = series(rated, bound, single, time)[0];
            double[] rate = sides.get(0).get(1) == rated ? right : left;
            double size = largest(kept);
            Set<String> own = owners(bound);
            int i = jumpAt(kept, rate, time, own, size);
            if (i > 0) {
                double step = Math.abs(kept[i] - kept[i - 1]);
                result.put(STATUS, "FAILED").put("relativeDeviation", size == 0 ? 0 : step / size).put("at", time[i]).put("left", kept[i - 1]).put("right", kept[i]);
                result.put("message", law.path(TITLE).asText() + " không được thoả" + whereNote(where)
                        + ": tại t = " + time[i] + " s các đối tượng " + String.join(", ", together(time[i], own)) + " cùng đổi đột ngột, và đại lượng phải giữ nguyên qua thời điểm đó lại nhảy từ "
                        + kept[i - 1] + " sang " + kept[i] + ". Các đại lượng được kiểm: " + String.join(", ", iterable(uses)) + ".");
                return result;
            }
        }
        result.put(STATUS, passed ? "PASSED" : "FAILED");
        result.put("relativeDeviation", scale == 0 ? 0 : worstBy / scale);
        if (!passed) {
            result.put("at", time[worst]).put("left", left[worst]).put("right", right[worst]);
            result.put("message", law.path(TITLE).asText() + " không được thoả"
                    + whereNote(where) + ": tại t = " + time[worst] + " s vế trái là "
                    + left[worst] + (equal ? " còn vế phải là " : " nhưng không được vượt quá ") + right[worst]
                    + ". Các đại lượng được kiểm: " + String.join(", ", iterable(uses)) + ".");
        }
        return result;
    }

    /** Where a law was checked, as it is named after the law in a message; empty for everywhere. */
    private static String whereNote(Map<String, String> where) {
        return where.isEmpty() ? "" : " (" + String.join(", ", where.values()) + ")";
    }

    /** The largest size of the defined values. */
    private static double largest(double[] values) {
        double size = 0;
        for (double value : values) {
            if (!Double.isNaN(value)) size = Math.max(size, Math.abs(value));
        }
        return size;
    }

    /** The objects the quantities bound to a law belong to. */
    private static Set<String> owners(Map<String, List<Symbol>> bound) {
        Set<String> own = new LinkedHashSet<>();
        for (List<Symbol> list : bound.values()) {
            for (Symbol symbol : list) {
                if (symbol.get("of") != null) own.add(symbol.get("of"));
            }
        }
        return own;
    }

    /** Which of the given objects jump at an instant. */
    private Set<String> together(double at, Set<String> own) {
        Set<String> together = new LinkedHashSet<>(impacts.getOrDefault(at, Set.of()));
        together.retainAll(own);
        return together;
    }

    /**
     * The first sample where a quantity that must be kept through an instant at which several of the law's objects
     * jump together changes by more than its rate allows; -1 for none.
     */
    private int jumpAt(double[] kept, double[] rate, double[] time, Set<String> own, double size) {
        for (int i = 1; i < time.length; i++) {
            if (together(time[i], own).size() < 2 || Double.isNaN(kept[i]) || Double.isNaN(kept[i - 1])) continue;
            double step = Math.abs(kept[i] - kept[i - 1]);
            double drift = (Double.isNaN(rate[i - 1]) ? 0 : Math.abs(rate[i - 1])) * (time[i] - time[i - 1]);
            if (step - drift > RELATIVE * size) return i;
        }
        return -1;
    }

    /** In "the rate of X is Y", the X whose rate it is: the operand of the side written as ["ddt", X]; null for none. */
    private static JsonNode ratedQuantity(JsonNode sides) {
        for (int side = 0; side < 2; side++) {
            JsonNode written = sides.get(side);
            if (written.isArray() && written.get(0).asText().equals("ddt")) return written.get(1);
        }
        return null;
    }

    /**
     * Whether the law is checked at sample i: where its condition ("when") holds clearly (more than a twentieth of
     * its largest value; an undefined condition does not), both sides are defined, and every object it speaks of is
     * there and under way.
     */
    private boolean checkedAt(int i, double[] mask, double maskScale, double left, double right, Map<String, List<Symbol>> bound) {
        if (mask != null) {
            boolean holds = Math.abs(mask[i]) > 0.05 * maskScale; // NaN compares false
            if (!holds) return false;
        }
        if (Double.isNaN(left) || Double.isNaN(right)) return false;
        for (List<Symbol> list : bound.values()) {
            for (Symbol symbol : list) {
                boolean[] running = symbol.get("of") == null ? null : active.get(symbol.get("of"));
                if (running != null && !running[i]) return false;
            }
        }
        return true;
    }

    private static List<String> iterable(ArrayNode node) { List<String> list = new ArrayList<>(); node.forEach(item -> list.add(item.asText())); return list; }

    /** Slope at sample i of the parabola through three samples of a smooth piece. */
    private static double slope(double[] a, double[] time, int first, int i) {
        double x0 = time[first];
        double x1 = time[first + 1];
        double x2 = time[first + 2];
        double x = time[i];
        return a[first] * (2 * x - x1 - x2) / ((x0 - x1) * (x0 - x2)) + a[first + 1] * (2 * x - x0 - x2) / ((x1 - x0) * (x1 - x2))
                + a[first + 2] * (2 * x - x0 - x1) / ((x2 - x0) * (x2 - x1));
    }

    /**
     * A law expression over the bound quantities: one value per sample and how far that value can be off.
     * Only a rate of change read from the samples is uncertain; where the samples are too coarse to follow a
     * quantity, its rate is weak evidence and is weighed as such instead of being taken for a violation.
     */
    private double[][] series(JsonNode ast, Map<String, List<Symbol>> bound, Map<String, double[][]> current, double[] time) {
        int count = time.length;
        double[] out = new double[count];
        double[] doubt = new double[count];
        if (ast.isNumber()) { java.util.Arrays.fill(out, ast.asDouble()); return new double[][]{out, doubt}; }
        if (ast.isTextual()) {
            String name = ast.asText();
            if (current.containsKey(name)) return current.get(name);
            List<Symbol> list = bound.get(name);
            if (list == null && name.equals("t")) return new double[][]{time, doubt};
            if (list == null && constants.path(name).path(VALUE).isNumber()) { java.util.Arrays.fill(out, constants.path(name).path(VALUE).asDouble()); return new double[][]{out, doubt}; }
            if (list == null) throw new IllegalStateException("Law uses an unbound quantity: " + name);
            if (list.size() == 1) return new double[][]{list.get(0).values(), noiseOf(list.get(0), count)};
            for (Symbol symbol : list) { double[] own = noiseOf(symbol, count); for (int i = 0; i < count; i++) { out[i] += symbol.values()[i]; doubt[i] += own[i]; } }
            return new double[][]{out, doubt};
        }
        String op = ast.get(0).asText();
        if (op.equals("sum")) {
            List<String> lists = new ArrayList<>();
            names(ast.get(1), lists);
            lists.removeIf(name -> current.containsKey(name) || !bound.containsKey(name));
            if (lists.isEmpty()) return series(ast.get(1), bound, current, time);
            // Terms are formed per item of the first list; items of the other lists join it on the same axis.
            String primary = lists.get(0);
            for (Symbol item : bound.get(primary)) {
                Map<String, double[][]> inner = new LinkedHashMap<>(current);
                inner.put(primary, new double[][]{item.values(), noiseOf(item, count)});
                for (String other : lists.subList(1, lists.size())) {
                    double[] partner = new double[count];
                    // a product of two directed quantities needs their directions: a magnitude given without an axis
                    // cannot be paired, and the law then says nothing about this model
                    boolean directed = item.get("axis") != null;
                    for (Symbol candidate : bound.get(other)) {
                        directed &= candidate.get("axis") != null;
                        if (java.util.Objects.equals(candidate.get("axis"), item.get("axis")))
                            for (int i = 0; i < count; i++) partner[i] += candidate.values()[i];
                    }
                    if (!directed) java.util.Arrays.fill(partner, Double.NaN);
                    inner.put(other, new double[][]{partner, new double[count]});
                }
                double[][] term = series(ast.get(1), bound, inner, time);
                for (int i = 0; i < count; i++) { out[i] += term[0][i]; doubt[i] += term[1][i]; }
            }
            return new double[][]{out, doubt};
        }
        double[][] left = series(ast.get(1), bound, current, time);
        double[] a = left[0];
        double[] da = left[1];
        if (op.equals("ddt")) {
            for (int i = 0; i < count; i++) {
                int from = i;
                int to = i;
                while (from > 0 && !starts[from]) from--;
                while (to + 1 < count && !starts[to + 1]) to++;
                // a rate needs three samples of one smooth piece over a span of time (NaN compares false)
                boolean spanned = time[to] > time[from];
                if (to - from < 2 || !spanned) {
                    out[i] = Double.NaN;
                    continue;
                }
                int centred = Math.clamp(i - 1L, from, to - 2); // from <= to - 2 here
                out[i] = slope(a, time, centred, i);
                // a second reading from a neighbouring triple tells how well the samples resolve the rate here
                int other = neighbourTriple(centred, from, to);
                doubt[i] = other < 0 ? Math.abs(out[i]) : Math.abs(out[i] - slope(a, time, other, i));
            }
            return new double[][]{out, doubt};
        }
        double[][] right = ast.size() > 2 ? series(ast.get(2), bound, current, time) : null;
        double[] b = right == null ? null : right[0];
        double[] db = right == null ? null : right[1];
        for (int i = 0; i < count; i++) {
            switch (op) {
                case "add" -> { out[i] = a[i] + b[i]; doubt[i] = da[i] + db[i]; }
                case "sub" -> { out[i] = a[i] - b[i]; doubt[i] = da[i] + db[i]; }
                case "mul" -> { out[i] = a[i] * b[i]; doubt[i] = Math.abs(a[i]) * db[i] + Math.abs(b[i]) * da[i]; }
                case "div" -> { out[i] = a[i] / b[i]; doubt[i] = da[i] / Math.abs(b[i]) + Math.abs(a[i]) * db[i] / (b[i] * b[i]); }
                case "pow" -> { out[i] = Math.pow(a[i], b[i]); doubt[i] = da[i] == 0 ? 0 : Math.abs(b[i] * Math.pow(a[i], b[i] - 1)) * da[i]; }
                case "neg" -> { out[i] = -a[i]; doubt[i] = da[i]; }
                case "abs" -> { out[i] = Math.abs(a[i]); doubt[i] = da[i]; }
                case "sqrt" -> { out[i] = Math.sqrt(a[i]); doubt[i] = da[i] == 0 ? 0 : da[i] / (2 * Math.sqrt(Math.abs(a[i]))); }
                case "sin" -> { out[i] = Math.sin(a[i]); doubt[i] = da[i]; }
                case "cos" -> { out[i] = Math.cos(a[i]); doubt[i] = da[i]; }
                case "exp" -> { out[i] = Math.exp(a[i]); doubt[i] = out[i] * da[i]; }
                case "log" -> { out[i] = Math.log(a[i]); doubt[i] = da[i] == 0 ? 0 : da[i] / Math.abs(a[i]); }
                case "min" -> { out[i] = Math.min(a[i], b[i]); doubt[i] = Math.max(da[i], db[i]); }
                case "max" -> { out[i] = Math.max(a[i], b[i]); doubt[i] = Math.max(da[i], db[i]); }
                default -> throw new IllegalStateException("Law uses an unknown operation: " + op);
            }
        }
        return new double[][]{out, doubt};
    }

    /** The triple of samples beside the centred one, within [from, to]: the next if there is one, else the previous; -1 for none. */
    private static int neighbourTriple(int centred, int from, int to) {
        if (centred + 1 <= to - 2) return centred + 1;
        return centred - 1 >= from ? centred - 1 : -1;
    }

    /**
     * What the quantities of an expression are worth over the run. A relation holds when the two sides differ by
     * little against this, so rounding of a conserved quantity against an exact zero is not read as a violation.
     */
    private static double size(JsonNode ast, Map<String, List<Symbol>> bound, Map<String, Double> worth) {
        return size(ast, bound, worth, "");
    }

    /** prefix "" measures values; "d/dt " measures how fast quantities of that unit change in this run. */
    private static double size(JsonNode ast, Map<String, List<Symbol>> bound, Map<String, Double> worth, String prefix) {
        if (ast.isNumber()) return prefix.isEmpty() ? Math.abs(ast.asDouble()) : 0;
        if (ast.isTextual()) {
            double largest = 0;
            if (!bound.containsKey(ast.asText())) return prefix.isEmpty() ? worth.getOrDefault("constant " + ast.asText(), 0.0) : 0;
            for (Symbol symbol : bound.get(ast.asText())) largest = Math.max(largest, worth.getOrDefault(prefix.isEmpty() ? "own " + symbol.id() : prefix + symbol.unit() + "@" + symbol.get("of"), 0.0));
            return largest;
        }
        String op = ast.get(0).asText();
        if (op.equals("ddt")) return size(ast.get(1), bound, worth, RATE_PREFIX);
        double a = size(ast.get(1), bound, worth, prefix);
        double b = ast.size() > 2 ? size(ast.get(2), bound, worth, prefix) : 0;
        if (!prefix.isEmpty() && (op.equals("mul") || op.equals("div")))
            return size(ast.get(1), bound, worth, "") * b + a * size(ast.get(2), bound, worth, "");
        return switch (op) {
            case "mul" -> a * b;
            case "div" -> b > 0 ? a / b : 0;
            case "pow" -> Math.pow(a, ast.get(2).asDouble(1));
            case "sqrt" -> Math.sqrt(a);
            case "add", "sub", "min", "max" -> Math.max(a, b);
            case "sin", "cos" -> 1;
            case "exp", "log" -> 1;
            default -> a;
        };
    }

    private static void names(JsonNode ast, List<String> into) {
        if (ast.isTextual()) { if (!into.contains(ast.asText())) into.add(ast.asText()); }
        else if (ast.isArray()) for (int i = 1; i < ast.size(); i++) names(ast.get(i), into);
    }
}
