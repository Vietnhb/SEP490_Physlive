import s from "./ComplaintsDesk.module.css";

/** Top-right hand-drawn style spot illustration for the Simulation Complaints page. */
export function ComplaintsArt() {
  return (
    <svg className={s.headerArt} viewBox="0 0 148 92" fill="none" aria-hidden="true">
      {/* Soft mint backdrop */}
      <ellipse cx="76" cy="52" rx="56" ry="30" fill="#E6F4F5" opacity="0.78" />
      {/* Speech / report card */}
      <path
        d="M26 20 C26 16.7 28.7 14 32 14 H98 C101.3 14 104 16.7 104 20 V54 C104 57.3 101.3 60 98 60 H50 L36 72 V60 H32 C28.7 60 26 57.3 26 54 Z"
        fill="#FFFFFF"
        stroke="#475569"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      {/* Message lines inside */}
      <line x1="38" y1="28" x2="86" y2="28" stroke="#94A3B8" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="38" y1="38" x2="78" y2="38" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="38" y1="48" x2="64" y2="48" stroke="#CBD5E1" strokeWidth="2.2" strokeLinecap="round" />
      {/* Alert badge on top-right of bubble */}
      <circle cx="106" cy="24" r="11" fill="#147B84" />
      <line x1="106" y1="19" x2="106" y2="25" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="106" cy="29" r="1.3" fill="#FFFFFF" />
      {/* Small teacher avatar silhouette on bottom-right */}
      <circle cx="114" cy="50" r="7" fill="#E0F1EC" stroke="#475569" strokeWidth="1.5" />
      <path d="M101 68 C102 61 107 58 114 58 C121 58 126 61 127 68" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" fill="#FFFFFF" />
    </svg>
  );
}
