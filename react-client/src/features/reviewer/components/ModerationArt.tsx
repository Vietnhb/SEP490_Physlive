import s from "./ContentModeration.module.css";

/** Top-right physics inspection spot illustration for the Moderation header. */
export function ModerationHeaderArt() {
  return (
    <svg className={s.headerArt} viewBox="0 0 148 92" fill="none" aria-hidden="true">
      {/* Soft backdrop wash */}
      <ellipse cx="76" cy="50" rx="58" ry="34" fill="#E6F4F5" opacity="0.72" />
      {/* Inspection board / chart frame */}
      <rect x="26" y="14" width="76" height="58" rx="8" fill="#FFFFFF" stroke="#475569" strokeWidth="1.7" />
      <line x1="36" y1="58" x2="92" y2="58" stroke="#CBD5E1" strokeWidth="1.2" />
      <line x1="36" y1="24" x2="36" y2="58" stroke="#CBD5E1" strokeWidth="1.2" />
      {/* Physics curve inside board */}
      <path
        d="M38 52 C48 26, 62 28, 72 44 C78 53, 85 48, 90 32"
        stroke="#23919A"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="56" cy="33" r="3" fill="#0B3262" />
      <circle cx="78" cy="48" r="3" fill="#23919A" />
      {/* Magnifying glass inspecting the chart */}
      <circle cx="104" cy="48" r="16" fill="#FFFFFF" fillOpacity="0.9" stroke="#0B3262" strokeWidth="2" />
      <circle cx="104" cy="48" r="11" fill="#E6F4F5" />
      <path d="M99 48.5 L102.5 52 L110 44" stroke="#15803D" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="115.5" y1="59.5" x2="127" y2="71" stroke="#0B3262" strokeWidth="3.2" strokeLinecap="round" />
    </svg>
  );
}

type ThumbKind = "pendulum" | "projectile" | "circuit" | "spring" | "atom";

function pickThumbKind(topic?: string, title?: string): ThumbKind {
  const text = `${topic ?? ""} ${title ?? ""}`.toLowerCase();
  if (text.includes("lò xo") || text.includes("lo xo") || text.includes("spring")) return "spring";
  if (text.includes("con lắc") || text.includes("con lac") || text.includes("dao động") || text.includes("pendulum") || text.includes("oscill")) return "pendulum";
  if (text.includes("mạch") || text.includes("điện") || text.includes("ohm") || text.includes("wheatstone") || text.includes("circuit") || text.includes("current")) return "circuit";
  if (text.includes("ném") || text.includes("rơi") || text.includes("chuyển động") || text.includes("động học") || text.includes("kinemat") || text.includes("projectile")) return "projectile";
  return "atom";
}

/** Compact 44x44 physics thumbnail SVG matched to a simulation's topic/title. */
export function SimulationTopicThumb({ topic, title }: Readonly<{ topic?: string; title?: string }>) {
  const kind = pickThumbKind(topic, title);

  if (kind === "pendulum") {
    return (
      <svg className={s.thumbSvg} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <line x1="10" y1="9" x2="38" y2="9" stroke="#1E3A5F" strokeWidth="1.6" strokeLinecap="round" />
        <line x1="24" y1="9" x2="24" y2="35" stroke="#94A3B8" strokeWidth="1.1" strokeDasharray="2.5 2.5" />
        <path d="M15 35 A 26 26 0 0 0 32 34" stroke="#94A3B8" strokeWidth="1.1" strokeDasharray="2.5 2.5" />
        <line x1="24" y1="9" x2="32" y2="33" stroke="#1E3A5F" strokeWidth="1.5" />
        <circle cx="32" cy="34" r="4.5" fill="#23919A" stroke="#1E3A5F" strokeWidth="1.3" />
      </svg>
    );
  }

  if (kind === "projectile") {
    return (
      <svg className={s.thumbSvg} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <line x1="8" y1="38" x2="41" y2="38" stroke="#64748B" strokeWidth="1.3" strokeLinecap="round" />
        <line x1="10" y1="10" x2="10" y2="38" stroke="#CBD5E1" strokeWidth="1.1" />
        <path d="M10 37 Q 24 8 39 37" stroke="#23919A" strokeWidth="1.6" strokeDasharray="3 2.5" />
        <line x1="10" y1="37" x2="19" y2="23" stroke="#5B4BC4" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="24" cy="22" r="3.4" fill="#23919A" stroke="#1E3A5F" strokeWidth="1.2" />
      </svg>
    );
  }

  if (kind === "circuit") {
    return (
      <svg className={s.thumbSvg} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="11" y="13" width="26" height="22" rx="2" stroke="#1E3A5F" strokeWidth="1.4" />
        <rect x="19" y="10" width="10" height="6" rx="1.5" fill="#E6F4F5" stroke="#23919A" strokeWidth="1.3" />
        <circle cx="24" cy="35" r="3.5" fill="#FFFFFF" stroke="#23919A" strokeWidth="1.4" />
        <line x1="8" y1="22" x2="14" y2="22" stroke="#1E3A5F" strokeWidth="1.6" />
        <line x1="9.5" y1="25" x2="12.5" y2="25" stroke="#1E3A5F" strokeWidth="1.6" />
      </svg>
    );
  }

  if (kind === "spring") {
    return (
      <svg className={s.thumbSvg} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <line x1="13" y1="8" x2="35" y2="8" stroke="#1E3A5F" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M24 8 V12 L20 14.5 L28 17.5 L20 20.5 L28 23.5 L20 26.5 L24 29 V31" stroke="#475569" strokeWidth="1.4" strokeLinejoin="round" />
        <rect x="17" y="31" width="14" height="9" rx="2" fill="#23919A" stroke="#1E3A5F" strokeWidth="1.2" />
      </svg>
    );
  }

  return (
    <svg className={s.thumbSvg} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <ellipse cx="24" cy="24" rx="15" ry="6.5" transform="rotate(30 24 24)" stroke="#23919A" strokeWidth="1.4" />
      <ellipse cx="24" cy="24" rx="15" ry="6.5" transform="rotate(-30 24 24)" stroke="#1E3A5F" strokeWidth="1.4" />
      <circle cx="24" cy="24" r="3" fill="#23919A" />
    </svg>
  );
}
