export type UsageSchool = {
  id: string; name: string; code: string; plan: string | null; licenseEnd: string | null;
  activeUsers: number; aiCalls: number; assignments: number; submissions: number; tokens: number; revenue: number;
  lastActivity: string | null; attention: string;
};
export type UsageMetric = "aiCalls" | "activeUsers" | "assignments" | "submissions" | "tokens" | "revenue";
export type UsagePoint = { label: string; activeUsers: number; aiCalls: number; assignments: number; submissions: number; revenue: number };
export type CustomerUsageReport = {
  year: number; month: number | null;
  summary: { schools: number; activeSchools: number; activeUsers: number; aiCalls: number; assignments: number; submissions: number; tokens: number; revenue: number };
  trend: UsagePoint[]; ranking: UsageSchool[]; attention: { key: string; count: number }[];
  items: UsageSchool[]; totalElements: number; page: number; size: number; totalPages: number;
  plans: string[]; firstRecordedAt: string | null; asOf: string;
};
