/** One icon of the canvas sprite (StudioSprite), drawn at the current text colour. */
export const StudioIcon = ({ name, style }: { name: string; style?: React.CSSProperties }) =>
  <svg className="icon" aria-hidden="true" style={style}><use href={`#i-${name}`} /></svg>;
