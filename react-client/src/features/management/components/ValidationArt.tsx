export default function ValidationArt() {
  return (
    <svg width="152" height="96" viewBox="0 0 180 112" fill="none" aria-hidden="true">
      <ellipse cx="92" cy="64" rx="68" ry="34" fill="var(--teal-3)" />
      <ellipse cx="90" cy="34" rx="62" ry="15" stroke="var(--teal-7)" strokeDasharray="2 4" transform="rotate(-6 90 34)" />
      {/* Balance scale stand */}
      <g stroke="var(--indigo-9)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M90 22v68M68 90h44M78 90l12-8 12 8" />
        <path d="M48 36h84" strokeWidth="1.7" />
        {/* Left pan */}
        <path d="M48 36 37 64h22L48 36Z" strokeWidth="1.2" />
        <path d="M35 64c2 6 8 9 13 9s11-3 13-9H35Z" fill="var(--color-panel-solid)" />
        {/* Right pan */}
        <path d="M132 36l-11 28h22l-11-28Z" strokeWidth="1.2" />
        <path d="M119 64c2 6 8 9 13 9s11-3 13-9h-26Z" fill="var(--color-panel-solid)" />
      </g>
      {/* Check badge on left pan */}
      <circle cx="48" cy="54" r="6.5" fill="var(--teal-9)" />
      <path d="m45.2 54.2 1.8 1.8 3.6-3.8" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Weight block on right pan */}
      <rect x="126" y="48" width="12" height="12" rx="2.5" fill="var(--teal-8)" stroke="var(--indigo-9)" strokeWidth="1.2" />
      {/* Top pivot & accents */}
      <circle cx="90" cy="22" r="3.5" fill="var(--teal-9)" />
      <circle cx="156" cy="32" r="2.8" fill="var(--teal-8)" />
      <circle cx="28" cy="48" r="2.5" fill="var(--indigo-8)" />
    </svg>
  );
}
