import { useMemo, useState, type FormEvent } from "react";
import type { LibraryFolder, LibraryItem } from "../../../shared/types/physlive";
import Icon from "../../../shared/ui/LearningIcon";
import LibraryFolderView from "./LibraryFolder";
import { useTopicName } from "../../../shared/hooks/useTopicName";

type Props = {
  folders: LibraryFolder[];
  items: LibraryItem[];
  currentSimulationId: string;
  loading: boolean;
  error: string;
  openingId: string | null;
  onCreateFolder: (name: string) => Promise<boolean>;
  onOpen: (item: LibraryItem) => Promise<void>;
  onNewSimulation?: () => void;
  onRetry?: () => void;
  /** The pane can fold to a narrow rail; its own buttons fold and unfold it. */
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
};

export default function TeacherLibraryPane({ folders, items, currentSimulationId, loading, error, openingId, onCreateFolder, onOpen, onNewSimulation, onRetry, collapsed = false, onToggleCollapsed }: Readonly<Props>) {
  const [creating, setCreating] = useState(false);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const topicName = useTopicName();
  const normalizedQuery = query.trim().toLocaleLowerCase("vi");
  const visibleItems = useMemo(() => normalizedQuery
    ? items.filter(item => `${item.title} ${topicName(item.topic)}`.toLocaleLowerCase("vi").includes(normalizedQuery))
    : items, [items, normalizedQuery, topicName]);
  const grouped = useMemo(() => new Map(folders.map(folder => [folder.id, visibleItems.filter(item => item.folderId === folder.id)])), [folders, visibleItems]);
  const unassignedItems = useMemo(() => visibleItems.filter(item => !item.folderId), [visibleItems]);
  const visibleFolders = useMemo(() => normalizedQuery
    ? folders.filter(folder => folder.name.toLocaleLowerCase("vi").includes(normalizedQuery) || (grouped.get(folder.id)?.length ?? 0) > 0)
    : folders, [folders, grouped, normalizedQuery]);

  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || creating) return;
    setCreating(true);
    try {
      if (await onCreateFolder(name.trim())) {
        setName("");
        setCreatorOpen(false);
      }
    } finally {
      setCreating(false);
    }
  };

  return <aside className="learn-library-pane" aria-label="Thư mục mô phỏng cá nhân">
    {collapsed && onToggleCollapsed && <div className="learn-library-rail">
      <button type="button" className="learn-library-fold" aria-label="Mở thư viện" title="Mở thư viện" onClick={onToggleCollapsed}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg></button>
      {onNewSimulation && <button type="button" className="learn-library-fold" aria-label="Mô phỏng mới" title="Mô phỏng mới" onClick={onNewSimulation}><Icon name="plus" /></button>}
    </div>}
    <div className="learn-library-pane-header">
      <div className="learn-library-heading"><div><span>Thư viện của tôi</span><strong>{loading ? "Đang tải…" : `${folders.length} thư mục · ${items.length} mô phỏng`}</strong></div>
        {onToggleCollapsed && <button type="button" className="learn-library-fold" aria-label="Thu gọn thư viện" title="Thu gọn thư viện" onClick={onToggleCollapsed}><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m15 18-6-6 6-6" /></svg></button>}</div>
      <div className="learn-library-actions">
        {onNewSimulation && <button type="button" className="learn-new-simulation" onClick={onNewSimulation}><Icon name="plus" />Mô phỏng mới</button>}
        <button className="learn-new-folder-trigger" type="button" aria-label="Thư mục mới" title="Thư mục mới" aria-expanded={creatorOpen} aria-controls="new-library-folder-form" onClick={() => setCreatorOpen(value => !value)}><Icon name="folderPlus" /></button>
      </div>
      <label className="learn-library-search"><Icon name="search" /><span className="learn-sr-only">Tìm trong thư viện</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Tìm trong thư viện" /></label>
      {creatorOpen && <form id="new-library-folder-form" className="learn-folder-popover" onSubmit={create}>
        <label htmlFor="new-library-folder">Tạo thư mục mới</label>
        <input id="new-library-folder" value={name} maxLength={120} onChange={event => setName(event.target.value)} placeholder="Ví dụ: Chuyển động lớp 10" disabled={creating} />
        <div><button type="button" onClick={() => { setCreatorOpen(false); setName(""); }} disabled={creating}>Hủy</button><button className="primary" type="submit" disabled={!name.trim() || creating}>{creating ? "Đang tạo…" : "Tạo thư mục"}</button></div>
      </form>}
    </div>
    <div className="learn-library-tree">
      {loading && <div className="learn-library-skeleton" role="status" aria-label="Đang tải thư viện">
        {[78, 60, 70, 52, 66].map((width, index) => <span className="skeleton skeleton-line" key={index} style={{ width: `${width}%` }} />)}
      </div>}
      {!loading && error && <div className="learn-library-state error" role="alert">{error} {onRetry && <button type="button" onClick={onRetry}>Thử lại</button>}</div>}
      {!loading && !error && folders.length === 0 && <div className="learn-library-empty"><strong>Chưa có thư mục</strong><p>Tạo thư mục để lưu và tổ chức các mô phỏng đã kiểm chứng.</p></div>}
      {visibleFolders.map(folder => <LibraryFolderView
        key={folder.id}
        folder={folder}
        items={grouped.get(folder.id) ?? []}
        folders={folders}
        currentSimulationId={currentSimulationId}
        openingId={openingId}
        onOpen={onOpen}
      />)}
      {unassignedItems.length > 0 && <LibraryFolderView
        folder={null}
        items={unassignedItems}
        folders={folders}
        currentSimulationId={currentSimulationId}
        openingId={openingId}
        onOpen={onOpen}
      />}
      {!loading && !error && normalizedQuery && visibleFolders.length === 0 && unassignedItems.length === 0 && <p className="learn-library-state">Không tìm thấy thư mục hoặc mô phỏng phù hợp.</p>}
    </div>
  </aside>;
}