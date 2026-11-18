import { useMemo, useState } from "react";
import { Button, Text } from "@radix-ui/themes";
import { AdvancedJson } from "./JsonEditor";
import { ReviewerDialog } from "./ReviewerDialog";
import type { JsonObject } from "../model/jsonRows";
import { codeFrom, parseRelation, plainName, pretty, relationOf, relationText, sameAs, summedSymbols, symbols, print, type Ast } from "../model/lawText";
import { matches } from "../model/reviewerUtils";
import "../styles/lawbook.css";

type Catalogue = JsonObject;
type Law = JsonObject;
type Bind = Record<string, JsonObject>;
type Names = Record<string, unknown>;

/** Shared cross-topic physics roles so laws that reference mechanics fundamentals (e.g. force in Coulomb's law) resolve cleanly. */
const FALLBACK_ROLES: Names = {
  force: "một lực tác dụng lên vật (of, by, axis, kind)",
  force_magnitude: "độ lớn của một lực tác dụng lên vật (of, by, kind)",
  mass: "khối lượng của một vật (of)",
  velocity: "vận tốc của vật trên một trục (of, axis)",
  speed: "tốc độ của một vật (of)",
  acceleration: "gia tốc của vật trên một trục (of, axis)",
  position: "tọa độ của vật trên một trục (of, axis)",
  displacement: "độ dịch chuyển của vật trên một trục (of, axis)",
  distance: "quãng đường đi được của một vật (of)",
  time: "thời gian chuyển động (of)",
  momentum: "động lượng của vật trên một trục (of, axis)",
  kinetic_energy: "động năng của một vật (of)",
  potential_energy: "thế năng của một vật (of)",
  mechanical_energy: "cơ năng của một vật (of)",
  work: "công của một lực (of, by, kind)",
  power: "công suất (of)",
};

const FALLBACK_KINDS: Names = {
  electric: "lực điện",
  magnetic: "lực từ",
  gravity: "trọng lực",
  normal: "phản lực pháp tuyến",
  tension: "lực căng dây",
  elastic: "lực đàn hồi",
  friction: "lực ma sát",
  drag: "lực cản môi trường",
};

const record = (value: unknown): Names => value && typeof value === "object" && !Array.isArray(value) ? value as Names : {};
const without = (source: Names, ...keys: string[]) => Object.fromEntries(Object.entries(source).filter(([key]) => !keys.includes(key)));
const bindOf = (law: Law) => record(law.bind) as Bind;
const UNSORTED = "Chưa xếp vào phần nào";
const partOf = (law: Law) => String(law.curriculum ?? "").split(" – ")[0].trim() || UNSORTED;

