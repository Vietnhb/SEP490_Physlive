// Production UI with in-memory fixtures only. Never loads env or calls a real backend.
import { build, preview } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { chromium } from 'playwright';
import { expect } from '@playwright/test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import path from 'node:path';import os from 'node:os';
const outDir=await mkdtemp(path.join(os.tmpdir(),'physlive-manager-overview-'));
await build({configFile:false,envFile:false,plugins:[react()],build:{outDir,emptyOutDir:false},logLevel:'warn'});
const server=await preview({configFile:false,envFile:false,build:{outDir},preview:{host:'127.0.0.1',port:5199,strictPort:true}});
const browser=await chromium.launch({headless:true}).catch(()=>chromium.launch({channel:'chrome',headless:true}));
try {
 const context=await browser.newContext({viewport:{width:1600,height:1080},reducedMotion:'reduce'});
 const token=Buffer.from(JSON.stringify({alg:'none',typ:'JWT'})).toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:'fixture',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
 await context.addInitScript(token=>localStorage.setItem('token',token),token);
 let mode='normal';const errors=[],requests=[];
 await context.route('**/api/**',async route=>{
  const url=new URL(route.request().url()),api=url.pathname;requests.push(api+url.search);let data=[];
  if(api==='/api/user/me')data={id:100,fullName:'Manager',email:'manager@test.invalid',role:'MANAGER',permissions:[],active:true,accountStatus:'ACTIVE',mustChangePassword:false};
  else if(api==='/api/user/me/license')data={active:true,canPerformWriteOperations:true,showRenewalBanner:false};
  else if(api==='/api/admin/overview-counts'){
   if(mode==='overview-error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Không tải được tổng quan thử nghiệm'})});
   data={accounts:{total:115,suspended:1,ADMIN:2,MANAGER:4,REVIEWER:2,SCHOOL:8,STAFF:5,STUDENT:94},schools:10,activeSchools:9,validation:{total:mode==='empty'?0:177,failed:0,failureRate:0}};
  }else if(api==='/api/support/inbox/pending-count'){
   if(mode==='support-error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Không tải được hỗ trợ thử nghiệm'})});
   data={count:mode==='empty'?0:2};
  }else if(api==='/api/admin/payment-analytics'){
   if(mode==='payment-error')return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Không tải được doanh thu thử nghiệm'})});
   const period=url.searchParams.get('period'),year=Number(url.searchParams.get('year')),month=period==='MONTH'?Number(url.searchParams.get('month')):null;
   const paid=mode==='empty'?0:month?30000000:490000000,transactions=mode==='empty'?0:month?1:10;
   data={period,year,month,quarter:null,timezone:'Asia/Ho_Chi_Minh',from:year+'-01-01T00:00:00Z',to:(year+1)+'-01-01T00:00:00Z',kpis:{grossPaidVnd:paid,paidTransactions:transactions,pendingTransactions:0,reviewTransactions:mode==='empty'?0:1,failedTransactions:mode==='empty'?0:2,totalTransactions:transactions+(mode==='empty'?0:3)},trend:Array.from({length:month?new Date(year,month,0).getDate():12},(_,i)=>({key:String(i),label:month?'Ngày '+(i+1):'Tháng '+(i+1),revenueVnd:i===8?paid:0,transactions:i===8?transactions:0})),packages:[],statuses:[]};
  }
  return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:5199/manager');
 await expect(page.locator('[data-analytics=dashboard]')).toBeVisible({timeout:20000});await expect(page.locator('[data-dashboard-heading] h1,[data-dashboard-heading] p')).toHaveCount(0);
 const accountCard=page.getByRole('link',{name:/Tài khoản hoạt động/});await expect(accountCard).toContainText('114');
 await expect(page.getByRole('link',{name:/Trường học.*10/}).first()).toContainText('9 trường đang hoạt động');
 await expect(page.getByRole('img',{name:/Học sinh: 94/})).toBeVisible();
 await expect(page.getByRole('progressbar',{name:'Tỷ lệ kiểm định đạt'})).toHaveAttribute('aria-valuenow','100');
 await expect(page.locator('strong[title="490.000.000 ₫"]')).toBeVisible();
 await page.screenshot({path:path.join(outDir,'desktop.png'),fullPage:true,animations:'disabled'});
 await page.getByRole('button',{name:'Tháng này',exact:true}).click();await expect(page.locator('strong[title="30.000.000 ₫"]')).toBeVisible();
 await expect(page.getByText(/Chi tiết theo ngày/)).toBeVisible();
 if(!requests.some(url=>url.includes('period=MONTH')&&url.includes('timezone=Asia%2FHo_Chi_Minh')))throw Error('Monthly request lacks Vietnam scope');
 await page.getByRole('button',{name:/Giao diện:/}).click();await page.getByRole('menuitemradio',{name:'Tối',exact:true}).click();
 await page.screenshot({path:path.join(outDir,'dark.png'),fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
 if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw Error('Manager overview overflows mobile');
 await page.screenshot({path:path.join(outDir,'mobile.png'),fullPage:true,animations:'disabled'});
 await page.setViewportSize({width:1600,height:1080});
 mode='empty';await page.getByRole('button',{name:'Làm mới',exact:true}).click();await expect(page.getByRole('heading',{name:'Chất lượng kiểm định'})).toBeVisible();await expect(page.getByText('Chưa có doanh thu trong kỳ',{exact:true})).toBeVisible();await expect(page.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow','100');
 mode='payment-error';await page.getByRole('button',{name:'Làm mới',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Không tải được doanh thu thử nghiệm'})).toBeVisible();await expect(page.getByRole('link',{name:/Doanh thu ·/})).toContainText('—');await expect(accountCard).toContainText('114');
 mode='overview-error';await page.getByRole('button',{name:'Làm mới',exact:true}).click();await expect(accountCard).toContainText('—');
 mode='support-error';await page.getByRole('button',{name:'Làm mới',exact:true}).click();await expect(page.getByRole('link',{name:/Hỗ trợ cần xử lý/})).toContainText('—');
 if(errors.length)throw Error(errors.join('\n'));
 await writeFile(path.join(outDir,'results.json'),JSON.stringify({passed:['real API contracts','account totals and roles','validation rate','year/month revenue scope','desktop','dark','mobile overflow','empty validation/revenue','partial API failures'],errors},null,2));
 console.log('PASS Manager overview. Screenshots: '+outDir);
}finally{await browser.close();await server.httpServer.close();}
