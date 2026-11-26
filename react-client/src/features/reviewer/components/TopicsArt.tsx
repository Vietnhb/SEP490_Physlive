import s from "./TopicsWorkspace.module.css";

/** Top-right physics atom & specification sheet illustration for Physics Topics. */
export function TopicsArt() {
  return (
    <svg className={s.headerArt} viewBox="0 0 148 92" fill="none" aria-hidden="true">
      <ellipse cx="78" cy="48" rx="56" ry="32" fill="#E6F4F5" opacity="0.78" />
      {/* Physics atom on the left */}
      <g transform="translate(52 46)">
        <ellipse rx="24" ry="9.5" transform="rotate(32)" stroke="#23919A" strokeWidth="1.6" />
        <ellipse rx="24" ry="9.5" transform="rotate(-32)" stroke="#0B3262" strokeWidth="1.6" />
        <ellipse rx="24" ry="9.5" transform="rotate(90)" stroke="#6B8FCB" strokeWidth="1.3" opacity="0.75" />
        <circle r="4.2" fill="#147B84" />
        <circle cx="19" cy="-10" r="2.2" fill="#0B3262" />
      </g>
      {/* Reference schema document on the right */}
      <rect x="84" y="16" width="44" height="58" rx="7" fill="#FFFFFF" stroke="#475569" strokeWidth="1.6" />
      <rect x="92" y="25" width="16" height="4" rx="2" fill="#147B84" />
      <line x1="92" y1="36" x2="120" y2="36" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" />
      <line x1="92" y1="45" x2="116" y2="45" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <line x1="92" y1="54" x2="112" y2="54" stroke="#CBD5E1" strokeWidth="2" strokeLinecap="round" />
      <circle cx="118" cy="63" r="4" fill="#E0F1EC" stroke="#15803D" strokeWidth="1.4" />
    </svg>
  );
}
