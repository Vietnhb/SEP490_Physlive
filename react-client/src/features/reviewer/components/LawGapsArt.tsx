import s from "./LawGapsDesk.module.css";

/** Top-right puzzle piece / missing law illustration for Law Gaps Desk. */
export function LawGapsArt() {
  return (
    <svg className={s.headerArt} viewBox="0 0 148 92" fill="none" aria-hidden="true">
      <ellipse cx="76" cy="48" rx="54" ry="30" fill="#E6F4F5" opacity="0.78" />
      {/* Main puzzle block */}
      <path
        d="M36 22 H60 C60 17 68 17 68 22 H92 V42 C97 42 97 50 92 50 V70 H68 C68 65 60 65 60 70 H36 V50 C41 50 41 42 36 42 Z"
        fill="#DCEEF0"
        stroke="#475569"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      {/* Formula hint lines inside main block */}
      <line x1="48" y1="38" x2="78" y2="38" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" opacity="0.55" />
      <line x1="48" y1="48" x2="72" y2="48" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" opacity="0.45" />
      {/* Detached teal missing piece floating slightly to top-right */}
      <g transform="translate(97 22) rotate(10)">
        <rect x="0" y="0" width="22" height="22" rx="4" fill="#147B84" stroke="#0B3262" strokeWidth="1.4" />
        <circle cx="0" cy="11" r="4" fill="#147B84" stroke="#0B3262" strokeWidth="1.4" />
        <line x1="6" y1="11" x2="16" y2="11" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
        <line x1="11" y1="6" x2="11" y2="16" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" />
      </g>
    </svg>
  );
}
