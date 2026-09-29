import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import { ensureStore, readState, updateState, UPLOAD_DIR } from './store.js'
import {reviewErrors} from '../src/lib/review.js'
import {taskDaySegments} from '../src/lib/rules.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'
const scrypt=promisify(crypto.scrypt),sessions=new Map()

await ensureStore()
app.use(cors())
app.use(express.json({ limit: '4mb' }))

const safeExt = name => path.extname(name || '').replace(/[^.a-zA-Z0-9]/g, '').slice(0, 10)
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${safeExt(file.originalname)}`)
})
const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype.startsWith('image/')
    cb(ok ? null : new Error('僅接受票據圖片'), ok)
  }
})

const now = () => new Date().toISOString()
const uid = prefix => `${prefix}-${new Date().toISOString().slice(0,10).replaceAll('-','')}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`
const companyPrefix = company => company?.includes('東瑭') ? 'DT' : company?.includes('栢貨') ? 'BH' : 'HSM'
const findCase = (state, id, user) => state.cases.find(c => c.id === id&&(user?.role==='accounting'||c.ownerEmployeeId===user?.employeeId))
const parseCookies=req=>Object.fromEntries(String(req.headers.cookie||'').split(';').map(x=>x.trim().split('=').map(decodeURIComponent)).filter(x=>x.length===2))
const hashPassword=async password=>{const salt=crypto.randomBytes(16).toString('hex');const key=await scrypt(password,salt,64);return `${salt}:${Buffer.from(key).toString('hex')}`}
const checkPassword=async(password,stored)=>{try{const [salt,hex]=stored.split(':');const key=await scrypt(password,salt,64);return crypto.timingSafeEqual(Buffer.from(hex,'hex'),Buffer.from(key))}catch{return false}}
const requireAuth=(req,res,next)=>{const user=sessions.get(parseCookies(req).trip_session);if(!user)return res.status(401).json({error:'請先登入'});req.user=user;next()}

function materialSnapshot(c) {
  return JSON.stringify({
    company:c.company, employee:c.employee, employeeId:c.employeeId, dept:c.dept, manager:c.manager,
    tripMode:c.tripMode, taskType:c.taskType, projectName:c.projectName, destination:c.destination,
    startDate:c.startDate, endDate:c.endDate, purpose:c.purpose,
    taskStartAt:c.taskStartAt, taskEndAt:c.taskEndAt,taskDays:c.taskDays,
    claimItems:c.claimItems, transports:c.transports, lodgings:c.lodgings, overtimeRows:c.overtimeRows,
    hasPrivate:c.hasPrivate, privateStart:c.privateStart, privateEnd:c.privateEnd, privateNote:c.privateNote
  })
}

const receiptCategoryFor = category => ({
  '住宿費':'住宿發票／收據','汽油費':'加油／停車／過路費','停車費':'加油／停車／過路費','過路費':'加油／停車／過路費',
  '自用車／汽車':'里程／路線佐證','自用車／機車':'里程／路線佐證',
  '高鐵票':'交通票券／訂票紀錄','火車票':'交通票券／訂票紀錄','飛機票':'交通票券／訂票紀錄','客運／捷運':'交通票券／訂票紀錄',
  '計程車':'計程車收據','門票':'門票／報名／場租憑證','報名費／場租':'門票／報名／場租憑證','餐費':'餐費憑證','其他代墊費用':'其他報支憑證'
}[category] || '其他報支憑證')

function validateEmployeeSubmission(c) {
  const errors = []
  ;['company','employee','dept','manager','tripMode','taskType','destination','startDate','endDate','purpose','taskStartAt','taskEndAt'].forEach(k => {
    if (!String(c[k] ?? '').trim()) errors.push(`缺少欄位：${k}`)
  })
  const claimItems = Array.isArray(c.claimItems) ? c.claimItems : []
  const taskDays=taskDaySegments(c)
  if(!taskDays.length||taskDays.some(d=>d.to<=d.from))errors.push('每日任務結束時間必須晚於開始時間')
  if (!claimItems.length) errors.push('請至少新增 1 筆差旅費用')
  claimItems.forEach((item, index) => {
    if (!String(item.category || '').trim()) errors.push(`第 ${index + 1} 筆核銷項目未選擇類別`)
    if (!String(item.date || item.checkIn || '').trim()) errors.push(`第 ${index + 1} 筆核銷項目未填日期`)
    if (!String(item.detail || '').trim()) errors.push(`第 ${index + 1} 筆核銷項目未填內容`)
    const amount=item.category==='自用車／汽車'?Number(item.km||0)*6:item.category==='自用車／機車'?Number(item.km||0)*3:Number(item.amount||0)
    if (!(amount > 0)) errors.push(`第 ${index + 1} 筆核銷項目金額必須大於 0`)
    if (item.category.startsWith('自用車／') && !(Number(item.km)>0)) errors.push(`第 ${index + 1} 筆自用車未填里程`)
    if (item.category === '住宿費' && !item.checkOut) errors.push(`第 ${index + 1} 筆住宿費未填退房日期`)
    if (item.category === '計程車' && !item.taxiReason) errors.push(`第 ${index + 1} 筆計程車未填必要原因`)
    const hasReceipt = (c.attachments || []).some(a => a.group === 'receipt' && a.mime?.startsWith('image/') && (a.claimItemId === item.id || (!a.claimItemId && a.category === receiptCategoryFor(item.category))))
    if (!hasReceipt) errors.push(`第 ${index + 1} 筆${item.category || '核銷項目'}尚未上傳票據照片`)
  })
  if(c.tripMode==='國外出差'&&(!(Number(c.foreignDailyUsd)>0)||!(Number(c.usdRate)>0)))errors.push('國外差旅需填日支標準與美元匯率')
  if(!c.hr104TripConfirmed||!c.hr104OvertimeConfirmed)errors.push('請先完成兩項 104 企業大師提醒確認')
  return errors
}

async function purgeExpiredCases(){
  const cutoff=new Date();cutoff.setMonth(cutoff.getMonth()-2)
  const removed=[]
  await updateState(state=>{state.cases=state.cases.filter(c=>{const expired=new Date(c.submittedAt||c.createdAt)<cutoff;if(expired)removed.push(...(c.attachments||[]));return !expired})})
  await Promise.all(removed.map(a=>a.filename?fs.unlink(path.join(UPLOAD_DIR,a.filename)).catch(()=>{}):null))
}

app.get('/api/auth/status',async(_req,res)=>{const s=await readState();res.json({needsSetup:!(s.accounts||[]).some(x=>x.role==='accounting')})})
app.get('/api/health',(_req,res)=>res.json({ok:true}))
app.post('/api/auth/demo-login',(req,res)=>{const role=req.body?.role==='accounting'?'accounting':'employee';const user=role==='accounting'?{username:'demo-accounting',role,name:'測試會計／行政'}:{username:'demo-employee',role,name:'測試員工',employeeId:'DEMO-EMP',dept:'測試部',manager:'測試主管'};const token=crypto.randomUUID();sessions.set(token,user);res.setHeader('Set-Cookie',`trip_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.RENDER?'; Secure':''}`);res.json(user)})
app.post('/api/auth/setup',async(req,res)=>{let user,error;await updateState(async state=>{if((state.accounts||[]).some(x=>x.role==='accounting')){error='管理員已建立';return}const username=String(req.body.username||'accounting').trim(),password=String(req.body.password||'');if(password.length<8){error='密碼至少需要 8 個字元';return}state.accounts||=[];state.accounts.push({id:crypto.randomUUID(),username,role:'accounting',name:'會計／行政',passwordHash:await hashPassword(password)});user={username,role:'accounting',name:'會計／行政'}});if(error)return res.status(400).json({error});const token=crypto.randomUUID();sessions.set(token,user);res.setHeader('Set-Cookie',`trip_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.RENDER?'; Secure':''}`);res.json(user)})
app.post('/api/auth/login',async(req,res)=>{const state=await readState(),account=(state.accounts||[]).find(x=>x.username===String(req.body.username||'').trim());if(!account||!await checkPassword(String(req.body.password||''),account.passwordHash))return res.status(401).json({error:'帳號或密碼錯誤'});const user={username:account.username,role:account.role,name:account.name,employeeId:account.employeeId};const token=crypto.randomUUID();sessions.set(token,user);res.setHeader('Set-Cookie',`trip_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800${process.env.RENDER?'; Secure':''}`);res.json(user)})
app.get('/api/auth/me',requireAuth,(req,res)=>res.json(req.user))
app.post('/api/auth/logout',requireAuth,(req,res)=>{sessions.delete(parseCookies(req).trip_session);res.setHeader('Set-Cookie','trip_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');res.json({ok:true})})
app.get('/uploads/:filename',requireAuth,async(req,res)=>{const state=await readState();const allowed=state.cases.some(c=>(req.user.role==='accounting'||c.ownerEmployeeId===req.user.employeeId)&&(c.attachments||[]).some(a=>a.filename===req.params.filename));if(!allowed)return res.status(404).end();res.sendFile(path.join(UPLOAD_DIR,req.params.filename))})
app.use('/api',requireAuth)

app.get('/api/state', async (req, res) => {await purgeExpiredCases();const state=await readState();const cases=req.user.role==='accounting'?state.cases:state.cases.filter(c=>c.ownerEmployeeId===req.user.employeeId);const settings=req.user.role==='accounting'?state.settings:{...state.settings,employees:(state.settings.employees||[]).map(({monthlySalary,...p})=>p.employeeId===req.user.employeeId?{...p,monthlySalary}:p)};res.json({cases,settings,user:req.user})})

app.get('/api/exchange-rate',async(req,res)=>{
  const date=String(req.query.date||'').slice(0,10)
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return res.status(400).json({error:'日期格式不正確'})
  try{const r=await fetch(`https://api.frankfurter.app/${date}?from=USD&to=TWD`);const data=await r.json();const rate=Number(data?.rates?.TWD);if(!rate)throw new Error();res.json({date:data.date,rate,source:'Frankfurter/ECB'})}catch{return res.status(502).json({error:'暫時無法載入美元匯率，請手動輸入'})}
})

