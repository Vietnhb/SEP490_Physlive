// Isolated browser checks: no env files, credentials or real API/database.
import {build,preview} from 'vite';import react from '@vitejs/plugin-react-swc';
import {chromium} from 'playwright';import {expect} from '@playwright/test';
import {mkdtemp,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const outDir=await mkdtemp(path.join(os.tmpdir(),'physlive-customer-usage-'));
await build({configFile:false,envFile:false,plugins:[react()],build:{outDir,emptyOutDir:false},logLevel:'warn'});
const server=await preview({configFile:false,envFile:false,build:{outDir},preview:{host:'127.0.0.1',port:5198,strictPort:true}});
const browser=await chromium.launch({headless:true}).catch(()=>chromium.launch({channel:'chrome',headless:true}));
try{
 const context=await browser.newContext({viewport:{width:1600,height:1080},reducedMotion:"reduce"});const page=await context.newPage();let mode='normal';const errors=[];
 page.on('pageerror',error=>errors.push(error.message));
 const token=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:'fixture',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
 await context.addInitScript(token=>localStorage.setItem('token',token),token);
 const actor={id:100,fullName:'Manager',email:'manager@test.invalid',role:'MANAGER',active:true,accountStatus:'ACTIVE',permissions:[],mustChangePassword:false,schoolId:null};
 const rows=Array.from({length:12},(_,i)=>({id:'00000000-0000-0000-0000-'+String(i+1).padStart(12,'0'),name:['Trường THPT Nguyễn Huệ','Trường THPT Lê Quý Đôn','Trường THPT Trần Phú'][i%3]+(i<3?'':' · Cơ sở '+(i+1)),code:'TRUONG'+(i+1),plan:i%2?'STARTER':'ENTERPRISE',licenseEnd:'2027-09-21',activeUsers:120-i*7,aiCalls:800-i*50,assignments:40-i*2,submissions:400-i*20,tokens:900000-i*70000,revenue:30000000-i*1000000,lastActivity:'2026-11-18T09:00:00Z',attention:['NONE','EXPIRING','QUOTA','IDLE','UNKNOWN'][i%5]}));
 await context.route('**/api/**',async route=>{
   const url=new URL(route.request().url());let data=[];
   if(url.pathname==='/api/user/me')data=actor;
   else if(url.pathname==='/api/user/me/license')data={active:true,canPerformWriteOperations:true,showRenewalBanner:false};
   else if(url.pathname==='/api/support/inbox/pending-count')data=0;
   else if(url.pathname==='/api/reports/customer-usage/csv')return route.fulfill({status:200,contentType:'text/csv; charset=UTF-8',body:'\uFEFFTrường,Lượt AI\r\nFixture,800\r\n'});
   else if(url.pathname==='/api/reports/customer-usage'){
     if(mode==='error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Fixture unavailable'})});
     const year=Number(url.searchParams.get('year')),month=Number(url.searchParams.get('month'))||null,sort=url.searchParams.get('sort')||'aiCalls',care=url.searchParams.get('attention')||'ALL',schoolId=url.searchParams.get('schoolId');
     const items=mode==='empty'?[]:rows.filter(row=>(!schoolId||row.id===schoolId)&&(care==='ALL'||row.attention===care)&&(!url.searchParams.get('query')||(row.name+' '+row.code).toLowerCase().includes(url.searchParams.get('query').toLowerCase()))).sort((a,b)=>b[sort]-a[sort]);
     const size=Number(url.searchParams.get('size')||10),pages=Math.max(1,Math.ceil(items.length/size)),page=Math.min(Number(url.searchParams.get('page')||0),pages-1);
     const trend=Array.from({length:month?new Date(year,month,0).getDate():12},(_,i)=>({label:String(year)+'-'+String(month||i+1).padStart(2,'0')+(month?'-'+String(i+1).padStart(2,'0'):''),aiCalls:items.length?(i===8?1500:i===9?2800:i===10?4100:100+i*50):0,activeUsers:items.length?30+i*5:0,assignments:items.length?12+i:0,submissions:items.length?30+i*10:0,revenue:items.length?30000000+i*1000000:0}));
     data={year,month,summary:{schools:items.length,activeSchools:items.length,activeUsers:items.reduce((n,r)=>n+r.activeUsers,0),aiCalls:items.reduce((n,r)=>n+r.aiCalls,0),assignments:200,submissions:1500,tokens:1200000,revenue:items.reduce((n,r)=>n+r.revenue,0)},trend,ranking:items.slice(0,5),attention:['EXPIRING','QUOTA','IDLE','UNKNOWN','NONE'].map(key=>({key,count:items.filter(r=>r.attention===key).length})),items:items.slice(page*size,(page+1)*size),totalElements:items.length,page,size,totalPages:pages,plans:['ENTERPRISE','STARTER'],firstRecordedAt:'2026-01-01T00:00:00Z',asOf:new Date().toISOString()};
   }
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto('http://127.0.0.1:5198/manager/customer-usage');
 await expect(page.locator('[data-kpis]')).toBeVisible({timeout:20000});await expect(page.locator('[data-report-heading]')).toHaveCount(0);
 await expect(page.getByRole('region',{name:'Danh sách sử dụng khách hàng'}).locator('tbody tr')).toHaveCount(10,{timeout:20000});
 await page.screenshot({path:path.join(outDir,'desktop.png'),fullPage:true});
 await page.getByRole('button',{name:'Sau',exact:true}).click();await expect(page.getByRole('region',{name:'Danh sách sử dụng khách hàng'}).locator('tbody tr')).toHaveCount(2);
 await page.getByRole('combobox',{name:'Số dòng/trang',exact:true}).click();await page.getByRole('option',{name:'5',exact:true}).click();await expect(page.getByRole('region',{name:'Danh sách sử dụng khách hàng'}).locator('tbody tr')).toHaveCount(5);
 await page.locator('button').filter({hasText:'Trường THPT Nguyễn Huệ'}).first().click();await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByRole('heading',{name:'Diễn biến sử dụng AI'})).toBeVisible();await page.waitForTimeout(250);await page.screenshot({path:path.join(outDir,'detail.png'),animations:'disabled'});await page.getByRole('button',{name:'Đóng',exact:true}).click();
 await page.getByRole('combobox',{name:'Tháng',exact:true}).click();await page.getByRole('option',{name:'Tháng 11',exact:true}).click();await page.getByRole('button',{name:'Áp dụng',exact:true}).click();await expect(page.getByRole('heading',{name:'Nhịp sử dụng theo ngày'})).toBeVisible();
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Xuất CSV',exact:true}).click();await download;await expect(page.getByRole('status').filter({hasText:'Đã xuất toàn bộ trường'})).toBeVisible();
 await page.getByRole('group',{name:'Chỉ số biểu đồ'}).getByRole('button',{name:'Doanh thu',exact:true}).click();await expect(page.getByRole('img',{name:'Xu hướng doanh thu'})).toBeVisible();
 await page.getByRole('combobox',{name:'Nhóm chăm sóc',exact:true}).click();await page.getByRole('option',{name:'Ít hoạt động',exact:true}).click();await expect(page.getByRole('region',{name:'Danh sách sử dụng khách hàng'}).locator('tbody tr')).toHaveCount(2);
 await page.getByRole('combobox',{name:'Nhóm chăm sóc',exact:true}).click();await page.getByRole('option',{name:'Tất cả trường',exact:true}).click();
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(350);await page.screenshot({path:path.join(outDir,'mobile.png'),fullPage:true});
 if(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth+2)) {
   const overflow = await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).filter(e=>e.getBoundingClientRect().right>innerWidth+2&&getComputedStyle(e).position!=='fixed').slice(0,15).map(e=>({tag:e.tagName,cls:String(e.className),right:e.getBoundingClientRect().right})));
   throw Error('Page overflows on mobile: '+JSON.stringify(overflow));
 }
 await page.setViewportSize({width:1600,height:1080});await page.getByRole('button',{name:/Giao diện:/}).click();await page.getByRole('menuitemradio',{name:'Tối',exact:true}).click();await page.waitForTimeout(650);await page.screenshot({path:path.join(outDir,'dark.png'),fullPage:true,animations:'disabled'});
 mode='empty';await page.getByRole('button',{name:'Làm mới',exact:true}).click();await expect(page.getByRole('heading',{name:'Không có trường phù hợp'})).toBeVisible();
 mode='error';await page.getByRole('button',{name:'Làm mới',exact:true}).click();await expect(page.getByRole('heading',{name:'Chưa tải được báo cáo'})).toBeVisible();
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(path.join(outDir,'results.json'),JSON.stringify({passed:['desktop charts','pagination','page size','school detail','monthly daily trend','CSV','mobile overflow','dark mode','empty state','error state'],errors},null,2));
 console.log('PASS customer usage browser checks. Screenshots: '+outDir);
}finally{await browser.close();await server.httpServer.close();}
