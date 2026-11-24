import axiosClient from "../../../shared/api/client";

export type SupportKind = "FEEDBACK" | "MESSAGE" | "COMPLAINT";
export type SupportStatus = "OPEN" | "READ" | "RESOLVED";
export type SupportItem = { id: string; kind: SupportKind; senderId: number; senderName: string; senderEmail: string; subject: string; content: string; status: SupportStatus; adminResponse?: string | null; createdAt: string; respondedAt?: string | null; reviewerReferred?: boolean; responderName?: string | null };
export type ComplaintCounts = {
  open: number;
  read: number;
  resolved: number;
  total: number;
  under24h: number;
  from24To48h: number;
  over48h: number;
  oldestOpenCreatedAt?: string | null;
};

export const adminSupportItems = (kind?: SupportKind) => axiosClient.get<SupportItem[]>("/support/admin", { params: kind ? { kind } : undefined }).then(r => r.data);
export const referComplaintToReviewer = (id: string) => axiosClient.post<SupportItem>(`/support/admin/${id}/refer-reviewer`).then(r => r.data);
export const updateSupportItem = (id: string, status: SupportStatus, response?: string) => axiosClient.put<SupportItem>(`/support/admin/${id}`, { status, response }).then(r => r.data);
/** Simulation complaints: sent by teachers, answered by reviewers. */
export type SimulationComplaint = SupportItem & {
  simulationId?: string | null;
  simulationSnapshot?: unknown | null;
  hasSimulationSnapshot?: boolean;
  assignedToId?: number | null;
  assignedToName?: string | null;
  responderName?: string | null;
  lawGapId?: string | null;
  lawGapStatus?: "OPEN" | "RESOLVED" | "DISMISSED" | string | null;
};
export type ComplaintPage = {
  items: SimulationComplaint[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
};
export const submitSimulationComplaint = (subject: string, content: string, simulationId?: string, simulationSnapshot?: unknown) =>
  axiosClient.post<SimulationComplaint>("/support/complaints", { subject, content, simulationId, ...(simulationSnapshot ? { simulationSnapshot } : {}) }).then(r => r.data);
export const mySupportItems = () => axiosClient.get<SimulationComplaint[]>("/support/mine").then(r => r.data);
export const submitSupportRequest = (kind: "MESSAGE" | "FEEDBACK", subject: string, content: string) =>
  axiosClient.post<SupportItem>(kind === "MESSAGE" ? "/support/messages" : "/support/feedback", { subject, content }).then(r => r.data);
export const complaintsForReview = () => axiosClient.get<SimulationComplaint[]>("/support/complaints/review").then(r => r.data);
export const complaintForReview = (id: string) => axiosClient.get<SimulationComplaint>(`/support/complaints/review/${id}`).then(r => r.data);
export const resolveComplaint = (id: string, status: SupportStatus, response?: string, expectedStatus?: SupportStatus, expectedRespondedAt?: string | null) =>
  axiosClient.put<SimulationComplaint>(`/support/complaints/review/${id}`, {
    status,
    response,
    ...(expectedStatus ? { expectedStatus } : {}),
    ...(expectedRespondedAt ? { expectedRespondedAt } : {}),
  }).then(r => r.data);
export const claimComplaint = (id: string, release = false, force = false) =>
  axiosClient.post<SimulationComplaint>(`/support/complaints/review/${id}/claim`, null, { params: { release, force } }).then(r => r.data);
export const escalateComplaintToLawGap = (id: string, payload?: { schemaId?: string; topic?: string; note?: string }) =>
  axiosClient.post<SimulationComplaint>(`/support/complaints/review/${id}/escalate-law-gap`, payload ?? {}).then(r => r.data);
