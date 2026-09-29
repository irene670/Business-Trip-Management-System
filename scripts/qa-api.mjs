import assert from 'node:assert/strict'
// Run only against a disposable DATA_DIR server, never the shared demo.
const base='http://127.0.0.1:8791'
let cookie=''
async function api(path,body,method='POST',expected=200){
  const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json',Cookie:cookie},...(body===undefined?{}:{body:JSON.stringify(body)})})
  if(response.headers.get('set-cookie'))cookie=response.headers.get('set-cookie').split(';')[0]
  const data=await response.json()
  assert.equal(response.status,expected,JSON.stringify(data))
  return data
}
await api('/api/auth/demo-login',{role:'accounting'})
await api('/api/settings',{employees:[{name:'測試員工',employeeId:'DEMO-EMP',dept:'測試部',manager:'測試主管',monthlySalary:24000}]},'PUT')
await api('/api/auth/demo-login',{role:'employee'})
const c=await api('/api/cases',{},'POST',201)
await api('/api/cases/'+c.id,{startDate:'2026-09-29',endDate:'2026-09-29',destination:'測試台北',purpose:'隔離環境驗收，不是真實報支',taskStartAt:'2026-09-29T08:00',taskEndAt:'2026-09-29T17:00',hr104TripConfirmed:true,hr104OvertimeConfirmed:true,claimItems:[{id:'qa-ticket',category:'火車票',date:'2026-09-29',detail:'測試票據',amount:100,personalAdvance:true}]},'PUT')
await api('/api/cases/'+c.id+'/submit',{},'POST',400)
const form=new FormData()
form.set('category','交通票券／訂票紀錄');form.set('claimItemId','qa-ticket')
form.append('files',new Blob(['<svg xmlns="http://www.w3.org/2000/svg" width="600" height="300"><rect width="600" height="300" fill="white"/><text x="40" y="100" font-size="30">TEST RECEIPT - NT$100</text><text x="40" y="170" font-size="24">Demo QA only</text></svg>'],{type:'image/svg+xml'}),'test-receipt.svg')
assert.equal((await fetch(base+'/api/cases/'+c.id+'/attachments',{method:'POST',headers:{Cookie:cookie},body:form})).status,200)
assert.equal((await api('/api/cases/'+c.id+'/submit',{})).status,'待會計審核')
await api('/api/auth/demo-login',{role:'accounting'})
await api('/api/cases/'+c.id+'/accounting',{action:'save',itemApprovals:{'claim:qa-ticket':{status:'不核准',amount:100}}},'POST',400)
const reviewed=await api('/api/cases/'+c.id+'/accounting',{action:'save',itemApprovals:{'claim:qa-ticket':{status:'不核准',amount:100,note:'測試：票據不符'}} ,allowanceAdjustments:{'2026-09-29':{minutes:30,extraMinutes:0,taskHours:8,note:'測試：104紀錄核對'}}})
assert.equal(reviewed.status,'待會計審核')
assert.equal(reviewed.accounting.itemApprovals['claim:qa-ticket'].amount,0)
await api('/api/auth/demo-login',{role:'employee'})
const state=await api('/api/state',undefined,'GET')
assert.equal(state.settings.employees[0].monthlySalary,24000)
assert.match(state.cases.find(x=>x.id===c.id).accounting.itemApprovals['claim:qa-ticket'].note,/票據不符/)
console.log('API QA PASS: receipt gating, save status, reason validation, zero rejection, employee review visibility, own salary. Case '+c.id)
