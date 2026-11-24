// Isolated UI verification: all requests mocked; no mail sent and no credentials loaded.
import {build,preview} from 'vite';import react from '@vitejs/plugin-react-swc';
import {chromium} from 'playwright';import {expect} from '@playwright/test';
import {mkdtemp} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const outDir=await mkdtemp(path.join(os.tmpdir(),'physlive-email-inbox-'));
await build({configFile:false,envFile:false,plugins:[react()],build:{outDir,emptyOutDir:false},logLevel:'warn'});
const server=await preview({configFile:false,envFile:false,build:{outDir},preview:{host:'127.0.0.1',port:5199,strictPort:true}});
const browser=await chromium.launch({headless:true}).catch(()=>chromium.launch({channel:'chrome',headless:true}));
try{
 const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const token=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:'fixture',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
 await context.addInitScript(token=>localStorage.setItem('token',token),token);
 const actor={id:100,fullName:'Manager',email:'manager@test.invalid',role:'MANAGER',active:true,accountStatus:'ACTIVE',permissions:[],mustChangePassword:false,schoolId:null};
 const school='11111111-1111-4111-8111-111111111111';
 const rows=Array.from({length:12},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),schoolId:school,schoolName:'Trường THPT '+['Nguyễn Huệ','Trần Phú','Lê Quý Đôn'][i%3],recipient:'school@example.com',subject:'[PhysLive] '+(i%2?'Hỗ trợ sử dụng':'Nhắc gia hạn gói')+' · '+(i+1),preview:'Nhà trường đã nhận thông báo. Vui lòng hướng dẫn gia hạn gói.',status:i===2?'BOUNCED':'DELIVERED',actorName:'Manager',createdAt:'2026-11-23T14:00:00Z',activityAt:'2026-11-23T15:00:00Z',replyCount:i===0?1:0,unreadCount:i===0?1:0,latestReplyId:i===0?'reply-initial':null}));
 let reads=0,mode='normal';
 await context.route('**/api/**',async route=>{
  const u=new URL(route.request().url());let data=[];
  if(u.pathname==='/api/realtime/events')return route.fulfill({status:200,contentType:'text/event-stream',body:'event: change\ndata: '+JSON.stringify({revision:Date.now(),path:'/api/reports/customer-usage',clientId:null})+'\n\n'});
  if(u.pathname==='/api/user/me')data=actor;
  else if(u.pathname==='/api/user/me/license')data={active:true,canPerformWriteOperations:true,showRenewalBanner:false};
  else if(u.pathname==='/api/support/inbox/pending-count')data=0;
  else if(u.pathname.endsWith('/email-inbox/automation'))data={enabled:true,configured:true};
  else if(u.pathname.endsWith('/email-inbox/notifications')){const items=rows.filter(r=>r.unreadCount);data={unreadCount:items.length,items:items.slice(0,5)};}
  else if(u.pathname.endsWith('/read')){const ids=route.request().postDataJSON().replyIds;expect(ids).toHaveLength(1);reads++;const id=u.pathname.split('/').at(-2);rows.find(r=>r.id===id).unreadCount=0;data={};}
  else if(u.pathname.endsWith('/email-inbox')){
   if(mode==='error')return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({message:'Không tải được hộp thư thử nghiệm'})});
   let items=mode==='empty'?[]:rows.filter(r=>(!u.searchParams.get('query')||(r.schoolName+r.subject).toLowerCase().includes(u.searchParams.get('query').toLowerCase()))&&(u.searchParams.get('filter')!=='UNREAD'||r.unreadCount)&&(u.searchParams.get('filter')!=='REPLIED'||r.replyCount)&&(!u.searchParams.get('delivery')||u.searchParams.get('delivery')===r.status));
   const size=Number(u.searchParams.get('size')),pages=Math.max(1,Math.ceil(items.length/size)),index=Math.min(Number(u.searchParams.get('page')),pages-1);
   data={items:items.slice(index*size,(index+1)*size),totalElements:items.length,page:index,size,totalPages:pages};
  }else if(/\/emails\/[^/]+$/.test(u.pathname)){
   const row=rows.find(r=>r.id===u.pathname.split('/').at(-1));data={email:{...row,body:'Kính gửi nhà trường, vui lòng kiểm tra hạn gói.'},replies:row.replyCount?[{id:row.latestReplyId,sender:row.recipient,subject:'Re: '+row.subject,body:'Nhà trường đã nhận thông báo. Vui lòng hướng dẫn gia hạn gói.\n\nOn Mon, 23 Nov 2026, PhysLive wrote:\n> Nội dung cũ được trích dẫn',attachments:'[]',receivedAt:row.activityAt}]:[],totalElements:row.replyCount,page:0,totalPages:1};
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:5199/manager/emails');
 await expect(page.getByRole('heading',{name:'Nhật ký email tự động',exact:true})).toBeVisible({timeout:20000});
 const searchInput=page.getByPlaceholder('Trường, tiêu đề hoặc email…');
 await searchInput.focus();const searchStyle=await searchInput.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.parentElement.getBoundingClientRect(),c=getComputedStyle(el);return {inside:a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom,border:c.borderTopWidth,shadow:c.boxShadow};});expect(searchStyle.inside).toBe(true);expect(searchStyle.border).toBe('0px');expect(searchStyle.shadow).toBe('none');await searchInput.blur();
 const list=page.getByRole('region',{name:'Danh sách email'});
 await expect(list.locator('button[aria-pressed]')).toHaveCount(10);
 await expect(page.getByRole('button',{name:/Soạn email|Xác nhận gửi|Thử lại cùng mã thư/})).toHaveCount(0);
 await expect(page.getByText(/Đang bật gửi tự động/)).toHaveCount(0);
 await expect(page.getByText('THÔNG BÁO TỰ ĐỘNG',{exact:true})).toHaveCount(0);
 await expect(page.getByText('Chọn email để xem chi tiết',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Thông báo · 1 email chưa đọc'})).toBeVisible();
 const bell=page.getByRole('button',{name:'Thông báo · 1 email chưa đọc'});
 const badge=await bell.locator('span').evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,text:el.textContent}));
 const channels=badge.background.match(/\d+/g).map(Number);expect(channels[0]).toBeGreaterThan(channels[1]*1.5);expect(badge.color).toBe('rgb(255, 255, 255)');expect(badge.text).toBe('1');
 const firstMail=list.locator('button[aria-pressed]').first();await firstMail.hover();
 const hover=await firstMail.evaluate(el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,box:el.getBoundingClientRect().toJSON()}));
 expect(hover.background).not.toBe('rgb(29, 78, 216)');expect(hover.background).not.toBe('rgb(37, 99, 235)');expect(hover.color).not.toBe('rgb(255, 255, 255)');
 await page.screenshot({path:path.join(outDir,'hover-and-red-badge.png'),fullPage:true});
 await page.screenshot({path:path.join(outDir,'desktop-list.png'),fullPage:true});
 await list.locator('button[aria-pressed]').first().click();
 await expect(page.getByRole('heading',{name:'Thư trả lời (1)'})).toBeVisible();
 await expect(page.getByText('Hiện nội dung trước đó')).toBeVisible();
 await expect(page.getByText('Nội dung cũ được trích dẫn')).not.toBeVisible();
 await expect.poll(()=>reads).toBe(1);
 await expect(page.getByRole('button',{name:'Thông báo',exact:true})).toBeVisible();
 await page.reload();await expect(page.getByRole('heading',{name:'Thư trả lời (1)'})).toBeVisible();await expect(page.getByRole('button',{name:'Thông báo',exact:true})).toBeVisible();
 await page.screenshot({path:path.join(outDir,'desktop-thread.png'),fullPage:true});
 rows[1].replyCount=1;rows[1].unreadCount=1;rows[1].latestReplyId='reply-new';rows[1].activityAt='2026-11-23T16:00:00Z';
 await expect(page.getByText('Trường vừa phản hồi email',{exact:true})).toBeVisible({timeout:10000});
 await page.getByRole('button',{name:'Xem thư',exact:true}).click();await expect(page).toHaveURL(new RegExp(rows[1].id));await expect(page.getByRole('heading',{name:'Thư trả lời (1)'})).toBeVisible();
 await page.getByRole('combobox',{name:'Số dòng',exact:true}).click();await page.getByRole('option',{name:'5',exact:true}).click();await expect(list.locator('button[aria-pressed]')).toHaveCount(5);
 await list.getByRole('button',{name:'Sau',exact:true}).click();await expect(list.getByText('2/3',{exact:true})).toBeVisible();
 await page.getByRole('combobox',{name:'Trạng thái gửi'}).click();await page.getByRole('option',{name:'Bị trả lại',exact:true}).click();await expect(list.locator('button[aria-pressed]')).toHaveCount(1);
 await page.getByRole('button',{name:'Xóa bộ lọc',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(outDir,'mobile-thread.png'),fullPage:true});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2)).toBe(true);
 await page.setViewportSize({width:1600,height:1000});
 mode='empty';await page.getByRole('button',{name:'Làm mới',exact:true}).click();await expect(page.getByText('Không có email phù hợp',{exact:true})).toBeVisible();
 mode='error';await page.getByRole('button',{name:'Làm mới',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Không tải được hộp thư thử nghiệm');
 if(errors.length)throw Error(errors.join('\n'));
 console.log('PASS inbox: list, persisted read, new reply toast and deep link, quote collapse, filters, pagination, mobile overflow, empty/error. Screenshots: '+outDir);
}finally{await browser.close();await server.httpServer.close();}
