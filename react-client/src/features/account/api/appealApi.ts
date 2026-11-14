import axiosClient from "../../../shared/api/client";
import axios from "axios";
import { apiMessage } from "../../../shared/lib/apiError";

class AppealSendTimeoutError extends Error { }
export const appealErrorMessage = (error: unknown, fallback: string) => error instanceof AppealSendTimeoutError ? error.message : apiMessage(error, fallback);

export type Appeal = {
  id: string;
  userId: number;
  userEmail: string;
  userName: string;
  reason: string;
  content: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  resolutionNote?: string | null;
  createdAt: string;
  authority?: "SCHOOL" | "SYSTEM" | null;
  canResolve?: boolean;
  currentSuspension?: boolean;
  resolvedAt?: string | null;
};

export const createAppeal = async (payload: { reason: string; content: string }, files: File[] = [], progress?: (message: string) => void): Promise<Appeal> => {
  const data = new FormData();
  if (files.length) {
    data.append("request", new Blob([JSON.stringify(payload)], { type: "application/json" }));
    files.forEach(file => data.append("files", file));
  }
  progress?.(files.length ? "Đang tải ảnh minh chứng…" : "Đang gửi đơn…");
  try {
    const res = files.length ? await axiosClient.post<Appeal>("/appeals", data, {
      headers: { "Content-Type": "multipart/form-data" }, timeout: 60_000,
      onUploadProgress: event => progress?.(event.total && event.loaded >= event.total
        ? "Đã tải ảnh lên máy chủ. Đang lưu đơn khiếu nại…"
        : event.total ? `Đang tải ảnh: ${Math.round(event.loaded * 100 / event.total)}%` : "Đang tải ảnh minh chứng…"),
    }) : await axiosClient.post<Appeal>("/appeals", payload, { timeout: 60_000 });
    return res.data;
  } catch (error) {
    if (axios.isAxiosError(error) && error.code === "ECONNABORTED")
      throw new AppealSendTimeoutError("Máy chủ phản hồi quá lâu. Đơn có thể vẫn đang được lưu; hãy làm mới lịch sử để kiểm tra trước khi gửi lại.");
    throw error;
  }
};

export const getMyAppeals = async (): Promise<Appeal[]> => {
  const res = await axiosClient.get<Appeal[]>("/appeals/my");
  return res.data;
};

export const getAdminAppeals = async (): Promise<Appeal[]> => {
  const res = await axiosClient.get<Appeal[]>("/admin/appeals");
  return res.data;
};

export const resolveAppeal = async (id: string, payload: { status: "APPROVED" | "REJECTED"; resolutionNote?: string }): Promise<Appeal> => {
  const res = await axiosClient.put<Appeal>(`/admin/appeals/${id}/resolve`, payload);
  return res.data;
};
