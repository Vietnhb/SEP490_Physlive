import s from "./ReviewerOverview.module.css";

/** Animated vertical spring-mass oscillator illustration for the reviewer hero banner. */
export function ReviewerSpringArt() {
  return (
    <svg
      className={s.heroArt}
      viewBox="0 0 132 104"
      fill="none"
      aria-hidden="true"
    >
      {/* Ceiling support bar */}
      <line x1="30" y1="8" x2="86" y2="8" stroke="#64748B" strokeWidth="1.8" strokeLinecap="round" />
      <g stroke="#94A3B8" strokeWidth="1.2" strokeLinecap="round" opacity="0.65">
        <line x1="38" y1="8" x2="42" y2="4" />
        <line x1="48" y1="8" x2="52" y2="4" />
        <line x1="58" y1="8" x2="62" y2="4" />
        <line x1="68" y1="8" x2="72" y2="4" />
        <line x1="78" y1="8" x2="82" y2="4" />
      </g>

      {/* Equilibrium reference line */}
      <line
        x1="22"
        y1="74"
        x2="92"
        y2="74"
        stroke="#94A3B8"
        strokeWidth="1.1"
        strokeDasharray="3 3"
        opacity="0.55"
      />

      {/* Oscillating spring + mass */}
      <g className={s.springOscillate}>
        {/* Vertical coil spring */}
        <path
          d="M58 8 V16 L50 20 L66 26 L50 32 L66 38 L50 44 L66 50 L50 56 L58 60 V64"
          stroke="#475569"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Teal mass block */}
        <rect
          x="45"
          y="64"
          width="26"
          height="22"
          rx="4"
          fill="#1A828C"
        />
        <rect
          x="48"
          y="67"
          width="20"
          height="4"
          rx="2"
          fill="#5CC9D1"
          opacity="0.45"
        />
      </g>

      {/* Amplitude double-headed arrow */}
      <g stroke="#94A3B8" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <line x1="99" y1="52" x2="99" y2="95" />
        <polyline points="96.5,55.5 99,52 101.5,55.5" />
        <polyline points="96.5,91.5 99,95 101.5,91.5" />
      </g>
    </svg>
  );
}
