// Visual regression checks using fixtures only; never reads env or calls a database.
import {build,preview} from 'vite';import react from '@vitejs/plugin-react-swc';import {chromium} from 'playwright';import {expect} from '@playwright/test';import {mkdtemp,writeFile} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
const outDir=await mkdtemp(path.join(os.tmpdir(),'physlive-role-analytics-'));
await build({configFile:false,envFile:false,plugins:[react()],build:{outDir,emptyOutDir:false},logLevel:'warn'});
const server=await preview({configFile:false,envFile:false,build:{outDir},preview:{host:'127.0.0.1',port:5197,strictPort:true}});
const browser=await chromium.launch({headless:true}).catch(()=>chromium.launch({channel:'chrome',headless:true}));
const token=Buffer.from('{}').toString('base64url')+'.'+Buffer.from(JSON.stringify({sub:'fixture',exp:Math.floor(Date.now()/1000)+3600})).toString('base64url')+'.fixture';
const schoolId='10000000-0000-0000-0000-000000000001';
const students=Array.from({length:8},(_,i)=>({id:i+1,fullName:'Học sinh '+(i+1),email:'student'+i+'@test.invalid'}));
const classes=[{id:'class1',name:'10A1',gradeLevel:10,schoolYear:'2026-2027',subject:'Vật lý',active:true,students,studentCount:8,teacherCount:1,teacherNames:['Giáo viên mẫu']},{id:'class2',name:'11A1',gradeLevel:11,schoolYear:'2026-2027',subject:'Vật lý',active:true,students:students.slice(0,5),studentCount:5,teacherCount:1,teacherNames:['Giáo viên mẫu']}];
const lessons=Array.from({length:4},(_,i)=>({id:'assignment'+i,title:i===0?'Chuyển động của vật trên mặt phẳng nghiêng có ma sát và các đại lượng cần khảo sát':'Bài thực hành '+i,classId:i===3?'class2':'class1',className:i===3?'11A1':'10A1',assignedAt:'2026-11-01T08:00:00Z',dueAt:'2029-11-30T08:00:00Z',studentIds:[1],questions:{activityType:'PREDICT_OBSERVE_EXPLAIN'},status:'ACTIVE',maxScore:10,submissionCompleted:i<2,gradingStatus:i<2?'TEACHER_CONFIRMED':'PENDING',score:i<2?8:null}));
const summary={schoolId,schoolName:'Trường thử nghiệm',students:13,teachers:2,managers:1,activeClasses:2,enrolledStudents:13,usedTokens:123456,studentQuota:100,tokenQuota:1000000,planCode:'STARTER',licenseStart:'2026-01-01',licenseEnd:'2029-01-01',licenseStatus:'ACTIVE',usageMonth:'2026-11-01'};
const studentWork=[
 {...lessons[0],title:'Chuyển động ném ngang và phân tích quỹ đạo',submissionCompleted:true,gradingStatus:'TEACHER_CONFIRMED',score:8,completedAt:'2026-11-20T08:00:00Z',feedback:'Lập luận đúng, cần ghi rõ đơn vị đo.'},
 {...lessons[1],title:'Khảo sát chuyển động trên mặt phẳng nghiêng',submissionCompleted:true,gradingStatus:'PENDING',score:null,completedAt:'2026-11-19T08:00:00Z'},
 {...lessons[2],id:'late',title:'Bài thực hành được phép nộp muộn',submissionCompleted:false,dueAt:'2020-01-01T00:00:00Z',allowLateSubmission:true,score:null},
 {...lessons[3],id:'started',title:'Quan sát dao động của con lắc đơn',submissionCompleted:false,predictionSubmitted:true,score:null},
 {...lessons[2],id:'expired',title:'Bài quá hạn không nhận bài trễ',submissionCompleted:false,dueAt:'2020-01-01T00:00:00Z',allowLateSubmission:false,score:0},
 {...lessons[2],id:'closed',title:'Bài đã đóng',submissionCompleted:false,status:'CLOSED',score:null},
 {...lessons[2],id:'returned',title:'Bài cần bổ sung giải thích sau quan sát',submissionCompleted:true,retryAllowed:true,gradingStatus:'RETURNED',score:null}
];
const totals={assignments:4,recipients:32,submitted:20,notSubmitted:12,late:2,awaitingGrade:4,confirmed:16,missedDeadline:0,average10:8,submissionRate:62.5};
const results=[];
try{for(const [role,url,title] of [['MANAGER','/manager','Tổng quan vận hành'],['ADMIN','/admin','Tổng quan hệ thống'],['SCHOOL','/school','Trường thử nghiệm'],['REVIEWER','/reviewer','Tổng quan kiểm duyệt'],['STAFF','/teacher','Tổng quan giảng dạy'],['STUDENT','/student','Tổng quan học tập'],['SCHOOL','/school/reports','Thống kê lớp học'],['STAFF','/lab/reports','Kết quả bài tập theo lớp'],['MANAGER','/manager/payments','Thanh toán & doanh thu']]){
const context=await browser.newContext({viewport:{width:1600,height:1000},reducedMotion:'reduce'});await context.addInitScript(token=>localStorage.setItem('token',token),token);const errors=[];
let hideOperationDetails=false;
await context.route('**/api/**',async route=>{const u=new URL(route.request().url()),p=u.pathname;let data=[];
if(p==='/api/user/me')data={id:1,fullName:'Người dùng mẫu',email:'fixture@test.invalid',role,permissions:role==='STAFF'?['TEACH']:role==='REVIEWER'?['CONTENT_EDIT','CONTENT_REVIEW']:[],schoolId,schoolName:summary.schoolName,active:true,accountStatus:'ACTIVE',mustChangePassword:false};
else if(p==='/api/user/me/license')data={active:true,canPerformWriteOperations:true,showRenewalBanner:false};
else if(p==='/api/admin/users')data=[{id:2,fullName:'Manager mẫu',email:'manager@test.invalid',role:'MANAGER',active:true,accountStatus:'ACTIVE',permissions:[]}];
else if(p==='/api/admin/analytics')data={postsThisWeek:4,postsThisMonth:8,operationsThisWeek:32,operationsThisMonth:100,operationBreakdown:{weekly:{simulationRuns:20,submissions:8,gradedSubmissions:4},monthly:{simulationRuns:60,submissions:25,gradedSubmissions:15},weekStart:'2026-11-15T17:00:00Z',monthStart:'2026-10-31T17:00:00Z',measuredAt:'2026-11-21T08:00:00Z'},revenue:{totalVnd:490000000,weeklyVnd:30000000,monthlyVnd:90000000,paidCount:10,pendingCount:1,failedCount:2,byPlan:[{planCode:'STARTER',name:'Starter',amountVnd:490000000,count:10}],timeline:[{period:'Tuần 1',amountVnd:10000000,posts:1,operations:2},{period:'Tuần 2',amountVnd:30000000,posts:2,operations:5}],recentTransactions:[]}};
else if(p==='/api/admin/overview-counts')data={accounts:{total:115,suspended:1,ADMIN:2,MANAGER:4,REVIEWER:2,SCHOOL:8,STAFF:5,STUDENT:94},schools:10,activeSchools:9,validation:{total:177,failed:3,failureRate:1.7}};
else if(p==='/api/admin/payments/page'){const status=u.searchParams.get('status');const all=Array.from({length:13},(_,i)=>({id:'payment-'+i,schoolName:'Trường thử nghiệm '+(i+1),managerEmail:'school'+i+'@test.invalid',planCode:i===0?'ENTERPRISE':'STARTER',purpose:'RENEWAL',amountVnd:i===0?200000000:30000000,status:i<10?'PAID':i===10?'REQUIRES_REVIEW':'FAILED',createdAt:'2026-09-25T08:00:00Z',paidAt:i<10?'2026-09-25T08:30:00Z':null}));const rows=all.filter(row=>!status||status==='ALL'||row.status===status);const size=Number(u.searchParams.get('size')||10),index=Number(u.searchParams.get('page')||0);data={items:rows.slice(index*size,(index+1)*size),totalElements:rows.length,totalPages:Math.max(1,Math.ceil(rows.length/size)),page:index,size};}
else if(p==='/api/admin/payment-analytics')data={period:'YEAR',year:2026,month:null,timezone:'Asia/Ho_Chi_Minh',kpis:{grossPaidVnd:490000000,paidTransactions:10,pendingTransactions:0,reviewTransactions:1,failedTransactions:2,totalTransactions:13},trend:Array.from({length:12},(_,i)=>({key:String(i),label:'Tháng '+(i+1),revenueVnd:i===8?490000000:0,transactions:i===8?10:0})),packages:[{planCode:'STARTER',revenueVnd:240000000,transactions:8},{planCode:'ENTERPRISE',revenueVnd:200000000,transactions:1},{planCode:'PROFESSIONAL',revenueVnd:50000000,transactions:1}],statuses:[{status:'PAID',transactions:10},{status:'PENDING',transactions:0},{status:'REQUIRES_REVIEW',transactions:1},{status:'FAILED',transactions:2}]};
else if(p.endsWith('/pending-count'))data={count:2};
else if(p.endsWith('/reports/summary'))data=summary;
else if(p.endsWith('/reports/classes'))data=classes.map(c=>({...c,students:c.studentCount,teachers:c.teacherCount}));
else if(p.endsWith('/token-audit/options'))data={operations:['AI_GENERATION'],months:['2026-11-01']};
else if(p.endsWith('/token-audit/page'))data={items:[],totalElements:0,page:0,size:10,totalPages:1};
else if(p.includes('/classes/page'))data={items:classes,page:0,size:5,totalElements:2,totalPages:1};
else if(p==='/api/student/classes')data=classes.slice(0,1).map(c=>({...c,classmateCount:7,teachers:[{id:2,fullName:'Giáo viên mẫu'}]}));
else if(p==='/api/assignments/mine/teacher/classes')data=classes;
else if(p==='/api/assignments/mine/teacher')data=lessons;
else if(p==='/api/assignments/mine/student')data=studentWork;
else if(p.endsWith('/class1/report'))data={classId:'class1',className:'10A1',schoolYear:'2026-2027',asOf:new Date().toISOString(),summary:totals,items:lessons.map(l=>({...l,...totals,assignedBy:'Giáo viên mẫu'})),page:0,size:10,totalElements:4,totalPages:1};
else if(p==='/api/reviewer/library')data=[{id:'library1',createdAt:'2026-11-01T08:00:00Z'}];
else if(p==='/api/support/complaints/review')data=[{id:'complaint1',status:'OPEN',createdAt:'2026-11-02T08:00:00Z'}];
else if(p==='/api/reviewer/schemas')data=[{id:'draft1',lifecycleStatus:'DRAFT',createdAt:'2026-11-01T08:00:00Z'}];
else if(p==='/api/reviewer/law-gaps')data=[{occurrences:2}];
else if(p==='/api/curriculum')data={topics:[],lessons:[]};
if(hideOperationDetails && p==='/api/admin/analytics') delete data.operationBreakdown;
return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});});
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://127.0.0.1:5197'+url);if(url==='/manager'||url==='/admin'||url==='/school'||url==='/reviewer'||url==='/teacher'||url==='/student'){await expect(page.locator('[data-analytics=dashboard]')).toBeVisible({timeout:20000});await expect(page.locator('[data-dashboard-heading] h1,[data-dashboard-heading] p')).toHaveCount(0);}else if(url==='/lab/reports')await expect(page.getByRole('region',{name:'Danh sách kết quả bài tập'})).toBeVisible({timeout:20000});else if(url==='/manager/payments')await expect(page.getByRole('heading',{name:'Xu hướng doanh thu',exact:true})).toBeVisible({timeout:20000});else await expect(page.getByRole('heading',{name:title,exact:true})).toBeVisible({timeout:20000});await expect(page.locator('[data-kpi]').first()).toBeVisible();
const refreshButtons=page.locator('[data-page-refresh]');if(url!=='/student'){await expect(refreshButtons).toHaveCount(1);if(!await refreshButtons.evaluateAll(nodes=>nodes.every(node=>node.closest('[data-page-actions-target]'))))throw Error('Refresh outside topbar '+url);const box=await refreshButtons.first().boundingBox();if(!box||box.y>90)throw Error('Refresh below header '+url);}
if(url==='/admin'){
  await page.locator('.admin-platform-details > summary').click();
  const heights=await page.locator('.admin-activity-summary > span').evaluateAll(nodes=>nodes.map(node=>node.getBoundingClientRect().height));
  if(Math.max(...heights)-Math.min(...heights)>1)throw Error('Admin summary cards have uneven heights');
  const heading=page.locator('[class*=operationCardHeading]');const value=page.locator('.admin-activity-summary > span').nth(1).locator(':scope > strong');
  if((await heading.boundingBox()).y >= (await value.boundingBox()).y)throw Error('Detail action should stay above metric value');
  await page.getByRole('button',{name:'Xem chi tiết',exact:true}).click();
  const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading',{name:'Chi tiết thao tác tuần này'})).toBeVisible();
  await expect(dialog.locator('dd')).toHaveText(['20','8','4']);
  await page.screenshot({path:path.join(outDir,'admin-operation-details.png')});
  await dialog.getByRole('button',{name:'Đóng',exact:true}).click();await expect(dialog).not.toBeVisible();
  await page.getByRole('radio',{name:'Tháng này',exact:true}).click();
  await page.getByRole('button',{name:'Xem chi tiết',exact:true}).click();
  await expect(dialog.getByRole('heading',{name:'Chi tiết thao tác tháng này'})).toBeVisible();
  await expect(dialog.locator('dd')).toHaveText(['60','25','15']);
  await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
  hideOperationDetails=true;
  await page.locator('[data-page-refresh]').click();
  await page.getByRole('button',{name:'Xem chi tiết',exact:true}).click();
  await expect(dialog.getByText('Chưa tải được số liệu chi tiết',{exact:true})).toBeVisible();
  await expect(dialog).not.toContainText('backend');
  await page.screenshot({path:path.join(outDir,'admin-operation-unavailable.png')});
  hideOperationDetails=false;
  await dialog.getByRole('button',{name:'Thử lại',exact:true}).click();
  await expect(dialog.locator('dd')).toHaveText(['60','25','15']);
  await dialog.getByRole('button',{name:'Đóng',exact:true}).click();
  await page.locator('.admin-platform-details > summary').click();
}
if(url==='/student'){
  await expect(page.locator('[data-kpi] dd')).toHaveText(['3','2','1','7']);
  const surface=await page.locator('[data-student-design=study]').boundingBox();if(!surface||surface.x>310||surface.x+surface.width<1560)throw Error('Student dashboard should use full School-style content width');
  await expect(page.getByRole('heading',{name:'Kết quả & phản hồi',exact:true})).toBeVisible();
  const todo=page.getByRole('region',{name:'Cần làm tiếp'});await expect(todo.locator('li')).toHaveCount(3);await expect(todo.locator('li').first()).toContainText('Bài cần bổ sung');
  await expect(page.getByText('Nhận xét: Lập luận đúng, cần ghi rõ đơn vị đo.',{exact:true})).toBeVisible();
  await expect(page.getByRole('heading',{name:'Tiến độ nộp bài',exact:true})).toBeVisible();
}
if(url==='/lab/reports'){
  await expect(page.locator('[data-report-heading]')).toHaveCount(0);
  await expect(page.getByRole('region',{name:'Bảng kết quả bài tập'}).locator('tbody tr')).toHaveCount(4);
  const filters=page.getByRole('form',{name:'Bộ lọc báo cáo lớp'});
  await filters.getByLabel('Từ ngày giao',{exact:true}).fill('2026-12-01');await filters.getByLabel('Đến ngày giao',{exact:true}).fill('2026-11-01');await filters.getByRole('button',{name:'Áp dụng',exact:true}).click();await expect(page.getByRole('alert')).toContainText('Từ ngày phải trước');
  await filters.getByRole('button',{name:'Xóa bộ lọc',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);
  await filters.getByRole('searchbox').fill('Bài thực hành');const request=page.waitForRequest(r=>r.url().includes('/class1/report?')&&new URL(r.url()).searchParams.get('query')==='Bài thực hành');await filters.getByRole('button',{name:'Áp dụng',exact:true}).click();await request;
  await filters.getByRole('button',{name:'Xóa bộ lọc',exact:true}).click();
  await page.getByRole('button',{name:'Cách tính số liệu báo cáo'}).hover();await expect(page.getByRole('tooltip')).toContainText('không tính điểm tạm tính');await page.mouse.move(0,0);await page.keyboard.press('Escape');
}
if(url==='/school/reports'){
  await expect(page.locator('[data-report-heading]')).toHaveCount(0);
  const search=page.getByRole('textbox',{name:'Tìm lớp trong báo cáo'});
  const table=page.getByRole('region',{name:'Thống kê lớp học'});
  await search.fill('11A1');await expect(table.locator('tbody tr')).toHaveCount(1);await expect(table).toContainText('11A1');await expect(page.locator('.report-chart-row')).toHaveCount(1);
  await search.fill('Không có lớp');await expect(table).toContainText('Không có lớp phù hợp');await expect(page.getByRole('button',{name:'Xuất CSV',exact:true})).toBeDisabled();
  await search.fill('');await expect(table.locator('tbody tr')).toHaveCount(2);await expect(page.getByRole('button',{name:'Xuất CSV',exact:true})).toBeEnabled();
  await expect(page.getByRole('region',{name:'Bản quyền và hạn mức'})).toContainText('13 / 100');
}
await page.screenshot({path:path.join(outDir,role+'-'+url.replaceAll('/','_')+'-desktop.png'),fullPage:true});
if(url==='/manager/payments'){
  const table=page.locator('[class*=desktopTable] tbody');await expect(table.locator('tr')).toHaveCount(10);
  await page.getByRole('tab',{name:/Thanh toán thất bại/}).click();await expect(table.locator('tr')).toHaveCount(2);
  await page.getByRole('tab',{name:/Chờ thanh toán/}).click();await expect(table).toContainText('Không có giao dịch phù hợp');
  await page.getByRole('tab',{name:/Tất cả/}).click();await expect(table.locator('tr')).toHaveCount(10);
  await expect(page.getByRole('img',{name:'Phân bổ 13 giao dịch'})).toBeVisible();
}
if(url==='/manager'){await page.getByRole('link',{name:'Người dùng',exact:true}).click();await expect(page.locator('[data-page-refresh]')).toHaveCount(1);await expect(page.locator('[data-page-actions-target] [data-page-refresh]')).toHaveAttribute('aria-label','Làm mới danh sách tài khoản');await page.getByRole('link',{name:'Tổng quan',exact:true}).click();await expect(page.locator('[data-kpi]').first()).toBeVisible();await expect(page.locator('[data-page-refresh]')).toHaveCount(1);}
if(url==='/teacher'){await page.getByRole('link',{name:'Bài tập',exact:true}).click();await expect(page.getByRole('heading',{name:'Lớp phụ trách',exact:true})).toBeVisible();await expect(page.locator('[data-page-actions-target] [data-page-refresh]')).toHaveCount(1);await page.getByRole('link',{name:'Tổng quan',exact:true}).first().click();await expect(page.locator('[data-kpi]').first()).toBeVisible();await expect(page.locator('[data-page-refresh]')).toHaveCount(1);}
if(url==='/student'){await page.getByRole('link',{name:/Bài tập được giao/}).first().click();await expect(page.locator('[data-page-actions-target] [data-page-refresh]')).toHaveCount(1);await page.getByRole('link',{name:'Tổng quan',exact:true}).first().click();await expect(page.locator('[data-kpi]').first()).toBeVisible();await expect(page.locator('[data-page-refresh]')).toHaveCount(0);}

await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2))throw Error('Mobile overflow '+url);if(url==='/student'){const widths=await page.locator('.student-results__list li > button').evaluateAll(nodes=>nodes.map(el=>el.getBoundingClientRect().width));if(widths.some(width=>width<68))throw Error('Student result action clipped');}await page.screenshot({path:path.join(outDir,role+'-'+url.replaceAll('/','_')+'-mobile.png'),fullPage:true});
if(url==='/lab/reports'||url==='/student'){await page.emulateMedia({colorScheme:'dark'});}else if(url==='/school/reports'){await page.getByRole('button',{name:/Giao diện:/}).click();await page.getByRole('menuitemradio',{name:'Tối',exact:true}).click();}else await page.evaluate(()=>{localStorage.setItem('physlive-theme','dark');document.documentElement.classList.add('dark');});await page.screenshot({path:path.join(outDir,role+'-'+url.replaceAll('/','_')+'-dark.png'),fullPage:true});
if(errors.length)throw Error(url+': '+errors.join('; '));results.push({role,url,passed:true});await context.close();}
await writeFile(path.join(outDir,'results.json'),JSON.stringify(results,null,2));console.log('PASS all role dashboards and reports. Screenshots: '+outDir);
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
