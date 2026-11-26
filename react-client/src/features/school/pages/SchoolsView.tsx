import RowActions from "../../../shared/ui/RowActions";
import RefreshButton from "../../../shared/ui/RefreshButton";
import { useResource } from "../../../shared/hooks/operationsData";
import { useState, type FormEvent } from "react";
import LearningIcon from "../../../shared/ui/LearningIcon";
import { Badge, Button as ThemeButton, Callout, Checkbox, Dialog, Select, Table, Text, TextField } from "@radix-ui/themes";
import { createSchool, updateSchool, type ManagedSchool } from "../api/schoolApi";
import { apiMessage } from "../../../shared/lib/apiError";
import { Loading, ErrorNotice, Button, FormField } from "../../../shared/ui/ManagementUI";
import modal from "../../../shared/ui/ModalScroll.module.css";
import ManagerSchoolClassesDialog from "../components/ManagerSchoolClassesDialog";
import SchoolSubscriptionDialog from "../components/SchoolSubscriptionDialog";
import ManagerSchoolsArt from "../components/ManagerSchoolsArt";
import { SUBSCRIPTION_STATUS } from "../model/schoolSubscription";
import { adminPlans } from "../../billing/api/billingApi";
import { usePlanNames } from "../../../shared/hooks/usePlanNames";
import styles from "./SchoolsView.module.css";
type SchoolForm = { code:string; name:string; address:string; active:boolean; licenseStart:string; licenseEnd:string; monthlyTokenQuota:string };
const blankSchool:SchoolForm={code:"",name:"",address:"",active:true,licenseStart:"",licenseEnd:"",monthlyTokenQuota:"0"};
const SCHOOL_PAGE_SIZES=[10,25,50];
const colors=["#23919a","#3973d2","#7956d8","#5165a4","#a1a6b1"];
export function SchoolsView() {
  const planName=usePlanNames(adminPlans);
  const [form,setForm]=useState<SchoolForm>(blankSchool),[editing,setEditing]=useState<string|null>(null),[showForm,setShowForm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const [pageSize,setPageSize]=useState(10),[page,setPage]=useState(1),[query,setQuery]=useState("");
  const [classSchool,setClassSchool]=useState<ManagedSchool|null>(null),[subscriptionId,setSubscriptionId]=useState<string|null>(null);
  const resource=useResource<ManagedSchool[]>("/admin/schools");
  const items=resource.data??[],known=resource.data!==undefined,loading=resource.loading&&!known,load=resource.refresh;
  const total=items.length;
  const filtered=items.filter(item=>(item.code+" "+item.name+" "+(item.address??"")).toLocaleLowerCase("vi").includes(query.trim().toLocaleLowerCase("vi")));
  const pageCount=Math.max(1,Math.ceil(filtered.length/pageSize)),currentPage=Math.min(page,pageCount),pageStart=(currentPage-1)*pageSize;
  const visibleItems=filtered.slice(pageStart,pageStart+pageSize);
  const today=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Ho_Chi_Minh"});
  const day=(v:string)=>Date.parse(v+"T00:00:00Z");
  const active=items.filter(item=>item.active).length;
  const soon=items.filter(item=>item.active&&item.licenseEnd&&day(item.licenseEnd)>=day(today)&&day(item.licenseEnd)<=day(today)+30*86400000).length;
  const noPlan=items.filter(item=>!item.planCode&&!item.licenseEnd).length;
  const groupKey=(item:ManagedSchool)=>item.planCode||(item.licenseEnd?"__granted":"__none");
  const groups=Array.from(new Set(items.map(groupKey))).map(code=>({code,name:code==="__none"?"Chưa có gói":code==="__granted"?"Do vận hành cấp":planName(code),count:items.filter(item=>groupKey(item)===code).length})).sort((a,b)=>b.count-a.count);
  const months=Array.from({length:6},(_,i)=>{const date=new Date(day(today));date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+i+1);const key=date.toISOString().slice(0,7);return {key,label:"T"+(date.getUTCMonth()+1),count:items.filter(item=>item.active&&item.licenseEnd?.startsWith(key)).length};});
  const maxExpiry=Math.max(1,...months.map(month=>month.count));
  const submit=async(event:FormEvent)=>{event.preventDefault();setBusy(true);try{const payload={...form,licenseStart:form.licenseStart||null,licenseEnd:form.licenseEnd||null,monthlyTokenQuota:form.monthlyTokenQuota===""?null:Number(form.monthlyTokenQuota)};if(editing)await updateSchool(editing,payload);else await createSchool(payload);setShowForm(false);setEditing(null);setForm(blankSchool);await load();}catch(e){setError(apiMessage(e,"Không thể lưu trường học."));}finally{setBusy(false);}};
  return <div className={"admin-content "+styles.page}>
    <RefreshButton disabled={resource.refreshing} onClick={()=>void load()}/>
    <header className={styles.heading}><div><h1>Trường học</h1><p>{known?total.toLocaleString("vi-VN")+" trường học":"Quản lý các trường trên nền tảng"}</p></div><div className={styles.headingActions}><Button primary onClick={()=>{setEditing(null);setForm(blankSchool);setShowForm(true);}}><LearningIcon name="plus"/>Thêm trường</Button><ManagerSchoolsArt/></div></header>
    <section className={styles.stats} aria-label="Thống kê trường học">{[
      {label:"Trường học",value:total,note:"Tất cả trường trên nền tảng",icon:"book" as const},
      {label:"Đang hoạt động",value:active,note:(total-active)+" trường đã tắt",icon:"activity" as const},
      {label:"Hết hạn trong 30 ngày",value:soon,note:"Các trường đang hoạt động cần gia hạn",icon:"refresh" as const},
      {label:"Chưa có gói",value:noPlan,note:"Chưa có gói và chưa được cấp thời hạn",icon:"shield" as const}
    ].map(item=><article key={item.label}><span>{item.label}</span><i><LearningIcon name={item.icon}/></i><strong>{known?item.value.toLocaleString("vi-VN"):"—"}</strong><small>{item.note}</small></article>)}</section>
    {(error||resource.error)&&<ErrorNotice error={error||resource.error||""} onRetry={()=>void load()}/>}
    <ManagerSchoolClassesDialog key={classSchool?.id ?? "no-school"} school={classSchool} onClose={() => setClassSchool(null)} />
    <SchoolSubscriptionDialog key={subscriptionId ?? "closed"} schoolId={subscriptionId} onClose={() => setSubscriptionId(null)} />
    <Dialog.Root open={showForm} onOpenChange={setShowForm}><Dialog.Content className={modal.dialog} maxWidth="620px" aria-describedby={undefined}><div className={modal.body}><Dialog.Title>{editing ? "Cập nhật trường" : "Thêm trường"}</Dialog.Title>
      {error && <Callout.Root color="red" size="1" mb="4" role="alert"><Callout.Text>{error}</Callout.Text></Callout.Root>}
      <form className="admin-form-grid" onSubmit={submit}>
        <FormField label="Mã trường" htmlFor="managed-school-code"><TextField.Root id="managed-school-code" size="3" required value={form.code} disabled={Boolean(editing)} onChange={event => setForm({ ...form, code: event.target.value })} /></FormField>
        <FormField label="Tên trường" htmlFor="managed-school-name"><TextField.Root id="managed-school-name" size="3" required value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></FormField>
        <FormField label="Địa chỉ" htmlFor="managed-school-address"><TextField.Root id="managed-school-address" size="3" value={form.address} onChange={event => setForm({ ...form, address: event.target.value })} /></FormField>
        <FormField label="Ngày bắt đầu license" htmlFor="managed-school-start"><TextField.Root id="managed-school-start" size="3" type="date" value={form.licenseStart} required={Boolean(form.licenseEnd)} onChange={event => setForm({ ...form, licenseStart: event.target.value })} /></FormField>
        <FormField label="Ngày hết hạn license" htmlFor="managed-school-end"><TextField.Root id="managed-school-end" size="3" type="date" min={form.licenseStart} value={form.licenseEnd} required={Boolean(form.licenseStart)} onChange={event => setForm({ ...form, licenseEnd: event.target.value })} /></FormField>
        <FormField label="Token AI/tháng (trống = không giới hạn)" htmlFor="managed-school-quota"><TextField.Root id="managed-school-quota" size="3" type="number" min="0" step="1" value={form.monthlyTokenQuota} onChange={event => setForm({ ...form, monthlyTokenQuota: event.target.value })} /></FormField>
        <Text as="label" size="2" className="admin-checkbox"><Checkbox checked={form.active} onCheckedChange={checked => setForm({ ...form, active: checked === true })} />Đang hoạt động</Text>
        <div className="admin-form-actions"><Button onClick={() => setShowForm(false)}>Hủy</Button><ThemeButton type="submit" size="3" loading={busy} disabled={busy}>{busy ? "Đang lưu…" : "Lưu trường"}</ThemeButton></div>
      </form>
    </div></Dialog.Content></Dialog.Root>

    <div className={styles.layout}><section className={styles.list} aria-label="Danh sách trường học">
      <div className={styles.toolbar}><TextField.Root size="3" type="search" aria-label="Tìm trường học" placeholder="Tìm mã hoặc tên trường…" value={query} onChange={event=>{setQuery(event.target.value);setPage(1);}}><TextField.Slot><LearningIcon name="search"/></TextField.Slot></TextField.Root></div>
      {loading?<Loading text="Đang tải danh sách trường học…" headers={["Trường","Gói","Trạng thái","Thao tác"]}/>:<><Table.Root className={styles.table} size="2" variant="ghost"><Table.Header><Table.Row><Table.ColumnHeaderCell>Trường</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Gói</Table.ColumnHeaderCell><Table.ColumnHeaderCell>Trạng thái</Table.ColumnHeaderCell><Table.ColumnHeaderCell><span className="sr-only">Thao tác</span></Table.ColumnHeaderCell></Table.Row></Table.Header><Table.Body>{visibleItems.map(item=><Table.Row key={item.id}><Table.Cell><strong className={styles.schoolName}>{item.name}</strong><small className={styles.secondary}>{item.code} · {item.address||"Chưa cập nhật địa chỉ"}</small></Table.Cell><Table.Cell><Badge variant="soft" color={item.planCode?"indigo":"gray"}>{item.planCode?planName(item.planCode):item.licenseEnd?"Do vận hành cấp":"Chưa có gói"}</Badge><small className={styles.secondary}>{item.licenseEnd?"Hết hạn "+item.licenseEnd.split("-").reverse().join("/"):"Chưa thiết lập thời hạn"}</small></Table.Cell><Table.Cell><Badge color={SUBSCRIPTION_STATUS[item.subscriptionStatus??"UNKNOWN"].color}>{SUBSCRIPTION_STATUS[item.subscriptionStatus??"UNKNOWN"].label}</Badge><small className={styles.secondary}>{item.active?"Trường đang hoạt động":"Trường đã tắt"}</small></Table.Cell><Table.Cell><RowActions subject={item.name} actions={[
        {label:"Xem lớp học",onSelect:()=>setClassSchool(item)},
        {label:"Xem gói",onSelect:()=>setSubscriptionId(item.id)},
        {label:"Sửa thông tin",onSelect:()=>{setEditing(item.id);setForm({code:item.code,name:item.name,address:item.address??"",active:item.active,licenseStart:item.licenseStart??"",licenseEnd:item.licenseEnd??"",monthlyTokenQuota:item.monthlyTokenQuota==null?"":String(item.monthlyTokenQuota)});setShowForm(true);}}
      ]}/></Table.Cell></Table.Row>)}</Table.Body></Table.Root>{visibleItems.length===0&&<p className={styles.empty}>{query?"Không tìm thấy trường phù hợp.":"Chưa có trường học."}</p>}
      <div className={styles.pagination}><span aria-live="polite">{filtered.length===0?"0 trường học":`Hiển thị ${pageStart+1}–${Math.min(pageStart+pageSize,filtered.length)} / ${filtered.length} trường học`}</span><div><Select.Root size="2" value={String(pageSize)} onValueChange={value=>{setPageSize(Number(value));setPage(1);}}><Select.Trigger aria-label="Số trường học trên mỗi trang"/><Select.Content>{SCHOOL_PAGE_SIZES.map(size=><Select.Item key={size} value={String(size)}>{size} / trang</Select.Item>)}</Select.Content></Select.Root><ThemeButton size="2" variant="surface" disabled={currentPage<=1} onClick={()=>setPage(currentPage-1)}>Trước</ThemeButton><span>Trang {currentPage}/{pageCount}</span><ThemeButton size="2" variant="surface" disabled={currentPage>=pageCount} onClick={()=>setPage(currentPage+1)}>Sau</ThemeButton></div></div></>}
    </section><aside className={styles.insights}>
      <section className={styles.panel}><h2>Trường theo gói</h2><p>Mỗi vạch là một trường</p><div className={styles.bigNumber}><LearningIcon name="book"/><strong>{known?total:"—"}</strong></div><div className={styles.barcode} role="img" aria-label={groups.map(group=>group.name+": "+group.count+" trường").join("; ")||"Chưa có dữ liệu"}>{groups.map((group,i)=>Array.from({length:group.count},(_,n)=><i key={group.code+n} style={{background:colors[i%colors.length]}}/>))}</div><ul className={styles.groups}>{groups.map((group,i)=><li key={group.code}><i style={{background:colors[i%colors.length]}}/><div><strong>{group.name}</strong><small>{group.count} trường</small></div><span>{Math.round(group.count/Math.max(1,total)*100)}%</span></li>)}</ul>{known&&total===0&&<p>Chưa có dữ liệu trường học.</p>}</section>
      <section className={styles.panel}><div className={styles.panelHeading}><h2>Gói sắp hết hạn</h2><span>6 tháng tới</span></div><div className={styles.expiryChart} role="img" aria-label={months.map(month=>month.key+": "+month.count+" trường").join("; ")}>{months.map(month=><div key={month.key} title={month.key+": "+month.count+" trường"}><b>{known?month.count:"—"}</b><span><i style={{height:Math.max(2,month.count/maxExpiry*96)+"px"}}/></span><small>{month.label}</small></div>)}</div><p>Ngày hết hạn của các trường đang hoạt động, từ tháng kế tiếp.</p></section>
    </aside></div>
  </div>;
}