app.post('/api/cases', async (req, res) => {
  const body = req.body || {}
  const state=await readState(),profile=(state.settings.employees||[]).find(x=>x.employeeId===req.user.employeeId)
  const c = {
    id: uid(companyPrefix(body.company)),
    company: body.company || '東瑭國際有限公司', employee:profile?.name||req.user.name||'', employeeId:profile?.employeeId||req.user.employeeId||'', dept:profile?.dept||req.user.dept||'', manager:profile?.manager||req.user.manager||'',ownerEmployeeId:profile?.employeeId||req.user.employeeId||'',
    tripMode:'公出', taskType:'客戶拜訪', projectName:'', destination:'', startDate:'', endDate:'', purpose:'',taskStartAt:'',taskEndAt:'',foreignDailyUsd:0,usdRate:0,hr104TripConfirmed:false,hr104OvertimeConfirmed:false,
    claimItems:[], transports:[], lodgings:[], overtimeRows:[], hasPrivate:false, privateStart:'', privateEnd:'', privateNote:'',
    attachments:[], status:'草稿', createdAt:now(), updatedAt:now(), submittedAt:null, firstSubmittedAt:null,
    returnTarget:null, returnSnapshot:null, managerApproval:{}, accounting:{ itemApprovals:{} }, audit:[]
  }
  await updateState(state => { state.cases.unshift(c) })
  res.status(201).json(c)
})

