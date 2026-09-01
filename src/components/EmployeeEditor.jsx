import React, {useEffect, useMemo, useState} from 'react'
import ExpenseClaims from './ExpenseClaims.jsx'
import { COMPANIES, TASKS, claimCategory, claimItemsFor, totals, overtimeHours, deadline, canEmployeeEdit, money } from '../lib/rules.js'

const clone=v=>JSON.parse(JSON.stringify(v))
const rid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`

function Field({label,required,children,className=''}){return <div className={`field ${className}`}><label className={required?'req':''}>{label}</label>{children}</div>}

export default function EmployeeEditor({caseData,settings,onSave,onSubmit,onUpload,onDeleteAttachment,onPdf}){
  const normalize=value=>({...clone(value),claimItems:claimItemsFor(value)})
  const [c,setC]=useState(()=>normalize(caseData))
  const [saving,setSaving]=useState(false)
  useEffect(()=>setC(normalize(caseData)),[caseData?.id,caseData?.updatedAt])
  const edit=canEmployeeEdit(c)
  const sum=useMemo(()=>totals(c,settings),[c,settings])
  const due=deadline(c.endDate,settings)
  const receiptCount=(c.attachments||[]).filter(a=>a.group==='receipt'&&a.mime?.startsWith('image/')).length
  const missingReceiptCount=(c.claimItems||[]).filter(item=>!(c.attachments||[]).some(a=>a.group==='receipt'&&a.mime?.startsWith('image/')&&(a.claimItemId===item.id||(!a.claimItemId&&a.category===claimCategory(item.category).receipt)))).length
  const update=(k,v)=>setC(x=>({...x,[k]:v,...(k==='startDate'&&x.tripMode==='公出'?{endDate:v}:{})}))
  const save=async()=>{setSaving(true);try{await onSave(c)}finally{setSaving(false)}}
  const addOt=()=>setC(x=>({...x,overtimeRows:[...(x.overtimeRows||[]),{id:rid('o'),date:x.endDate,start:'',end:'',hours:0,note:''}]}))
  const setOt=(id,k,v)=>setC(x=>({...x,overtimeRows:x.overtimeRows.map(r=>{if(r.id!==id)return r;const y={...r,[k]:v};y.hours=overtimeHours(y);return y})}))
  const delOt=id=>setC(x=>({...x,overtimeRows:x.overtimeRows.filter(r=>r.id!==id)}))
  const tripModeChange=v=>setC(x=>({...x,tripMode:v,endDate:v==='公出'?x.startDate:x.endDate}))

  return <div>
    <div className="detail-top"><div><div className="case-id">{c.id}</div><h2>{edit?'員工事後報支':'報支案件檢視'}</h2><div className="mini-kpi"><span className="badge blue">{c.status}</span>{due&&<span className="badge">送出期限 {due}</span>}</div></div><div className="actions-row top-actions-inline"><button className="btn" onClick={onPdf}>下載／列印 PDF</button>{edit&&<button className="btn" disabled={saving} onClick={save}>{saving?'儲存中…':'儲存草稿'}</button>}</div></div>

    <section className="section"><div className="section-head"><div><h3><span className="step">1</span>申請人與實際任務</h3><p>純事後報支，只填實際發生內容。</p></div></div>
      <div className="grid g4">
        <Field label="公司" required><select disabled={!edit} value={c.company} onChange={e=>update('company',e.target.value)}>{COMPANIES.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="姓名" required><input readOnly={!edit} value={c.employee||''} onChange={e=>update('employee',e.target.value)}/></Field>
        <Field label="員工編號"><input readOnly={!edit} value={c.employeeId||''} onChange={e=>update('employeeId',e.target.value)}/></Field>
        <Field label="部門" required><input readOnly={!edit} value={c.dept||''} onChange={e=>update('dept',e.target.value)}/></Field>
        <Field label="主管" required><input readOnly={!edit} value={c.manager||''} onChange={e=>update('manager',e.target.value)}/></Field>
        <Field label="差旅型態" required><select disabled={!edit} value={c.tripMode} onChange={e=>tripModeChange(e.target.value)}><option>公出</option><option>國內出差</option><option>國外出差</option></select></Field>
        <Field label="主要任務" required><select disabled={!edit} value={c.taskType} onChange={e=>update('taskType',e.target.value)}>{TASKS.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="專案／活動名稱"><input readOnly={!edit} value={c.projectName||''} onChange={e=>update('projectName',e.target.value)} placeholder="有專案時再填"/></Field>
      </div>
      <div className="grid g3 mt10">
        <Field label="目的地" required><input readOnly={!edit} value={c.destination||''} onChange={e=>update('destination',e.target.value)} /></Field>
        <Field label={c.tripMode==='公出'?'任務日期':'出差開始日期'} required><input disabled={!edit} type="date" value={c.startDate||''} onChange={e=>update('startDate',e.target.value)}/></Field>
        {c.tripMode!=='公出'&&<Field label="出差結束日期" required><input disabled={!edit} type="date" value={c.endDate||''} onChange={e=>update('endDate',e.target.value)}/></Field>}
      </div>
      <Field label="實際任務說明" required className="mt10"><textarea readOnly={!edit} value={c.purpose||''} onChange={e=>update('purpose',e.target.value)} placeholder="例如：設備維修、展覽值班、客戶拜訪、撤展…"/></Field>
    </section>

    <section className="section"><div className="section-head"><div><h3><span className="step">2</span>員工代墊核銷項目</h3><p>需要公司還款給員工的費用才新增，沒有代墊就不必送申請。</p></div></div>
      <ExpenseClaims items={c.claimItems||[]} attachments={c.attachments||[]} editable={edit} onChange={items=>update('claimItems',items)} onUpload={async(itemId,category,files)=>{const saved=await onSave(c);await onUpload(saved.id,'receipt',category,files,itemId)}} onDelete={onDeleteAttachment}/>
    </section>

    <section className="section"><div className="section-head"><div><h3><span className="step">3</span>實際加班（如有）</h3><p>只申報正常工時外真正執行工作的時間；沒有加班就不需要新增。</p></div>{edit&&<button type="button" className="add overtime-add" onClick={addOt}>＋ 新增加班</button>}</div>
      {!(c.overtimeRows||[]).length&&<div className="claim-empty"><strong>本次沒有加班</strong><span>有實際加班時，再填寫日期、開始、結束與工作內容。</span></div>}
      <div className="rows">{(c.overtimeRows||[]).map((r,i)=><div className="row" key={r.id}><div className="row-head"><b>加班 #{i+1}　{r.hours||0} 小時</b>{edit&&<button type="button" className="remove overtime-remove" aria-label={`移除第 ${i+1} 筆加班`} onClick={()=>delOt(r.id)}>移除</button>}</div><div className="row-grid"><Field label="日期"><input disabled={!edit} type="date" value={r.date||''} onChange={e=>setOt(r.id,'date',e.target.value)}/></Field><Field label="開始"><input disabled={!edit} type="time" value={r.start||''} onChange={e=>setOt(r.id,'start',e.target.value)}/></Field><Field label="結束"><input disabled={!edit} type="time" value={r.end||''} onChange={e=>setOt(r.id,'end',e.target.value)}/></Field><Field label="時數"><input readOnly value={r.hours||0}/></Field><Field label="實際工作內容" className="span4"><input readOnly={!edit} value={r.note||''} onChange={e=>setOt(r.id,'note',e.target.value)}/></Field></div></div>)}</div>
    </section>

    <section className="section"><div className="section-head"><div><h3><span className="step">4</span>私人延長</h3><p>只有真的有私人延長才展開；私人增加的交通、改票、住宿不列入報支。</p></div></div><label className="checkline"><input type="checkbox" disabled={!edit} checked={!!c.hasPrivate} onChange={e=>update('hasPrivate',e.target.checked)}/> 本次差旅包含私人延長／私人行程</label>{c.hasPrivate&&<div className="grid g3 mt10"><Field label="私人開始"><input disabled={!edit} type="datetime-local" value={c.privateStart||''} onChange={e=>update('privateStart',e.target.value)}/></Field><Field label="私人結束"><input disabled={!edit} type="datetime-local" value={c.privateEnd||''} onChange={e=>update('privateEnd',e.target.value)}/></Field><Field label="公私切分說明"><input readOnly={!edit} value={c.privateNote||''} onChange={e=>update('privateNote',e.target.value)} placeholder="例如私人延住兩晚自行負擔"/></Field></div>}</section>

    <section className="section"><div className="summary"><div className="sum"><span>交通／車輛</span><b>{money(sum.transport)}</b></div><div className="sum"><span>住宿</span><b>{money(sum.lodging)}</b></div><div className="sum"><span>餐費／其他</span><b>{money(sum.meal+sum.other)}</b></div><div className="sum"><span>核銷筆數</span><b>{sum.itemCount} 筆</b></div><div className="sum accent"><span>本次申報</span><b>{money(sum.total)}</b></div><div className={`sum ${receiptCount&&!missingReceiptCount?'good':''}`}><span>票據照片</span><b>{receiptCount} 張</b></div></div>{edit&&<div className="actions-row"><button className="btn" onClick={save}>儲存草稿</button><button className="btn primary" onClick={async()=>{const saved=await onSave(c);await onSubmit(saved.id)}} disabled={!!missingReceiptCount||!sum.itemCount} title={!sum.itemCount?'請先新增至少 1 筆員工代墊費用':missingReceiptCount?`還有 ${missingReceiptCount} 筆核銷項目未上傳票據照片`:''}>送主管審核</button></div>}</section>
  </div>
}
