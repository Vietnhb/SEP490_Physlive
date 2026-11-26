import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import type { LibraryItem } from "../../../shared/types/physlive";
import { useTopicName } from "../../../shared/hooks/useTopicName";
import { picture, verification } from "../../library/model/libraryVisuals";
import { StudioIcon } from "./StudioIcon";

/**
 * Picks the simulation to assign. Library titles are whole problem statements, so a native <select> (one line per
 * option, as wide as the text) spills across the screen; this list keeps each one to two lines with its topic picture,
 * topic and verification, and can be searched.
 */
export default function SimulationPicker({ items, value, onChange, disabled = false }: Readonly<{ items: LibraryItem[]; value: string; onChange: (id: string) => void; disabled?: boolean }>) {
  const topicName = useTopicName();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const id = useId();
  const selected = items.find(item => item.id === value);
  const shown = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("vi");
    return q ? items.filter(item => `${item.title} ${topicName(item.topic)}`.toLocaleLowerCase("vi").includes(q)) : items;
  }, [items, query, topicName]);

  useEffect(() => {
    if (!open) return;
    const away = (event: MouseEvent) => { if (!box.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", away);
    search.current?.focus();
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  useEffect(() => { list.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" }); }, [active, open]);

  const show = () => { setQuery(""); setActive(Math.max(0, items.findIndex(item => item.id === value))); setOpen(true); };
  const choose = (item: LibraryItem) => { onChange(item.id); setOpen(false); box.current?.querySelector<HTMLButtonElement>(".simpick-trigger")?.focus(); };
  const keys = (event: KeyboardEvent) => {
    if (event.key === "ArrowDown") { event.preventDefault(); setActive(index => Math.min(shown.length - 1, index + 1)); }
    else if (event.key === "ArrowUp") { event.preventDefault(); setActive(index => Math.max(0, index - 1)); }
    else if (event.key === "Enter") { event.preventDefault(); if (shown[active]) choose(shown[active]); }
    else if (event.key === "Escape") { event.preventDefault(); setOpen(false); box.current?.querySelector<HTMLButtonElement>(".simpick-trigger")?.focus(); }
  };
  const meta = (item: LibraryItem) => { const check = verification(item); return <span className="simpick-meta">{topicName(item.topic) || "Vật lý"}<span className={"badge " + check.tone} title={check.hint}>{check.label}</span></span>; };

  return <div className="simpick" ref={box}>
    <button type="button" className="input simpick-trigger" id="assignment-library-item" aria-haspopup="listbox" aria-expanded={open} aria-controls={id} disabled={disabled}
      onClick={() => open ? setOpen(false) : show()} onKeyDown={event => { if (!open && (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ")) { event.preventDefault(); show(); } }}>
      {selected ? <><img src={picture(selected.topic)} alt="" /><span className="simpick-text"><b>{selected.title}</b>{meta(selected)}</span></>
        : <span className="simpick-placeholder">Chọn một mô phỏng trong thư viện</span>}
      <StudioIcon name="chevron-down" />
    </button>
    {open && <div className="simpick-panel">
      <label className="search"><StudioIcon name="search" /><input ref={search} className="input" type="search" placeholder="Tìm theo đề bài hoặc chủ đề…" aria-label="Tìm mô phỏng"
        role="combobox" aria-expanded="true" aria-controls={id} aria-activedescendant={shown[active] ? `${id}-${shown[active].id}` : undefined}
        value={query} onChange={event => { setQuery(event.target.value); setActive(0); }} onKeyDown={keys} /></label>
      <ul className="simpick-list" role="listbox" id={id} ref={list} aria-label="Mô phỏng trong thư viện">
        {shown.length === 0 ? <li className="simpick-empty">Không có mô phỏng khớp “{query}”.</li>
          : shown.map((item, index) => <li key={item.id} id={`${id}-${item.id}`} data-index={index} role="option" aria-selected={item.id === value}
            className={"simpick-option" + (index === active ? " is-active" : "")} onMouseEnter={() => setActive(index)} onMouseDown={event => event.preventDefault()} onClick={() => choose(item)}>
            <img src={picture(item.topic)} alt="" /><span className="simpick-text"><b>{item.title}</b>{meta(item)}</span>
            {item.id === value && <StudioIcon name="check" />}
          </li>)}
      </ul>
      <p className="simpick-foot">{shown.length}/{items.length} mô phỏng đã kiểm định trong thư viện</p>
    </div>}
  </div>;
}
