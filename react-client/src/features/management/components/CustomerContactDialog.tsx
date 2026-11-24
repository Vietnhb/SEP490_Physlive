import { useState } from "react";
import { Button, Dialog, IconButton } from "@radix-ui/themes";
import { Cross2Icon } from "@radix-ui/react-icons";
import CustomerEmailPanel from "./CustomerEmailPanel";
import { useResource } from "../../../shared/hooks/operationsData";
import modal from "../../../shared/ui/ModalScroll.module.css";
import s from "./CustomerContactDialog.module.css";

type ContactInfo = {
  school: { id: string; name: string; code: string; contactName: string | null; email: string | null; phone: string | null };
};

export default function CustomerContactDialog({ schoolId, onClose }: {
  schoolId: string; onClose: () => void;
}) {
  const [opener] = useState(() => document.activeElement instanceof HTMLElement ? document.activeElement : null);
  const resource = useResource<ContactInfo>("/reports/customer-usage/" + schoolId + "/contacts?page=0&size=1");
  const school = resource.data?.school;
  return <Dialog.Root open onOpenChange={open => { if (!open) onClose(); }}>
    <Dialog.Content className={modal.dialog + " " + s.dialog} maxWidth="840px"
      onCloseAutoFocus={event => {
        if (opener?.isConnected) { event.preventDefault(); opener.focus({ preventScroll: true }); }
      }}>
      <header className={s.header}>
        <div><Dialog.Title mb="1">Nhật ký email của trường</Dialog.Title>
          <Dialog.Description>{school?.name || "Thông tin trường và lịch sử email"}</Dialog.Description></div>
        <IconButton variant="soft" color="gray" aria-label="Đóng nhật ký" onClick={onClose}><Cross2Icon /></IconButton>
      </header>
      <div className={modal.body}>
        {resource.error && <p role="alert" className={s.error}>{resource.error}</p>}
        {resource.loading ? <p role="status">Đang tải thông tin liên hệ…</p> : !school ?
          <Button onClick={() => void resource.refresh()}>Thử lại</Button> : <>
            <section className={s.info}>
              <div><small>Người phụ trách</small><strong>{school.contactName || "Chưa cập nhật"}</strong><span>{school.code}</span></div>
              <div><small>Email liên hệ</small><strong>{school.email || "Chưa cập nhật"}</strong>
                {school.email?.toLowerCase().endsWith(".invalid") && <span>Email dữ liệu demo</span>}</div>
              <div><small>Số điện thoại</small><strong>{school.phone || "Chưa cập nhật"}</strong></div>
            </section>
            <CustomerEmailPanel schoolId={schoolId} />
          </>}
      </div>
      <footer className={s.footer}><Button variant="soft" onClick={onClose}>Đóng</Button></footer>
    </Dialog.Content>
  </Dialog.Root>;
}