app.put('/api/cases/:id', async (req, res) => {
  let out,locked=false
  await updateState(state => {
    const c = findCase(state, req.params.id,req.user)
    if (!c) return
    if(req.user.role==='employee'&&!['草稿','主管退回','會計退回'].includes(c.status)){locked=true;return}
    const editable=['company','tripMode','taskType','projectName','destination','startDate','endDate','purpose','taskStartAt','taskEndAt','taskDays','foreignDailyUsd','usdRate','usdRateDate','usdRateSource','hr104TripConfirmed','hr104OvertimeConfirmed','claimItems','overtimeRows','hasPrivate','privateStart','privateEnd','privateNote']
    for(const key of editable)if(Object.hasOwn(req.body||{},key))c[key]=req.body[key]
    const profile=(state.settings.employees||[]).find(x=>x.employeeId===req.user.employeeId)
    if(req.user.role==='employee')Object.assign(c,{employee:profile?.name||req.user.name||'',employeeId:req.user.employeeId,dept:profile?.dept||req.user.dept||'',manager:profile?.manager||req.user.manager||'',ownerEmployeeId:req.user.employeeId})
    c.updatedAt=now()
    out = c
  })
  if(locked)return res.status(409).json({error:'案件已送出，無法再修改'})
  if (!out) return res.status(404).json({ error:'案件不存在' })
  res.json(out)
})

