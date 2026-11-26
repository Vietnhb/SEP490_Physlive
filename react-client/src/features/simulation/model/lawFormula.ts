/**
 * Turns a law's relation, as the backend checked it (a small expression tree: ["mul", "m", ["ddt", "v"]]), into the
 * formula a teacher reads ("m·dv/dt = ΣF"), with each letter tied to the simulation's own quantity.
 */
export type LawSymbol = { id: string; label?: string | null; unit?: string | null };
export type LawNode = string | number | LawNode[];

const GREEK: Record<string, string> = {
  al: "α", alpha: "α", be: "β", beta: "β", ga: "γ", gamma: "γ", de: "δ", delta: "δ", eps: "ε", th: "θ", theta: "θ",
  la: "λ", lam: "λ", lambda: "λ", mu: "μ", nu: "ν", rho: "ρ", sig: "σ", sigma: "σ", tau: "τ", ph: "φ", phi: "φ",
  om: "ω", omega: "ω", Om: "Ω", De: "Δ",
};
const SUPERSCRIPT: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
const FRACTIONS: Record<string, string> = { "0.5": "½", "0.25": "¼", "0.75": "¾", "0.3333333333333333": "⅓" };

/** A law's letter as printed: Greek where the catalogue spells it out, a trailing part as a subscript (Ts → Tₛ stays readable). */
export function letter(name: string): string {
  return GREEK[name] ?? name;
}

const number = (value: number) => FRACTIONS[String(value)] ?? value.toLocaleString("vi-VN", { maximumFractionDigits: 4 });
const power = (exponent: LawNode) => typeof exponent === "number" && Number.isInteger(exponent)
  ? String(exponent).split("").map(char => SUPERSCRIPT[char] ?? char).join("") : `^(${render(exponent)})`;

/** How tightly an operator binds, to know when a part needs brackets. */
const RANK: Record<string, number> = { add: 1, sub: 1, neg: 2, mul: 3, div: 3, pow: 4 };
const rank = (node: LawNode) => Array.isArray(node) && typeof node[0] === "string" ? RANK[node[0]] ?? 5 : 5;
const wrap = (node: LawNode, below: number) => rank(node) < below ? `(${render(node)})` : render(node);

export function render(node: LawNode): string {
  if (typeof node === "number") return number(node);
  if (typeof node === "string") return letter(node);
  const [op, ...args] = node as [string, ...LawNode[]];
  switch (op) {
    case "add": return `${render(args[0])} + ${wrap(args[1], 1)}`;
    case "sub": return `${render(args[0])} − ${wrap(args[1], 2)}`;
    case "neg": return `−${wrap(args[0], 3)}`;
    case "mul": return `${wrap(args[0], 3)}·${wrap(args[1], 3)}`;
    case "div": return `${wrap(args[0], 3)} / ${wrap(args[1], 4)}`;
    case "pow": return `${wrap(args[0], 5)}${power(args[1])}`;
    case "sum": return `Σ${wrap(args[0], 4)}`;
    case "ddt": return typeof args[0] === "string" ? `d${letter(args[0])}/dt` : `d(${render(args[0])})/dt`;
    case "sqrt": return `√(${render(args[0])})`;
    case "abs": return `|${render(args[0])}|`;
    case "log": return `ln(${render(args[0])})`;
    case "exp": return `e^(${render(args[0])})`;
    case "sin": case "cos": return `${op} ${wrap(args[0], 5)}`;
    case "max": case "min": return `${op}(${args.map(render).join("; ")})`;
    default: return `${op}(${args.map(render).join(", ")})`;
  }
}

/** The whole relation: "left = right", or "left ≤ right" for a bound. */
export function relation(kind: string | undefined, sides: LawNode[] | undefined): string | null {
  if (!Array.isArray(sides) || sides.length !== 2) return null;
  return `${render(sides[0])} ${kind === "atMost" ? "≤" : "="} ${render(sides[1])}`;
}

