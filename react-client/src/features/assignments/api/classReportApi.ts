import api from "../../../shared/api/client";
import { saveFile } from "../../../shared/lib/saveFile";
export type ClassReportTotals = { assignments:number; recipients:number; submitted:number; notSubmitted:number; late:number; awaitingGrade:number; confirmed:number; missedDeadline:number; average10:number|null; submissionRate:number|null };
export type ClassReportRow = Omit<ClassReportTotals,"assignments"|"submissionRate"> & { id:string; title:string; assignedBy:string; status:string; assignedAt:string; dueAt:string|null };
export type ClassReport = { classId:string; className:string; schoolYear:string; asOf:string; summary:ClassReportTotals; items:ClassReportRow[]; page:number; size:number; totalPages:number; totalElements:number };
export type ClassReportFilters = { query:string; status:string; from:string; to:string };
export function classReportUrl(classId:string, filters:ClassReportFilters, page=0, size=10, csv=false) {
  const params = new URLSearchParams({query:filters.query,status:filters.status});
  if (filters.from) params.set("from",filters.from);
  if (filters.to) params.set("to",filters.to);
  if (!csv) { params.set("page",String(page)); params.set("size",String(size)); }
  return "/assignments/mine/teacher/classes/" + encodeURIComponent(classId) + "/report" + (csv ? "/csv" : "") + "?" + params;
}
export async function downloadClassReport(classId:string, filters:ClassReportFilters) {
  const response = await api.get<Blob>(classReportUrl(classId,filters,0,10,true),{responseType:"blob"});
  saveFile("ket-qua-lop-"+classId+".csv",response.data);
}
