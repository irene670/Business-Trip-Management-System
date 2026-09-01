import express from 'express'
import cors from 'cors'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs/promises'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { ensureStore, readState, updateState, UPLOAD_DIR } from './store.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const app = express()
const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'

await ensureStore()
app.use(cors())
app.use(express.json({ limit: '4mb' }))
app.use('/uploads', express.static(UPLOAD_DIR))

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
const findCase = (state, id) => state.cases.find(c => c.id === id)

function materialSnapshot(c) {
  return JSON.stringify({
    company:c.company, employee:c.employee, employeeId:c.employeeId, dept:c.dept, manager:c.manager,
    tripMode:c.tripMode, taskType:c.taskType, projectName:c.projectName, destination:c.destination,
    startDate:c.startDate, endDate:c.endDate, purpose:c.purpose,
    attendanceStartMode:c.attendanceStartMode, attendanceStartAt:c.attendanceStartAt,
    attendanceEndMode:c.attendanceEndMode, attendanceEndAt:c.attendanceEndAt,
    claimItems:c.claimItems, transports:c.transports, lodgings:c.lodgings, overtimeRows:c.overtimeRows,
    hasPrivate:c.hasPrivate, privateStart:c.privateStart, privateEnd:c.privateEnd, privateNote:c.privateNote
  })
}

const receiptCategoryFor = category => ({
  '住宿費':'住宿發票／收據','汽油費':'加油／停車／過路費','停車費':'加油／停車／過路費','過路費':'加油／停車／過路費',
  '高鐵票':'交通票券／訂票紀錄','火車票':'交通票券／訂票紀錄','飛機票':'交通票券／訂票紀錄','客運／捷運':'交通票券／訂票紀錄',
  '計程車':'計程車收據','門票':'門票／報名／場租憑證','報名費／場租':'門票／報名／場租憑證','餐費':'餐費憑證','其他代墊費用':'其他報支憑證'
}[category] || '其他報支憑證')

function validateEmployeeSubmission(c) {
  const errors = []
  ;['company','employee','dept','manager','tripMode','taskType','destination','startDate','endDate','purpose'].forEach(k => {
    if (!String(c[k] ?? '').trim()) errors.push(`缺少欄位：${k}`)
  })
  const claimItems = Array.isArray(c.claimItems) ? c.claimItems : []
  if (!claimItems.length) errors.push('請至少新增 1 筆員工代墊核銷項目')
  claimItems.forEach((item, index) => {
    if (!String(item.category || '').trim()) errors.push(`第 ${index + 1} 筆核銷項目未選擇類別`)
    if (!String(item.date || item.checkIn || '').trim()) errors.push(`第 ${index + 1} 筆核銷項目未填日期`)
    if (!String(item.detail || '').trim()) errors.push(`第 ${index + 1} 筆核銷項目未填內容`)
    if (!(Number(item.amount) > 0)) errors.push(`第 ${index + 1} 筆核銷項目金額必須大於 0`)
    if (item.category === '住宿費' && !item.checkOut) errors.push(`第 ${index + 1} 筆住宿費未填退房日期`)
    if (item.category === '計程車' && !item.taxiReason) errors.push(`第 ${index + 1} 筆計程車未填必要原因`)
    const hasReceipt = (c.attachments || []).some(a => a.group === 'receipt' && a.mime?.startsWith('image/') && (a.claimItemId === item.id || (!a.claimItemId && a.category === receiptCategoryFor(item.category))))
    if (!hasReceipt) errors.push(`第 ${index + 1} 筆${item.category || '核銷項目'}尚未上傳票據照片`)
  })
  return errors
}

app.get('/api/state', async (_req, res) => res.json(await readState()))

app.post('/api/cases', async (req, res) => {
  const body = req.body || {}
  const c = {
    id: uid(companyPrefix(body.company)),
    company: body.company || '東瑭國際有限公司', employee:'', employeeId:'', dept:'', manager:'',
    tripMode:'公出', taskType:'客戶拜訪', projectName:'', destination:'', startDate:'', endDate:'', purpose:'',
    claimItems:[], transports:[], lodgings:[], overtimeRows:[], hasPrivate:false, privateStart:'', privateEnd:'', privateNote:'',
    attachments:[], status:'草稿', createdAt:now(), updatedAt:now(), submittedAt:null, firstSubmittedAt:null,
    returnTarget:null, returnSnapshot:null, managerApproval:{}, accounting:{ itemApprovals:{} }, audit:[]
  }
  await updateState(state => { state.cases.unshift(c) })
  res.status(201).json(c)
})

app.put('/api/cases/:id', async (req, res) => {
  let out
  await updateState(state => {
    const c = findCase(state, req.params.id)
    if (!c) return
    const keep = { id:c.id, attachments:c.attachments || [], createdAt:c.createdAt, audit:c.audit || [] }
    Object.assign(c, req.body, keep, { updatedAt:now() })
    out = c
  })
  if (!out) return res.status(404).json({ error:'案件不存在' })
  res.json(out)
})

