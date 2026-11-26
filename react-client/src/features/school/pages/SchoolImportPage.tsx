import { useState } from "react";
import { AlertDialog, Button, Flex } from "@radix-ui/themes";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { SchoolImportWorkflow, type ImportCompletion } from "../dataio/components/SchoolBulkImport";
import { IMPORT_LABELS, type ImportKind } from "../dataio/api/importApi";
import s from "./SchoolImportPage.module.css";
import ImportDataArt from "../dataio/components/ImportDataArt";
import { CheckIcon, FileTextIcon } from "@radix-ui/react-icons";

const IMPORT_KINDS: ImportKind[] = ["USERS", "CLASSES", "ENROLLMENTS", "TEACHER_ASSIGNMENTS"];

export default function SchoolImportPage() {
  const schoolId = useSessionStore(state => state.user?.schoolId);
  const [kind, setKind] = useState<ImportKind>("USERS");
  const [busy, setBusy] = useState(false);
  const [recent, setRecent] = useState<ImportCompletion[]>([]);
  const [hasPendingData, setHasPendingData] = useState(false);
  const [pendingKind, setPendingKind] = useState<ImportKind | null>(null);

  if (!schoolId) return null;

  const changeKind = (next: ImportKind) => {
    if (next === kind || busy) return;
    if (hasPendingData) {
      setPendingKind(next);
      return;
    }
    setHasPendingData(false);
    setKind(next);
  };

  const confirmKindChange = () => {
    if (!pendingKind) return;
    setHasPendingData(false);
    setKind(pendingKind);
    setPendingKind(null);
  };

  return <div className={`admin-content ${s.page}`}>
    <header className={s.heading}><div><h1>Nhập dữ liệu</h1><p>Tải lên tệp CSV để kiểm tra, chỉnh sửa và xác nhận trước khi nhập.</p></div><ImportDataArt className={s.art} /></header>
    <div className={s.layout}>
    <div className={s.main}>
    <div className={s.card}>
      <div className={s.tabsScroll}>
        <div className={s.tabs} role="tablist" aria-label="Loại dữ liệu nhập">
          {IMPORT_KINDS.map(item => <button key={item} type="button" disabled={busy} role="tab" aria-selected={kind === item} aria-controls="school-import-workflow" className={kind === item ? s.activeTab : ""} onClick={() => changeKind(item)}>{IMPORT_LABELS[item]}</button>)}
        </div>
      </div>
      <div id="school-import-workflow" role="tabpanel" aria-label={IMPORT_LABELS[kind]} className={s.panel}>
        <SchoolImportWorkflow key={kind} schoolId={schoolId} kind={kind} onPendingChange={setHasPendingData} onBusyChange={setBusy} showTemplateExample onCompleted={entry => setRecent(current => [entry, ...current].slice(0, 5))} />
      </div>
    </div>
    </div>
    <aside className={s.sidebar}>
      <section className={s.sideCard}><h2>Lần nhập gần đây</h2><p>Các lần nhập thành công trong phiên này.</p>
        {recent.length ? <div className={s.history}>{recent.map((entry, index) => <article key={entry.completedAt + index}><span className={s.fileIcon}><FileTextIcon /></span><div><strong title={entry.filename}>{entry.filename}</strong><small>{entry.imported.toLocaleString("vi-VN")} dòng · {new Date(entry.completedAt).toLocaleDateString("vi-VN")}</small></div><span className={s.success}>Thành công</span></article>)}</div> : <div className={s.emptyHistory}><FileTextIcon /><span>Chưa có lần nhập nào trong phiên này.</span></div>}
      </section>
      <section className={s.sideCard}><h2>Thứ tự nhập</h2><p>Tài khoản và mã lớp cần có trước khi xếp lớp hoặc phân công.</p>
        <ol className={s.importOrder}>{IMPORT_KINDS.map((item, index) => {
          const completed = recent.find(entry => entry.kind === item);
          return <li key={item}><button type="button" disabled={busy} onClick={() => changeKind(item)} aria-current={kind === item ? "step" : undefined} className={kind === item ? s.currentOrder : ""}><span className={completed ? s.completedIcon : s.orderIcon}>{completed ? <CheckIcon /> : index + 1}</span><span><strong>{IMPORT_LABELS[item]}</strong><small>{completed ? `Đã nhập ${completed.imported.toLocaleString("vi-VN")} dòng trong phiên` : kind === item ? "Đang chọn" : item === "USERS" ? "Tạo tài khoản giáo viên, học sinh" : item === "CLASSES" ? "Khai báo lớp và năm học" : "Dùng email và mã lớp đã tồn tại"}</small></span></button></li>;
        })}</ol>
      </section>
    </aside>
    </div>

    <AlertDialog.Root open={pendingKind !== null} onOpenChange={open => { if (!open) setPendingKind(null); }}>
      <AlertDialog.Content maxWidth="460px">
        <AlertDialog.Title>Hủy phiên nhập hiện tại?</AlertDialog.Title>
        <AlertDialog.Description size="2">
          Bạn có dữ liệu chưa xác nhận. Chuyển sang tab khác sẽ xóa tệp và kết quả xem trước hiện tại.
        </AlertDialog.Description>
        <Flex gap="3" mt="4" justify="end">
          <AlertDialog.Cancel><Button variant="soft" color="gray">Tiếp tục nhập</Button></AlertDialog.Cancel>
          <AlertDialog.Action><Button color="red" onClick={confirmKindChange}>Hủy và chuyển tab</Button></AlertDialog.Action>
        </Flex>
      </AlertDialog.Content>
    </AlertDialog.Root>
  </div>;
}
