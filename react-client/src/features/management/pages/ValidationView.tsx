import { useResource } from "../../../shared/hooks/operationsData";
import type { DataPage } from "../../../shared/api/page";
import { useRef, useState } from "react";
import { Badge, Select, Table } from "@radix-ui/themes";
import type { ValidationRun } from "../api/operationsApi";
import { PageHeader, Panel, Loading, ErrorNotice, Button } from "../../../shared/ui/ManagementUI";
import tableScroll from "../../../shared/ui/TableScroll.module.css";
import { useTopicName } from "../../../shared/hooks/useTopicName";
import RefreshButton from "../../../shared/ui/RefreshButton";
import styles from "./ValidationView.module.css";

export function ValidationView() {
  const topicName = useTopicName();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [topic, setTopic] = useState("ALL");
  const [status, setStatus] = useState("ALL");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const tableRef = useRef<HTMLDivElement>(null);
  const invalidDates = Boolean(from && to && from > to);
  const params = new URLSearchParams({ page: String(page - 1), size: String(pageSize), status });
  if (topic !== "ALL") params.set("topic", topic);
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const topicsResource = useResource<string[]>("/admin/validation-runs/topics");
  const resource = useResource<DataPage<ValidationRun>>("/admin/validation-runs/page?" + params, !invalidDates);
  const items = resource.data?.items ?? [];
  const total = resource.data?.totalElements ?? 0;
  const loading = !invalidDates && resource.loading;
  const filtered = topic !== "ALL" || status !== "ALL" || Boolean(from || to);
  const error = invalidDates ? "Ngày bắt đầu phải trước hoặc bằng ngày kết thúc." : resource.error;
  const load = () => Promise.all([...(invalidDates ? [] : [resource.refresh()]), topicsResource.refresh()]);
  const pageCount = Math.max(1, resource.data?.totalPages ?? 1);
  const currentPage = resource.data ? resource.data.page + 1 : page;
  const pageStart = (currentPage - 1) * pageSize;
  const resetPage = () => { setPage(1); tableRef.current?.scrollTo({ top: 0 }); };
  const changePage = (next: number) => {
    setPage(Math.max(1, Math.min(next, pageCount)));
    tableRef.current?.scrollTo({ top: 0 });
  };

  return <div className="admin-content">
    <PageHeader title="Kiểm định mô phỏng" description="Kết quả kiểm tra hệ thống ghi nhận khi chạy mô phỏng." action={<RefreshButton onClick={() => void load()} disabled={resource.refreshing} />} />
    {error && <ErrorNotice error={error} onRetry={invalidDates ? undefined : () => void load()} />}
    <Panel title="Lịch sử kiểm định" hideHeader>
      <div className={styles.filters} role="group" aria-label="Bộ lọc kiểm định">
        <label>Chủ đề<Select.Root value={topic} onValueChange={value => { setTopic(value); resetPage(); }}><Select.Trigger aria-label="Lọc chủ đề kiểm định" /><Select.Content><Select.Item value="ALL">Tất cả chủ đề</Select.Item>{(topicsResource.data ?? []).map(code => <Select.Item key={code} value={code}>{topicName(code)}</Select.Item>)}</Select.Content></Select.Root></label>
        <label>Trạng thái<Select.Root value={status} onValueChange={value => { setStatus(value); resetPage(); }}><Select.Trigger aria-label="Lọc trạng thái kiểm định" /><Select.Content><Select.Item value="ALL">Tất cả trạng thái</Select.Item><Select.Item value="PASS">Đạt</Select.Item><Select.Item value="FAIL">Không đạt</Select.Item></Select.Content></Select.Root></label>
        <label>Từ ngày<input type="date" aria-label="Kiểm định từ ngày" value={from} max={to || undefined} onChange={event => { setFrom(event.target.value); resetPage(); }} /></label>
        <label>Đến ngày<input type="date" aria-label="Kiểm định đến ngày" value={to} min={from || undefined} onChange={event => { setTo(event.target.value); resetPage(); }} /></label>
        <Button disabled={!filtered} onClick={() => { setTopic("ALL"); setStatus("ALL"); setFrom(""); setTo(""); resetPage(); }}>Xóa bộ lọc</Button>
      </div>
      {topicsResource.error && <p className={styles.optionsError} role="alert">Không tải được danh sách chủ đề. <button type="button" onClick={() => void topicsResource.refresh()}>Thử lại</button></p>}
      {loading ? <Loading text="Đang tải các lần kiểm định…" headers={["Thời gian", "Chủ đề", "Phiên bản chủ đề", "Trạng thái", "Lỗi"]} /> : <>
        <p className={styles.resultCount} aria-live="polite">{total} lần chạy{filtered ? " phù hợp bộ lọc" : ""}</p>
        <Table.Root ref={tableRef} size="2" variant="ghost" className={"admin-table " + tableScroll.viewport}>
          <Table.Header><Table.Row>{["Thời gian", "Chủ đề", "Phiên bản chủ đề", "Trạng thái", "Lỗi"].map(label => <Table.ColumnHeaderCell key={label}>{label}</Table.ColumnHeaderCell>)}</Table.Row></Table.Header>
          <Table.Body>{items.length === 0 ? <Table.Row><Table.Cell colSpan={5} className="admin-empty-table">{filtered ? "Không có lần kiểm định phù hợp bộ lọc." : "Chưa có lần kiểm định."}</Table.Cell></Table.Row> : items.map(item => <Table.Row key={item.id}>
            <Table.Cell>{new Date(item.createdAt).toLocaleString("vi-VN")}</Table.Cell>
            <Table.Cell>{topicName(item.topic) || "—"}</Table.Cell>
            <Table.Cell>{item.schemaVersion ? "Bản " + item.schemaVersion : "—"}</Table.Cell>
            <Table.Cell><Badge color={item.passed ? "green" : "red"}>{item.passed ? "Đạt" : "Không đạt"}</Badge></Table.Cell>
            <Table.Cell className={item.errorMessage ? "admin-error-cell" : undefined}>{item.errorMessage || "—"}</Table.Cell>
          </Table.Row>)}</Table.Body>
        </Table.Root>
        <div className="admin-table-pagination">
          <span aria-live="polite">{total === 0 ? "0 lần chạy" : "Hiển thị " + (pageStart + 1) + "–" + Math.min(pageStart + pageSize, total) + " / " + total + " lần chạy"}</span>
          <div>
            <label>Số dòng/trang<Select.Root size="2" value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); resetPage(); }}><Select.Trigger aria-label="Số lần chạy trên mỗi trang" /><Select.Content>{[10, 25, 50].map(size => <Select.Item key={size} value={String(size)}>{size}</Select.Item>)}</Select.Content></Select.Root></label>
            <Button disabled={currentPage <= 1 || invalidDates} onClick={() => changePage(currentPage - 1)}>Trước</Button>
            <span>Trang {currentPage}/{pageCount}</span>
            <Button disabled={currentPage >= pageCount || invalidDates} onClick={() => changePage(currentPage + 1)}>Sau</Button>
          </div>
        </div>
      </>}
    </Panel>
  </div>;
}
