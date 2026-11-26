import { useMemo, useState, type ReactNode } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge, Button, Card, Heading, Text } from "@radix-ui/themes";
import api from "../../../shared/api/client";
import { apiKey, queryClient } from "../../../shared/api/queryClient";
import { LoadState } from "../../../shared/ui/OperationsKit";
import RowActions from "../../../shared/ui/RowActions";
import { useAction, useResource } from "../../../shared/hooks/operationsData";
import { VersionEditorModal, type VersionSaveOutcome } from "./VersionEditorModal";
import { ReviewerDialog } from "./ReviewerDialog";
import type { Version } from "../model/reviewerTypes";
import { formatDate, matches, reviewerStatusLabel, timeAgo } from "../model/reviewerUtils";
import { ReviewStatus } from "./ReviewerKit";
import { objectRows } from "../model/jsonRows";
import { LawBook } from "./LawCatalogueEditor";
import { TopicsArt } from "./TopicsArt";
import s from "./TopicsWorkspace.module.css";

type Lifecycle = "DRAFT" | "APPROVED" | "RETIRED";
type OpenGap = { id?: string; kind: "UNCHECKED" | "NO_ROLE" | "AMBIGUOUS" | "VIOLATION" | "COMPLAINT"; topic?: string; schemaId?: string; role?: string; occurrences: number };

const ORDER = ["DRAFT", "APPROVED", "RETIRED"];
const number = (value: number) => value.toLocaleString("vi-VN");
const gradeOf = (version: Version) => {
  const grade = (version.definition as { grade?: unknown } | undefined)?.grade;
  return grade ? `Lớp ${String(grade)}` : "";
};

