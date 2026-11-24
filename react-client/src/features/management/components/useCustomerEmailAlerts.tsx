import { useEffect, useRef, useState } from "react";
import { useResource } from "../../../shared/hooks/operationsData";
import type { InboxItem, MailNotifications } from "../pages/CustomerEmailInbox";
export const threadUrl=(item:InboxItem)=>"/manager/emails?thread="+item.id+"&threadSchool="+item.schoolId;
export function useCustomerEmailAlerts(){
 const resource=useResource<MailNotifications>("/reports/customer-usage/email-inbox/notifications",true,15000);
 const seen=useRef<Set<string>|null>(null);
 const latest=useRef<number|null>(null);
 const [notice,setNotice]=useState<InboxItem|null>(null);
 useEffect(()=>{
  const items=resource.data?.items;if(!items)return;
  const ids=items.map(item=>item.latestReplyId).filter((id):id is string=>!!id);
  if(seen.current){const fresh=items.find(item=>item.latestReplyId&&!seen.current!.has(item.latestReplyId));if(fresh&&latest.current!==null&&new Date(fresh.activityAt).getTime()>latest.current)setNotice(fresh);}
  else seen.current=new Set();
  ids.forEach(id=>seen.current!.add(id));
  latest.current=Math.max(latest.current??0,...items.map(item=>new Date(item.activityAt).getTime()));
 },[resource.data]);
 useEffect(()=>{if(!notice)return;const timer=window.setTimeout(()=>setNotice(null),12000);return ()=>window.clearTimeout(timer);},[notice]);
 return {...resource,notice,dismiss:()=>setNotice(null)};
}