app.post('/api/cases/:id/attachments', upload.array('files', 12), async (req, res) => {
  const group = 'receipt'
  const category = String(req.body.category || '其他報支憑證')
  const claimItemId = String(req.body.claimItemId || '')
  let out
  await updateState(state => {
    const c = findCase(state, req.params.id)
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
    const c = findCase(state, req.params.caseId)
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
    const c = findCase(state, req.params.id)
    if (!c) return
    errors = validateEmployeeSubmission(c)
    if (errors.length) { out=c; return }
    const oldStatus = c.status
    if (oldStatus === '會計退回' && c.returnTarget === 'employee') {
      c.status = c.returnSnapshot === materialSnapshot(c) ? '待會計審核' : '待主管審核'
    } else c.status = '待主管審核'
    c.submittedAt=now(); c.firstSubmittedAt ||= c.submittedAt
    c.audit ||= []; c.audit.push({at:now(),actor:'員工',action:'送出報支',from:oldStatus,to:c.status})
    c.updatedAt=now(); out=c
  })
  if (!out) return res.status(404).json({ error:'案件不存在' })
  if (errors?.length) return res.status(400).json({ error:'送出前尚有缺漏', details:errors, case:out })
  res.json(out)
})

app.post('/api/cases/:id/manager', async (req, res) => {
  const { action, note='', overtimeDecision='同意認列', approvedOtHours=0, privateDecision='不適用' } = req.body || {}
  let out
  await updateState(state => {
    const c=findCase(state,req.params.id); if(!c)return
    const from=c.status
    if(action==='approve'){
      c.managerApproval={decision:'核准',note,overtimeDecision,approvedOtHours:Number(approvedOtHours||0),privateDecision,at:now()}
      c.status='待會計審核'; c.returnTarget=null
    }else{
      c.managerApproval={decision:'退回',note,at:now()}; c.status='主管退回'; c.returnTarget='manager'
    }
    c.audit ||= []; c.audit.push({at:now(),actor:'主管',action:action==='approve'?'核准':'退回員工',from,to:c.status,note})
    c.updatedAt=now(); out=c
  })
  if(!out)return res.status(404).json({error:'案件不存在'})
  res.json(out)
})

app.post('/api/cases/:id/accounting', async (req, res) => {
  const { action, note='', itemApprovals={}, costCenter='', costType='', customerRecharge='不適用', quotationCost='不適用', overtimePay=0, foreignDailyRate=0 } = req.body || {}
  let out
  await updateState(state => {
    const c=findCase(state,req.params.id); if(!c)return
    const from=c.status
    c.accounting={...(c.accounting||{}),note,itemApprovals,costCenter,costType,customerRecharge,quotationCost,overtimePay:Number(overtimePay||0),foreignDailyRate:Number(foreignDailyRate||0)}
    if(action==='approve'){
      c.status='核銷完成'; c.accounting.at=now(); c.returnTarget=null
    }else if(action==='returnManager'){
      c.status='待主管審核'; c.returnTarget='manager'; c.accounting.returnedAt=now()
    }else{
      c.status='會計退回'; c.returnTarget='employee'; c.returnSnapshot=materialSnapshot(c); c.accounting.returnedAt=now()
    }
    c.audit ||= []; c.audit.push({at:now(),actor:'會計／行政',action:action==='approve'?'核銷完成':action==='returnManager'?'退回主管':'退回員工補件',from,to:c.status,note})
    c.updatedAt=now(); out=c
  })
  if(!out)return res.status(404).json({error:'案件不存在'})
  res.json(out)
})

app.put('/api/settings', async (req,res)=>{
  let settings
  await updateState(state=>{state.settings={...state.settings,...req.body};settings=state.settings})
  res.json(settings)
})

app.post('/api/demo', async (_req,res)=>{
  const today = new Date(); const d=n=>{const x=new Date(today);x.setDate(x.getDate()+n);return x.toISOString().slice(0,10)}
  const c={
    id:'DT-DEMO-RN-001',company:'東瑭國際有限公司',employee:'王品涵',employeeId:'D017',dept:'業務部',manager:'陳主管',
    tripMode:'國內出差',taskType:'展覽／活動',projectName:'台北品牌展',destination:'台北南港展覽館',startDate:d(-2),endDate:d(-1),purpose:'展覽值班、客戶接待與撤展',
    transports:[{id:'t1',date:d(-2),type:'高鐵／台鐵',detail:'左營→台北',amount:1490},{id:'t2',date:d(-1),type:'高鐵／台鐵',detail:'台北→左營',amount:1490}],
    lodgings:[{id:'l1',checkIn:d(-2),checkOut:d(-1),name:'南港商旅',region:'metro',amount:3600}],
    overtimeRows:[{id:'o1',date:d(-1),start:'18:00',end:'20:00',hours:2,note:'撤展與展品整理'}],
    hasPrivate:false,privateStart:'',privateEnd:'',privateNote:'',attachments:[],status:'待主管審核',createdAt:now(),updatedAt:now(),submittedAt:now(),firstSubmittedAt:now(),returnTarget:null,returnSnapshot:null,managerApproval:{},accounting:{itemApprovals:{}},audit:[]
  }
  await updateState(state=>{state.cases=state.cases.filter(x=>!x.id.includes('DEMO-RN'));state.cases.unshift(c)})
  res.json(c)
})

app.delete('/api/demo', async (_req,res)=>{
  await updateState(state=>{state.cases=state.cases.filter(x=>!x.id.includes('DEMO-RN'))})
  res.json({ok:true})
})

const dist = path.join(__dirname,'..','dist')
try { await fs.access(dist); app.use(express.static(dist)); app.get('*',(_req,res)=>res.sendFile(path.join(dist,'index.html'))) } catch {}

app.use((err,_req,res,_next)=>{console.error(err);res.status(400).json({error:err.message||'處理失敗'})})
app.listen(PORT,HOST,()=>console.log(`Travel claim API running at http://${HOST}:${PORT}`))
