import styles from "./PlansView.module.css";
import BillingArt from "../components/BillingArt";
import LearningIcon from "../../../shared/ui/LearningIcon";
import RefreshButton from "../../../shared/ui/RefreshButton";
import { useResource } from "../../../shared/hooks/operationsData";
import { useState, type FormEvent } from "react";
import { Button as ThemeButton, Checkbox, Dialog, Table, Text, TextField } from "@radix-ui/themes";
import { saveManagedPlan, type ManagedPlan, type PaymentAnalytics } from "../api/billingApi";
import type { ManagedSchool } from "../../school/api/schoolApi";
import { apiMessage } from "../../../shared/lib/apiError";
import { Loading, ErrorNotice, Button, FormField } from "../../../shared/ui/ManagementUI";
import modal from "../../../shared/ui/ModalScroll.module.css";

function CardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <path d="M2 10h20" />
    </svg>
  );
}

function BuildingIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M16 9h2a2 2 0 0 1 2 2v10M2 21h20M8 7h4M8 11h4M8 15h4" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.4 12.4 2.5 2.5 4.9-5.3" />
    </svg>
  );
}

function formatCompactVnd(amount: number): string {
  if (amount >= 1_000_000_000) {
    const val = amount / 1_000_000_000;
    return `${val.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ ₫`;
  }
  if (amount >= 1_000_000) {
    const val = amount / 1_000_000;
    return `${val.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr ₫`;
  }
  return `${Math.round(amount).toLocaleString("vi-VN")} ₫`;
}

function formatShortMillions(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `${(amount / 1_000_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tỷ`;
  }
  if (amount >= 1_000_000) {
    return `${(amount / 1_000_000).toLocaleString("vi-VN", { maximumFractionDigits: 1 })} tr`;
  }
  return `${Math.round(amount).toLocaleString("vi-VN")} ₫`;
}

function buildSparkline(values: number[]): { line: string; area: string } | null {
  if (values.length < 2 || values.every(v => v === 0)) return null;
  const w = 120;
  const h = 30;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [
    (i / (values.length - 1)) * w,
    h - 3 - ((v - min) / span) * (h - 8),
  ]);
  const line = pts.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  return { line, area: `${line} L${w} ${h} L0 ${h} Z` };
}