/** The letters of the formula with the simulation quantities they stood for, in the order the law names them. */
export function legend(symbols: Record<string, LawSymbol[]> | undefined, labelOf: (id: string) => string | undefined) {
  return Object.entries(symbols ?? {}).filter(([, list]) => list.length).map(([name, list]) => ({
    name,
    letter: letter(name),
    many: list.length > 1,
    quantities: list.map(symbol => ({ label: symbol.label || labelOf(symbol.id) || symbol.id, unit: symbol.unit || "" })),
  }));
}

const GREEK_TEX: Record<string, string> = {
  al: "\\alpha", alpha: "\\alpha", be: "\\beta", beta: "\\beta", ga: "\\gamma", gamma: "\\gamma", de: "\\delta", delta: "\\delta",
  eps: "\\varepsilon", th: "\\theta", theta: "\\theta", la: "\\lambda", lam: "\\lambda", lambda: "\\lambda", mu: "\\mu", nu: "\\nu",
  rho: "\\rho", sig: "\\sigma", sigma: "\\sigma", tau: "\\tau", ph: "\\varphi", phi: "\\varphi", om: "\\omega", omega: "\\omega",
  Om: "\\Omega", De: "\\Delta",
};

/** A law's letter in LaTeX: Greek by name, a longer name as a letter with the rest as its subscript (Ts → T_{s}). */
export function letterTex(name: string): string {
  if (GREEK_TEX[name]) return GREEK_TEX[name];
  if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) return `\\text{${name.replaceAll(/[{}\\]/g, "")}}`;
  return name.length === 1 ? name : `${name[0]}_{\\text{${name.slice(1)}}}`;
}

const texNumber = (value: number) => value === 0.5 ? "\\tfrac{1}{2}" : value === 0.25 ? "\\tfrac{1}{4}" : String(value);
const texWrap = (node: LawNode, below: number) => rank(node) < below ? `\\left(${tex(node)}\\right)` : tex(node);

/** The same relation as LaTeX, for the formula renderer the rest of the app uses. */
export function tex(node: LawNode): string {
  if (typeof node === "number") return texNumber(node);
  if (typeof node === "string") return letterTex(node);
  const [op, ...args] = node as [string, ...LawNode[]];
  switch (op) {
    case "add": return `${tex(args[0])} + ${texWrap(args[1], 1)}`;
    case "sub": return `${tex(args[0])} - ${texWrap(args[1], 2)}`;
    case "neg": return `-${texWrap(args[0], 3)}`;
    case "mul": return `${texWrap(args[0], 3)} \\cdot ${texWrap(args[1], 3)}`;
    case "div": return `\\dfrac{${tex(args[0])}}{${tex(args[1])}}`;
    case "pow": return `{${texWrap(args[0], 5)}}^{${tex(args[1])}}`;
    case "sum": return `\\sum ${texWrap(args[0], 4)}`;
    case "ddt": return typeof args[0] === "string" ? `\\dfrac{d${letterTex(args[0])}}{dt}` : `\\dfrac{d}{dt}\\left(${tex(args[0])}\\right)`;
    case "sqrt": return `\\sqrt{${tex(args[0])}}`;
    case "abs": return `\\left|${tex(args[0])}\\right|`;
    case "log": return `\\ln ${texWrap(args[0], 5)}`;
    case "exp": return `e^{${tex(args[0])}}`;
    case "sin": case "cos": return `\\${op} ${texWrap(args[0], 5)}`;
    case "max": case "min": return `\\${op}\\left(${args.map(tex).join(",\\ ")}\\right)`;
    default: return `\\operatorname{${op.replaceAll(/[^A-Za-z]/g, "")}}\\left(${args.map(tex).join(",\\ ")}\\right)`;
  }
}

export function relationTex(kind: string | undefined, sides: LawNode[] | undefined): string | null {
  if (!Array.isArray(sides) || sides.length !== 2) return null;
  return `${tex(sides[0])} ${kind === "atMost" ? "\\le" : "="} ${tex(sides[1])}`;
}
