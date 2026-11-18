import { useResource } from "../../../shared/hooks/operationsData";
import type { DataPage } from "../../../shared/api/page";
import { useRef, useState } from "react";
import { Badge, Select, Table } from "@radix-ui/themes";
import { type ValidationRun } from "../api/operationsApi";
import { PageHeader, Panel, Loading, ErrorNotice, Button } from "../../../shared/ui/ManagementUI";
import tableScroll from "../../../shared/ui/TableScroll.module.css";
import { useTopicName } from "../../../shared/hooks/useTopicName";
import RefreshButton from "../../../shared/ui/RefreshButton";

export function ValidationView() {
  const topicName = useTopicName();

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const resource = useResource<DataPage<ValidationRun>>(`/admin/validation-runs/page?page=${page - 1}&size=${pageSize}`);
  const items = resource.data?.items ?? [];
  const total = resource.data?.totalElements ?? 0;
  const loading = resource.loading;
  const error = resource.error;
  const load = resource.refresh;
  const tableRef = useRef<HTMLDivElement>(null);
  const pageCount = Math.max(1, resource.data?.totalPages ?? 1);
  const currentPage = resource.data ? resource.data.page + 1 : page;
  const pageStart = (currentPage - 1) * pageSize;
  const visibleItems = items;
  const changePage = (next: number) => {
    setPage(Math.max(1, Math.min(next, pageCount)));
    tableRef.current?.scrollTo({ top: 0 });
  };

  return <div className="admin-content">
    <PageHeader title="Kiểm định mô phỏng" description={`${total} lần chạy · Kết quả kiểm tra hệ thống ghi nhận khi chạy mô phỏng, kèm thông báo lỗi nếu có.`} action={<RefreshButton onClick={() => void load()} disabled={loading} />} />
    {error && <ErrorNotice error={error} onRetry={() => void load()} />}
    {loading ? <Loading text="Đang tải các lần kiểm định…" headers={["Thời gian", "Chủ đề", "Phiên bản chủ đề", "Trạng thái", "Lỗi"]} /> : <Panel title={`${total} lần chạy`} hideHeader>
      <Table.Root ref={tableRef} size="2" variant="ghost" className={`admin-table ${tableScroll.viewport}`}>
        <Table.Header><Table.Row>
          <Table.ColumnHeaderCell>Thời gian</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Chủ đề</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Phiên bản chủ đề</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Trạng thái</Table.ColumnHeaderCell>
          <Table.ColumnHeaderCell>Lỗi</Table.ColumnHeaderCell>
        </Table.Row></Table.Header>
        <Table.Body>{visibleItems.length === 0 ? <Table.Row><Table.Cell colSpan={5} className="admin-empty-table">Chưa có lần kiểm định.</Table.Cell></Table.Row> : visibleItems.map(item => <Table.Row key={item.id}>
          <Table.Cell>{new Date(item.createdAt).toLocaleString("vi-VN")}</Table.Cell>
          <Table.Cell>{topicName(item.topic) || "—"}</Table.Cell>
          <Table.Cell>{item.schemaVersion ? `Bản ${item.schemaVersion}` : "—"}</Table.Cell>
          <Table.Cell><Badge color={item.passed ? "green" : "red"}>{item.passed ? "Đạt" : "Không đạt"}</Badge></Table.Cell>
          <Table.Cell className={item.errorMessage ? "admin-error-cell" : undefined}>{item.errorMessage || "—"}</Table.Cell>
        </Table.Row>)}</Table.Body>
      </Table.Root>
      <div className="admin-table-pagination">
        <span aria-live="polite">{total === 0 ? "0 lần chạy" : `Hiển thị ${pageStart + 1}–${Math.min(pageStart + pageSize, total)} / ${total} lần chạy`}</span>
        <div>
          <label>Số dòng/trang<Select.Root size="2" value={String(pageSize)} onValueChange={value => { setPageSize(Number(value)); setPage(1); tableRef.current?.scrollTo({ top: 0 }); }}><Select.Trigger aria-label="Số lần chạy trên mỗi trang" /><Select.Content>{[10, 25, 50].map(size => <Select.Item key={size} value={String(size)}>{size}</Select.Item>)}</Select.Content></Select.Root></label>
          <Button disabled={currentPage <= 1} onClick={() => changePage(currentPage - 1)}>Trước</Button>
          <span>Trang {currentPage}/{pageCount}</span>
          <Button disabled={currentPage >= pageCount} onClick={() => changePage(currentPage + 1)}>Sau</Button>
        </div>
      </div>
    </Panel>}
  </div>;
}