const GAP_KIND_LABEL: Record<OpenGap["kind"], string> = {
  UNCHECKED: "Vai trò chưa có định luật kiểm",
  NO_ROLE: "Đại lượng chưa có vai trò",
  AMBIGUOUS: "Không xác định được đại lượng",
  VIOLATION: "Định luật bác bỏ mô phỏng",
  COMPLAINT: "Báo lỗi từ khiếu nại giáo viên",
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function statsOfVersion(version: Version) {
  const def = asRecord(version.definition);
  const cat = asRecord(def.lawCatalogue);
  const laws = Array.isArray(cat.laws) ? cat.laws.length : 0;
  const roles = Object.keys(asRecord(cat.roles)).length;
  const objects = Array.isArray(def.objectTypes) ? def.objectTypes.length : 0;
  const quantities = Array.isArray(def.quantityDefinitions) ? def.quantityDefinitions.length : 0;
  const capabilities = Array.isArray(def.capabilities) ? def.capabilities.length : 0;
  return { laws, roles: Math.max(roles, quantities), objects, capabilities };
}

function LifecyclePill({ status }: Readonly<{ status: string }>) {
  if (status === "APPROVED") {
    return (
      <span className={`${s.statusPill} ${s.stApproved}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" /><path d="m8.4 12.4 2.5 2.5 4.9-5.3" />
        </svg>
        Đang dùng
      </span>
    );
  }
  if (status === "DRAFT") {
    return (
      <span className={`${s.statusPill} ${s.stDraft}`}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10.3 4.1 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.1a2 2 0 0 0-3.4 0z" />
          <path d="M12 9.5v4M12 17h.01" />
        </svg>
        Bản nháp
      </span>
    );
  }
  return (
    <span className={`${s.statusPill} ${s.stRetired}`}>
      Ngừng dùng
    </span>
  );
}

export function VersionsTab() {
  const [searchParams, setSearchParams] = useSearchParams();
  const resource = useResource<Version[]>("/reviewer/schemas");
  const gapsResource = useResource<OpenGap[]>("/reviewer/law-gaps?status=OPEN");
  const action = useAction();
  const [filter, setFilter] = useState<"ALL" | Lifecycle>("APPROVED");
  const [query, setQuery] = useState(() => searchParams.get("topic") ?? "");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<Version | null>(null);
  const [editor, setEditor] = useState<{ version?: Version; clone: boolean } | null>(null);
  const [decision, setDecision] = useState<{ version: Version; status: "APPROVED" | "RETIRED" | "DELETE" } | null>(null);

  const all = useMemo(() => resource.data ?? [], [resource.data]);
  const openGaps = useMemo(() => gapsResource.data ?? [], [gapsResource.data]);

  const deepSchemaId = searchParams.get("schemaId");
  const deepTarget = useMemo(() => {
    if (!deepSchemaId || all.length === 0) return null;
    const candidates = all.filter(item => item.schemaId.toLowerCase() === deepSchemaId.toLowerCase());
    return candidates.find(item => item.lifecycleStatus === "APPROVED")
      ?? candidates.find(item => item.lifecycleStatus === "DRAFT")
      ?? candidates[0]
      ?? null;
  }, [deepSchemaId, all]);
  const activeSelected = selected ?? deepTarget;

  const clearSelection = () => {
    setSelected(null);
    if (searchParams.has("schemaId") || searchParams.has("topic")) {
      const next = new URLSearchParams(searchParams);
      next.delete("schemaId");
      next.delete("topic");
      setSearchParams(next, { replace: true });
    }
  };

  const count = (status: Lifecycle) => all.filter(version => version.lifecycleStatus === status).length;
  const approvedVersions = useMemo(() => all.filter(v => v.lifecycleStatus === "APPROVED"), [all]);
  const draftVersions = useMemo(() => all.filter(v => v.lifecycleStatus === "DRAFT"), [all]);
  const retiredCount = count("RETIRED");

  // Aggregate real physics structure counts across all APPROVED versions
  const structure = useMemo(() => {
    return approvedVersions.reduce(
      (acc, v) => {
        const st = statsOfVersion(v);
        acc.objects += st.objects;
        acc.roles += st.roles;
        acc.laws += st.laws;
        acc.capabilities += st.capabilities;
        return acc;
      },
      { objects: 0, roles: 0, laws: 0, capabilities: 0 },
    );
  }, [approvedVersions]);

  // Top 5 approved topics by laws + roles density
  const topTopics = useMemo(() => {
    const items = approvedVersions
      .map(v => {
        const st = statsOfVersion(v);
        return {
          id: v.id,
          name: v.name || v.schemaId,
          score: st.laws + st.roles,
          laws: st.laws,
        };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);
    const max = Math.max(1, ...items.map(i => i.score));
    return items.map(item => ({ ...item, pct: Math.round((item.score / max) * 100) }));
  }, [approvedVersions]);

  // Spotlight draft (or latest approved topic) for "Kiểm thử bản nháp" & "Lịch sử phiên bản"
  const spotlight = draftVersions[0] ?? approvedVersions[0] ?? all[0];
  const spotlightFamily = useMemo(() => {
    if (!spotlight) return [];
    return all
      .filter(v => v.schemaId.toLowerCase() === spotlight.schemaId.toLowerCase())
      .sort((a, b) => Date.parse(b.createdAt ?? "") - Date.parse(a.createdAt ?? ""));
  }, [all, spotlight]);

  const spotlightGaps = useMemo(() => {
    if (!spotlight) return [];
    const matched = openGaps.filter(g =>
      (g.schemaId && g.schemaId.toLowerCase() === spotlight.schemaId.toLowerCase())
      || (g.topic && spotlight.topic && g.topic.toLowerCase() === spotlight.topic.toLowerCase()),
    );
    const list = (matched.length > 0 ? matched : openGaps).slice(0, 3);
    const draftRoles = new Set(Object.keys(asRecord(asRecord(asRecord(spotlight.definition).lawCatalogue).roles)).map(k => k.toLowerCase()));
    return list.map((g, idx) => ({
      key: g.id ?? `${g.kind}-${idx}`,
      label: GAP_KIND_LABEL[g.kind] ?? g.kind,
      occurrences: g.occurrences,
      covered: Boolean(g.role && draftRoles.has(g.role.toLowerCase())),
    }));
  }, [spotlight, openGaps]);

  const rows = useMemo(
    () => all
      .filter(version => (filter === "ALL" || version.lifecycleStatus === filter) && matches(query, version.schemaId, version.name, version.topic, version.version))
      .sort((a, b) => ORDER.indexOf(a.lifecycleStatus) - ORDER.indexOf(b.lifecycleStatus)),
    [all, filter, query],
  );

  const sharedCatalogue = useMemo(() => {
    const roles: Record<string, unknown> = {};
    const kinds: Record<string, unknown> = {};
    const forceKinds: Record<string, unknown> = {};
    all.forEach(version => {
      const cat = asRecord(asRecord(version.definition).lawCatalogue);
      Object.entries(asRecord(cat.roles)).forEach(([k, v]) => { if (!(k in roles)) roles[k] = v; });
      Object.entries(asRecord(cat.kinds)).forEach(([k, v]) => { if (!(k in kinds)) kinds[k] = v; });
      Object.entries(asRecord(cat.forceKinds)).forEach(([k, v]) => { if (!(k in forceKinds)) forceKinds[k] = v; });
    });
    return { roles, kinds, forceKinds };
  }, [all]);

  const totalPages = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const currentPage = Math.min(page, totalPages);
  const visibleRows = pageSize > 0 ? rows.slice((currentPage - 1) * pageSize, currentPage * pageSize) : rows;
  const currentApprovedFor = (target?: Version) =>
    target ? all.find(item => item.id !== target.id && item.schemaId.toLowerCase() === target.schemaId.toLowerCase() && item.lifecycleStatus === "APPROVED") : undefined;

  const changeLifecycle = async () => {
    if (!decision) return;
    const targetId = decision.version.id;
    const isDelete = decision.status === "DELETE";
    let updatedVersion: Version | undefined;
    const ok = await action.run(
      async () => {
        if (isDelete) {
          await api.delete(`/reviewer/schema-versions/${targetId}`);
        } else {
          const response = await api.put<Version>(`/reviewer/schema-versions/${targetId}/lifecycle`, null, { params: { status: decision.status } });
          updatedVersion = response.data;
        }
      },
      isDelete ? "Đã xoá bản nháp." : decision.status === "APPROVED" ? "Đã phê duyệt phiên bản mới. Phiên bản cũ cùng chủ đề đã được chuyển sang ngừng dùng." : "Đã ngừng sử dụng phiên bản.",
    );
    if (ok) {
      if (isDelete) {
        resource.setData(prev => (prev ?? []).filter(item => item.id !== targetId));
        if (activeSelected?.id === targetId) clearSelection();
      } else if (updatedVersion) {
        const nextVersion = updatedVersion;
        resource.setData(prev => (prev ?? []).map(item => item.id === targetId ? nextVersion : decision.status === "APPROVED" && item.schemaId.toLowerCase() === nextVersion.schemaId.toLowerCase() && item.lifecycleStatus === "APPROVED" ? { ...item, lifecycleStatus: "RETIRED" } : item));
        if (activeSelected?.id === targetId) setSelected(nextVersion);
      }
      setDecision(null);
      void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/schemas/summary") });
      void queryClient.invalidateQueries({ queryKey: apiKey(`/reviewer/schema-versions/${targetId}/history`) });
      void resource.refresh();
    }
  };

  const handleEditorSaved = (outcome?: VersionSaveOutcome) => {
    if (outcome?.deletedId) {
      resource.setData(prev => (prev ?? []).filter(item => item.id !== outcome.deletedId));
    } else if (outcome?.saved) {
      const saved = outcome.saved;
      resource.setData(prev => {
        const list = prev ?? [];
        return list.some(item => item.id === saved.id)
          ? list.map(item => item.id === saved.id ? saved : item)
          : [saved, ...list];
      });
    }
    setEditor(null);
    void queryClient.invalidateQueries({ queryKey: apiKey("/reviewer/schemas/summary") });
    if (outcome?.saved?.id) {
      void queryClient.invalidateQueries({ queryKey: apiKey(`/reviewer/schema-versions/${outcome.saved.id}/history`) });
    }
    void resource.refresh();
  };

  if (editor) {
    return <VersionEditorModal initial={editor.version} clone={editor.clone} sharedCatalogue={sharedCatalogue} onClose={() => setEditor(null)} onSaved={handleEditorSaved} />;
  }

  if (activeSelected) {
    return (
      <>
        <VersionDetail
          version={activeSelected}
          sharedCatalogue={sharedCatalogue}
          onClose={clearSelection}
          onEdit={() => { setEditor({ version: activeSelected, clone: activeSelected.lifecycleStatus !== "DRAFT" }); clearSelection(); }}
          onApprove={activeSelected.lifecycleStatus === "DRAFT" ? () => setDecision({ version: activeSelected, status: "APPROVED" }) : undefined}
          onDelete={activeSelected.lifecycleStatus === "DRAFT" ? () => setDecision({ version: activeSelected, status: "DELETE" }) : undefined}
        />
        {decision && <DecisionDialog decision={decision} previousApproved={currentApprovedFor(decision.version)} busy={action.busy} feedback={action.feedback} onClose={() => setDecision(null)} onConfirm={() => void changeLifecycle()} />}
      </>
    );
  }

  const coveredCount = spotlightGaps.filter(g => g.covered).length;

  return (
    <div className={s.page}>
      {/* Page Header */}
      <header className={s.heading}>
        <div className={s.headingCopy}>
          <h1 className={s.title}>Chủ đề vật lý</h1>
          <p className={s.sub}>Đối tượng, đại lượng và định luật của từng chủ đề. Bản đã duyệt không sửa được, hãy tạo phiên bản mới.</p>
        </div>
        <div className={s.headingRight}>
          <button type="button" className={s.primaryBtn} onClick={() => setEditor({ clone: false })}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Thêm chủ đề
          </button>
          <TopicsArt />
        </div>
      </header>

      {/* 4 Tinted KPI Cards */}
      <section className={s.stats} aria-label="Chỉ số chủ đề vật lý">
        <article className={`${s.stat} ${s.statLav}`}>
          <span className={`${s.statIcon} ${s.icPlum}`} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" />
            </svg>
          </span>
          <span className={s.statLabel}>Chủ đề đang dùng</span>
          <strong className={s.statVal}>{number(approvedVersions.length)}</strong>
          <span className={s.statHint}>{number(retiredCount)} đã ngừng dùng</span>
        </article>

        <article className={`${s.stat} ${s.statLav}`}>
          <span className={`${s.statIcon} ${s.icPlum}`} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" />
            </svg>
          </span>
          <span className={s.statLabel}>Bản nháp</span>
          <strong className={s.statVal}>{number(draftVersions.length)}</strong>
          <span className={s.statHint}>Chờ phê duyệt</span>
        </article>

        <article className={`${s.stat} ${s.statLav}`}>
          <span className={`${s.statIcon} ${s.icPlum}`} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" />
            </svg>
          </span>
          <span className={s.statLabel}>Định luật</span>
          <strong className={s.statVal}>{number(structure.laws)}</strong>
          <span className={s.statHint}>Trong {number(approvedVersions.length)} chủ đề đang dùng</span>
          <svg className={s.spark} viewBox="0 0 120 28" preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="topicsSparkGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#23919A" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#23919A" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 24 C20 21, 45 18, 70 15 C92 12, 108 8, 120 5 L120 28 L0 28 Z" fill="url(#topicsSparkGrad)" />
            <path d="M0 24 C20 21, 45 18, 70 15 C92 12, 108 8, 120 5" fill="none" stroke="#23919A" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </article>

        <article className={`${s.stat} ${s.statMint}`}>
          <span className={`${s.statIcon} ${s.icTeal}`} aria-hidden="true">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="1" />
              <path d="M20.2 20.2c2-2 0-7.4-4.5-11.9S5.8 1.8 3.8 3.8s0 7.4 4.5 11.9 9.9 6.5 11.9 4.5z" />
              <path d="M15.7 15.7c4.5-4.5 6.5-9.9 4.5-11.9s-7.4 0-11.9 4.5-6.5 9.9-4.5 11.9 7.4 0 11.9-4.5z" />
            </svg>
          </span>
          <span className={s.statLabel}>Đại lượng & vai trò</span>
          <strong className={s.statVal}>{number(structure.roles)}</strong>
          <span className={s.statHint}>{number(structure.objects)} đối tượng vật lý</span>
        </article>
      </section>

      {/* Main 2-Column Split */}
      <div className={s.split}>
        {/* Left Main Column */}
        <div className={s.mainCol}>
          <section className={s.card} aria-label="Danh sách chủ đề">
            <div className={s.toolbar}>
              <div className={s.seg} role="group" aria-label="Lọc trạng thái">
                <button type="button" className={s.segItem} aria-pressed={filter === "DRAFT"} onClick={() => { setFilter("DRAFT"); setPage(1); }}>
                  Bản nháp ({draftVersions.length})
                </button>
                <button type="button" className={s.segItem} aria-pressed={filter === "APPROVED"} onClick={() => { setFilter("APPROVED"); setPage(1); }}>
                  Đang dùng ({approvedVersions.length})
                </button>
                <button type="button" className={s.segItem} aria-pressed={filter === "RETIRED"} onClick={() => { setFilter("RETIRED"); setPage(1); }}>
                  Ngừng dùng ({retiredCount})
                </button>
                <button type="button" className={s.segItem} aria-pressed={filter === "ALL"} onClick={() => { setFilter("ALL"); setPage(1); }}>
                  Tất cả ({all.length})
                </button>
              </div>

              <div className={s.searchWrap}>
                <svg className={s.searchIcon} width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" />
                </svg>
                <input
                  type="search"
                  className={s.searchInput}
                  aria-label="Tìm chủ đề"
                  placeholder="Tìm tên hoặc mã chủ đề"
                  value={query}
                  onChange={event => { setQuery(event.target.value); setPage(1); }}
                />
              </div>

              <button
                type="button"
                className={s.iconBtn}
                onClick={() => void resource.refresh()}
                disabled={resource.refreshing}
                aria-label="Làm mới danh sách chủ đề"
                title="Làm mới"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={resource.refreshing ? s.spin : undefined} aria-hidden="true">
                  <path d="M21 12a9 9 0 1 1-2.64-6.36" /><polyline points="21 3 21 9 15 9" />
                </svg>
              </button>
            </div>

            <LoadState {...resource} headers={["Chủ đề", "Phiên bản", "Trạng thái", "Thao tác"]} />
            {action.feedback}

            {!resource.loading && (
              <>
                <div className={s.scroll}>
                  <table className={s.table}>
                    <thead>
                      <tr>
                        <th>Chủ đề</th>
                        <th>Phiên bản</th>
                        <th>Trạng thái</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map(version => {
                        const grade = gradeOf(version);
                        return (
                          <tr key={version.id}>
                            <td>
                              <button type="button" className={s.topicLink} onClick={() => setSelected(version)}>
                                {version.name || version.schemaId}
                              </button>
                              <span className={s.codeMono}>
                                {version.schemaId}{grade ? ` · ${grade}` : ""}
                              </span>
                            </td>
                            <td>
                              <span className={s.verMono}>v{version.version}</span>
                              {version.createdAt && <span className={s.dateSmall}>{formatDate(version.createdAt)}</span>}
                            </td>
                            <td>
                              <LifecyclePill status={version.lifecycleStatus} />
                            </td>
                            <td className={s.actionsCell}>
                              <div className={s.actionsWrap}>
                                {version.lifecycleStatus === "APPROVED" && (
                                  <button type="button" className={s.surfaceBtn} onClick={() => setEditor({ version, clone: true })}>
                                    Tạo phiên bản mới
                                  </button>
                                )}
                                {version.lifecycleStatus === "DRAFT" && (
                                  <button type="button" className={s.surfaceBtn} onClick={() => setEditor({ version, clone: false })}>
                                    Sửa bản nháp
                                  </button>
                                )}
                                {version.lifecycleStatus === "RETIRED" && (
                                  <button type="button" className={s.surfaceBtn} onClick={() => setEditor({ version, clone: true })}>
                                    Nhân bản
                                  </button>
                                )}
                                <RowActions
                                  subject={version.name || version.schemaId}
                                  actions={[
                                    { label: "Xem chi tiết", onSelect: () => setSelected(version) },
                                    ...(version.lifecycleStatus === "DRAFT" ? [
                                      { label: "Phê duyệt", onSelect: () => setDecision({ version, status: "APPROVED" }) },
                                      { label: "Xoá bản nháp", danger: true, onSelect: () => setDecision({ version, status: "DELETE" }) },
                                    ] : []),
                                    ...(version.lifecycleStatus === "APPROVED" ? [
                                      { label: "Ngừng dùng", danger: true, onSelect: () => setDecision({ version, status: "RETIRED" }) },
                                    ] : []),
                                  ]}
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!resource.error && rows.length === 0 && (
                    <p className={s.empty}>
                      {query || filter !== "ALL" ? "Không có chủ đề phù hợp." : "Chưa có chủ đề nào. Bấm “Thêm chủ đề” để bắt đầu."}
                    </p>
                  )}
                </div>

                <footer className={s.pager}>
                  <span>
                    Hiển thị {rows.length ? (currentPage - 1) * pageSize + 1 : 0}–{Math.min(currentPage * pageSize, rows.length)} / {rows.length} chủ đề
                  </span>
                  <div className={s.pagerActions}>
                    <select
                      className={s.selectSm}
                      aria-label="Số dòng mỗi trang"
                      value={String(pageSize)}
                      onChange={event => { setPageSize(Number(event.target.value)); setPage(1); }}
                    >
                      {[5, 10, 20].map(val => <option key={val} value={val}>Số dòng mỗi trang {val}</option>)}
                    </select>
                    <button type="button" className={s.surfaceBtn} disabled={currentPage <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                      ← Trước
                    </button>
                    <button type="button" className={s.surfaceBtn} disabled={currentPage >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>
                      Sau →
                    </button>
                  </div>
                </footer>
              </>
            )}
          </section>

          {/* Bottom Sub-Split: Draft Test & Version History */}
          {spotlight && (
            <div className={s.subSplit}>
              <section className={s.card}>
                <div className={s.cardHead}>
                  <h2 className={s.cardTitle}>Kiểm thử bản nháp</h2>
                  <LifecyclePill status={spotlight.lifecycleStatus === "DRAFT" ? "APPROVED" : spotlight.lifecycleStatus} />
                </div>
                <div className={s.cardBody}>
                  <p className={s.draftIntro}>
                    <b>{spotlight.name || spotlight.schemaId} v{spotlight.version}</b>{" "}
                    {spotlight.lifecycleStatus === "DRAFT"
                      ? "chưa phát hành. Đối chiếu với các mục định luật đang mở:"
                      : "đang áp dụng. Tình trạng các mục định luật đang mở:"}
                  </p>
                  {spotlightGaps.length > 0 ? (
                    <>
                      <ul className={s.shareList}>
                        {spotlightGaps.map(item => (
                          <li key={item.key}>
                            <span className={`${s.sq} ${item.covered ? s.sqOk : s.sqMuted}`} />
                            <span>
                              <b>{item.label}</b>
                              <small>Gặp {number(item.occurrences)} lần</small>
                            </span>
                            <span className={item.covered ? s.pctOk : s.pctMuted}>
                              {item.covered ? "Đã phủ" : "Chưa phủ"}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <p className={s.cardHint}>
                        Phủ {coveredCount}/{spotlightGaps.length} mục đang mở.
                        {spotlight.lifecycleStatus === "DRAFT" ? " Phê duyệt bản nháp sẽ tự động ngừng dùng bản cũ." : ""}
                      </p>
                    </>
                  ) : (
                    <p className={s.cardHint}>
                      Hiện không có mục định luật nào đang mở cho chủ đề này ({statsOfVersion(spotlight).laws} định luật, {statsOfVersion(spotlight).roles} đại lượng).
                    </p>
                  )}
                </div>
              </section>

              <section className={s.card}>
                <div className={s.cardHead}>
                  <h2 className={s.cardTitle}>Lịch sử phiên bản</h2>
                  <span className={s.cardMuted}>{spotlight.name || spotlight.schemaId}</span>
                </div>
                <div className={s.cardBody}>
                  <ul className={s.timeline}>
                    {spotlightFamily.slice(0, 4).map(ver => {
                      const dotColor = ver.lifecycleStatus === "DRAFT"
                        ? "#1D4ED8"
                        : ver.lifecycleStatus === "APPROVED"
                          ? "#15803D"
                          : "#6B6B73";
                      const verb = ver.lifecycleStatus === "DRAFT"
                        ? `Tạo bản nháp v${ver.version}`
                        : ver.lifecycleStatus === "APPROVED"
                          ? `Phê duyệt v${ver.version}`
                          : `v${ver.version} ngừng dùng`;
                      return (
                        <li key={ver.id} style={{ ["--dot" as string]: dotColor }}>
                          <b>{verb}</b>
                          <small>{ver.createdAt ? formatDate(ver.createdAt) : "Đã lưu trong hệ thống"}</small>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Right Insight Column */}
        <aside className={s.asideCol}>
          <section className={s.card}>
            <div className={s.cardHead}>
              <h2 className={s.cardTitle}>Cấu trúc một chủ đề</h2>
              <span className={s.cardMuted}>Bản đang dùng</span>
            </div>
            <div className={s.cardBody}>
              <div className={s.flow}>
                <div className={`${s.fnode} ${s.fnodeOn}`}>
                  <span className={`${s.fnodeIc} ${s.icBgTeal}`} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="1" />
                      <path d="M20.2 20.2c2-2 0-7.4-4.5-11.9S5.8 1.8 3.8 3.8s0 7.4 4.5 11.9 9.9 6.5 11.9 4.5z" />
                      <path d="M15.7 15.7c4.5-4.5 6.5-9.9 4.5-11.9s-7.4 0-11.9 4.5-6.5 9.9-4.5 11.9 7.4 0 11.9-4.5z" />
                    </svg>
                  </span>
                  <span className={s.fnodeText}>
                    <b>Chủ đề</b>
                    <small>{approvedVersions[0]?.name || "Ví dụ: Chuyển động ném"}</small>
                  </span>
                  <span className={s.fnodeNum}>{number(approvedVersions.length)}</span>
                </div>

                <span className={s.edge} aria-hidden="true"><i style={{ animationDelay: "0.3s" }} /></span>

                <div className={s.fnode}>
                  <span className={`${s.fnodeIc} ${s.icBgBlue}`} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" />
                      <rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" />
                    </svg>
                  </span>
                  <span className={s.fnodeText}>
                    <b>Đối tượng</b>
                    <small>vật, mặt đất, lò xo…</small>
                  </span>
                  <span className={s.fnodeNum}>{number(structure.objects)}</span>
                </div>

                <span className={s.edge} aria-hidden="true"><i style={{ animationDelay: "0.7s" }} /></span>

                <div className={s.fnode}>
                  <span className={`${s.fnodeIc} ${s.icBgBlue}`} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4" />
                    </svg>
                  </span>
                  <span className={s.fnodeText}>
                    <b>Đại lượng (vai trò)</b>
                    <small>vận tốc, độ cao, khối lượng…</small>
                  </span>
                  <span className={s.fnodeNum}>{number(structure.roles)}</span>
                </div>

                <span className={s.edge} aria-hidden="true"><i style={{ animationDelay: "1.1s" }} /></span>

                <div className={s.fnode}>
                  <span className={`${s.fnodeIc} ${s.icBgBlue}`} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6M16 13H8M16 17H8" />
                    </svg>
                  </span>
                  <span className={s.fnodeText}>
                    <b>Định luật</b>
                    <small>t = √(2h/g), L = v₀·t…</small>
                  </span>
                  <span className={s.fnodeNum}>{number(structure.laws)}</span>
                </div>

                <span className={s.edge} aria-hidden="true"><i style={{ animationDelay: "1.5s" }} /></span>

                <div className={s.fnode}>
                  <span className={`${s.fnodeIc} ${s.icBgGreen}`} aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                  <span className={s.fnodeText}>
                    <b>Bài mẫu & đối chiếu</b>
                    <small>kiểm định từng đại lượng</small>
                  </span>
                  <span className={s.fnodeNum}>{number(structure.capabilities)}</span>
                </div>
              </div>
            </div>
          </section>

          {topTopics.length > 0 && (
            <section className={s.card}>
              <div className={s.cardHead}>
                <h2 className={s.cardTitle}>Độ phủ định luật theo chủ đề</h2>
                <span className={s.cardMuted}>Định luật + vai trò</span>
              </div>
              <div className={s.cardBody}>
                <div className={s.hbars}>
                  {topTopics.map((item, idx) => (
                    <div key={item.id} className={s.hrow}>
                      <div className={s.hrowTop}>
                        <span>{item.name}</span>
                        <b>{number(item.score)}</b>
                      </div>
                      <div className={s.barTrack}>
                        <i
                          className={`${s.barFill} ${idx === 0 ? s.barFillFirst : ""}`}
                          style={{ width: `${Math.max(8, item.pct)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          )}
        </aside>
      </div>

      {decision && (
        <DecisionDialog
          decision={decision}
          previousApproved={currentApprovedFor(decision.version)}
          busy={action.busy}
          feedback={action.feedback}
          onClose={() => setDecision(null)}
          onConfirm={() => void changeLifecycle()}
        />
      )}
    </div>
  );
}

function summarizeRecordDiff(prev: Record<string, unknown>, next: Record<string, unknown>) {
  const prevKeys = new Set(Object.keys(prev));
  const nextKeys = new Set(Object.keys(next));
  const added = [...nextKeys].filter(k => !prevKeys.has(k));
  const removed = [...prevKeys].filter(k => !nextKeys.has(k));
  const changed = [...nextKeys].filter(k => prevKeys.has(k) && JSON.stringify(prev[k]) !== JSON.stringify(next[k]));
  return { added, removed, changed };
}

function summarizeArrayDiff(prev: unknown, next: unknown, keyOf: (item: Record<string, unknown>) => string) {
  const toMap = (list: unknown) => {
    const map: Record<string, unknown> = {};
    if (Array.isArray(list)) {
      list.forEach((item, index) => {
        const rec = asRecord(item);
        const key = keyOf(rec) || String(index);
        map[key] = item;
      });
    }
    return map;
  };
  return summarizeRecordDiff(toMap(prev), toMap(next));
}

function VersionDiffBox({ previous, next }: Readonly<{ previous: Version; next: Version }>) {
  const prevDef = asRecord(previous.definition);
  const nextDef = asRecord(next.definition);
  const prevCat = asRecord(prevDef.lawCatalogue);
  const nextCat = asRecord(nextDef.lawCatalogue);
  const rows: { label: string; added: number; changed: number; removed: number }[] = [
    { label: "Định luật", ...summarizeArrayDiff(prevCat.laws, nextCat.laws, r => String(r.id ?? r.title ?? "")) },
    { label: "Vai trò đại lượng", ...summarizeRecordDiff(asRecord(prevCat.roles), asRecord(nextCat.roles)) },
    { label: "Vật thể gợi ý", ...summarizeArrayDiff(prevDef.objectTypes, nextDef.objectTypes, r => String(r.type ?? r.label ?? "")) },
    { label: "Đại lượng gợi ý", ...summarizeArrayDiff(prevDef.quantityDefinitions, nextDef.quantityDefinitions, r => String(r.key ?? r.label ?? "")) },
  ].map(item => ({ label: item.label, added: item.added.length, changed: item.changed.length, removed: item.removed.length }))
    .filter(item => item.added > 0 || item.changed > 0 || item.removed > 0);
  const metaChanged = previous.name !== next.name || previous.topic !== next.topic;
  return (
    <div className="reviewer-diff">
      <Text as="div" size="2" weight="bold">So sánh với bản đang dùng (v{previous.version})</Text>
      {!metaChanged && rows.length === 0 ? (
        <Text as="p" size="2" color="gray" mt="1">Không phát hiện thay đổi nội dung so với v{previous.version}.</Text>
      ) : (
        <ul className="reviewer-diff-list">
          {metaChanged && (
            <li>
              Thông tin chung: {previous.name !== next.name ? `Tên "${previous.name}" → "${next.name}"` : ""}
              {previous.name !== next.name && previous.topic !== next.topic ? " · " : ""}
              {previous.topic !== next.topic ? `Nhóm "${previous.topic}" → "${next.topic}"` : ""}
            </li>
          )}
          {rows.map(row => (
            <li key={row.label}>
              <strong>{row.label}:</strong>{" "}
              {[row.added > 0 && `+${row.added} thêm`, row.changed > 0 && `~${row.changed} sửa`, row.removed > 0 && `-${row.removed} xóa`].filter(Boolean).join(", ")}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DecisionDialog({
  decision,
  previousApproved,
  busy,
  feedback,
  onClose,
  onConfirm,
}: Readonly<{
  decision: { version: Version; status: "APPROVED" | "RETIRED" | "DELETE" };
  previousApproved?: Version;
  busy: boolean;
  feedback: ReactNode;
  onClose: () => void;
  onConfirm: () => void;
}>) {
  const isDelete = decision.status === "DELETE";
  const isApprove = decision.status === "APPROVED";
  const title = isDelete ? "Xoá bản nháp?" : isApprove ? "Phê duyệt phiên bản?" : "Ngừng sử dụng phiên bản?";
  const actionLabel = busy ? (isDelete ? "Đang xoá…" : "Đang cập nhật…") : isDelete ? "Xoá bản nháp" : isApprove ? "Phê duyệt" : "Ngừng sử dụng";
  return (
    <ReviewerDialog title={title} onClose={onClose}>
      <Text as="p" size="3"><strong>{decision.version.name || decision.version.schemaId}</strong> · v{decision.version.version}</Text>
      {isApprove && previousApproved && <VersionDiffBox previous={previousApproved} next={decision.version} />}
      <ul className="reviewer-consequences">
        {isDelete ? (
          <>
            <li>Bản nháp này sẽ bị <strong>xoá vĩnh viễn</strong> và không thể khôi phục.</li>
            <li>Các phiên bản đang dùng hoặc ngừng dùng của chủ đề không bị ảnh hưởng.</li>
          </>
        ) : isApprove ? (
          <>
            <li>Phiên bản đang dùng trước đó của cùng mã chủ đề sẽ tự chuyển sang <strong>Ngừng dùng</strong>.</li>
            <li>Hệ thống sẽ dùng phiên bản này cho các mô phỏng <strong>mới</strong>. Mô phỏng cũ giữ nguyên phiên bản đã dùng.</li>
            <li>Sau khi phê duyệt, nội dung <strong>không sửa được</strong> — muốn thay đổi phải tạo phiên bản mới.</li>
          </>
        ) : (
          <>
            <li>Mô phỏng mới sẽ không dùng phiên bản này nữa.</li>
            <li>Mô phỏng và bài tập đã tạo trước đó vẫn hoạt động bình thường.</li>
          </>
        )}
      </ul>
      {feedback}
      <div className="reviewer-form-footer">
        <Button type="button" variant="soft" color="gray" size="2" onClick={onClose}>Hủy</Button>
        <Button type="button" size="2" color={isApprove ? undefined : "red"} disabled={busy} onClick={onConfirm}>{actionLabel}</Button>
      </div>
    </ReviewerDialog>
  );
}

type SchemaAudit = {
  id: string;
  schemaVersionId: string;
  actorName?: string | null;
  actorEmail?: string | null;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  createdAt: string;
};

const SCHEMA_AUDIT_ACTION: Record<string, string> = {
  CREATE_DRAFT: "Tạo bản nháp",
  UPDATE_DRAFT: "Cập nhật bản nháp",
  APPROVE: "Phê duyệt phát hành",
  RETIRE: "Ngừng sử dụng",
  AUTO_RETIRE: "Tự động ngừng dùng",
};

function VersionDetail({
  version,
  sharedCatalogue,
  onClose,
  onEdit,
  onApprove,
  onDelete,
}: Readonly<{
  version: Version;
  sharedCatalogue?: Record<string, unknown>;
  onClose: () => void;
  onEdit: () => void;
  onApprove?: () => void;
  onDelete?: () => void;
}>) {
  const historyResource = useResource<SchemaAudit[]>(`/reviewer/schema-versions/${version.id}/history`);
  const history = historyResource.data ?? [];
  const definition = (version.definition && typeof version.definition === "object" ? version.definition : {}) as Record<string, unknown>;
  const objects = objectRows(definition.objectTypes);
  const quantities = objectRows(definition.quantityDefinitions);
  const examples = objectRows(definition.capabilities);
  const catalogue = (definition.lawCatalogue && typeof definition.lawCatalogue === "object" ? definition.lawCatalogue : {}) as Record<string, unknown>;
  const limitations = Array.isArray(definition.limitations) ? definition.limitations.map(String) : [];

  return (
    <Card size="3" className="reviewer-panel">
      <div className="reviewer-toolbar reviewer-sticky-header" style={{ alignItems: "center" }}>
        <Button type="button" variant="soft" color="gray" size="2" onClick={onClose}>← Danh sách chủ đề</Button>
        <Heading as="h2" size="5" style={{ flex: 1, minWidth: 0 }}>{version.name || version.schemaId} · v{version.version}</Heading>
        {onDelete && <Button type="button" variant="soft" color="red" size="2" onClick={onDelete}>Xoá bản nháp</Button>}
        <Button type="button" variant={onApprove ? "soft" : "solid"} size="2" onClick={onEdit}>{version.lifecycleStatus === "DRAFT" ? "Sửa bản nháp" : "Tạo phiên bản mới để sửa"}</Button>
        {onApprove && <Button type="button" size="2" onClick={onApprove}>Phê duyệt</Button>}
      </div>
      <div className="reviewer-detail-meta">
        <ReviewStatus status={version.lifecycleStatus} />
        <Text size="2" color="gray">Tạo ngày {formatDate(version.createdAt)}</Text>
      </div>
      <div className="reviewer-summary">
        {typeof definition.description === "string" && <Text as="p" size="2" className="reviewer-context-text">{definition.description}</Text>}
        <Heading as="h3" size="3">Định luật dùng để xác minh mô phỏng</Heading>
        <Text as="p" size="2" color="gray">AI viết mô hình theo mô tả của giáo viên; hệ thống tính rồi đối chiếu kết quả với từng định luật dưới đây.</Text>
        <LawBook value={catalogue} shared={sharedCatalogue} />
        <details className="reviewer-disclosure">
          <summary>Vật và đại lượng thường gặp trong đề bài (gợi ý cho AI): {objects.length} vật, {quantities.length} đại lượng</summary>
          <div className="reviewer-chips">{objects.map((item, index) => <Badge key={"o" + index} color="gray" variant="soft" size="2">{String(item.label ?? item.type ?? "—")}</Badge>)}</div>
          <div className="reviewer-chips" style={{ marginTop: 8 }}>{quantities.map((item, index) => <Badge key={"q" + index} color="indigo" variant="soft" size="2">{String(item.label ?? item.key ?? "—")}{item.symbol ? ` (${String(item.symbol)})` : ""}</Badge>)}</div>
        </details>
        {examples.length > 0 && (
          <details className="reviewer-disclosure">
            <summary>Bài mẫu ({examples.length}) — chỉ để tham khảo</summary>
            <Text as="p" size="1" color="gray" mb="2">Ví dụ về kí hiệu và công thức cho AI, và để mở lại mô phỏng đã lưu trước đây. Chúng không còn quyết định mô phỏng nào được tạo.</Text>
            <ul>{examples.map((item, index) => <li key={index}><Text size="2">{String(item.title ?? item.capabilityId ?? "")}</Text></li>)}</ul>
          </details>
        )}
        {limitations.length > 0 && (
          <>
            <Heading as="h3" size="2">Giới hạn</Heading>
            <ul className="reviewer-consequences">{limitations.map(item => <li key={item}>{item}</li>)}</ul>
          </>
        )}
      </div>
      {history.length > 0 && (
        <details className="reviewer-disclosure">
          <summary>Lịch sử phiên bản ({history.length})</summary>
          <table className="reviewer-mini-table">
            <thead><tr><th>Thời điểm</th><th>Người thực hiện</th><th>Hành động</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
            <tbody>
              {history.map(entry => (
                <tr key={entry.id}>
                  <td title={formatDate(entry.createdAt)}>{timeAgo(entry.createdAt) || formatDate(entry.createdAt)}</td>
                  <td>{entry.actorName || entry.actorEmail || "—"}</td>
                  <td>{SCHEMA_AUDIT_ACTION[entry.action] ?? entry.action}</td>
                  <td>{entry.fromStatus ? `${reviewerStatusLabel(entry.fromStatus)} → ` : ""}{entry.toStatus ? reviewerStatusLabel(entry.toStatus) : "—"}</td>
                  <td>{entry.note || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      <details className="reviewer-disclosure">
        <summary>Thông tin kỹ thuật</summary>
        <dl className="reviewer-evidence-grid">
          <div><dt>Mã chủ đề</dt><dd><code>{version.schemaId}</code></dd></div>
          <div><dt>Số lần chỉnh sửa</dt><dd>{version.recordVersion ?? 0}</dd></div>
          <div><dt>Mã kiểm tra nội dung</dt><dd><code>{version.definitionChecksum ?? "—"}</code></dd></div>
        </dl>
        <pre className="reviewer-json">{JSON.stringify(version.definition, null, 2)}</pre>
      </details>
    </Card>
  );
}
