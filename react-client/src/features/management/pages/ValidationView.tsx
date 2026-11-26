import { useResource } from "../../../shared/hooks/operationsData";
import type { DataPage } from "../../../shared/api/page";
import { useRef, useState } from "react";
import { Button as ThemeButton, Select, Table } from "@radix-ui/themes";
import type { ValidationRun } from "../api/operationsApi";
import { Loading, ErrorNotice } from "../../../shared/ui/ManagementUI";
import tableScroll from "../../../shared/ui/TableScroll.module.css";
import { useTopicName } from "../../../shared/hooks/useTopicName";
import RefreshButton from "../../../shared/ui/RefreshButton";
import LearningIcon from "../../../shared/ui/LearningIcon";
import ValidationArt from "../components/ValidationArt";
import styles from "./ValidationView.module.css";

type ValidationMetrics = { total: number; failed: number; failureRate: number };

function AlertCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 5h18M6 12h12M10 19h4" />
    </svg>
  );
}

function StatusIcon({ passed }: Readonly<{ passed: boolean }>) {
  if (passed) {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.4 12.4 2.5 2.5 4.9-5.3" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m9.2 9.2 5.6 5.6M14.8 9.2l-5.6 5.6" />
    </svg>
  );
}

export function ValidationView() {
  const topicName = useTopicName();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [topic, setTopic] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [nowMs] = useState(() => Date.now());
  const tableRef = useRef<HTMLDivElement>(null);

  const invalidDates = Boolean(from && to && from > to);
  const params = new URLSearchParams({ page: String(page - 1), size: String(pageSize), status });
  if (topic !== "ALL") params.set("topic", topic);
  if (from) params.set("from", from);
  if (to) params.set("to", to);

  const metricsResource = useResource<ValidationMetrics>("/admin/metrics/validation");
  const topicsResource = useResource<string[]>("/admin/validation-runs/topics");
  const failedSampleResource = useResource<DataPage<ValidationRun>>("/admin/validation-runs/page?page=0&size=100&status=FAIL");
  const resource = useResource<DataPage<ValidationRun>>("/admin/validation-runs/page?" + params, !invalidDates);

  const items = resource.data?.items ?? [];
  const total = resource.data?.totalElements ?? 0;
  const knownTable = resource.data !== undefined;
  const loading = !invalidDates && resource.loading && !knownTable;
  const activeFilterCount = (topic !== "ALL" ? 1 : 0) + (status !== "ALL" ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);
  const filtered = activeFilterCount > 0;
  const error = invalidDates ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." : resource.error;

  const load = () => Promise.all([
    ...(invalidDates ? [] : [resource.refresh()]),
    topicsResource.refresh(),
    metricsResource.refresh(),
    failedSampleResource.refresh(),
  ]);

  const pageCount = Math.max(1, resource.data?.totalPages ?? 1);
  const currentPage = resource.data ? resource.data.page + 1 : page;
  const pageStart = (currentPage - 1) * pageSize;
  const resetPage = () => { setPage(1); tableRef.current?.scrollTo({ top: 0 }); };
  const changePage = (next: number) => {
    setPage(Math.max(1, Math.min(next, pageCount)));
    tableRef.current?.scrollTo({ top: 0 });
  };

  // KPI metrics
  const metrics = metricsResource.data;
  const knownMetrics = metrics !== undefined;
  const totalRuns = metrics?.total ?? 0;
  const failedRuns = metrics?.failed ?? 0;
  const passRate = totalRuns > 0 ? (1 - (metrics?.failureRate ?? 0)) * 100 : 100;

  // Failed topics breakdown from latest failed sample
  const failedItems = failedSampleResource.data?.items ?? [];
  const weekMs = 7 * 86_400_000;
  const weekFailedTopicNames = [...new Set(
    failedItems
      .filter(item => nowMs - Date.parse(item.createdAt) <= weekMs)
      .map(item => topicName(item.topic) || item.topic || "Khác"),
  )];

  const topicFailMap = new Map<string, number>();
  for (const item of failedItems) {
    const label = topicName(item.topic) || item.topic || "Chủ đề khác";
    topicFailMap.set(label, (topicFailMap.get(label) ?? 0) + 1);
  }
  const sortedFailedTopics = Array.from(topicFailMap.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);

  const top3Failed = sortedFailedTopics.slice(0, 3);
  const otherFailedCount = sortedFailedTopics.slice(3).reduce((sum, row) => sum + row.count, 0);
  const failedBreakdown = otherFailedCount > 0
    ? [...top3Failed, { label: "Chủ đề khác", count: otherFailedCount }]
    : top3Failed;
  const maxFailedTopic = Math.max(1, ...failedBreakdown.map(row => row.count));

  return (
    <div className={`admin-content ${styles.page}`}>
      <RefreshButton onClick={() => void load()} disabled={resource.refreshing || metricsResource.refreshing} />

      <header className={styles.heading}>
        <div className={styles.headingText}>
          <h1>Kiểm định mô phỏng</h1>
          <p>Kết quả kiểm tra hệ thống ghi nhận khi chạy mô phỏng.</p>
        </div>
        <div className={styles.artWrap}>
          <ValidationArt />
        </div>
      </header>

      {error && <ErrorNotice error={error} onRetry={invalidDates ? undefined : () => void load()} />}

      <section className={styles.stats} aria-label="Chỉ số kiểm định">
        <article className={`${styles.stat} ${styles.mint}`}>
          <span className={styles.statIcon}><LearningIcon name="atom" /></span>
          <span className={styles.statLabel}>Lượt chạy</span>
          <strong className={styles.statValue}>{knownMetrics ? totalRuns.toLocaleString("vi-VN") : "—"}</strong>
          <span className={styles.statHint}>Tổng lượt kiểm định đã ghi nhận</span>
          <svg className={styles.spark} viewBox="0 0 120 32" preserveAspectRatio="none" aria-hidden="true">
            <path className={styles.sparkArea} d="M0 29 C24 24 48 19 72 15 C96 10 112 6 120 5 L120 32 L0 32 Z" />
            <path className={styles.sparkLine} d="M0 29 C24 24 48 19 72 15 C96 10 112 6 120 5" />
          </svg>
        </article>

        <article className={`${styles.stat} ${styles.green}`}>
          <span className={styles.statIcon}><LearningIcon name="check" /></span>
          <span className={styles.statLabel}>Tỉ lệ đạt</span>
          <strong className={styles.statValue}>
            {knownMetrics
              ? totalRuns > 0
                ? `${passRate.toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`
                : "—"
              : "—"}
          </strong>
          <span className={styles.statHint}>
            {knownMetrics ? `${(totalRuns - failedRuns).toLocaleString("vi-VN")} lượt đạt chuẩn` : "Đang tải…"}
          </span>
        </article>

        <article className={`${styles.stat} ${styles.red}`}>
          <span className={styles.statIcon}><AlertCircleIcon /></span>
          <span className={styles.statLabel}>Không đạt</span>
          <strong className={styles.statValue}>{knownMetrics ? failedRuns.toLocaleString("vi-VN") : "—"}</strong>
          <span className={styles.statHint}>
            {sortedFailedTopics.length > 0
              ? `Tập trung ở ${sortedFailedTopics.length} chủ đề`
              : "Không có lỗi ghi nhận"}
          </span>
        </article>

        <article className={`${styles.stat} ${styles.red}`}>
          <span className={styles.statIcon}><AlertCircleIcon /></span>
          <span className={styles.statLabel}>Chủ đề có lỗi tuần này</span>
          <strong className={styles.statValue}>
            {failedSampleResource.data !== undefined ? weekFailedTopicNames.length.toLocaleString("vi-VN") : "—"}
          </strong>
          <span className={styles.statHint}>
            {weekFailedTopicNames.length > 0
              ? weekFailedTopicNames.slice(0, 2).join(", ")
              : "Không có lỗi trong 7 ngày qua"}
          </span>
        </article>
      </section>

      <div className={styles.split}>
        <section className={styles.card} aria-label="Lịch sử kiểm định">
          <div className={styles.toolbar} aria-label="Bộ lọc kiểm định">
            <ThemeButton
              type="button"
              size="2"
              variant={showFilters || filtered ? "soft" : "surface"}
              color={showFilters || filtered ? "teal" : "gray"}
              aria-expanded={showFilters}
              onClick={() => setShowFilters(v => !v)}
            >
              <FilterIcon />
              Bộ lọc
              {activeFilterCount > 0 && <span className={styles.filterBadge}>{activeFilterCount}</span>}
            </ThemeButton>
            <p className={styles.resultCount} aria-live="polite">
              {total.toLocaleString("vi-VN")} lần chạy{filtered ? " phù hợp bộ lọc" : ""}
            </p>
          </div>

          {showFilters && (
            <div className={styles.filterDrawer} role="group" aria-label="Bộ lọc chi tiết kiểm định">
              <label className={styles.filterField}>
                Chủ đề
                <Select.Root size="2" value={topic} onValueChange={value => { setTopic(value); resetPage(); }}>
                  <Select.Trigger aria-label="Lọc chủ đề kiểm định" />
                  <Select.Content>
                    <Select.Item value="ALL">Tất cả chủ đề</Select.Item>
                    {(topicsResource.data ?? []).map(code => (
                      <Select.Item key={code} value={code}>{topicName(code)}</Select.Item>
                    ))}
                  </Select.Content>
                </Select.Root>
              </label>

              <label className={styles.filterField}>
                Trạng thái
                <Select.Root size="2" value={status} onValueChange={value => { setStatus(value); resetPage(); }}>
                  <Select.Trigger aria-label="Lọc trạng thái kiểm định" />
                  <Select.Content>
                    <Select.Item value="ALL">Tất cả trạng thái</Select.Item>
                    <Select.Item value="PASS">Đạt</Select.Item>
                    <Select.Item value="FAIL">Không đạt</Select.Item>
                  </Select.Content>
                </Select.Root>
              </label>

              <label className={styles.filterField}>
                Từ ngày
                <input className={styles.dateInput} type="date" aria-label="Kiểm định từ ngày" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); resetPage(); }} />
              </label>

              <label className={styles.filterField}>
                Đến ngày
                <input className={styles.dateInput} type="date" aria-label="Kiểm định đến ngày" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); resetPage(); }} />
              </label>

              <ThemeButton type="button" size="2" variant="outline" color="gray" disabled={!filtered} onClick={() => { setTopic("ALL"); setStatus("ALL"); setFrom(""); setTo(""); resetPage(); }}>
                Xóa bộ lọc
              </ThemeButton>
            </div>
          )}

          {topicsResource.error && (
            <p className={styles.optionsError} role="alert">
              Không tải được danh sách chủ đề.{" "}
              <button type="button" onClick={() => void topicsResource.refresh()}>Thử lại</button>
            </p>
          )}

          {loading ? (
            <Loading text="Đang tải các lần kiểm định…" headers={["Thời gian", "Chủ đề", "Phiên bản chủ đề", "Trạng thái", "Lỗi"]} />
          ) : (
            <>
              <Table.Root ref={tableRef} size="2" variant="ghost" className={`${styles.tableWrap} ${tableScroll.viewport}`}>
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Thời gian</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Chủ đề</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Phiên bản chủ đề</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Trạng thái</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Lỗi</Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {items.length === 0 ? (
                    <Table.Row>
                      <Table.Cell colSpan={5} className={styles.emptyCell}>
                        {filtered ? "Không có lần kiểm định phù hợp bộ lọc." : "Chưa có lần kiểm định."}
                      </Table.Cell>
                    </Table.Row>
                  ) : (
                    items.map(item => (
                      <Table.Row key={item.id}>
                        <Table.Cell className={styles.timeCell}>{new Date(item.createdAt).toLocaleString("vi-VN")}</Table.Cell>
                        <Table.Cell className={styles.topicCell}>{topicName(item.topic) || "—"}</Table.Cell>
                        <Table.Cell className={styles.mono}>{item.schemaVersion ? `Bản ${item.schemaVersion}` : "—"}</Table.Cell>
                        <Table.Cell>
                          <span className={`${styles.statusBadge} ${item.passed ? styles.statusPass : styles.statusFail}`}>
                            <StatusIcon passed={item.passed} />
                            {item.passed ? "Đạt" : "Không đạt"}
                          </span>
                        </Table.Cell>
                        <Table.Cell className={`${styles.errorCell} ${item.errorMessage ? styles.errorCellFail : ""}`}>
                          {item.errorMessage || "—"}
                        </Table.Cell>
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table.Root>

              <div className={styles.pager}>
                <span aria-live="polite">
                  {total === 0
                    ? "0 lần chạy"
                    : `Hiển thị ${(pageStart + 1).toLocaleString("vi-VN")}–${Math.min(pageStart + pageSize, total).toLocaleString("vi-VN")} / ${total.toLocaleString("vi-VN")} lần chạy`}
                </span>
                <div className={styles.pagerActions}>
                  <label className={styles.pagerSize}>
                    Số dòng/trang
                    <Select.Root size="2" value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); resetPage(); }}>
                      <Select.Trigger aria-label="Số lần chạy trên mỗi trang" />
                      <Select.Content>{[10, 25, 50].map(size => <Select.Item key={size} value={String(size)}>{size}</Select.Item>)}</Select.Content>
                    </Select.Root>
                  </label>
                  <ThemeButton type="button" size="2" variant="surface" color="gray" disabled={currentPage <= 1 || invalidDates} onClick={() => changePage(currentPage - 1)}>Trước</ThemeButton>
                  <span>Trang {currentPage}/{pageCount}</span>
                  <ThemeButton type="button" size="2" variant="surface" color="gray" disabled={currentPage >= pageCount || invalidDates} onClick={() => changePage(currentPage + 1)}>Sau</ThemeButton>
                </div>
              </div>
            </>
          )}
        </section>

        <aside className={styles.insights}>
          <section className={styles.card}>
            <div className={styles.panelHead}>
              <h2>Lỗi theo chủ đề</h2>
              <span>{knownMetrics ? `${failedRuns.toLocaleString("vi-VN")} lượt không đạt` : "—"}</span>
            </div>
            <div className={styles.panelBody}>
              {failedBreakdown.length === 0 ? (
                <p className={styles.panelEmpty}>Chưa ghi nhận lượt kiểm định không đạt.</p>
              ) : (
                failedBreakdown.map((row, index) => (
                  <div key={row.label} className={styles.hrow}>
                    <div className={styles.hrowHead}>
                      <span>{row.label}</span>
                      <strong>{row.count.toLocaleString("vi-VN")}</strong>
                    </div>
                    <span className={styles.bar}>
                      <i
                        className={`${styles.barFill} ${index === 0 ? styles.barFillPrimary : ""}`}
                        style={{ width: `${Math.max(6, Math.round((row.count / maxFailedTopic) * 100))}%` }}
                      />
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