app.post('/api/cases/:id/attachments', upload.array('files', 12), async (req, res) => {
  const group = 'receipt'
  const category = String(req.body.category || '其他報支憑證')
  const claimItemId = String(req.body.claimItemId || '')
  let out
  await updateState(state => {
    const c = findCase(state, req.params.id,req.user)
    if (!c) return
    c.attachments ||= []
    for (const f of req.files || []) {
      c.attachments.push({
        id: crypto.randomUUID(), group, category, claimItemId, name:f.originalname, mime:f.mimetype, size:f.size,
        url:`/uploads/${f.filename}`, filename:f.filename, uploadedAt:now()
      })
    }
    c.updatedAt = now(); out = c
  })
  if (!out) return res.status(404).json({ error:'案件不存在' })
  res.json(out)
})

app.delete('/api/cases/:caseId/attachments/:attachmentId', async (req, res) => {
  let removed, out
  await updateState(state => {
    const c = findCase(state, req.params.caseId,req.user)
    if (!c) return
    const idx = (c.attachments || []).findIndex(a => a.id === req.params.attachmentId)
    if (idx >= 0) removed = c.attachments.splice(idx,1)[0]
    c.updatedAt=now(); out=c
  })
  if (!out) return res.status(404).json({ error:'案件不存在' })
  if (removed?.filename) fs.unlink(path.join(UPLOAD_DIR, removed.filename)).catch(()=>{})
  res.json(out)
})

app.post('/api/cases/:id/submit', async (req, res) => {
  let out, errors
  await updateState(state => {
    const c = findCase(state, req.params.id,req.user)
    if (!c) return
    errors = validateEmployeeSubmission(c)
    if (errors.length) { out=c; return }
    const oldStatus = c.status
    c.status = '待會計審核'
    c.submittedAt=now(); c.firstSubmittedAt ||= c.submittedAt
    c.audit ||= []; c.audit.push({at:now(),actor:'員工',action:'列印紙本並送會計',from:oldStatus,to:c.status})
    c.updatedAt=now(); out=c
  })
  if (!out) return res.status(404).json({ error:'案件不存在' })
  if (errors?.length) return res.status(400).json({ error:'送出前尚有缺漏', details:errors, case:out })
  res.json(out)
})

app.post('/api/cases/:id/accounting', async (req, res) => {
  if(req.user.role!=='accounting')return res.status(403).json({error:'僅限會計／行政'})
  const { action, note='', itemApprovals={}, allowanceAdjustments={},costCenter='', costType='', customerRecharge='不適用', quotationCost='不適用', overtimePay=0, foreignDailyRate=0 } = req.body || {}
  if(!['save','approve','returnEmployee'].includes(action))return res.status(400).json({error:'不支援的核銷動作'})
  let out,errors=[]
  await updateState(state => {
    const c=findCase(state,req.params.id,req.user); if(!c)return
    out=c
    if(c.status!=='待會計審核'){errors=['案件目前不可核定'];return}
    const accounting={...(c.accounting||{}),note,itemApprovals,allowanceAdjustments,costCenter,costType,customerRecharge,quotationCost,overtimePay:Number(overtimePay||0),foreignDailyRate:Number(foreignDailyRate||0),reviewedAt:now()}
    errors=reviewErrors({...c,accounting},state.settings)
    if(errors.length)return
    for(const a of Object.values(accounting.itemApprovals))if(a.status==='不核准')a.amount=0
    const from=c.status
    c.accounting=accounting
    if(action==='approve'){
      c.status='核銷完成'; c.accounting.at=now(); c.returnTarget=null
    }else if(action==='returnEmployee'){
      c.status='會計退回'; c.returnTarget='employee'; c.returnSnapshot=materialSnapshot(c); c.accounting.returnedAt=now()
    }
    c.audit ||= []; c.audit.push({at:now(),actor:'會計／行政',action:action==='approve'?'核銷完成':action==='save'?'儲存核定':'退回員工補件',from,to:c.status,note})
    c.updatedAt=now(); out=c
  })
  if(!out)return res.status(404).json({error:'案件不存在'})
  if(errors.length)return res.status(400).json({error:errors.join('、'),details:errors})
  res.json(out)
})

