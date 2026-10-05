import assert from 'node:assert/strict'
const base='http://127.0.0.1:8791'
let cookie=''
async function api(path,body,method='POST',status=200){
 const r=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)})})
 if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0]
 const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data
}
await api('/api/auth/demo-login',{role:'accounting'})
await api('/api/settings',{employees:[{employeeId:'DEMO-EMP',name:'測試員工',dept:'測試部',manager:'測試主管',monthlySalary:24000}],foreignPerDiems:[{destination:'日本－東京',dailyUsd:200},{destination:'日本－大阪',dailyUsd:180}]},'PUT')
await api('/api/auth/demo-login',{role:'employee'})
const c=await api('/api/cases',{},'POST',201)
const saved=await api('/api/cases/'+c.id,{tripMode:'國外出差',destination:'日本－東京',foreignDailyUsd:99999,usdRate:32,startDate:'2026-10-05',endDate:'2026-10-05',taskStartAt:'2026-10-05T08:00',taskEndAt:'2026-10-05T22:00',purpose:'10月回饋驗收（虛構資料）',hr104TripConfirmed:true,hr104OvertimeConfirmed:true,claimItems:[{id:'oct-hotel',category:'住宿費',checkIn:'2026-10-08',checkOut:'2026-10-11',region:'foreign',detail:'測試飯店',amount:20000,personalAdvance:true}]},'PUT')
assert.equal(saved.foreignDailyUsd,200)
const switched=await api('/api/cases/'+c.id,{destination:'日本－大阪',foreignDailyUsd:999},'PUT')
assert.equal(switched.foreignDailyUsd,180)
await api('/api/cases/'+c.id,{destination:'日本－東京'},'PUT')
const form=new FormData();form.set('claimItemId','oct-hotel');form.set('category','住宿發票／收據')
form.append('files',new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="white"/><text x="20" y="100" font-size="30">TEST HOTEL RECEIPT 20,000 TWD</text></svg>'],{type:'image/svg+xml'}),'test-hotel.svg')
assert.equal((await fetch(base+'/api/cases/'+c.id+'/attachments',{method:'POST',headers:{Cookie:cookie},body:form})).status,200)
console.log('PASS catalog enforced on save and destination change; browser QA draft '+c.id)
