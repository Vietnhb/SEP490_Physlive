import { TableLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import { lazy, Suspense, useMemo } from "react";
import { Link } from "react-router-dom";
import { useResource } from "../../../shared/hooks/operationsData";
import type { LibraryItem } from "../../../shared/types/physlive";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { isStudentRole } from "../../../shared/auth/roles";
import { canTeach } from "../../../shared/auth/permissions";
import { useTopicName } from "../../../shared/hooks/useTopicName";

const StudentAssignments = lazy(
  () => import("../../assignments/pages/StudentAssignments"),
);

function LibraryRows({
  items,
  assignable,
  loading = false,
}: Readonly<{ items: LibraryItem[]; assignable: boolean; loading?: boolean }>) {
  const topicName = useTopicName();
  if (loading) return <TableLoadingSkeleton headers={["Tên", "Chủ đề", "Chia sẻ", "Người chia sẻ", "Ngày lưu", ...(assignable ? ["Thao tác"] : [])]} label="Đang tải thư viện…" />;
  if (!items.length)
    return (
      <p className="muted">
        {assignable
          ? "Bạn chưa lưu mô phỏng nào. Dựng một mô phỏng rồi bấm “Lưu mô phỏng” để thấy ở đây."
          : "Chưa có mô phỏng nào được chia sẻ với bạn."}
      </p>
    );
  const visibilityLabel = (item: LibraryItem) => {
    if (item.visibility === "PERSONAL") return "Chỉ mình tôi";
    const scope =
      item.visibility === "PUBLIC" ? "Kho cộng đồng" : "Trong trường";
    // Review state only matters to the owner; shared rows of other people are always approved.
    if (!assignable) return scope;
    return `${scope} · ${item.moderationStatus === "PENDING" ? "chờ duyệt" : item.moderationStatus === "REJECTED" ? "bị từ chối" : "đã duyệt"}`;
  };
  return (
    <div className="table-wrap table-stack">
      <table>
        <thead>
          <tr>
            <th>Tên</th>
            <th>Chủ đề</th>
            <th>Chia sẻ</th>
            <th>Người chia sẻ</th>
            <th>Ngày lưu</th>
            {assignable && <th>Thao tác</th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td className="table-stack-title">
                <strong>
                  {assignable ? (
                    <Link to={`/workspace?simulationId=${item.simulationId}`}>
                      {item.title}
                    </Link>
                  ) : (
                    item.title
                  )}
                </strong>
              </td>
              <td data-label="Chủ đề">{topicName(item.topic) || "—"}</td>
              <td data-label="Chia sẻ">{visibilityLabel(item)}</td>
              <td data-label="Người chia sẻ">
                {item.sharedByName || "—"}
                {item.schoolName ? (
                  <small className="library-school">{item.schoolName}</small>
                ) : null}
              </td>
              <td data-label="Ngày lưu">
                {new Date(item.createdAt).toLocaleDateString("vi-VN")}
              </td>
              {assignable && (
                <td className="table-stack-action">
                  <Link
                    className="table-action"
                    to={`/assignments/workspace?libraryItemId=${item.id}`}
                  >
                    Giao bài
                  </Link>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Library() {
  const user = useSessionStore((state) => state.user);
  if (isStudentRole(user?.role)) {
    return (
      <Suspense fallback={<main className="route-loading" aria-busy="true" />}>
        <StudentAssignments />
      </Suspense>
    );
  }
  return <LibraryCatalog canManage={canTeach(user)} />;
}

function LibraryCatalog({ canManage }: Readonly<{ canManage: boolean }>) {
  const mineResource = useResource<LibraryItem[]>("/library/mine", canManage);
  const accessibleResource = useResource<LibraryItem[]>("/library");
  const mine = useMemo(() => mineResource.data ?? [], [mineResource.data]);
  const accessible = accessibleResource.data ?? [];
  const error = mineResource.error || accessibleResource.error || "";
  const mineIds = useMemo(() => new Set(mine.map((item) => item.id)), [mine]);
  const shared = accessible.filter(
    (item) => item.visibility !== "PERSONAL" && !mineIds.has(item.id),
  );
  return (
    <main className="main">
      <div className="hero">
        <div>
          <h1>Mô phỏng của tôi</h1>
          <p className="muted">Mô phỏng bạn đã lưu và mô phỏng được chia sẻ với bạn. Chọn Giao bài để dùng cho lớp.</p>
        </div>
        {canManage && (
          <Link to="/workspace" className="primary page-action">
            Tạo mô phỏng
          </Link>
        )}
      </div>
      {canManage && (
        <section className="card library-section">
          <div className="section-heading">
            <div>
              <h2>Đã lưu</h2>
            </div>
          </div>
          <LibraryRows items={mine} assignable loading={mineResource.loading} />
        </section>
      )}
      <section className="card library-section">
        <div className="section-heading">
          <div>
            <h2>Được chia sẻ với bạn</h2>
          </div>
        </div>
        <LibraryRows items={shared} assignable={false} loading={accessibleResource.loading} />
      </section>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