app.put('/api/settings', async (req,res)=>{
  if(req.user.role!=='accounting')return res.status(403).json({error:'僅限會計／行政'})
  let settings
  await updateState(async state=>{const employees=(req.body.employees||state.settings.employees||[]).map(({loginPassword,...p})=>p);state.accounts||=[];for(const p of req.body.employees||[]){if(!p.employeeId)continue;let a=state.accounts.find(x=>x.employeeId===p.employeeId);if(!a){a={id:crypto.randomUUID(),username:p.employeeId,employeeId:p.employeeId,role:'employee',name:p.name,passwordHash:''};state.accounts.push(a)}a.name=p.name;if(p.loginPassword)a.passwordHash=await hashPassword(String(p.loginPassword))}state.settings={...state.settings,...req.body,employees};settings=state.settings})
  res.json(settings)
})

app.post('/api/demo', async (req,res)=>{
  if(req.user.role!=='accounting')return res.status(403).json({error:'僅限會計／行政'})
  const today = new Date(); const d=n=>{const x=new Date(today);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)}
  const c={
    id:'DT-DEMO-RN-001',company:'東瑭國際有限公司',employee:'王品涵',employeeId:'D017',dept:'業務部',manager:'陳主管',
    tripMode:'國內出差',taskType:'展覽／活動',projectName:'台北品牌展',destination:'台北南港展覽館',startDate:d(-2),endDate:d(-1),purpose:'展覽值班、客戶接待與撤展',
    transports:[{id:'t1',date:d(-2),type:'高鐵／台鐵',detail:'左營→台北',amount:1490},{id:'t2',date:d(-1),type:'高鐵／台鐵',detail:'台北→左營',amount:1490}],
    lodgings:[{id:'l1',checkIn:d(-2),checkOut:d(-1),name:'南港商旅',region:'metro',amount:3600}],
    overtimeRows:[{id:'o1',date:d(-1),start:'18:00',end:'20:00',hours:2,note:'撤展與展品整理'}],
    taskStartAt:`${d(-2)}T09:00`,taskEndAt:`${d(-1)}T20:00`,hr104TripConfirmed:true,hr104OvertimeConfirmed:true,
    hasPrivate:false,privateStart:'',privateEnd:'',privateNote:'',attachments:[],status:'待會計審核',createdAt:now(),updatedAt:now(),submittedAt:now(),firstSubmittedAt:now(),returnTarget:null,returnSnapshot:null,managerApproval:{},accounting:{itemApprovals:{}},audit:[]
  }
  await updateState(state=>{state.cases=state.cases.filter(x=>!x.id.includes('DEMO-RN'));state.cases.unshift(c)})
  res.json(c)
})

app.delete('/api/demo', async (req,res)=>{
  if(req.user.role!=='accounting')return res.status(403).json({error:'僅限會計／行政'})
  await updateState(state=>{state.cases=state.cases.filter(x=>!x.id.includes('DEMO-RN'))})
  res.json({ok:true})
})

const dist = path.join(__dirname,'..','dist')
try { await fs.access(dist); app.use(express.static(dist)); app.get('*',(_req,res)=>res.sendFile(path.join(dist,'index.html'))) } catch {}

app.use((err,_req,res,_next)=>{console.error(err);res.status(400).json({error:err.message||'處理失敗'})})
app.listen(PORT,HOST,()=>console.log(`Travel claim API running at http://${HOST}:${PORT}`))
