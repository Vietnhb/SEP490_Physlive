import { useResource } from "../../../shared/hooks/operationsData";
import { Badge, Heading, Progress, Text } from "@radix-ui/themes";
import { ErrorNotice, Panel, Stat } from "../../../shared/ui/ManagementUI";
import { DashboardLoadingSkeleton } from "../../../shared/ui/LoadingSkeleton";

export function OverviewView() {
  const resource = useResource<{ accounts: Record<string, number>; schools: number; activeSchools: number; validation: { total: number; failed: number; failureRate: number } }>("/admin/overview-counts");
  const counts = resource.data?.accounts ?? {};
  const total = counts.total ?? 0;
  const metrics = resource.data?.validation;
  const loading = resource.loading;
  const error = resource.error;
  const load = resource.refresh;
  const activeUsers = total - (counts.suspended ?? 0);
  const teachers = counts.STAFF ?? 0;
  const systemAccounts = (counts.ADMIN ?? 0) + (counts.MANAGER ?? 0);
  const schoolAccounts = (counts.SCHOOL ?? 0) + (counts.STAFF ?? 0);
  const individualAccounts = total - systemAccounts - schoolAccounts;
  const activeSchools = resource.data?.activeSchools ?? 0;
  const passed = metrics ? metrics.total - metrics.failed : 0;
  const hasValidationData = Boolean(metrics?.total);
  const rate = hasValidationData && metrics ? (passed / metrics.total) * 100 : 0;

  if (loading) return <div className="admin-content"><DashboardLoadingSkeleton cards={4} label="Đang tải tổng quan hệ thống…" /></div>;

  return (
    <div className="admin-content">
      
      {error && <ErrorNotice error={error} onRetry={() => void load()} />}

      <div className="admin-stats-grid">
        <Stat label="Tổng người dùng" value={total} icon="users" tone="blue" />
        <Stat label="Đang hoạt động" value={activeUsers} icon="activity" tone="green" note={`${total - activeUsers} tài khoản tạm khóa`} />
        <Stat label="Giáo viên" value={teachers} icon="book" tone="orange" />
        <Stat label="Trường học" value={(resource.data?.schools ?? 0)} icon="grid" tone="purple" note={`${activeSchools} đang hoạt động`} />
      </div>

      <div className="admin-dashboard-grid">
        <Panel title="Kết quả kiểm định" description="Tổng hợp các lượt kiểm tra solver và lời giải tham chiếu.">
          <Heading as="h3" size="8" color="indigo" className="admin-health-value">
            {hasValidationData ? `${rate.toFixed(1)}%` : "—"}
          </Heading>
          <Progress value={Math.max(0, Math.min(100, rate))} color="indigo" aria-label="Tỷ lệ kiểm định đạt" />
          <div className="admin-health-meta">
            <Badge color="green" size="2">{passed} lượt đạt</Badge>
            <Badge color="amber" size="2">{metrics?.failed ?? 0} lượt lỗi</Badge>
          </div>
        </Panel>

        <Panel title="Phân bổ tài khoản" description={`Ba nhóm bao phủ toàn bộ ${total} tài khoản.`}>
          <div className="admin-breakdown-list">
            <div><Text>Quản trị hệ thống</Text><Badge color="gray" size="2">{systemAccounts}</Badge></div>
            <div><Text>Trường học</Text><Badge color="gray" size="2">{schoolAccounts}</Badge></div>
            <div><Text>Cá nhân</Text><Badge color="gray" size="2">{individualAccounts}</Badge></div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

