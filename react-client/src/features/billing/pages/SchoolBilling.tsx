import { useResource } from "../../../shared/hooks/operationsData";
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Badge, Button, Card, Table } from "@radix-ui/themes";
import { motion, useReducedMotion } from "motion/react";
import { type LicensePlan } from "../api/billingApi";
import { purchaseSchoolPlan, quoteSchoolPlan } from "../api/billingApi";
import type { LicenseStatus } from "../../account/api/userApi";
import type { PlanQuote, SchoolBilling as Billing } from "../../school/types";
import { apiMessage } from "../../../shared/lib/apiError";
import { useSessionStore } from "../../../shared/auth/sessionStore";
import BillingArt from "../components/BillingArt";
import RefreshButton from "../../../shared/ui/RefreshButton";
import { CheckCircledIcon } from "@radix-ui/react-icons";
import s from "./SchoolBilling.module.css";
import { CardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";

const money = (amount: number) => `${amount.toLocaleString("vi-VN")} ₫`;
const date = (value: string | null) =>
  value
    ? new Date(`${value}T00:00:00`).toLocaleDateString("vi-VN")
    : "Chưa cấp";
const statuses: Record<string, string> = {
  PAID: "Đã thanh toán",
  FAILED: "Thất bại",
  PENDING: "Chờ thanh toán",
  EXPIRED: "Hết phiên",
  REQUIRES_REVIEW: "Cần đối soát",
};
const purposes: Record<string, string> = {
  REGISTRATION: "Đăng ký",
  UPGRADE: "Nâng gói",
  RENEWAL: "Gia hạn",
};

export default function SchoolBilling() {
  const reducedMotion = useReducedMotion();
  const navigate = useNavigate();
  const user = useSessionStore((state) => state.user);
  const [quote, setQuote] = useState<PlanQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setError] = useState("");
  const billingResource = useResource<Billing>("/school/billing");
  const plansResource = useResource<LicensePlan[]>("/auth/plans");
  const licenseResource = useResource<LicenseStatus>("/user/me/license");
  const billing = billingResource.data ?? null;
  const plans = plansResource.data ?? [];
  const licenseWritable = licenseResource.data?.canPerformWriteOperations ?? null;
  const loading = billingResource.loading || plansResource.loading;
  const error = actionError || billingResource.error || plansResource.error || "";
  const [selectedDraft, setSelected] = useState("");
  const selected = selectedDraft || billing?.planChoices?.find(choice => choice.planCode === billing.planCode && choice.allowed)?.planCode || billing?.planChoices?.find(choice => choice.allowed)?.planCode || "";
  const load = () => { setError(""); setQuote(null); return Promise.all([billingResource.refresh(), plansResource.refresh(), licenseResource.refresh()]); };
  useEffect(() => {
    const actor = useSessionStore.getState().user;
    if (actor && licenseWritable !== null && actor.billingRequired !== !licenseWritable) {
      useSessionStore.getState().setUser({ ...actor, billingRequired: !licenseWritable });
    }
  }, [licenseWritable]);

  const getQuote = async () => {
    if (busy || !selected || billing?.planChoices?.find(choice => choice.planCode === selected)?.allowed !== true) return;
    setBusy(true);
    setError("");
    setQuote(null);
    try {
      setQuote(await quoteSchoolPlan(selected));
    } catch (err) {
      setError(apiMessage(err, "Không thể lấy báo giá."));
    } finally {
      setBusy(false);
    }
  };
  const pay = async () => {
    if (!quote || busy) return;
    setBusy(true);
    setError("");
    try {
      const payment = await purchaseSchoolPlan(quote.planCode, quote.amountVnd);
      sessionStorage.setItem("physlive.schoolPayment", payment.paymentId);
      if (payment.paymentUrl) window.location.assign(payment.paymentUrl);
      else
        navigate(
          `/signup/payment-result?vnp_TxnRef=${encodeURIComponent(payment.paymentId)}`,
        );
    } catch (err) {
      setError(apiMessage(err, "Không thể tạo thanh toán."));
      setQuote(null);
      setBusy(false);
    }
  };
  const selectedChoice = billing?.planChoices?.find(choice => choice.planCode === selected);
  return <motion.div className={`admin-content ${s.billing}`} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : .18 }}>
    <RefreshButton onClick={() => void load()} disabled={loading || busy} />
    <header className={s.pageHeading}><h1>Mua & gia hạn gói</h1><BillingArt className={s.art} /></header>
    {user?.billingRequired && <div className="admin-error-banner" role="status">Trường chưa có gói còn hiệu lực. Hãy chọn gói và hoàn tất thanh toán để mở các chức năng quản lý.</div>}
    {error && <div className="admin-error-banner" role="alert">{error}<Button variant="soft" color="red" onClick={() => void load()}>Tải lại</Button></div>}
    {loading ? <CardLoadingSkeleton cards={3} label="Đang tải thông tin gói…" /> : billing && <>
      <Card asChild size="3"><section className={`admin-panel ${s.currentPanel}`} aria-label="Gói hiện tại và mức sử dụng">
        <div className={s.sectionHeading}><h2>Gói hiện tại và mức sử dụng</h2><Badge color={licenseWritable ? "green" : "orange"} className={s.status}>{licenseWritable && <CheckCircledIcon />}{licenseWritable ? "Đang hiệu lực" : licenseWritable === false ? "Chưa hiệu lực" : "Chưa xác minh"}</Badge></div>
        <dl className={s.currentSummary}>
          <div><dt>Gói</dt><dd>{plans.find(plan => plan.code === billing.planCode)?.name || billing.planCode || (billing.licenseEnd ? "Gói được cấp" : "Chưa mua gói")}</dd></div>
          <div><dt>Thời hạn sử dụng</dt><dd>{date(billing.licenseStart)} — {date(billing.licenseEnd)}</dd></div>
          <div><dt>Học sinh đang hoạt động</dt><dd>{billing.studentsUsed.toLocaleString("vi-VN")} / {billing.studentQuota == null ? "Không giới hạn" : billing.studentQuota.toLocaleString("vi-VN")}</dd></div>
          <div><dt>Token AI tháng này</dt><dd>{billing.tokensUsed.toLocaleString("vi-VN")} / {billing.monthlyTokenQuota == null ? "Không giới hạn" : billing.monthlyTokenQuota.toLocaleString("vi-VN")}</dd></div>
        </dl>
      </section></Card>
      <Card asChild size="3"><section className={`admin-panel ${s.planPanel}`}>
        <div className={s.sectionHeading}><h2>{user?.billingRequired ? "Chọn gói để bắt đầu" : "Nâng gói hoặc gia hạn"}</h2><span className={s.caption}>Gói năm</span></div>
        <p className={s.planGuide}>Nâng gói có hiệu lực ngay sau khi thanh toán, thu chênh lệch theo thời hạn còn lại. Gia hạn gói hiện tại thêm một năm.</p>
        {licenseWritable === false && <p className={s.notice} role="status">Gói đã hết hạn hoặc chưa hiệu lực. Chọn gói phù hợp với số học sinh để gia hạn.</p>}
        {licenseWritable === null && <p className={s.notice} role="status">Chưa xác minh được trạng thái gói. Các lựa chọn sẽ được kiểm tra lại khi lấy báo giá.</p>}
        {plans.length === 0 ? <p className={s.emptyState}>Chưa có gói đăng ký khả dụng.</p> : <div className={s.planOptions} role="radiogroup" aria-label="Gói đăng ký">
          {plans.map(plan => {
            const choice = billing.planChoices?.find(entry => entry.planCode === plan.code);
            const disabled = busy || choice?.allowed !== true;
            return <label key={plan.code} className={`${s.planOption} ${selected === plan.code ? s.selectedPlan : ""} ${disabled ? s.disabledPlan : ""}`}>
              <input type="radio" name="school-plan" value={plan.code} checked={selected === plan.code} disabled={disabled} onChange={() => { setSelected(plan.code); setQuote(null); setError(""); }} />
              <div className={s.planCopy}><div className={s.planName}><strong>{plan.name}</strong>{billing.planCode === plan.code && <span>Hiện tại</span>}</div>
                <p>{plan.studentQuota.toLocaleString("vi-VN")} học sinh · {plan.monthlyTokenQuota == null ? "Không giới hạn token AI" : `${plan.monthlyTokenQuota.toLocaleString("vi-VN")} token/tháng`}</p>
                <div className={s.planPrice}>{money(plan.annualPriceVnd)} <small>/ năm</small></div>
                <p className={s.choiceNote}>{choice?.allowed ? choice.purpose === "UPGRADE" ? "Nâng cấp ngay sau thanh toán" : "Gia hạn thêm một năm" : choice?.reason || "Chưa xác minh được gói khả dụng."}</p>
              </div>
            </label>;
          })}
        </div>}
        <div className={s.checkout}>
          <div className={s.quote} aria-live="polite">{quote ? <><p>Tổng thanh toán: <strong>{money(quote.amountVnd)}</strong></p><small>{purposes[quote.purpose]} · {date(quote.licenseStart)} — {date(quote.licenseEnd)}</small>{quote.purpose === "UPGRADE" && <small>Giữ ngày hết hạn hiện tại. Gói mới có hiệu lực sau thanh toán.</small>}</> : <p className={s.quoteHint}>Chọn gói và lấy báo giá để xem số tiền thanh toán.</p>}</div>
          <div className={s.checkoutActions}><Button variant="outline" color="gray" disabled={!selected || busy || selectedChoice?.allowed !== true} loading={busy && !quote} onClick={() => void getQuote()}>Lấy báo giá</Button><Button className={s.payButton} disabled={!quote || busy} loading={busy && !!quote} onClick={() => void pay()}>Xác nhận và thanh toán qua VNPAY</Button></div>
        </div>
      </section></Card>
      <Card asChild size="3"><section className={`admin-panel ${s.historyPanel}`}><div className={s.sectionHeading}><h2>Lịch sử thanh toán</h2><span className={s.caption}>{billing.payments.length.toLocaleString("vi-VN")} giao dịch</span></div><div className={s.tableScroll}><Table.Root variant="surface" size="2"><Table.Header><Table.Row><Table.ColumnHeaderCell>Thời gian</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Gói</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Nội dung</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Số tiền</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Trạng thái</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Giao dịch</Table.ColumnHeaderCell></Table.Row></Table.Header><Table.Body>
        {billing.payments.length === 0 ? <Table.Row><Table.Cell colSpan={6}><div className={s.emptyState}>Chưa có giao dịch thanh toán.</div></Table.Cell></Table.Row> : billing.payments.map(payment => <Table.Row key={payment.id}><Table.Cell>{new Date(payment.createdAt).toLocaleString("vi-VN")}</Table.Cell><Table.Cell>{plans.find(plan => plan.code === payment.planCode)?.name || payment.planCode}</Table.Cell><Table.Cell>{purposes[payment.purpose] || payment.purpose}</Table.Cell><Table.Cell className={s.amount}>{money(payment.amountVnd)}</Table.Cell><Table.Cell><Badge color={payment.status === "PAID" ? "green" : payment.status === "PENDING" ? "amber" : payment.status === "REQUIRES_REVIEW" ? "purple" : "red"}>{statuses[payment.status] || payment.status}</Badge></Table.Cell><Table.Cell><Button asChild variant="ghost" size="1"><Link to={`/signup/payment-result?vnp_TxnRef=${encodeURIComponent(payment.id)}`}>Xem giao dịch</Link></Button></Table.Cell></Table.Row>)}
      </Table.Body></Table.Root></div></section></Card>
    </>}
  </motion.div>;
}