/** Splits "vận tốc của vật (of, axis)" into editable Vietnamese label + technical AI suffix "(of, axis)". */
function splitRoleDescription(raw: unknown, fallback = ""): { label: string; suffix: string } {
  const text = String(raw ?? "").trim();
  if (!text) return { label: fallback, suffix: "" };
  const mark = text.search(/[(;]/);
  const idx = mark === -1 ? -1 : text.slice(0, mark).trimEnd().length;
  if (idx === -1) return { label: text, suffix: "" };
  return { label: text.slice(0, idx).trim() || fallback, suffix: text.slice(idx).trim() };
}

/** What the reviewer still has to fill in before this law can check anything. */
function gaps(law: Law, roles: Names): string[] {
  const out: string[] = [];
  if (!String(law.title ?? "").trim()) out.push("chưa có tên");
  if (!relationOf(law)) out.push("chưa có công thức");
  const unnamed = Object.entries(bindOf(law)).filter(([, rule]) => !String(rule?.role ?? "").trim() || !(String(rule.role) in roles)).map(([symbol]) => symbol);
  if (unnamed.length) out.push(`chưa nói ${unnamed.join(", ")} là đại lượng nào`);
  return out;
}

/** "tất cả lực tác dụng lên vật — loại: lực ma sát trượt" */
function meaning(rule: JsonObject, roles: Names, kinds: Names): string {
  const role = String(rule?.role ?? "");
  if (!role) return "chưa chọn đại lượng";
  const where = record(rule.where);
  const kind = where.kind;
  const kindText = kind === undefined ? "" : kind === "*" ? "thuộc một loại bất kì" : `loại: ${(Array.isArray(kind) ? kind : [kind]).map(item => plainName(kinds[String(item)], String(item))).join(" / ")}`;
  const extra = [kindText, Object.keys(where).some(key => key !== "kind") ? "có điều kiện riêng" : "", rule.global ? "dùng chung cho cả mô hình" : ""].filter(Boolean);
  return `${rule.many ? "tất cả " : ""}${plainName(roles[role], role).replace(rule.many ? /^(một|mỗi) / : /^$/, "")}${extra.length ? ` — ${extra.join(", ")}` : ""}`;
}

/** The fine print of a law, in a sentence. */
function conditions(law: Law, roles: Names): string[] {
  const out: string[] = [];
  const scope = Array.isArray(law.scope) ? law.scope.map(String) : [];
  if (scope.length) out.push(`Xét các đại lượng thuộc ${scope.map(sameAs).join(", ")}.`);
  if (law.when !== undefined) out.push(`Chỉ xét những lúc ${pretty(print(law.when as Ast))} khác 0.`);
  const unless = record(law.unless);
  if (unless.role) out.push(`Bỏ qua khi mô hình có ${plainName(roles[String(unless.role)], String(unless.role))}${unless.where ? " (thuộc loại nêu trong phần nâng cao)" : ""}.`);
  return out;
}

/**
 * The laws a topic checks simulations against, laid out like a formula sheet: grouped by part of the programme,
 * each law with its formula, what every letter stands for and when it applies. With onChange it is editable.
 */
export function LawBook({ value, shared, onChange }: Readonly<{ value: Catalogue; shared?: Catalogue; onChange?: (next: Catalogue) => void }>) {
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const [editingPart, setEditingPart] = useState<string>(UNSORTED);
  const laws = useMemo(() => (Array.isArray(value.laws) ? value.laws as Law[] : []), [value.laws]);
  const ownRoles = record(value.roles);
  const roles = useMemo(() => ({ ...FALLBACK_ROLES, ...record(shared?.roles), ...ownRoles }), [shared, ownRoles]);
  const kinds = useMemo(() => ({ ...FALLBACK_KINDS, ...record(shared?.forceKinds), ...record(shared?.kinds), ...record(value.forceKinds), ...record(value.kinds) }), [shared, value.forceKinds, value.kinds]);
  const constants = record(value.constants);
  const hit = (law: Law) => matches(
    query,
    String(law.title ?? ""),
    String(law.curriculum ?? ""),
    relationText(law),
    pretty(relationText(law)),
    ...Object.entries(bindOf(law)).flatMap(([sym, rule]) => [sym, String(rule?.role ?? ""), plainName(roles[String(rule?.role)], "")]),
  );
  const groups = new Map<string, number[]>();
  laws.forEach((law, index) => {
    if (index === editing || hit(law)) {
      const part = index === editing ? editingPart : partOf(law);
      groups.set(part, [...(groups.get(part) ?? []), index]);
    }
  });
  const unfinished = laws.filter(law => gaps(law, roles).length).length;
  const setLaws = (next: Law[]) => onChange?.({ ...value, laws: next });
  const addInPart = (targetPart = UNSORTED) => {
    const sampleCurriculum = targetPart === UNSORTED
      ? ""
      : String(laws.find(item => partOf(item) === targetPart)?.curriculum ?? targetPart).trim();
    setQuery("");
    setLaws([{ id: "", title: "", curriculum: sampleCurriculum, scope: ["of"], bind: {} }, ...laws]);
    setEditingPart(targetPart);
    setEditing(0);
  };

  // Saved programme names (excluding the law currently being edited so half-typed text does not pollute suggestions)
  const savedCurricula = useMemo(() => {
    const items: string[] = [];
    laws.forEach((item, idx) => {
      if (idx === editing) return;
      const full = String(item.curriculum ?? "").trim();
      const part = partOf(item);
      if (full && !items.includes(full)) items.push(full);
      if (part !== UNSORTED && !items.includes(part)) items.push(part);
    });
    return items;
  }, [laws, editing]);

  // The book sits inside the topic form: Enter in one of its boxes must not save the whole topic.
  return <div className="lawbook" role="group" aria-label="Bộ định luật" onKeyDown={event => { if (event.key === "Enter" && (event.target as HTMLElement).tagName === "INPUT") event.preventDefault(); }}>
    <div className="lawbook-bar">
      <input className="lawbook-input lawbook-search" type="search" placeholder="Tìm định luật, công thức hoặc đại lượng…" value={query} onChange={event => setQuery(event.target.value)} aria-label="Tìm định luật" />
      <span className="lawbook-count">{laws.length} định luật · {new Set(laws.map(partOf)).size} phần{unfinished > 0 && <b> · {unfinished} cần bổ sung</b>}</span>
      {onChange && <button type="button" className="lawbook-button is-primary" onClick={() => addInPart(UNSORTED)}>+ Thêm định luật</button>}
    </div>

    {laws.length === 0 && <p className="lawbook-empty">Chủ đề này chưa có định luật nào, nên mô phỏng thuộc chủ đề chỉ được gắn nhãn “minh hoạ”.{onChange ? " Bấm “Thêm định luật” để bắt đầu." : ""}</p>}
    {laws.length > 0 && groups.size === 0 && <p className="lawbook-empty">Không có định luật nào khớp với “{query}”.</p>}

    {[...groups].map(([part, indexes]) => <details key={part} className="lawbook-part" open>
      <summary>
        <span>{part}</span>
        <small>{indexes.length} định luật</small>
        {onChange && part !== UNSORTED && (
          <button
            type="button"
            className="lawbook-button is-part-add"
            onClick={event => { event.preventDefault(); event.stopPropagation(); addInPart(part); }}
          >
            + Thêm định luật vào phần này
          </button>
        )}
      </summary>
      {indexes.map(index => {
        const law = laws[index], missing = gaps(law, roles), notes = conditions(law, roles);
        if (onChange && editing === index) {
          const usedByOthers = new Set<string>();
          laws.forEach((item, i) => {
            if (i === index) return;
            Object.values(bindOf(item)).forEach(r => { if (r?.role) usedByOthers.add(String(r.role)); });
            const u = record(item.unless);
            if (u.role) usedByOthers.add(String(u.role));
          });
          return <LawForm key={index} law={law} ownRoles={ownRoles} roles={roles} kinds={kinds} constants={constants} curricula={savedCurricula}
            usedByOthers={usedByOthers}
            onChange={(next, nextRoles) => onChange({ ...value, ...(nextRoles ? { roles: nextRoles } : {}), laws: laws.map((item, i) => i === index ? next : item) })}
            onDone={() => setEditing(null)}
            onDelete={() => { setEditing(null); setLaws(laws.filter((_, i) => i !== index)); }}
            takenIds={laws.filter((_, i) => i !== index).map(item => String(item.id ?? ""))} />;
        }
        return <article key={index} className={`law${missing.length ? " has-gap" : ""}`}>
          <div className="law-text">
            <h4>{String(law.title || "Định luật chưa đặt tên")}</h4>
            {String(law.curriculum ?? "").includes(" – ") && <p className="law-lesson">{String(law.curriculum).split(" – ").slice(1).join(" – ")}</p>}
            {notes.map(note => <p key={note} className="law-note">{note}</p>)}
            {missing.length > 0 && <p className="law-gap">Cần bổ sung: {missing.join("; ")}.</p>}
          </div>
          <div className="law-maths">
            <div className="law-formula">{pretty(relationText(law)) || "—"}</div>
            <dl className="law-legend">{Object.entries(bindOf(law)).map(([symbol, rule]) => <div key={symbol}><dt>{symbol}</dt><dd>{meaning(rule, roles, kinds)}</dd></div>)}</dl>
          </div>
          {onChange && <button type="button" className="lawbook-button" onClick={() => { setEditingPart(partOf(law)); setEditing(index); }}>Sửa</button>}
        </article>;
      })}
    </details>)}

    <RoleDictionary value={value} allRoles={roles} laws={laws} onChange={onChange} />
  </div>;
}

function LawForm({ law, ownRoles, roles, kinds, constants, curricula, takenIds, usedByOthers, onChange, onDone, onDelete }: Readonly<{ law: Law; ownRoles: Names; roles: Names; kinds: Names; constants: Names; curricula: string[]; takenIds: string[]; usedByOthers: Set<string>; onChange: (next: Law, nextRoles?: Names) => void; onDone: () => void; onDelete: () => void }>) {
  const current = relationText(law);
  // The box keeps what is being typed, even half a formula; the law changes only when the text reads as one.
  const [draft, setDraft] = useState<{ base: string; text: string; problem: string } | null>(null);
  const [roleTexts, setRoleTexts] = useState<Record<string, string>>({});
  const [autoRoles, setAutoRoles] = useState<Record<string, string>>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showCurriculaMenu, setShowCurriculaMenu] = useState(false);
  const typed = draft && draft.base === current ? draft : null;
  const bind = bindOf(law);
  const scope = Array.isArray(law.scope) ? law.scope.map(String) : [];
  const isEmptyDraftLaw = !String(law.title ?? "").trim() && !current.trim() && Object.keys(bind).length === 0;
  const write = (text: string) => {
    const read = parseRelation(text);
    if (typeof read === "string") { setDraft({ base: current, text, problem: text.trim() ? read : "" }); return; }
    // Letters follow the formula: a new one gets a row to fill in, one that left and was never filled in goes away.
    // Letters inside Σ(...) / sum(...) automatically bind all matching quantities so the checker can sum them.
    const used = [...symbols(read.left), ...symbols(read.right), ...symbols(law.when)].filter(symbol => !(symbol in constants));
    const summed = new Set([...summedSymbols(read.left), ...summedSymbols(read.right), ...summedSymbols(law.when)]);
    const next: Bind = {};
    for (const [symbol, rule] of Object.entries(bind)) if (used.includes(symbol) || rule?.role) next[symbol] = rule;
    for (const symbol of used) {
      const base = next[symbol] ?? { role: "" };
      next[symbol] = summed.has(symbol) ? { ...base, many: true, min: base.min ?? 1 } : without(base, "many", "min");
    }
    const updated = { ...without(law, "equal", "atMost"), bind: next, [read.sign === "=" ? "equal" : "atMost"]: [read.left, read.right] };
    setDraft({ base: relationText(updated), text, problem: "" });
    onChange(updated);
  };
  const setRule = (symbol: string, rule: JsonObject | null) => {
    const next = { ...bind };
    if (rule) next[symbol] = rule; else delete next[symbol];
    onChange({ ...law, bind: next });
  };
  const setRoleText = (symbol: string, rawText: string) => {
    const rule = bind[symbol] ?? { role: "" };
    setRoleTexts(prev => ({ ...prev, [symbol]: rawText }));
    const trimmed = rawText.trim();
    const prevAuto = autoRoles[symbol];
    const usedElsewhere = (id: string) =>
      usedByOthers.has(id) ||
      Object.entries(bind).some(([otherSym, otherRule]) => otherSym !== symbol && otherRule?.role === id) ||
      record(law.unless).role === id;
    const baseOwnRoles = prevAuto && !usedElsewhere(prevAuto) ? without(ownRoles, prevAuto) : { ...ownRoles };
    const lookupRoles = { ...roles, ...baseOwnRoles };
    if (!trimmed) {
      setAutoRoles(prev => without(prev, symbol) as Record<string, string>);
      onChange({ ...law, bind: { ...bind, [symbol]: { ...rule, role: "" } } }, baseOwnRoles);
      return;
    }
    const lower = trimmed.toLowerCase();
    const existing = Object.entries(lookupRoles).find(
      ([id, desc]) =>
        id !== prevAuto && (
          id.toLowerCase() === lower ||
          plainName(desc, id).toLowerCase() === lower ||
          String(desc ?? "").trim().toLowerCase() === lower
        ),
    );
    if (existing) {
      const [matchedId, matchedDesc] = existing;
      setAutoRoles(prev => without(prev, symbol) as Record<string, string>);
      onChange(
        { ...law, bind: { ...bind, [symbol]: { ...rule, role: matchedId } } },
        matchedId in baseOwnRoles ? baseOwnRoles : { ...baseOwnRoles, [matchedId]: matchedDesc },
      );
      return;
    }
    const newId = codeFrom(trimmed, Object.keys(lookupRoles));
    setAutoRoles(prev => ({ ...prev, [symbol]: newId }));
    onChange({ ...law, bind: { ...bind, [symbol]: { ...rule, role: newId } } }, { ...baseOwnRoles, [newId]: trimmed });
  };
  // A new law gets its code from its name; a law that already has one keeps it, since saved results refer to it.
  const setTitle = (title: string) => onChange({ ...law, title, id: !law.id || law.id === codeFrom(String(law.title ?? ""), takenIds) ? codeFrom(title, takenIds) : law.id });
  const inFormula = symbols([0, relationOf(law)?.left, relationOf(law)?.right, law.when]);
  const kindNames = Object.keys(kinds);
  const scopeChoices = [...new Set(["of", "axis", ...scope])];
  const autoIds = new Set(Object.values(autoRoles));
  const roleSuggestions = [...new Set(Object.entries(roles).filter(([id]) => !autoIds.has(id)).map(([id, description]) => plainName(description, id)).filter(Boolean))];
  const curriculumValue = String(law.curriculum ?? "");

  return <article className="law is-editing">
    <div className="lawform">
      <label className="lawform-field"><span>Tên định luật</span>
        <input className="lawbook-input" value={String(law.title ?? "")} placeholder="Định luật II Newton: m·a bằng tổng các lực" onChange={event => setTitle(event.target.value)} /></label>
      <div className="lawform-field lawform-curriculum-field">
        <label htmlFor="lawform-curriculum-input"><span>Thuộc phần nào của chương trình</span></label>
        <div className="lawform-combobox">
          <input
            id="lawform-curriculum-input"
            className="lawbook-input"
            value={curriculumValue}
            placeholder="Nhập phần mới hoặc chọn phần đã lưu bên dưới…"
            onFocus={() => setShowCurriculaMenu(true)}
            onBlur={() => window.setTimeout(() => setShowCurriculaMenu(false), 160)}
            onChange={event => { onChange({ ...law, curriculum: event.target.value }); setShowCurriculaMenu(true); }}
          />
          {curricula.length > 0 && (
            <button
              type="button"
              className="lawform-combobox-toggle"
              aria-label="Hiện các phần chương trình đã lưu"
              onMouseDown={event => { event.preventDefault(); setShowCurriculaMenu(open => !open); }}
            >
              ▾
            </button>
          )}
          {showCurriculaMenu && curricula.length > 0 && (
            <div className="lawform-combobox-menu" role="listbox" aria-label="Các phần chương trình đã lưu">
              <div className="lawform-combobox-head">Phần chương trình đã có trong chủ đề (nhấn để chọn):</div>
              {curricula.map(item => (
                <button
                  key={item}
                  type="button"
                  role="option"
                  aria-selected={curriculumValue.trim() === item}
                  className={`lawform-combobox-option${curriculumValue.trim() === item ? " is-selected" : ""}`}
                  onMouseDown={event => {
                    event.preventDefault();
                    onChange({ ...law, curriculum: item });
                    setShowCurriculaMenu(false);
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          )}
        </div>
        {curricula.length > 0 && (
          <div className="lawform-curriculum-chips">
            <small>Chọn nhanh:</small>
            {curricula.map(item => (
              <button
                key={item}
                type="button"
                className={`lawform-chip${curriculumValue.trim() === item ? " is-active" : ""}`}
                onClick={() => onChange({ ...law, curriculum: item })}
              >
                {item}
              </button>
            ))}
          </div>
        )}
      </div>

      <label className="lawform-field is-wide"><span>Công thức</span>
        <input className="lawbook-input lawform-formula" spellCheck={false} value={typed ? typed.text : current} placeholder="m·d(v)/dt = ΣF" aria-invalid={Boolean(typed?.problem)} onChange={event => write(event.target.value)} />
        {typed?.problem ? <em className="lawform-problem">{typed.problem}</em>
          : <small>Nhân: <kbd>·</kbd> hoặc <kbd>*</kbd> · luỹ thừa: <kbd>v^2</kbd> · tổng: <kbd>ΣF</kbd> hoặc <kbd>sum(F)</kbd> · đạo hàm theo thời gian: <kbd>d(v)/dt</kbd> · căn: <kbd>sqrt(x)</kbd> · trị tuyệt đối: <kbd>|x|</kbd> · bất đẳng thức: <kbd>≤</kbd> hoặc <kbd>&lt;=</kbd></small>}</label>

      <div className="lawform-field is-wide"><span>Mỗi kí hiệu là đại lượng nào</span>
        {roleSuggestions.length > 0 && <datalist id="lawbook-roles-datalist">{roleSuggestions.map(item => <option key={item} value={item} />)}</datalist>}
        {Object.keys(bind).length === 0 ? <small>Viết công thức ở trên; từng kí hiệu sẽ hiện ra ở đây để bạn nhập tên đại lượng (ví dụ: vận tốc, quãng đường, thời gian…).</small>
          : <table className="lawform-symbols"><thead><tr><th>Kí hiệu</th><th>Là đại lượng</th>{kindNames.length > 0 && <th>Chỉ loại</th>}<th>Thao tác</th></tr></thead><tbody>
            {Object.entries(bind).map(([symbol, rule]) => {
              const where = record(rule.where), simple = Object.keys(where).every(key => key === "kind") && (where.kind === undefined || typeof where.kind === "string");
              const roleKey = String(rule.role ?? "");
              const displayValue = roleTexts[symbol] ?? (roleKey ? plainName(roles[roleKey], roleKey) : "");
              return <tr key={symbol}>
                <td><b>{symbol}</b></td>
                <td>
                  <input
                    className="lawbook-input"
                    list={roleSuggestions.length > 0 ? "lawbook-roles-datalist" : undefined}
                    value={displayValue}
                    placeholder="Nhập tên đại lượng, ví dụ: vận tốc, quãng đường…"
                    aria-label={`Đại lượng của ${symbol}`}
                    onChange={event => setRoleText(symbol, event.target.value)}
                    onBlur={() => setRoleTexts(prev => without(prev, symbol) as Record<string, string>)}
                  />
                  {Boolean(rule.many) && <small>Tự động lấy tổng tất cả các đại lượng cùng loại (Σ)</small>}
                </td>
                {kindNames.length > 0 && <td>{simple ? <select className="lawbook-input" value={String(where.kind ?? "")} aria-label={`Loại của ${symbol}`} onChange={event => setRule(symbol, event.target.value ? { ...rule, where: { kind: event.target.value } } : without(rule, "where"))}>
                  <option value="">mọi loại</option>{kindNames.map(kind => <option key={kind} value={kind}>{plainName(kinds[kind], kind)}</option>)}
                </select> : <small>có điều kiện riêng (xem phần nâng cao)</small>}</td>}
                <td>{!inFormula.includes(symbol) && <button type="button" className="lawbook-button is-quiet" onClick={() => setRule(symbol, null)} title="Kí hiệu này không còn trong công thức">Bỏ</button>}</td>
              </tr>;
            })}</tbody></table>}
      </div>

      <div className="lawform-field is-wide"><span>Chỉ so sánh các đại lượng thuộc</span>
        <div className="lawform-checks">{scopeChoices.map(attribute => <label key={attribute}><input type="checkbox" checked={scope.includes(attribute)} onChange={event => onChange({ ...law, scope: event.target.checked ? [...scope, attribute] : scope.filter(item => item !== attribute) })} />{sameAs(attribute)}</label>)}</div>
      </div>
    </div>
    <details className="lawform-advanced"><summary>Nâng cao: mã định luật và điều kiện đặc biệt</summary>
      <AdvancedJson open value={law} onChange={onChange} label="Dữ liệu đầy đủ của định luật" hint="Chỉ cần mở khi định luật có điều kiện mà biểu mẫu trên chưa diễn đạt được (when, unless, where)." />
    </details>
    <div className="lawform-actions">
      <button type="button" className="lawbook-button is-danger" onClick={() => { if (isEmptyDraftLaw) onDelete(); else setConfirmDelete(true); }}>
        {isEmptyDraftLaw ? "Huỷ thêm" : "Xoá định luật"}
      </button>
      <button type="button" className="lawbook-button is-primary" onClick={onDone}>Xong</button>
    </div>
    {confirmDelete && <ReviewerDialog title="Xoá định luật?" onClose={() => setConfirmDelete(false)}>
      <Text as="p" size="3"><strong>{String(law.title || "Định luật chưa đặt tên")}</strong>{current ? ` (${pretty(current)})` : ""}</Text>
      <Text as="p" size="2" color="gray" mt="2">Định luật này sẽ bị xoá khỏi chủ đề hiện tại.</Text>
      <div className="reviewer-form-footer">
        <Button type="button" variant="soft" color="gray" size="2" onClick={() => setConfirmDelete(false)}>Hủy</Button>
        <Button type="button" color="red" size="2" onClick={() => { setConfirmDelete(false); onDelete(); }}>Xoá định luật</Button>
      </div>
    </ReviewerDialog>}
  </article>;
}

/** The quantities laws can talk about. The AI tags each quantity of a model with one of these names. */
function RoleDictionary({ value, allRoles, laws, onChange }: Readonly<{ value: Catalogue; allRoles: Names; laws: Law[]; onChange?: (next: Catalogue) => void }>) {
  const [name, setName] = useState("");
  const [filterQuery, setFilterQuery] = useState("");
  const ownRoles = record(value.roles);

  // Include both explicitly declared roles in this topic AND any role referenced by laws in this topic
  const mergedEntries = useMemo(() => {
    const combined: Names = { ...ownRoles };
    laws.forEach(law => {
      Object.values(bindOf(law)).forEach(rule => {
        const id = String(rule?.role ?? "").trim();
        if (id && !(id in combined) && id in allRoles) combined[id] = allRoles[id];
      });
      const u = String(record(law.unless).role ?? "").trim();
      if (u && !(u in combined) && u in allRoles) combined[u] = allRoles[u];
    });
    return Object.entries(combined);
  }, [ownRoles, allRoles, laws]);

  const uses = (id: string) => laws.filter(law => Object.values(bindOf(law)).some(rule => rule?.role === id) || record(law.unless).role === id).length;
  const symbolsFor = (id: string) => {
    const found = new Set<string>();
    laws.forEach(law => {
      Object.entries(bindOf(law)).forEach(([sym, rule]) => { if (rule?.role === id) found.add(sym); });
    });
    return [...found];
  };
  const setRoles = (next: Names) => onChange?.({ ...value, roles: next });
  const updateRoleLabel = (id: string, currentDesc: unknown, newLabel: string) => {
    const { suffix } = splitRoleDescription(currentDesc, id);
    const hasOwnParens = /[()]/.test(newLabel);
    const updated = suffix && !hasOwnParens ? `${newLabel} ${suffix}` : newLabel;
    setRoles({ ...ownRoles, [id]: updated });
  };
  const add = () => {
    if (name.trim()) {
      setRoles({ ...ownRoles, [codeFrom(name, Object.keys(allRoles))]: name.trim() });
      setName("");
    }
  };
  const visibleEntries = mergedEntries.filter(([id, description]) =>
    matches(filterQuery, id, String(description ?? ""), plainName(description, id), ...symbolsFor(id)),
  );

  return <details className="lawbook-part lawbook-roles">
    <summary><span>Danh mục đại lượng của chủ đề</span><small>{mergedEntries.length} đại lượng</small></summary>
    <p className="lawbook-hint">Mỗi đại lượng bạn nhập ở các công thức trên đều được lưu tại đây. Khi AI dựng mô hình vật lý, nó đối chiếu các đại lượng trong danh mục này để tự động kiểm chứng định luật. Bạn có thể đổi tên hiển thị tại đây để cập nhật đồng loạt cho mọi định luật đang dùng.</p>
    {mergedEntries.length > 6 && (
      <div className="lawbook-bar">
        <input
          className="lawbook-input lawbook-search"
          type="search"
          value={filterQuery}
          placeholder="Tìm đại lượng hoặc kí hiệu…"
          aria-label="Tìm đại lượng trong danh mục"
          onChange={event => setFilterQuery(event.target.value)}
        />
      </div>
    )}
    {visibleEntries.length === 0 ? (
      <p className="lawbook-empty">
        {mergedEntries.length === 0
          ? "Chưa có đại lượng nào. Khi bạn nhập tên đại lượng trong định luật hoặc thêm ở dưới, đại lượng sẽ xuất hiện tại đây."
          : `Không tìm thấy đại lượng nào khớp với “${filterQuery}”.`}
      </p>
    ) : (
      <table className="lawform-symbols"><thead><tr><th>Tên đại lượng</th><th>Kí hiệu đang dùng</th><th>Dùng trong</th>{onChange && <th>Thao tác</th>}</tr></thead><tbody>
        {visibleEntries.map(([id, description]) => {
          const { label } = splitRoleDescription(description, id);
          const syms = symbolsFor(id);
          const count = uses(id);
          return <tr key={id}>
            <td>
              {onChange ? (
                <input
                  className="lawbook-input"
                  value={label}
                  aria-label={`Tên đại lượng ${id}`}
                  onChange={event => updateRoleLabel(id, description, event.target.value)}
                />
              ) : (
                <span>{label}</span>
              )}
            </td>
            <td className="lawbook-uses">{syms.length > 0 ? <code>{syms.join(", ")}</code> : "—"}</td>
            <td className="lawbook-uses">{count ? `${count} định luật` : "chưa dùng"}</td>
            {onChange && (
              <td>
                {count === 0 && id in ownRoles && (
                  <button type="button" className="lawbook-button is-danger is-small" onClick={() => setRoles(without(ownRoles, id))}>
                    Xoá
                  </button>
                )}
              </td>
            )}
          </tr>;
        })}
      </tbody></table>
    )}
    {onChange && <div className="lawbook-bar"><input className="lawbook-input" value={name} placeholder="Thêm đại lượng mới, ví dụ: tốc độ góc của vật quay…" aria-label="Tên đại lượng mới" onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(); } }} />
      <button type="button" className="lawbook-button" disabled={!name.trim()} onClick={add}>+ Thêm đại lượng</button></div>}
  </details>;
}

export const LawCatalogueEditor = LawBook;
