export type GlyphKind = "projectile" | "pendulum" | "braking" | "circuit";

/** Small line drawings of the situation itself, so an example reads as physics at a glance instead of a generic symbol. */
export function PhysicsGlyph({ kind }: Readonly<{ kind: GlyphKind }>) {
  return <svg className="physics-glyph" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === "projectile" && <>
      <path d="M2.5 20.5h19" />
      <path d="M3 20.5V7h3" />
      <path d="M8 7c4.6 0 8.6 3.6 10.5 12.5" strokeDasharray="1.4 2.4" />
      <circle cx="7" cy="7" r="1.9" fill="currentColor" stroke="none" />
      <path d="M9.6 4.2h4.6m-1.6-1.6 1.6 1.6-1.6 1.6" />
    </>}
    {kind === "pendulum" && <>
      <path d="M3 3.5h18" />
      <path d="M7 3.5 4.6 14.4M12 3.5v11.2M17 3.5l2.4 10.9" />
      <circle cx="4.3" cy="16" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16.6" r="1.9" fill="currentColor" stroke="none" />
      <circle cx="19.7" cy="16" r="1.9" fill="currentColor" stroke="none" />
      <path d="M4 20.3c4.8 1.6 11.2 1.6 16 0" strokeDasharray="1.2 2.2" />
    </>}
    {kind === "braking" && <>
      <path d="M8 16.5h12.5v-3.2l-2.6-3.6H11.4L8.6 13.2H8z" />
      <circle cx="11" cy="17" r="1.7" fill="currentColor" stroke="none" />
      <circle cx="18" cy="17" r="1.7" fill="currentColor" stroke="none" />
      <path d="M1.5 11h4M2.5 14h3M3.5 17h2" />
      <path d="M1.5 21h21" />
    </>}
    {kind === "circuit" && <>
      <path d="M10.6 6H4v12h3l1.1-2.2 2.2 4.4 2.2-4.4 2.2 4.4 2.2-4.4L18 18h2V6h-6.6" />
      <path d="M10.6 3v6M13.4 4.6v2.8" />
    </>}
  </svg>;
}

/**
 * The entry picture: a horizontal throw drawn like the multi-exposure photographs in a physics textbook —
 * graph paper, the ledge, the ball at equal time steps, and the velocity it was thrown with.
 */
export function ThrowIllustration() {
  const steps = [0, 1, 2, 3, 4, 5];
  // x grows evenly, y with the square of time: the same parabola the simulation draws
  const point = (step: number) => ({ x: 38 + step * 19, y: 22 + step * step * 3.4 });
  return <svg className="throw-illustration" viewBox="0 0 168 120" aria-hidden="true">
    <defs>
      <pattern id="throw-grid" width="12" height="12" patternUnits="userSpaceOnUse"><path d="M12 0H0v12" fill="none" stroke="currentColor" strokeWidth=".6" /></pattern>
    </defs>
    <rect className="throw-paper" x="0.5" y="0.5" width="167" height="119" rx="14" />
    <rect className="throw-grid" x="0.5" y="0.5" width="167" height="119" rx="14" fill="url(#throw-grid)" />
    <path className="throw-ground" d="M10 108h148" />
    <path className="throw-ledge" d="M14 108V24h20" />
    <path className="throw-path" d={`M${point(0).x} ${point(0).y}` + steps.slice(1).map(step => ` L${point(step).x} ${point(step).y}`).join("")} />
    {steps.map(step => <g key={step}>
      <path className="throw-drop" d={`M${point(step).x} ${point(step).y + 6}V108`} />
      <circle className="throw-ball" cx={point(step).x} cy={point(step).y} r="4.6" style={{ opacity: step === 0 ? 1 : 0.32 + step * 0.11 }} />
    </g>)}
    <path className="throw-vector" d="M44 22h24m-5-4.5 5 4.5-5 4.5" />
    <text className="throw-label" x="72" y="17">v<tspan dy="3" fontSize="8">0</tspan></text>
  </svg>;
}
