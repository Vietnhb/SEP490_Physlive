export type UsageSchool = {
  id: string; name: string; code: string; plan: string | null; licenseEnd: string | null;
  activeUsers: number; aiCalls: number; assignments: number; submissions: number; tokens: number; revenue: number;
  lastActivity: string | null; attention: string; lastContactAt?: string | null; nextFollowUpAt?: string | null; lastContactOutcome?: string | null;
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

export const contactOutcomes: Record<string,string> = { NO_ANSWER:"Chưa liên lạc được", WAITING:"Chờ trường phản hồi", CONTACTED:"Đã trao đổi", RESOLVED:"Đã hoàn tất", EMAIL_SENT:"Đã gửi email", EMAIL_DELIVERED:"Email đã chuyển đến", EMAIL_REPLIED:"Trường đã phản hồi email", EMAIL_DELAYED:"Email chuyển chậm", EMAIL_BOUNCED:"Email bị trả lại", EMAIL_COMPLAINED:"Email bị báo spam", EMAIL_FAILED:"Email gửi thất bại" };
