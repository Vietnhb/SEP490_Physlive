import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { Badge, Button, Callout, Dialog, Flex, IconButton, TextArea, TextField } from "@radix-ui/themes";
import { Cross2Icon, ExclamationTriangleIcon, LockClosedIcon } from "@radix-ui/react-icons";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import { createAppeal, appealErrorMessage } from "../api/appealApi";
import { AppealEvidencePicker } from "./AppealEvidence";
import modal from "../../../shared/ui/ModalScroll.module.css";

export default function AccountSuspendedBanner() {
  const user = useSessionStore(state => state.user);
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("Yêu cầu xem xét mở khóa tài khoản");
  const [content, setContent] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const isSuspended = user && (user.accountStatus === "SUSPENDED_READ_ONLY" || user.active === false);
  if (!isSuspended) return null;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    setError("");
    setNotice("");
    try {
      await createAppeal({ reason: reason.trim(), content: content.trim() }, files, setProgress);
      setNotice("Đã gửi đơn khiếu nại thành công! Quản trị viên sẽ xem xét và phản hồi sớm.");
      setContent("");
      setFiles([]);
    } catch (err) {
      setError(appealErrorMessage(err, "Không thể gửi khiếu nại lúc này. Vui lòng thử lại."));
    } finally {
      setSubmitting(false);
    }
  };

  const internalAdmin = ["MANAGER", "ADMIN"].includes(user.role);
  const expirationText = user.suspendedUntil
    ? `Thời hạn: đến ${new Date(user.suspendedUntil).toLocaleString("vi-VN")}`
    : "Thời hạn: Đến khi có quyết định xử lý từ Quản trị viên";

  return (
    <>
      <div
        role="alert"
        style={{
          background: "var(--red-3, #fee2e2)",
          borderBottom: "1px solid var(--red-6, #fca5a5)",
          color: "var(--red-11, #991b1b)",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          fontSize: "13px",
        }}
      >
        <Flex align="center" gap="3" style={{ flex: 1, minWidth: "280px" }}>
          <Badge color="red" size="2" variant="solid">
            <LockClosedIcon /> TÀI KHOẢN TẠM KHÓA
          </Badge>
          <div>
            <strong>{internalAdmin ? "Tài khoản quản trị đang bị tạm khóa:" : "Bạn chỉ có thể gửi và theo dõi yêu cầu mở khóa:"}</strong>{" "}
            {user.suspensionReason ? user.suspensionReason : "Chưa có lý do cụ thể."}{" "}
            <span style={{ opacity: 0.85 }}>({expirationText})</span>
          </div>
        </Flex>

        {!internalAdmin && <Button
          type="button"
          size="2"
          variant="solid"
          color="red"
          onClick={() => setOpen(true)}
          style={{ cursor: "pointer" }}
        >
          <ExclamationTriangleIcon /> Gửi khiếu nại tài khoản
        </Button>}
        {internalAdmin && <span>Vui lòng liên hệ quản trị viên hệ thống để mở lại tài khoản.</span>}
        <Link to="/support">Xem lịch sử và phản hồi</Link>
      </div>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Content maxWidth="600px" className={modal.dialog}><div className={modal.body}>
          <Flex justify="between" align="center" mb="3">
            <Dialog.Title mb="0">Khiếu nại tài khoản tạm khóa</Dialog.Title>
            <Dialog.Close>
              <IconButton variant="ghost" color="gray" aria-label="Đóng"><Cross2Icon /></IconButton>
            </Dialog.Close>
          </Flex>

          <Dialog.Description size="2" mb="4">
            Gửi yêu cầu xem xét mở khóa. School xử lý quyết định khóa của nhà trường; Manager xử lý quyết định khóa cấp hệ thống. Mỗi tài khoản chỉ có một đơn đang chờ.
          </Dialog.Description>

          {notice && (
            <Callout.Root color="green" mb="3" role="status">
              <Callout.Text>{notice}</Callout.Text>
            </Callout.Root>
          )}

          {error && (
            <Callout.Root color="red" mb="3" role="alert">
              <Callout.Text>{error}</Callout.Text>
            </Callout.Root>
          )}

          <form onSubmit={handleSubmit} style={{ display: "grid", gap: "14px" }}>
            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 500 }}>
              Tiêu đề / Lý do khiếu nại
              <TextField.Root
                required
                disabled={submitting}
                maxLength={200}
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </label>

            <label style={{ display: "grid", gap: "6px", fontSize: "13px", fontWeight: 500 }}>
              Nội dung giải trình chi tiết
              <TextArea
                required
                rows={4}
                maxLength={10000}
                disabled={submitting}
                placeholder="Mô tả hoàn cảnh, bằng chứng hoặc cam kết khắc phục vi phạm…"
                value={content}
                onChange={e => setContent(e.target.value)}
              />
            </label>

            <AppealEvidencePicker files={files} onChange={setFiles} disabled={submitting} />
            {submitting && <p role="status" style={{ margin: 0, fontSize: 13 }}>{progress}</p>}
            <Flex justify="end" gap="3" mt="2">
              <Dialog.Close>
                <Button variant="soft" color="gray" disabled={submitting}>Hủy</Button>
              </Dialog.Close>
              <Button type="submit" loading={submitting} disabled={submitting || !content.trim()}>
                Gửi đơn khiếu nại
              </Button>
            </Flex>
          </form>
        </div></Dialog.Content>
      </Dialog.Root>
    </>
  );
}