export function PlansView() {
  const [form, setForm] = useState<ManagedPlan | null>(null);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const currentYear = Number(new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).slice(0, 4));
  const plansResource = useResource<ManagedPlan[]>("/admin/plans", true);
  const schoolsResource = useResource<ManagedSchool[]>("/admin/schools");
  const analyticsResource = useResource<PaymentAnalytics>(
    `/admin/payment-analytics?period=YEAR&year=${currentYear}&timezone=Asia%2FHo_Chi_Minh`,
  );

  const items = plansResource.data ?? [];
  const schools = schoolsResource.data ?? [];
  const analytics = analyticsResource.data;
  const knownPlans = plansResource.data !== undefined;
  const knownSchools = schoolsResource.data !== undefined;
  const knownAnalytics = analytics !== undefined;
  const loading = plansResource.loading && !knownPlans;
  const error = plansResource.error || "";

  const refreshAll = () => {
    void plansResource.refresh();
    void schoolsResource.refresh();
    void analyticsResource.refresh();
  };

  const activePlans = items.filter(plan => plan.active).length;
  const hiddenPlans = items.length - activePlans;
  const totalSchools = schools.length;
  const schoolsUsingPlan = schools.filter(school => Boolean(school.planCode || school.licenseEnd)).length;

  const grossPaidVnd = analytics?.kpis.grossPaidVnd ?? 0;
  const paidTransactions = analytics?.kpis.paidTransactions ?? 0;
  const avgValuePerSchool = schoolsUsingPlan > 0 && grossPaidVnd > 0
    ? grossPaidVnd / schoolsUsingPlan
    : paidTransactions > 0
      ? grossPaidVnd / paidTransactions
      : 0;

  const planNameMap = new Map(items.map(plan => [plan.code, plan.name]));
  const resolvePlanName = (code: string | null) => {
    if (!code) return "Do vận hành cấp";
    return planNameMap.get(code) ?? code;
  };

  // Cumulative trend for revenue sparkline
  const cumulativeTrend = (analytics?.trend ?? []).reduce<number[]>((acc, point) => {
    const prev = acc.length > 0 ? acc[acc.length - 1] : 0;
    acc.push(prev + (point.revenueVnd ?? 0));
    return acc;
  }, []);
  const spark = buildSparkline(cumulativeTrend);

  // Revenue by plan (paid this year)
  const revenueByPlan = (analytics?.packages ?? [])
    .filter(pkg => pkg.revenueVnd > 0)
    .map(pkg => ({
      code: pkg.planCode,
      label: resolvePlanName(pkg.planCode),
      value: pkg.revenueVnd,
    }))
    .sort((a, b) => b.value - a.value);
  const maxRevenue = Math.max(1, ...revenueByPlan.map(row => row.value));

  // Active schools by plan
  const schoolCountMap = new Map<string, number>();
  for (const school of schools) {
    if (!school.planCode && !school.licenseEnd) continue;
    const key = school.planCode ?? "__granted";
    schoolCountMap.set(key, (schoolCountMap.get(key) ?? 0) + 1);
  }
  const schoolsByPlan = Array.from(schoolCountMap.entries())
    .map(([code, count]) => ({
      code,
      label: code === "__granted" ? "Do vận hành cấp" : resolvePlanName(code),
      count,
    }))
    .sort((a, b) => b.count - a.count);
  const maxSchoolCount = Math.max(1, ...schoolsByPlan.map(row => row.count));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form || busy) return;
    setBusy(true);
    setFormError("");
    try {
      await saveManagedPlan(form, editing);
      setForm(null);
      refreshAll();
    } catch (err) {
      setFormError(apiMessage(err, "Không thể lưu gói."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`admin-content ${styles.page}`}>
      <RefreshButton disabled={plansResource.refreshing || schoolsResource.refreshing || analyticsResource.refreshing} onClick={refreshAll} />

      <header className={styles.heading}>
        <div className={styles.headingText}>
          <h1>Gói dịch vụ</h1>
          <p>Các gói nhà trường có thể mua và gia hạn</p>
        </div>
        <div className={styles.headingActions}>
          <ThemeButton
            type="button"
            size="3"
            color="teal"
            className={styles.createBtn}
            onClick={() => {
              setEditing(false);
              setFormError("");
              setForm({ code: "", name: "", description: "", annualPriceVnd: 0, studentQuota: 0, monthlyTokenQuota: 0, active: false });
            }}
          >
            <LearningIcon name="plus" />
            Thêm gói
          </ThemeButton>
          <div className={styles.artWrap}>
            <BillingArt className={styles.art} />
          </div>
        </div>
      </header>

      {error && <ErrorNotice error={error} onRetry={refreshAll} />}

      <section className={styles.stats} aria-label="Chỉ số gói dịch vụ">
        <article className={`${styles.stat} ${styles.violet}`}>
          <span className={styles.statIcon}><CardIcon /></span>
          <span className={styles.statLabel}>Gói đang bán</span>
          <strong className={styles.statValue}>{knownPlans ? activePlans.toLocaleString("vi-VN") : "—"}</strong>
          <span className={styles.statHint}>{knownPlans ? `${hiddenPlans.toLocaleString("vi-VN")} gói ẩn` : "Đang tải…"}</span>
        </article>

        <article className={`${styles.stat} ${styles.violet}`}>
          <span className={styles.statIcon}><BuildingIcon /></span>
          <span className={styles.statLabel}>Trường đang dùng</span>
          <strong className={styles.statValue}>{knownSchools ? schoolsUsingPlan.toLocaleString("vi-VN") : "—"}</strong>
          <span className={styles.statHint}>{knownSchools ? `Trên ${totalSchools.toLocaleString("vi-VN")} trường` : "Đang tải…"}</span>
        </article>

        <article className={`${styles.stat} ${styles.violet}`}>
          <span className={styles.statIcon}><CardIcon /></span>
          <span className={styles.statLabel}>Doanh thu năm nay</span>
          <strong className={styles.statValue}>{knownAnalytics ? formatCompactVnd(grossPaidVnd) : "—"}</strong>
          <span className={styles.statHint}>{knownAnalytics ? `${paidTransactions.toLocaleString("vi-VN")} giao dịch đã thanh toán` : `Năm ${currentYear}`}</span>
          {spark && (
            <svg className={styles.spark} viewBox="0 0 120 30" preserveAspectRatio="none" aria-hidden="true">
              <path className={styles.sparkArea} d={spark.area} />
              <path className={styles.sparkLine} d={spark.line} />
            </svg>
          )}
        </article>

        <article className={`${styles.stat} ${styles.indigo}`}>
          <span className={styles.statIcon}><LearningIcon name="chart" /></span>
          <span className={styles.statLabel}>Giá trị trung bình</span>
          <strong className={styles.statValue}>{knownAnalytics && knownSchools ? formatCompactVnd(avgValuePerSchool) : "—"}</strong>
          <span className={styles.statHint}>Mỗi trường mỗi năm</span>
        </article>
      </section>

      <Dialog.Root open={form !== null} onOpenChange={open => { if (!open && !busy) { setForm(null); setFormError(""); } }}>
        <Dialog.Content className={modal.dialog} maxWidth="680px" onEscapeKeyDown={event => { if (busy) event.preventDefault(); }} onInteractOutside={event => { if (busy) event.preventDefault(); }}>
          <div className={modal.body}>
            <Dialog.Title>{editing ? "Cập nhật gói" : "Thêm gói"}</Dialog.Title>
            <Dialog.Description size="2" mb="5">Thay đổi áp dụng cho báo giá mới. Các giao dịch đã tạo giữ số tiền và hạn mức đã chốt.</Dialog.Description>
            {formError && <ErrorNotice error={formError} />}
            {form && (
              <form className="admin-form-grid" onSubmit={submit}>
                <FormField label="Mã gói" htmlFor="managed-plan-code"><TextField.Root id="managed-plan-code" size="3" required maxLength={40} pattern={"[A-Z0-9_\\-]+"} readOnly={editing} value={form.code} onChange={e => setForm({ ...form, code: e.target.value.toUpperCase() })} /></FormField>
                <FormField label="Tên gói" htmlFor="managed-plan-name"><TextField.Root id="managed-plan-name" size="3" required maxLength={255} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></FormField>
                <FormField label="Mô tả" htmlFor="managed-plan-description"><TextField.Root id="managed-plan-description" size="3" required maxLength={255} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></FormField>
                <FormField label="Giá / năm (VND)" htmlFor="managed-plan-price"><TextField.Root id="managed-plan-price" size="3" type="number" required min="1" step="1" value={form.annualPriceVnd || ""} onChange={e => setForm({ ...form, annualPriceVnd: Number(e.target.value) })} /></FormField>
                <FormField label="Hạn mức học sinh" htmlFor="managed-plan-students"><TextField.Root id="managed-plan-students" size="3" type="number" required min="1" step="1" value={form.studentQuota || ""} onChange={e => setForm({ ...form, studentQuota: Number(e.target.value) })} /></FormField>
                <FormField label="Hạn mức AI / tháng, tính bằng token (để trống = không giới hạn)" htmlFor="managed-plan-tokens"><TextField.Root id="managed-plan-tokens" size="3" type="number" min="0" step="1" value={form.monthlyTokenQuota ?? ""} onChange={e => setForm({ ...form, monthlyTokenQuota: e.target.value === "" ? null : Number(e.target.value) })} /></FormField>
                <Text as="label" className="admin-checkbox"><Checkbox checked={form.active} onCheckedChange={checked => setForm({ ...form, active: checked === true })} /> Cho phép đăng ký</Text>
                <div className="admin-form-actions"><Button type="button" disabled={busy} onClick={() => { setForm(null); setFormError(""); }}>Hủy</Button><ThemeButton type="submit" size="3" color="teal" loading={busy} disabled={busy}>{busy ? "Đang lưu…" : "Lưu gói"}</ThemeButton></div>
              </form>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Root>

      <div className={styles.split}>
        <section className={styles.card} aria-label="Gói đăng ký">
          {loading ? (
            <Loading text="Đang tải danh sách gói…" headers={["Gói", "Giá / năm", "Học sinh", "Token / tháng", "Trạng thái", "Thao tác"]} />
          ) : (
            <>
              <Table.Root className={styles.tableWrap} size="2" variant="ghost">
                <Table.Header>
                  <Table.Row>
                    <Table.ColumnHeaderCell>Gói</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={styles.num}>Giá / năm</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={styles.num}>Học sinh</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={styles.num}>Token / tháng</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell>Trạng thái</Table.ColumnHeaderCell>
                    <Table.ColumnHeaderCell className={styles.num}><span className="sr-only">Thao tác</span></Table.ColumnHeaderCell>
                  </Table.Row>
                </Table.Header>
                <Table.Body>
                  {items.length === 0 ? (
                    <Table.Row>
                      <Table.Cell colSpan={6} className={styles.emptyCell}>Chưa có gói dịch vụ nào.</Table.Cell>
                    </Table.Row>
                  ) : (
                    items.map(plan => (
                      <Table.Row key={plan.code}>
                        <Table.Cell>
                          <div className={styles.planMain}>
                            <span className={styles.planName}>{plan.name}</span>
                            <span className={styles.planMeta}>
                              <span className={styles.mono}>{plan.code}</span>
                              {plan.description ? ` · ${plan.description}` : ""}
                            </span>
                          </div>
                        </Table.Cell>
                        <Table.Cell className={styles.num}>{plan.annualPriceVnd.toLocaleString("vi-VN")} ₫</Table.Cell>
                        <Table.Cell className={styles.num}>{plan.studentQuota.toLocaleString("vi-VN")}</Table.Cell>
                        <Table.Cell className={styles.num}>{plan.monthlyTokenQuota == null ? "Không giới hạn" : plan.monthlyTokenQuota.toLocaleString("vi-VN")}</Table.Cell>
                        <Table.Cell>
                          <span className={`${styles.statusBadge} ${plan.active ? styles.statusActive : styles.statusHidden}`}>
                            {plan.active ? <CheckCircleIcon /> : <span className={styles.statusDot} aria-hidden="true" />}
                            {plan.active ? "Đang bán" : "Ẩn"}
                          </span>
                        </Table.Cell>
                        <Table.Cell className={styles.num}>
                          <ThemeButton
                            type="button"
                            size="2"
                            variant="surface"
                            color="gray"
                            onClick={() => {
                              setEditing(true);
                              setFormError("");
                              setForm({ ...plan });
                            }}
                          >
                            Sửa
                          </ThemeButton>
                        </Table.Cell>
                      </Table.Row>
                    ))
                  )}
                </Table.Body>
              </Table.Root>
              <p className={styles.tableNote}>Thay đổi áp dụng cho báo giá mới. Các giao dịch đã tạo giữ số tiền và hạn mức đã chốt.</p>
            </>
          )}
        </section>

        <aside className={styles.insights}>
          <section className={styles.card}>
            <div className={styles.panelHead}>
              <h2>Doanh thu năm nay theo gói</h2>
              <span>Đã thanh toán</span>
            </div>
            <div className={styles.panelBody}>
              {revenueByPlan.length === 0 ? (
                <p className={styles.panelEmpty}>Chưa có giao dịch đã thanh toán trong năm {currentYear}.</p>
              ) : (
                revenueByPlan.map((row, index) => (
                  <div key={row.code} className={styles.hrow}>
                    <div className={styles.hrowHead}>
                      <span>{row.label}</span>
                      <strong>{formatShortMillions(row.value)}</strong>
                    </div>
                    <span className={styles.bar}>
                      <i
                        className={`${styles.barFill} ${index === 0 ? styles.barFillPrimary : ""}`}
                        style={{ width: `${Math.max(4, Math.round((row.value / maxRevenue) * 100))}%` }}
                      />
                    </span>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className={styles.card}>
            <div className={styles.panelHead}>
              <h2>Số trường đang dùng</h2>
            </div>
            <div className={styles.panelBody}>
              {schoolsByPlan.length === 0 ? (
                <p className={styles.panelEmpty}>Chưa có trường nào kích hoạt gói.</p>
              ) : (
                schoolsByPlan.map((row, index) => (
                  <div key={row.code} className={styles.hrow}>
                    <div className={styles.hrowHead}>
                      <span>{row.label}</span>
                      <strong>{row.count.toLocaleString("vi-VN")}</strong>
                    </div>
                    <span className={styles.bar}>
                      <i
                        className={`${styles.barFill} ${index === 0 ? styles.barFillPrimary : ""}`}
                        style={{ width: `${Math.max(6, Math.round((row.count / maxSchoolCount) * 100))}%` }}
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
