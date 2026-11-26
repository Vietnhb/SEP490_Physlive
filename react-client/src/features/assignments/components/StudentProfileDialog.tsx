import { useState } from "react";
import { Dialog } from "radix-ui";
import { useResource } from "../../../shared/hooks/operationsData";
import { useStudioPortal } from "./useStudioPortal";

type Profile = {
  id: number; fullName: string; email: string; avatarUrl: string | null; dateOfBirth: string | null;
  active: boolean; accountStatus: string; schoolName: string;
  classes: { id: string; name: string; gradeLevel: number; schoolYear: string; subject: string | null }[];
};
const icon = (name: string) => <svg className="icon" aria-hidden="true"><use href={`#i-${name}`} /></svg>;
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(part => part[0]).join("").toUpperCase();

/** A student's account, as far as the teacher's class allows — the canvas dialog "Hồ sơ tài khoản". */
export default function StudentProfileDialog({ classId, userId, onClose }: Readonly<{ classId: string; userId: number; onClose: () => void }>) {
  const [opener] = useState(() => document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const portal = useStudioPortal(anchor);
  const resource = useResource<Profile>(`/assignments/mine/teacher/classes/${classId}/students/${userId}/profile`);
  const profile = resource.data;
  const state = !profile ? null : !profile.active ? { label: "Tạm khóa", tone: "b-warn" } : profile.accountStatus === "WARNED" ? { label: "Cảnh báo", tone: "b-warn" } : { label: "Hoạt động", tone: "b-success" };
  return <>
    <span ref={setAnchor} hidden />
    <Dialog.Root open={Boolean(anchor)} onOpenChange={open => { if (!open) onClose(); }}>
      <Dialog.Portal container={portal}><Dialog.Overlay className="scrim is-fixed" />
        <Dialog.Content className="dialog is-fixed" style={{ width: "min(520px, calc(100% - 32px))" }} onCloseAutoFocus={event => { if (opener?.isConnected) { event.preventDefault(); opener.focus({ preventScroll: true }); } }}>
          <div className="card-h" style={{ alignItems: "flex-start" }}>
            <div style={{ display: "flex", gap: 14, alignItems: "center", minWidth: 0 }}>
              {profile?.avatarUrl ? <img className="avatar" src={profile.avatarUrl} alt="" style={{ width: 48, height: 48, objectFit: "cover" }} /> : <span className="avatar" style={{ width: 48, height: 48, fontSize: 16 }}>{profile ? initials(profile.fullName) : "…"}</span>}
              <div style={{ minWidth: 0 }}><Dialog.Title className="h2">Hồ sơ tài khoản</Dialog.Title><Dialog.Description className="muted clamp-1" style={{ fontSize: 13, marginTop: 2 }}>{profile ? `${profile.fullName} · ${profile.email}` : "Đang tải…"}</Dialog.Description></div>
            </div>
            <Dialog.Close className="btn btn-sm btn-ghost" aria-label="Đóng hồ sơ">{icon("x")}</Dialog.Close>
          </div>
          <div className="card-b dialog-scroll">
            {resource.error && <p className="badge b-danger" role="alert" style={{ margin: 0 }}>{resource.error}</p>}
            {resource.loading ? <div role="status" aria-label="Đang tải hồ sơ" style={{ display: "flex", flexDirection: "column", gap: 10 }}><span className="sk" style={{ width: "40%", height: 14 }} /><span className="sk" style={{ width: "70%", height: 12 }} /><span className="sk" style={{ width: "55%", height: 12 }} /></div>
              : profile && <>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>{state && <span className={"badge " + state.tone}>{state.label}</span>}<span className="badge">Học sinh</span></div>
                <dl style={{ display: "grid", gridTemplateColumns: "160px minmax(0, 1fr)", gap: "10px 16px", margin: 0, fontSize: 14 }}>
                  <dt className="muted">Ngày sinh</dt><dd style={{ margin: 0 }}>{profile.dateOfBirth ? new Date(profile.dateOfBirth + "T00:00:00").toLocaleDateString("vi-VN") : "Chưa cập nhật"}</dd>
                  <dt className="muted">Trường</dt><dd style={{ margin: 0 }}>{profile.schoolName}</dd>
                </dl>
                <div><b style={{ fontSize: 13, fontWeight: 500 }}>Lớp trong phạm vi phụ trách</b>
                  {profile.classes.length ? <div className="chips" style={{ marginTop: 8 }}>{profile.classes.map(item => <span key={item.id} className="badge b-info">{item.name} · {item.schoolYear}</span>)}</div>
                    : <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>Học sinh đã rời lớp này. Bài nộp và kết quả cũ vẫn được giữ lại.</p>}
                  <p className="muted" style={{ fontSize: 12, margin: "8px 0 0" }}>Bạn chỉ xem được lớp mình phụ trách. Tài khoản do quản lý trường cấp và chỉnh sửa.</p></div>
              </>}
          </div>
          <div className="card-h" style={{ borderTop: "1px solid var(--border)", borderBottom: 0, justifyContent: "flex-end", gap: 8 }}>
            <button type="button" className="btn btn-ghost" disabled={resource.refreshing} onClick={() => void resource.refresh()}>{icon("refresh")}Làm mới</button>
            <Dialog.Close className="btn btn-primary">Đóng</Dialog.Close></div>
        </Dialog.Content></Dialog.Portal>
    </Dialog.Root>
  </>;
}
