package com.example.backend.common.text;

import java.util.List;
import java.util.Optional;
import java.util.function.IntPredicate;

/**
 * Linear scans of model-written text. Each one gives exactly the result of the regular expression named on it, without
 * the backtracking such an expression can fall into on long input.
 */
public final class CodeText {
    private static final List<String> TIME_FUNCTIONS = List.of("sin", "cos", "exp", "sqrt");

    private CodeText() {
    }

    /** The characters {@code \s} matches in a Java regular expression. */
    public static boolean regexSpace(int c) {
        return c == ' ' || c == '\t' || c == '\n' || c == 0x0B || c == '\f' || c == '\r';
    }

    /** Line terminators that {@code $} may stand before although {@code \s} does not match them. */
    private static boolean otherLineEnd(char c) {
        return c == 0x0085 || c == 0x2028 || c == 0x2029;
    }

    /** {@code replaceFirst("^```[lang]*\\s*", "")}, where {@code lang} tells the characters a fence label may hold. */
    public static String withoutOpeningFence(String text, IntPredicate lang) {
        if (!text.startsWith("```")) return text;
        int from = 3;
        while (from < text.length() && lang.test(text.charAt(from))) from++;
        while (from < text.length() && regexSpace(text.charAt(from))) from++;
        return text.substring(from);
    }

    /** {@code replaceFirst("\\s*```\\s*$", "")}: a closing fence at the very end, with the whitespace on both sides. */
    public static String withoutClosingFence(String text) {
        int tail = !text.isEmpty() && otherLineEnd(text.charAt(text.length() - 1)) ? 1 : 0;
        int end = text.length() - tail;
        while (end > 0 && regexSpace(text.charAt(end - 1))) end--;
        if (end < 3 || !text.startsWith("```", end - 3)) return text;
        end -= 3;
        while (end > 0 && regexSpace(text.charAt(end - 1))) end--;
        return text.substring(0, end) + text.substring(text.length() - tail);
    }

    /** {@code replaceAll("/+$", "")}. */
    public static String withoutTrailingSlashes(String text) {
        int end = text.length() - finalLineEnd(text);
        int cut = end;
        while (cut > 0 && text.charAt(cut - 1) == '/') cut--;
        return text.substring(0, cut) + text.substring(end);
    }

    /** The length of the line terminator closing the text, which {@code $} may stand before: 0, 1 or 2 ("\r\n"). */
    private static int finalLineEnd(String text) {
        if (text.endsWith("\r\n")) return 2;
        if (text.isEmpty()) return 0;
        char last = text.charAt(text.length() - 1);
        return last == '\n' || last == '\r' || otherLineEnd(last) ? 1 : 0;
    }

    /**
     * {@code Pattern.compile("Math\\.(sin|cos|exp|sqrt)\\s*\\([^()]*(\\([^()]*\\))?[^()]*\\b(t|time|frame\\.t)\\b").matcher(code).find()}:
     * a sine, cosine, exponential or root whose argument (allowing one plain bracket inside) names the time.
     */
    public static boolean mathOfTime(String code) {
        for (int at = code.indexOf("Math."); at >= 0; at = code.indexOf("Math.", at + 1)) {
            int open = callOpen(code, at + 5);
            if (open >= 0 && timeInArguments(code, open + 1)) return true;
        }
        return false;
    }

    private static int callOpen(String code, int from) {
        for (String name : TIME_FUNCTIONS) {
            if (!code.startsWith(name, from)) continue;
            int at = from + name.length();
            while (at < code.length() && regexSpace(code.charAt(at))) at++;
            if (at < code.length() && code.charAt(at) == '(') return at;
        }
        return -1;
    }

    private static boolean timeInArguments(String code, int start) {
        int end = bracketAt(code, start);
        if (hasTimeWord(code, start, end)) return true;
        if (end >= code.length() || code.charAt(end) != '(') return false;
        int close = bracketAt(code, end + 1);
        if (close >= code.length() || code.charAt(close) != ')') return false;
        return hasTimeWord(code, close + 1, bracketAt(code, close + 1));
    }

    /** The first round bracket at or after {@code from}, or the end of the text. */
    private static int bracketAt(String code, int from) {
        int at = from;
        while (at < code.length() && code.charAt(at) != '(' && code.charAt(at) != ')') at++;
        return at;
    }

    /** Whether a whole word "t" or "time" lies in {@code [from, to)}; "frame.t" ends in the word "t". */
    private static boolean hasTimeWord(String code, int from, int to) {
        int at = from;
        while (at < to) {
            if (!wordChar(code.charAt(at))) {
                at++;
                continue;
            }
            int start = at;
            while (at < to && wordChar(code.charAt(at))) at++;
            String word = code.substring(start, at);
            if (word.equals("t") || word.equals("time")) return true;
        }
        return false;
    }

    private static boolean wordChar(char c) {
        return c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '_';
    }

    /** A quantity of one member of a group: "hat[3].x" is member "3" of group "hat", quantity "x". */
    public record Member(String group, String index, String quantity) {
    }

    /**
     * What {@code ^(.+)\[(\d+)\]\.(.+)$} captures with {@code matches()}: the last "[digits]." with text on both
     * sides; empty where the key is not a member's quantity.
     */
    public static Optional<Member> memberKey(String key) {
        for (int i = 0; i < key.length(); i++) {
            char c = key.charAt(i);
            if (c == '\n' || c == '\r' || otherLineEnd(c)) return Optional.empty();
        }
        for (int open = key.lastIndexOf('['); open > 0; open = key.lastIndexOf('[', open - 1)) {
            int close = open + 1;
            while (close < key.length() && key.charAt(close) >= '0' && key.charAt(close) <= '9') close++;
            if (close > open + 1 && close + 2 < key.length() && key.charAt(close) == ']' && key.charAt(close + 1) == '.') {
                return Optional.of(new Member(key.substring(0, open), key.substring(open + 1, close), key.substring(close + 2)));
            }
        }
        return Optional.empty();
    }
}
