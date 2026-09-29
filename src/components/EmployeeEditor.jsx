import React, {useEffect, useMemo, useState} from 'react'
import ExpenseClaims from './ExpenseClaims.jsx'
import AccountingResult from './AccountingResult.jsx'
import { api } from '../api.js'
import { COMPANIES, TASKS, claimItemsFor, totals, overtimeHours, deadline, canEmployeeEdit, money, taskDaySegments, lunchAllowance, missingReceiptItems, foreignDailyUsd } from '../lib/rules.js'

const clone=v=>JSON.parse(JSON.stringify(v))
const rid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`
const withDefaultSchedule=value=>{
  const first=value.startDate,last=value.tripMode==='公出'?value.startDate:(value.endDate||value.startDate)
  if(!first||!last)return value
  const taskStartAt=String(value.taskStartAt||'').startsWith(`${first}T`)?value.taskStartAt:`${first}T08:00`
  const taskEndAt=String(value.taskEndAt||'').startsWith(`${last}T`)?value.taskEndAt:`${last}T17:00`
  return {...value,taskStartAt,taskEndAt}
}

function Field({label,required,children,className=''}){return <div className={`field ${className}`}><label className={required?'req':''}>{label}</label>{children}</div>}

export default function EmployeeEditor({caseData,settings,onSave,onUpload,onDeleteAttachment,onPdf}){
  const normalize=value=>({...clone(value),claimItems:claimItemsFor(value)})
  const [c,setC]=useState(()=>normalize(caseData))
  const [saving,setSaving]=useState(false)
  const [submitError,setSubmitError]=useState('')
  useEffect(()=>setC(normalize(caseData)),[caseData?.id,caseData?.updatedAt])
  useEffect(()=>{if(c.tripMode==='國外出差'&&c.startDate&&!c.usdRate)api.exchangeRate(c.startDate).then(x=>setC(v=>({...v,usdRate:x.rate,usdRateDate:x.date,usdRateSource:x.source}))).catch(()=>{})},[c.tripMode,c.startDate])
  const edit=canEmployeeEdit(c)
  const calculatedCase=withDefaultSchedule(c)
  const sum=useMemo(()=>totals(calculatedCase,settings),[c,settings])
  const due=deadline(c.endDate,settings)
  const receiptCount=(c.attachments||[]).filter(a=>a.group==='receipt'&&a.mime?.startsWith('image/')).length
  const missingReceipts=missingReceiptItems(c)
  const schedule=taskDaySegments(calculatedCase)
  const lunch=lunchAllowance(calculatedCase,settings)
  const withSchedule=value=>{
    value=withDefaultSchedule(value)
    const days=taskDaySegments(value)
    if(!days.length)return value
    return {...value,taskDays:days.map(({date,start,end})=>({date,start,end})),taskStartAt:`${days[0].date}T${days[0].start}`,taskEndAt:`${days.at(-1).date}T${days.at(-1).end}`}
  }
  const update=(k,v)=>setC(x=>({...x,[k]:v,...(k==='startDate'&&x.tripMode==='公出'?{endDate:v}:{})}))
  const setEmployee=name=>{const p=(settings.employees||[]).find(x=>x.name===name);setC(x=>({...x,employee:name,...(p?{employeeId:p.employeeId||'',dept:p.dept||'',manager:p.manager||''}:{})}))}
  const setDestination=value=>setC(x=>({...x,destination:value,...(x.tripMode==='國外出差'?{foreignDailyUsd:foreignDailyUsd(value,settings)||x.foreignDailyUsd}:{})}))
  const addOt=()=>setC(x=>({...x,overtimeRows:[...(x.overtimeRows||[]),{id:rid('o'),date:x.endDate,start:'',end:'',hours:0,note:''}]}))
  const setOt=(id,k,v)=>setC(x=>({...x,overtimeRows:x.overtimeRows.map(r=>{if(r.id!==id)return r;const y={...r,[k]:v};y.hours=overtimeHours(y);return y})}))
  const delOt=id=>setC(x=>({...x,overtimeRows:x.overtimeRows.filter(r=>r.id!==id)}))
  const tripModeChange=v=>setC(x=>({...x,tripMode:v,endDate:v==='公出'?x.startDate:x.endDate}))
  const setTaskDay=(date,key,value)=>setC(current=>{
    const currentDays=taskDaySegments(withDefaultSchedule(current)).map(day=>({date:day.date,start:day.start,end:day.end}))
    const taskDays=currentDays.map(day=>day.date===date?{...day,[key]:value}:day)
    const first=taskDays[0],last=taskDays.at(-1)
    return {...current,taskDays,taskStartAt:first?`${first.date}T${first.start}`:'',taskEndAt:last?`${last.date}T${last.end}`:''}
  })
  const pdf=async()=>{
    const errors=[]
    if(!sum.itemCount)errors.push('請先新增至少一筆核銷項目。')
    if(missingReceipts.length)errors.push(`以下項目尚未上傳票據照片：${missingReceipts.map(item=>`第 ${(c.claimItems||[]).findIndex(x=>x.id===item.id)+1} 筆 ${item.category}`).join('、')}。`)
    if(edit&&!c.hr104TripConfirmed)errors.push('請確認 104 企業大師的公出差旅單。')
    if(edit&&!c.hr104OvertimeConfirmed)errors.push('請確認 104 企業大師的加班單。')
    if(errors.length){setSubmitError(errors.join('\n'));return}
    setSubmitError('')
    setSaving(true)
    try{await onPdf(withSchedule(c),edit)}catch(error){setSubmitError(error?.message||'PDF 產生失敗，請稍後再試。')}finally{setSaving(false)}
  }

  return <div>
    <div className="detail-top"><div><div className="case-id">{c.id}</div><h2>{edit?'員工事後報支':'報支案件檢視'}</h2><div className="mini-kpi"><span className="badge blue">{c.status}</span>{due&&<span className="badge">列印期限 {due}</span>}</div></div><div className="actions-row top-actions-inline"><button className="btn primary" disabled={saving} onClick={pdf}>{saving?'處理中…':edit?'完成填寫並下載／列印 PDF':'下載／列印 PDF'}</button></div></div>
    {submitError&&<div className="callout danger" role="alert" style={{whiteSpace:'pre-line'}}>{submitError}</div>}

    <section className="section"><div className="section-head"><div><h3><span className="step">1</span>申請人與實際任務</h3><p>純事後報支，只填實際發生內容。</p></div></div>
      <div className="grid g4">
        <Field label="公司" required><select disabled={!edit} value={c.company} onChange={e=>update('company',e.target.value)}>{COMPANIES.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="姓名" required><input readOnly={!edit} list="employee-directory" value={c.employee||''} onChange={e=>setEmployee(e.target.value)}/><datalist id="employee-directory">{(settings.employees||[]).map(x=><option key={x.name} value={x.name}/>)}</datalist></Field>
        <Field label="員工編號"><input readOnly value={c.employeeId||''}/></Field>
        <Field label="部門" required><input readOnly value={c.dept||''}/></Field>
        <Field label="主管" required><input readOnly={!edit} value={c.manager||''} onChange={e=>update('manager',e.target.value)}/></Field>
        <Field label="差旅型態" required><select disabled={!edit} value={c.tripMode} onChange={e=>tripModeChange(e.target.value)}><option>公出</option><option>國內出差</option><option>國外出差</option></select></Field>
        <Field label="主要任務" required><select disabled={!edit} value={c.taskType} onChange={e=>update('taskType',e.target.value)}>{TASKS.map(x=><option key={x}>{x}</option>)}</select></Field>
        <Field label="專案／活動名稱"><input readOnly={!edit} value={c.projectName||''} onChange={e=>update('projectName',e.target.value)} placeholder="有專案時再填"/></Field>
      </div>
      <div className="grid g3 mt10">
        <Field label="目的地" required><input readOnly={!edit} value={c.destination||''} onChange={e=>setDestination(e.target.value)} /></Field>
        <Field label={c.tripMode==='公出'?'任務日期':'出差開始日期'} required><input disabled={!edit} type="date" value={c.startDate||''} onChange={e=>update('startDate',e.target.value)}/></Field>
        {c.tripMode!=='公出'&&<Field label="出差結束日期" required><input disabled={!edit} type="date" value={c.endDate||''} onChange={e=>update('endDate',e.target.value)}/></Field>}
      </div>
      <Field label="實際任務說明" required className="mt10"><textarea readOnly={!edit} value={c.purpose||''} onChange={e=>update('purpose',e.target.value)} placeholder="例如：設備維修、展覽值班、客戶拜訪、撤展…"/></Field>
      {!!schedule.length&&<div className="mt10"><div className="section-head compact"><div><h4>每日實際任務時間</h4><p>多日任務預設每日 08:00–17:00，請依實際時間調整；本欄同時作為午休及超時津貼計算依據。</p></div></div><div className="rows">{schedule.map(day=><div className="row" key={day.date}><div className="row-head"><b>{day.date}　{day.hours} 小時</b></div><div className="grid g2"><Field label="開始時間" required><input disabled={!edit} type="time" value={day.start} onChange={e=>setTaskDay(day.date,'start',e.target.value)}/></Field><Field label="結束時間" required><input disabled={!edit} type="time" value={day.end} onChange={e=>setTaskDay(day.date,'end',e.target.value)}/></Field></div>{(()=>{const allowance=lunch.days.find(x=>x.date===day.date);return allowance?<div className="helper">午休津貼 {allowance.minutes} 分鐘{allowance.extraMinutes?`＋超過 8 小時加給 ${allowance.extraMinutes} 分鐘`:''}，倍率 {allowance.multiplier}</div>:null})()}</div>)}</div></div>}
      {!!schedule.length&&!lunch.hourly&&<div className="callout warn">尚未設定此員工的月總薪，津貼暫顯示零元；請至會計端「公司行事曆／規則」設定測試薪資。</div>}{!!schedule.length&&<div className="callout info">午休津貼與超時津貼分開計算：每日實際涵蓋 12:30–13:30 的時間最多 60 分鐘；當日任務嚴格超過 8 小時，另加給 10 分鐘。週末及國定假日按 1.34 倍計算。</div>}
      {c.tripMode==='國外出差'&&<div className="grid g2 mt10"><Field label="目的地日支標準（USD／日）" required><input disabled={!edit} type="number" min="0" value={c.foreignDailyUsd||''} onChange={e=>update('foreignDailyUsd',Number(e.target.value||0))}/></Field><Field label="出差當日美元匯率" required><input disabled={!edit} type="number" min="0" step="0.0001" value={c.usdRate||''} onChange={e=>update('usdRate',Number(e.target.value||0))}/><div className="helper">系統會依出差日期載入；必要時可依公司採用匯率修正。</div></Field></div>}
    </section>

    <section className="section"><div className="section-head"><div><h3><span className="step">2</span>差旅費用明細</h3><p>只填寫員工自己先行代墊、需要公司核銷的費用。</p></div></div>
      <ExpenseClaims items={c.claimItems||[]} attachments={c.attachments||[]} editable={edit} settings={settings} onChange={items=>update('claimItems',items)} onUpload={async(itemId,category,files)=>{const saved=await onSave(withSchedule(c));await onUpload(saved.id,'receipt',category,files,itemId)}} onDelete={onDeleteAttachment}/>
    </section>

    <section className="section"><div className="section-head"><div><h3><span className="step">3</span>實際加班（如有）</h3><p>只申報正常工時外真正執行工作的時間；沒有加班就不需要新增。</p></div>{edit&&<button type="button" className="add overtime-add" onClick={addOt}>＋ 新增加班</button>}</div>
      {!(c.overtimeRows||[]).length&&<div className="claim-empty"><strong>本次沒有加班</strong><span>有實際加班時，再填寫日期、開始、結束與工作內容。</span></div>}
      <div className="rows">{(c.overtimeRows||[]).map((r,i)=><div className="row" key={r.id}><div className="row-head"><b>加班 #{i+1}　{r.hours||0} 小時</b>{edit&&<button type="button" className="remove overtime-remove" aria-label={`移除第 ${i+1} 筆加班`} onClick={()=>delOt(r.id)}>移除</button>}</div><div className="row-grid"><Field label="日期"><input disabled={!edit} type="date" value={r.date||''} onChange={e=>setOt(r.id,'date',e.target.value)}/></Field><Field label="開始"><input disabled={!edit} type="time" value={r.start||''} onChange={e=>setOt(r.id,'start',e.target.value)}/></Field><Field label="結束"><input disabled={!edit} type="time" value={r.end||''} onChange={e=>setOt(r.id,'end',e.target.value)}/></Field><Field label="時數"><input readOnly value={r.hours||0}/></Field><Field label="實際工作內容" className="span4"><input readOnly={!edit} value={r.note||''} onChange={e=>setOt(r.id,'note',e.target.value)}/></Field></div></div>)}</div>
    </section>

    <section className="section"><div className="section-head"><div><h3><span className="step">4</span>私人延長</h3><p>只有真的有私人延長才展開；私人增加的交通、改票、住宿不列入報支。</p></div></div><label className="checkline"><input type="checkbox" disabled={!edit} checked={!!c.hasPrivate} onChange={e=>update('hasPrivate',e.target.checked)}/> 本次差旅包含私人延長／私人行程</label>{c.hasPrivate&&<div className="grid g3 mt10"><Field label="私人開始"><input disabled={!edit} type="datetime-local" value={c.privateStart||''} onChange={e=>update('privateStart',e.target.value)}/></Field><Field label="私人結束"><input disabled={!edit} type="datetime-local" value={c.privateEnd||''} onChange={e=>update('privateEnd',e.target.value)}/></Field><Field label="公私切分說明"><input readOnly={!edit} value={c.privateNote||''} onChange={e=>update('privateNote',e.target.value)} placeholder="例如私人延住兩晚自行負擔"/></Field></div>}</section>

    {c.accounting&&<AccountingResult c={c} settings={settings}/>}

    <section className="section"><div className="summary"><div className="sum"><span>交通／車輛</span><b>{money(sum.transport)}</b></div><div className="sum"><span>住宿核銷</span><b>{money(sum.lodging)}</b></div><div className="sum"><span>{c.tripMode==='國外出差'?'膳雜費（國外不發）':'膳雜費（300／日）'}</span><b>{money(sum.mealAllowance)}</b></div><div className="sum"><span>超時津貼</span><b>{money(sum.allowance)}</b></div><div className="sum"><span>午休津貼（最多 60 分鐘／日）</span><b>{money(sum.lunchAllowance)}</b></div><div className="sum"><span>超過 8 小時加給 10 分鐘</span><b>{money(sum.extraAllowance)}</b></div>{c.tripMode==='國外出差'&&<div className="sum"><span>國外日支 3 折</span><b>{money(sum.foreignPerDiem)}</b></div>}<div className="sum"><span>公司掛帳</span><b>{money(sum.companyPaid)}</b></div><div className="sum accent"><span>原申請合計（核定另列上方）</span><b>{money(sum.total)}</b></div><div className={`sum ${receiptCount&&!missingReceipts.length?'good':''}`}><span>票據照片</span><b>{receiptCount} 張</b></div></div>
      {c.tripMode==='國外出差'&&<div className="callout info">國外出差不發 NT$ 300／日膳雜費；國外日支三折仍獨立計算。</div>}
      {!!missingReceipts.length&&<div className="callout danger"><strong>尚未完成票據上傳：</strong>{missingReceipts.map((item,index)=><span key={item.id||index}> 第 {(c.claimItems||[]).findIndex(x=>x.id===item.id)+1} 筆「{item.category}」</span>)}</div>}
      {edit&&<div className="reminder-box"><strong>送出前提醒</strong><label className="checkline"><input type="checkbox" checked={!!c.hr104TripConfirmed} onChange={e=>update('hr104TripConfirmed',e.target.checked)}/> 104 企業大師－公出差旅單（應於出差日前後三天提送申請）</label><label className="checkline"><input type="checkbox" checked={!!c.hr104OvertimeConfirmed} onChange={e=>update('hr104OvertimeConfirmed',e.target.checked)}/> 104 企業大師－加班單（出差日含週六、日請記得提送）</label><p>勾選完成後，請使用頁面上方「完成填寫並下載／列印 PDF」。列印後案件會直接進入會計／行政待處理。</p></div>}
    </section>
  </div>
}
