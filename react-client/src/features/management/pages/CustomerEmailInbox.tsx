import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Badge, Button, Select } from "@radix-ui/themes";
import { EnvelopeClosedIcon, MagnifyingGlassIcon } from "@radix-ui/react-icons";
import { useResource } from "../../../shared/hooks/operationsData";
import RefreshButton from "../../../shared/ui/RefreshButton";
import { Delivery, EmailThread } from "../components/CustomerEmailPanel";
import s from "./CustomerEmailInbox.module.css";
export type InboxItem={id:string;schoolId:string;schoolName:string;recipient:string;subject:string;preview:string;status:string;actorName:string;createdAt:string;activityAt:string;replyCount:number;unreadCount:number;latestReplyId:string|null};
type InboxPage={items:InboxItem[];totalElements:number;page:number;size:number;totalPages:number};
export type MailNotifications={unreadCount:number;items:InboxItem[]};
const format=(date:string)=>new Date(date).toLocaleString("vi-VN",{timeZone:"Asia/Ho_Chi_Minh",dateStyle:"short",timeStyle:"short"});
function Choice({label,value,options,onChange}:{label:string;value:string;options:[string,string][];onChange:(value:string)=>void}){
 return <label className={s.field}><span>{label}</span><Select.Root value={value||"ALL"} onValueChange={value=>onChange(value==="ALL"?"":value)}><Select.Trigger aria-label={label}/><Select.Content position="popper">{options.map(([key,text])=><Select.Item key={key} value={key}>{text}</Select.Item>)}</Select.Content></Select.Root></label>;
}
export default function CustomerEmailInbox(){
 const [params,setParams]=useSearchParams();
 const school=params.get("school")||"", selected=params.get("thread"), selectedSchool=params.get("threadSchool")||school;
 const [query,setQuery]=useState(""),[filter,setFilter]=useState(""),[delivery,setDelivery]=useState(""),[from,setFrom]=useState(""),[to,setTo]=useState("");
 const [page,setPage]=useState(0),[size,setSize]=useState(10);
 const search=new URLSearchParams({query,filter:filter||"ALL",delivery,from,to,page:String(page),size:String(size)});
 if(!from)search.delete("from");if(!to)search.delete("to");if(school)search.set("schoolId",school);
 const resource=useResource<InboxPage>("/reports/customer-usage/email-inbox?"+search,true,15000);
 const alerts=useResource<MailNotifications>("/reports/customer-usage/email-inbox/notifications",true,15000);
 const data=resource.data;
 const automation=useResource<{enabled:boolean;configured:boolean}>("/reports/customer-usage/email-inbox/automation",true,15000);
 const change=(action:()=>void)=>{action();setPage(0);};
 const open=(item:InboxItem)=>{const next=new URLSearchParams(params);next.set("thread",item.id);next.set("threadSchool",item.schoolId);setParams(next);};
 const close=()=>{const next=new URLSearchParams(params);next.delete("thread");next.delete("threadSchool");setParams(next);};
 const reset=()=>{setQuery("");setFilter("");setDelivery("");setFrom("");setTo("");setPage(0);setParams(selected&&selectedSchool?{thread:selected,threadSchool:selectedSchool}:{});};
 return <main className={s.page}>
  <RefreshButton disabled={resource.refreshing} onClick={()=>{void resource.refresh();void alerts.refresh();}}/>
  <header className={s.heading}><h1>Nhật ký email tự động</h1>{!!alerts.data?.unreadCount&&<Badge color="blue">{alerts.data.unreadCount} phản hồi chưa đọc</Badge>}</header>
  {automation.data&&(!automation.data.enabled||!automation.data.configured)&&<p className={s.error} role="status">Gửi email tự động chưa hoạt động.</p>}
  <section className={s.filters} aria-label="Bộ lọc email">
   <label className={s.field}><span>Tìm kiếm</span><div className={s.search}><MagnifyingGlassIcon/><input value={query} placeholder="Trường, tiêu đề hoặc email…" onChange={e=>change(()=>setQuery(e.target.value))}/></div></label>
   <Choice label="Phản hồi" value={filter} onChange={value=>change(()=>setFilter(value))} options={[["ALL","Tất cả email"],["UNREAD","Phản hồi chưa đọc"],["REPLIED","Có phản hồi"]]}/>
   <Choice label="Trạng thái gửi" value={delivery} onChange={value=>change(()=>setDelivery(value))} options={[["ALL","Tất cả trạng thái"],["QUEUED","Chờ gửi"],["SENDING","Đang gửi"],["ACCEPTED","Đã gửi"],["DELIVERED","Đã chuyển đến"],["UNKNOWN","Chưa xác định kết quả"],["DELAYED","Chuyển thư chậm"],["FAILED","Gửi thất bại"],["SKIPPED","Đã bỏ qua"],["BOUNCED","Bị trả lại"],["COMPLAINED","Bị báo spam"]]}/>
   <label className={s.field}><span>Gửi từ ngày</span><input aria-label="Gửi từ ngày" type="date" value={from} onChange={e=>change(()=>setFrom(e.target.value))}/></label>
   <label className={s.field}><span>Đến ngày</span><input aria-label="Đến ngày" type="date" min={from} value={to} onChange={e=>change(()=>setTo(e.target.value))}/></label>
   <Button variant="ghost" onClick={reset}>Xóa bộ lọc</Button>
  </section>
  {school&&<div className={s.scope}>Đang lọc theo trường đã chọn. <Button size="1" variant="ghost" onClick={()=>{const next=new URLSearchParams(params);next.delete("school");setParams(next);setPage(0);}}>Xem tất cả trường</Button></div>}
  {resource.error&&<p role="alert" className={s.error}>{resource.error}</p>}
  <div className={s.workspace}>
   <section className={s.inbox} aria-label="Danh sách email"><div className={s.listHeading}><strong>{data?data.totalElements+" email":"Email đã gửi"}</strong>{resource.refreshing&&data&&<small>Đang cập nhật…</small>}</div>
    {!data&&!resource.error?<p className={s.empty} role="status">Đang tải hộp thư…</p>:data&&!data.items.length?<div className={s.empty}><EnvelopeClosedIcon/><strong>Không có email phù hợp</strong><p>Thay đổi bộ lọc để tra cứu. Email được tạo khi trường đạt mốc cần nhắc.</p></div>:<div className={s.mailList}>{data?.items.map(item=><button key={item.id} className={[s.mail,selected===item.id?s.selected:"",item.unreadCount?s.newMail:""].join(" ")} onClick={()=>open(item)} aria-pressed={selected===item.id}>
     <div className={s.top}><strong title={item.schoolName}>{item.schoolName}</strong><time>{format(item.activityAt)}</time></div>
     <div className={s.subject}><span title={item.subject}>{item.subject}</span>{item.unreadCount>0&&<Badge color="blue">Mới</Badge>}</div>
     <div className={s.bottom}><Delivery status={item.status}/>{item.replyCount>0&&<span>{item.replyCount} phản hồi</span>}</div>
    </button>)}</div>}
    {data&&<footer className={s.pagination}><Choice label="Số dòng" value={String(size)} options={[["5","5"],["10","10"],["20","20"],["50","50"]]} onChange={value=>change(()=>setSize(Number(value)))}/>{data.totalPages>1&&<><span>{data.page+1}/{data.totalPages}</span><Button size="1" variant="soft" disabled={data.page===0||resource.refreshing} onClick={()=>setPage(data.page-1)}>Trước</Button><Button size="1" variant="soft" disabled={data.page+1>=data.totalPages||resource.refreshing} onClick={()=>setPage(data.page+1)}>Sau</Button></>}</footer>}
   </section>
   <section className={s.reader} aria-label="Nội dung cuộc trao đổi">{selected&&selectedSchool?<><EmailThread key={selected} schoolId={selectedSchool} emailId={selected} onClose={close}/></>:<div className={s.welcome}><EnvelopeClosedIcon/><h2>Chọn email để xem chi tiết</h2></div>}</section>
  </div>
 </main>;
}
