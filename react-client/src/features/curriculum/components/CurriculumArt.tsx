export default function CurriculumArt() {
  return (
    <svg width="152" height="96" viewBox="0 0 180 112" fill="none" aria-hidden="true">
      <ellipse cx="92" cy="64" rx="70" ry="34" fill="var(--teal-3)" />
      <ellipse cx="90" cy="34" rx="64" ry="15" stroke="var(--teal-7)" strokeDasharray="2 4" transform="rotate(-6 90 34)" />
      {/* Stacked books */}
      <g stroke="var(--indigo-9)" strokeWidth="1.4" strokeLinejoin="round">
        <rect x="38" y="68" width="84" height="17" rx="3.5" fill="var(--color-panel-solid)" />
        <path d="M48 68v17M114 73H56M114 79H56" stroke="var(--teal-8)" strokeWidth="1.2" />
        <rect x="44" y="51" width="76" height="17" rx="3.5" fill="var(--indigo-2)" />
        <path d="M54 51v17M112 57H62M112 62H62" stroke="var(--indigo-8)" strokeWidth="1.2" />
        <rect x="40" y="34" width="80" height="17" rx="3.5" fill="var(--color-panel-solid)" />
        <path d="M50 34v17M112 40H58M112 45H58" stroke="var(--teal-8)" strokeWidth="1.2" />
      </g>
      {/* Branching curriculum tree accent on right */}
      <path d="M138 86V38M138 66l12-10M138 56l-10-10M138 44l10-8" stroke="var(--teal-9)" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="138" cy="34" r="3.5" fill="var(--teal-9)" />
      <circle cx="151" cy="54" r="2.8" fill="var(--teal-8)" />
      <circle cx="127" cy="44" r="2.5" fill="var(--indigo-8)" />
      <circle cx="28" cy="54" r="2.5" fill="var(--teal-8)" />
    </svg>
  );
}
