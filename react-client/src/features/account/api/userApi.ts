import { readData } from "../../../shared/api/readData";
import type { User } from "../../../shared/auth/types";
import type { PermissionCode } from "../../../shared/auth/permissions";
import axiosClient from "../../../shared/api/client";

export const getMe = (): Promise<User> => readData<User>("/user/me", 0);
export const updateProfile = async (payload: { fullName: string; dateOfBirth?: string }) => {
    const res = await axiosClient.put<User>("/user/me/profile", payload);
    return res.data;
};

export const updateAvatar = async (avatarUrl: string) => {
    const res = await axiosClient.put<User>("/user/me/avatar", { avatarUrl });
    return res.data;
};

export const changePassword = async (currentPassword: string, newPassword: string) => {
    const res = await axiosClient.put<User>("/user/me/password", { currentPassword, newPassword });
    return res.data;
};

export type LicenseStatus = {
    active: boolean;
    inGraceMode: boolean;
    showRenewalBanner: boolean;
    daysUntilExpiry: number;
    canPerformWriteOperations: boolean;
    licenseEnd: string | null;
};
export const getLicenseStatus = () => readData<LicenseStatus>("/user/me/license");

const usersPath = (schoolId?: string) => schoolId ? `/schools/${schoolId}/users` : "/admin/users";

export const adminUsers = (schoolId?: string) =>
  axiosClient.get<User[]>(usersPath(schoolId)).then(r => r.data);

export type ManagedUserDetails = { fullName: string; role: string; institutionId?: string; dateOfBirth?: string | null; avatarUrl?: string | null; permissions?: PermissionCode[] };

export const createManagedUser = (payload: ManagedUserDetails & { email: string; password: string }, schoolId?: string) =>
  axiosClient.post<User>(usersPath(schoolId), payload).then(r => r.data);

export const updateManagedUser = (id: number, payload: ManagedUserDetails, schoolId?: string) =>
  axiosClient.put<User>(`${usersPath(schoolId)}/${id}`, payload).then(r => r.data);

export const resetManagedUserPassword = (id: number, newPassword: string, schoolId?: string) =>
  axiosClient.post<User>(`${usersPath(schoolId)}/${id}/reset-password`, { newPassword }).then(r => r.data);

export const setManagedUserActive = (id: number, active: boolean, schoolId?: string, reason?: string) =>
  axiosClient.put<User>(schoolId ? `${usersPath(schoolId)}/${id}/${active ? "restore" : "suspend"}` : `/admin/users/${id}/${active ? "restore" : "suspend"}`, active ? undefined : { reason }).then(r => r.data);

export type PostStats = {
  periodTotalPosts: number;
  publicPosts: number;
  privatePosts: number;
  deletedOrHiddenPosts: number;
};

export type PostBreakdown = {
  totalCumulativePosts: number;
  cumulative: PostStats;
  weekly: PostStats;
  monthly: PostStats;
};

export type OperationStats = { simulationRuns: number; submissions: number; gradedSubmissions: number };

export type AdminAnalytics = {
  postsThisWeek: number;
  postsThisMonth: number;
  operationsThisWeek: number;
  operationsThisMonth: number;
  operationBreakdown?: { weekly: OperationStats; monthly: OperationStats; weekStart: string; monthStart: string; measuredAt: string };
  postBreakdown?: PostBreakdown;
  revenue: {
    totalVnd: number;
    weeklyVnd: number;
    monthlyVnd: number;
    paidCount: number;
    pendingCount: number;
    failedCount: number;
    byPlan: Array<{ planCode: string; name: string; amountVnd: number; count: number }>;
    timeline: Array<{ period: string; amountVnd: number; posts: number; operations: number }>;
    recentTransactions: Array<{ id: string; schoolName: string; planCode: string | null; planName: string; amountVnd: number; status: string; createdAt: string }>;
  };
};

export const getAdminAnalytics = (): Promise<AdminAnalytics> =>
  axiosClient.get<AdminAnalytics>("/admin/analytics").then(res => res.data);