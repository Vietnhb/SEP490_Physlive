import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import type { LibraryFolder } from "../../../shared/types/physlive";
import { deleteLibraryFolder, renameLibraryFolder } from "../api/libraryApi";
import { teacherLibraryStore } from "../hooks/useTeacherLibrary";
import { getToken } from "../../../shared/lib/token";
import { apiMessage } from "../../../shared/lib/apiError";

const Dots = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" /></svg>;

/** Keeps the shared library store in step, unless the account changed while the request was in flight. */
const commit = (session: string | null, change: (folders: LibraryFolder[]) => LibraryFolder[]) => {
  if (getToken() === session && teacherLibraryStore.getState().session === session)
    teacherLibraryStore.setState(state => ({ folders: change(state.folders) }));
};

/**
 * The "⋯" of a folder row: rename it in place (Enter saves, Esc cancels; the server refuses a name already used) or
 * delete it, which the server allows only for an empty folder — so the menu says so instead of failing.
 */
export default function LibraryFolderMenu({ folder, itemCount, onRenaming }: Readonly<{ folder: LibraryFolder; itemCount: number; onRenaming: (renaming: boolean) => void }>) {
  const [menu, setMenu] = useState<{ top: number; left: number } | null>(null);
  const [mode, setMode] = useState<"" | "rename" | "delete">("");
  const [name, setName] = useState(folder.name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const box = useRef<HTMLSpanElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!menu) return;
    const away = (event: MouseEvent) => { const target = event.target as Node; if (!box.current?.contains(target) && !panel.current?.contains(target)) setMenu(null); };
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") setMenu(null); };
    const close = () => setMenu(null);
    document.addEventListener("mousedown", away); document.addEventListener("keydown", key); addEventListener("scroll", close, true);
    return () => { document.removeEventListener("mousedown", away); document.removeEventListener("keydown", key); removeEventListener("scroll", close, true); };
  }, [menu]);
  useEffect(() => { if (mode === "rename") field.current?.select(); }, [mode]);
  const stop = (event: { preventDefault: () => void; stopPropagation: () => void }) => { event.preventDefault(); event.stopPropagation(); };
  const startRename = () => { setMenu(null); setName(folder.name); setError(""); setMode("rename"); onRenaming(true); };
  const endRename = () => { setMode(""); setError(""); onRenaming(false); };
  const rename = async (event: FormEvent) => {
    stop(event);
    const next = name.trim();
    if (!next || next === folder.name) { endRename(); return; }
    const session = getToken();
    setBusy(true); setError("");
    try {
      const saved = await renameLibraryFolder(folder.id, next);
      commit(session, folders => folders.map(item => item.id === folder.id ? { ...item, ...saved } : item));
      endRename();
    } catch (cause) { setError(apiMessage(cause, "Chưa đổi được tên thư mục.")); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    const session = getToken();
    setBusy(true); setError("");
    try {
      await deleteLibraryFolder(folder.id);
      commit(session, folders => folders.filter(item => item.id !== folder.id));
      setMode("");
    } catch (cause) { setError(apiMessage(cause, "Chưa xóa được thư mục.")); }
    finally { setBusy(false); }
  };

  if (mode === "rename") return <form className="library-folder-rename" onSubmit={event => void rename(event)} onClick={stop}>
    <input ref={field} value={name} maxLength={120} aria-label="Tên thư mục mới" disabled={busy} onChange={event => setName(event.target.value)}
      onKeyDown={event => { if (event.key === "Escape") { stop(event); endRename(); } if (event.key === " ") event.stopPropagation(); }} onBlur={() => { if (!busy && !error) endRename(); }} />
    {error && <span className="library-folder-error" role="alert">{error}</span>}
  </form>;

  return <span ref={box} className="library-folder-actions" onClick={stop}>
    <button type="button" className="library-folder-more" aria-label={`Tùy chọn thư mục ${folder.name}`} aria-haspopup="menu" aria-expanded={Boolean(menu)}
      onClick={event => { const r = event.currentTarget.getBoundingClientRect(); const pane = event.currentTarget.closest(".learn-library-pane")?.getBoundingClientRect(); setMode(""); setError(""); setMenu(value => value ? null : { top: Math.min(r.bottom + 4, innerHeight - 170), left: Math.min(Math.max((pane?.left ?? 0) + 8, r.right - 236), innerWidth - 244) }); }}><Dots /></button>
    {/* rendered into the shell, not inside the folder row: the library pane contains its paint, and a menu inside it
        would be cut at the pane's edge and take the row's styles */}
    {menu && createPortal(<div ref={panel} className="library-folder-menu" role="menu" aria-label={folder.name} style={{ top: menu.top, left: menu.left }} onClick={event => event.stopPropagation()}>
      {mode === "delete" ? <div className="library-folder-confirm" role="alertdialog" aria-label="Xác nhận xóa thư mục">
        <p>Xóa thư mục <b>“{folder.name}”</b>? Không thể hoàn tác.</p>
        {error && <p className="library-folder-error" role="alert">{error}</p>}
        <div><button type="button" onClick={() => setMode("")} disabled={busy}>Hủy</button><button type="button" className="danger" onClick={() => void remove()} disabled={busy}>{busy ? "Đang xóa…" : "Xóa thư mục"}</button></div>
      </div> : <>
        <button type="button" role="menuitem" onClick={startRename}>Đổi tên</button>
        <button type="button" role="menuitem" className="danger" disabled={itemCount > 0} title={itemCount > 0 ? "Chỉ xóa được thư mục trống: hãy chuyển các mô phỏng sang thư mục khác trước" : undefined} onClick={() => setMode("delete")}>Xóa thư mục</button>
        {itemCount > 0 && <p className="library-folder-hint">Chỉ xóa được thư mục trống. Hãy chuyển các mô phỏng sang thư mục khác trước.</p>}
      </>}
    </div>, box.current?.closest(".studio-root") ?? document.body)}
  </span>;
}
