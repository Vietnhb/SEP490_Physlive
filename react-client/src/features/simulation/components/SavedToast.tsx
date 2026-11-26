import { useEffect } from "react";
import { createPortal } from "react-dom";

const LIFETIME = 5000;

/**
 * A short notice that a simulation was saved: it floats over the corner of the screen, says what happened and to which
 * simulation, and leaves by itself after five seconds (or at once with ×). It never pushes the controls below it down.
 */
export default function SavedToast({ message, onClose }: Readonly<{ message: string; onClose: () => void }>) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onClose, LIFETIME);
    return () => window.clearTimeout(timer);
  }, [message, onClose]);
  if (!message) return null;
  // "Đã lưu: <title>" reads as a heading and the simulation it is about
  const [heading, detail] = message.startsWith("Đã lưu: ") ? ["Đã lưu vào thư viện", message.slice("Đã lưu: ".length)] : [message, ""];
  return createPortal(<div className="saved-toast" role="status" aria-live="polite">
    <span className="saved-toast__icon" aria-hidden="true">✓</span>
    <span className="saved-toast__text"><b>{heading}</b>{detail && <small title={detail}>{detail}</small>}</span>
    <button type="button" className="saved-toast__close" aria-label="Đóng thông báo" onClick={onClose}>×</button>
    <span className="saved-toast__timer" aria-hidden="true" style={{ animationDuration: `${LIFETIME}ms` }} />
  </div>, document.body);
}
