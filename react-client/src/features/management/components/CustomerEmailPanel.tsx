import { useEffect, useState } from "react";
import { Badge, Button } from "@radix-ui/themes";
import { Link } from "react-router-dom";
import api from "../../../shared/api/client";
import { useResource } from "../../../shared/hooks/operationsData";
import s from "./CustomerEmailPanel.module.css";
type Mail={id:string;actorName:string;recipient:string;subject:string;body:string;reason:string;status:string;lastError:string|null;createdAt:string;sentAt:string|null;replyCount:number;canRetry:boolean};
type MailPage={items:Mail[];totalElements:number;page:number;size:number;totalPages:number;configured:boolean};
type Thread={email:Mail;replies:{id:string;sender:string;subject:string;body:string;attachments:string;receivedAt:string}[];totalElements:number;page:number;totalPages:number};
const statuses:Record<string,string>={QUEUED:"Chờ gửi",SENDING:"Đang gửi",UNKNOWN:"Chưa xác định kết quả",ACCEPTED:"Đã gửi",DELAYED:"Chuyển thư chậm",DELIVERED:"Đã chuyển đến",BOUNCED:"Bị trả lại",COMPLAINED:"Bị báo spam",SKIPPED:"Đã bỏ qua",FAILED:"Gửi thất bại"};
const date=(value:string)=>new Date(value).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh"});
export function Delivery({status}:{status:string}){return <Badge color={status==="DELIVERED"?"green":["BOUNCED","FAILED","COMPLAINED"].includes(status)?"red":["UNKNOWN","DELAYED"].includes(status)?"amber":"blue"}>{statuses[status]||status}</Badge>;}
export function EmailThread({schoolId,emailId,onClose}:{schoolId:string;emailId:string;onClose:()=>void}){
 const [page,setPage]=useState(0);const resource=useResource<Thread>("/reports/customer-usage/"+schoolId+"/emails/"+emailId+"?page="+page,true,5000);const data=resource.data;
 const ids=data?.replies.map(reply=>reply.id).join(",")||"";
 const [readError,setReadError]=useState("");
 useEffect(()=>{
  if(!ids)return;
  let active=true;
  void api.post("/reports/customer-usage/email-inbox/"+emailId+"/read",{replyIds:ids.split(",")})
   .catch(()=>{if(active)setReadError("Chưa lưu được trạng thái đã đọc. Mở lại cuộc trao đổi để thử lại.");});
  return ()=>{active=false;};
 },[emailId,ids]);
 return <section className={s.thread} aria-label="Cuộc trao đổi email"><header><h3>Chi tiết email và phản hồi</h3><Button size="1" variant="ghost" onClick={onClose}>Đóng chi tiết</Button></header>{resource.error?<p role="alert">{resource.error}</p>:!data?<p role="status">Đang tải cuộc trao đổi…</p>:<><article className={s.message}><div className={s.messageTop}><strong>{data.email.subject}</strong><Delivery status={data.email.status}/></div><p className={s.meta}>Đến: {data.email.recipient} · {date(data.email.createdAt)} · {data.email.actorName}</p><p className={s.body}>{data.email.body}</p></article>{readError&&<p role="alert">{readError}</p>}<h4>Thư trả lời ({data.totalElements})</h4>{!data.replies.length?<p className={s.muted}>Chưa có thư trả lời từ trường.</p>:data.replies.map(reply=><article className={s.reply} key={reply.id}><strong>{reply.subject}</strong><p className={s.meta}>Từ: {reply.sender} · {date(reply.receivedAt)}</p><ReplyBody body={reply.body}/>{reply.attachments!=="[]"&&<p className={s.muted}>Email có tệp đính kèm. Phiên bản này hiển thị nội dung thư; tệp được giữ tại dịch vụ email.</p>}</article>)}{data.totalPages>1&&<div className={s.pager}><Button size="1" disabled={page===0} onClick={()=>setPage(page-1)}>Trước</Button><span>Trang {page+1}/{data.totalPages}</span><Button size="1" disabled={page+1>=data.totalPages} onClick={()=>setPage(page+1)}>Sau</Button></div>}</> }</section>;
}
export function ReplyBody({body}:{body:string}){
 const match=/^(?:On .+wrote:|Vào .+(?:viết|wrote):|From:|>)/m.exec(body);
 if(!match)return <p className={s.body}>{body}</p>;
 const cut=match.index;
 return <><p className={s.body}>{body.slice(0,cut).trim()||"Email này chỉ trích dẫn nội dung trao đổi trước."}</p><details className={s.quoted}><summary>Hiện nội dung trước đó</summary><p className={s.body}>{body.slice(cut)}</p></details></>;
}
export default function CustomerEmailPanel({schoolId}:{schoolId:string}){
 const [page,setPage]=useState(0),[selected,setSelected]=useState<string|null>(null);
 const resource=useResource<MailPage>("/reports/customer-usage/"+schoolId+"/emails?page="+page+"&size=10",true,5000);const data=resource.data;
 return <section className={s.panel} aria-label="Nhật ký email của trường">
  <header><div><h3>Nhật ký email</h3><Link to={"/manager/emails?school="+schoolId}>Xem tất cả nhật ký của trường</Link><p className={s.muted}>Hệ thống tự gửi nhắc hạn gói và hạn mức AI. Manager chỉ theo dõi kết quả gửi.</p></div></header>
  {resource.error&&<p role="alert" className={s.error}>{resource.error}</p>}
  {selected&&<EmailThread schoolId={schoolId} emailId={selected} onClose={()=>setSelected(null)}/>}
  {!data&&!resource.error?<p role="status">Đang tải nhật ký…</p>:data&&<><div className={s.historyHeading}><h4>Lịch sử email ({data.totalElements})</h4><Button size="1" variant="ghost" disabled={resource.refreshing} onClick={()=>void resource.refresh()}>Làm mới nhật ký</Button></div>
   {!data.items.length?<p className={s.muted}>Chưa có email được ghi nhận cho trường này.</p>:<ul className={s.list}>{data.items.map(mail=><li key={mail.id}><div className={s.messageTop}><button className={s.title} onClick={()=>setSelected(mail.id)} title={mail.subject}>{mail.subject}</button><Delivery status={mail.status}/></div><p className={s.meta}>{date(mail.createdAt)} · {mail.actorName} · {mail.replyCount} phản hồi</p>{mail.lastError&&<p className={s.failure}>{mail.lastError}</p>}<div className={s.actions}><Button size="1" variant="ghost" onClick={()=>setSelected(mail.id)}>Xem chi tiết</Button></div></li>)}</ul>}
   {data.totalPages>1&&<div className={s.pager}><Button size="1" disabled={page===0||resource.refreshing} onClick={()=>setPage(page-1)}>Trước</Button><span>Trang {page+1}/{data.totalPages}</span><Button size="1" disabled={page+1>=data.totalPages||resource.refreshing} onClick={()=>setPage(page+1)}>Sau</Button></div>}</>}
  <p className={s.muted}>“Đã gửi”: dịch vụ đã tiếp nhận. “Đã chuyển đến”: máy chủ người nhận đã nhận thư, chưa xác nhận người nhận đã đọc. Email thủ công trước đây vẫn được lưu để tra cứu.</p>
 </section>;
}
