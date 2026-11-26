export default function UsersArt() {
  return (
    <svg width="148" height="100" viewBox="0 0 180 112" fill="none" aria-hidden="true">
      <ellipse cx="92" cy="64" rx="70" ry="36" fill="var(--teal-3)" />
      <ellipse cx="90" cy="34" rx="64" ry="16" stroke="var(--teal-7)" strokeDasharray="2 4" transform="rotate(-7 90 34)" />
      {/* Left ID card */}
      <g transform="rotate(-5 62 60)">
        <rect x="34" y="26" width="56" height="68" rx="9" fill="var(--color-panel-solid)" stroke="var(--teal-8)" strokeWidth="1.4" />
        <circle cx="62" cy="48" r="10" fill="var(--teal-4)" stroke="var(--teal-9)" strokeWidth="1.3" />
        <path d="M46 72c2.5-6.5 9-10 16-10s13.5 3.5 16 10" stroke="var(--teal-9)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M47 82h30" stroke="var(--teal-7)" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      {/* Right ID card */}
      <g transform="rotate(4 118 56)">
        <rect x="92" y="20" width="58" height="72" rx="9" fill="var(--color-panel-solid)" stroke="var(--indigo-8)" strokeWidth="1.4" />
        <circle cx="121" cy="44" r="10.5" fill="var(--indigo-3)" stroke="var(--indigo-9)" strokeWidth="1.3" />
        <path d="M104 68c2.8-6.8 9.5-10.5 17-10.5s14.2 3.7 17 10.5" stroke="var(--indigo-9)" strokeWidth="1.4" strokeLinecap="round" />
        <path d="M106 79h30" stroke="var(--indigo-7)" strokeWidth="1.6" strokeLinecap="round" />
      </g>
      <circle cx="158" cy="28" r="3.5" fill="var(--teal-9)" />
      <circle cx="26" cy="44" r="2.5" fill="var(--teal-8)" />
      <circle cx="91" cy="96" r="2.5" fill="var(--indigo-8)" />
    </svg>
  );
}
