import { Avatar, Badge, Button, Dialog, IconButton } from "@radix-ui/themes";
import { Cross2Icon, ReloadIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { useResource } from "../../../shared/hooks/operationsData";
import { getRoleLabel } from "../../../shared/auth/roles";
import { PERMISSION_LABELS, type PermissionCode } from "../../../shared/auth/permissions";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";
import modal from "../../../shared/ui/ModalScroll.module.css";
import s from "./SchoolAccountProfileDialog.module.css";

type Profile = {
  id: number; fullName: string; email: string; avatarUrl: string | null; dateOfBirth: string | null;
  role: "STAFF" | "STUDENT"; permissions: PermissionCode[]; active: boolean; accountStatus: string;
  lastLogin: string | null; schoolId: string; schoolName: string;
  classes: { id: string; name: string; gradeLevel: number; schoolYear: string; subject: string | null }[];
};

export default function SchoolAccountProfileDialog({ schoolId, userId, onClose }: Readonly<{
  schoolId: string; userId: number; onClose: () => void;
}>) {
  const [opener] = useState(() => document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const resource = useResource<Profile>("/schools/" + schoolId + "/users/" + userId + "/profile");
  const profile = resource.data;
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Content className={modal.dialog} maxWidth="720px" aria-describedby="school-profile-description" onCloseAutoFocus={event => { if (opener?.isConnected) { event.preventDefault(); opener.focus({ preventScroll: true }); } }}>
      <div className={s.heading}>
        <div><Dialog.Title mb="1">Hồ sơ tài khoản</Dialog.Title><Dialog.Description id="school-profile-description" size="2">Thông tin giáo viên, học sinh và các lớp đang tham gia trong trường.</Dialog.Description></div>
        <Dialog.Close><IconButton variant="soft" color="gray" aria-label="Đóng hồ sơ"><Cross2Icon /></IconButton></Dialog.Close>
      </div>
      <div className={modal.body}>
        {resource.error && <div className={s.error} role="alert"><span>{resource.error}</span><Button variant="soft" size="1" onClick={() => void resource.refresh()}>Thử lại</Button></div>}
        {resource.loading ? <CardLoadingSkeleton cards={1} label="Đang tải hồ sơ tài khoản…" /> : profile && <>
          <div className={s.identity}>
            <Avatar size="6" radius="full" src={profile.avatarUrl || undefined} fallback={(profile.fullName || profile.email).slice(0, 1).toUpperCase()} />
            <div className={s.identityText}><h2>{profile.fullName}</h2><p>{profile.email}</p><div className={s.badges}>
              <Badge color={profile.role === "STAFF" ? "orange" : "blue"}>{getRoleLabel(profile.role)}</Badge>
              <Badge color={!profile.active ? "amber" : profile.accountStatus === "WARNED" ? "orange" : "green"}>{!profile.active ? "Tạm khóa" : profile.accountStatus === "WARNED" ? "Cảnh báo" : "Hoạt động"}</Badge>
            </div></div>
          </div>
          <dl className={s.details}>
            <div><dt>Ngày sinh</dt><dd>{profile.dateOfBirth ? new Date(profile.dateOfBirth + "T00:00:00").toLocaleDateString("vi-VN") : "Chưa cập nhật"}</dd></div>
            <div><dt>Trường</dt><dd>{profile.schoolName}</dd></div>
            <div><dt>Đăng nhập gần nhất</dt><dd>{profile.lastLogin ? new Date(profile.lastLogin).toLocaleString("vi-VN") : "Chưa đăng nhập"}</dd></div>
            {profile.role === "STAFF" && <div><dt>Quyền trong trường</dt><dd>{profile.permissions.map(code => PERMISSION_LABELS[code] ?? code).join(" · ") || "Chưa cấp quyền"}</dd></div>}
          </dl>
          <section aria-labelledby="profile-classes-heading" className={s.classes}>
            <div className={s.sectionHeading}><h3 id="profile-classes-heading">{profile.role === "STAFF" ? "Lớp đang được phân công" : "Lớp đang học"}</h3></div>
            {profile.classes.length ? <ul>{profile.classes.map(item => <li key={item.id}>
              <div><strong>{item.name}</strong><p>Khối {item.gradeLevel} · {item.schoolYear}{item.subject ? " · " + item.subject : ""}</p></div>
            </li>)}</ul> : <p className={s.empty}>{profile.role === "STAFF" ? "Chưa được phân công vào lớp đang hoạt động." : "Chưa được xếp vào lớp đang hoạt động."}</p>}
          </section>
        </>}
      </div>
      <div className={s.footer}><Button variant="outline" disabled={resource.refreshing} onClick={() => void resource.refresh()}><ReloadIcon />Làm mới</Button><Dialog.Close><Button>Đóng</Button></Dialog.Close></div>
    </Dialog.Content>
  </Dialog.Root>;
}
