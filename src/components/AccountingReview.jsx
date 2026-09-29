import React,{useEffect,useState} from 'react'
import AttachmentsSection from './AttachmentsSection.jsx'
import {totals,money,lunchAllowance,missingReceiptItems} from '../lib/rules.js'
import {reviewRows,reviewErrors,approvedTotal} from '../lib/review.js'

export default function AccountingReview({c,settings,onAction,onPdf}) {
  const [review,setReview]=useState(c.accounting||{})
  const [busy,setBusy]=useState(false),[error,setError]=useState('')
  useEffect(()=>setReview(c.accounting||{}),[c.id,c.updatedAt])
  const pending=c.status==='待會計審核',draft={...c,accounting:review}
  const rows=reviewRows(draft,settings),base=totals(c,settings),days=lunchAllowance(c,settings).days,missing=missingReceiptItems(c)
  const set=(k,v)=>setReview(x=>({...x,[k]:v}))
  const setRow=(r,k,v)=>setReview(x=>({...x,itemApprovals:{...x.itemApprovals,[r.key]:{status:r.status,amount:r.amount,note:r.note,[k]:v,...(k==='status'&&v==='不核准'?{amount:0}:{})}}}))
  const setDay=(d,k,v)=>setReview(x=>{
    const itemApprovals={...x.itemApprovals}
    for(const key of ['lunch-allowance','extra-allowance','trip-allowance'])if(itemApprovals[key]){itemApprovals[key]={...itemApprovals[key]};delete itemApprovals[key].amount}
    return {...x,itemApprovals,allowanceAdjustments:{...x.allowanceAdjustments,[d.date]:{...x.allowanceAdjustments?.[d.date],[k]:v}}}
  })
  const run=async(action,print=false)=>{
    setError('');setBusy(true)
    try{
      const errors=reviewErrors(draft,settings)
      if(errors.length)throw new Error(errors.join('；'))
      if(print&&missing.length)throw new Error('請先補齊每筆核銷項目的票據照片')
      const saved=pending?await onAction({...review,action}):c
      if(print)await onPdf(saved)
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }
  return <div>
    <div className="detail-top"><div><div className="case-id">{c.id}</div><h2>會計／行政核銷</h2><span className="badge warn">{c.status}</span></div><button className="btn" disabled={busy||!!missing.length} onClick={()=>run('save',true)}>{busy?'處理中…':'下載／列印 PDF'}</button></div>
    {error&&<div className="callout danger" role="alert">{error}</div>}
    {!!missing.length&&<div className="callout danger">尚有 {missing.length} 筆項目缺少票據照片，補齊後才能列印 PDF。</div>}
    <section className="section"><h3>票據照片</h3><AttachmentsSection c={c} readonly onUpload={()=>{}} onDelete={()=>{}}/></section>
    <section className="section"><h3>104 工時核對與津貼</h3><p className="helper">人工比對 104 紀錄後調整；保留原計算，調整必填原因。Demo 未串接 104。</p>
      {days.map(d=>{const a=review.allowanceAdjustments?.[d.date]||{};return <div className="calendar-panel mt10" key={d.date}><strong>{d.date}</strong><p className="helper">原系統：任務 {d.hours} 小時、午休 {d.minutes} 分鐘、額外 {d.extraMinutes} 分鐘；午休／額外倍率 {d.multiplier}。</p><div className="grid g3">
        {[['taskHours','核定任務時數',d.hours,24],['minutes','核定午休分鐘',d.minutes,60],['extraMinutes','核定額外分鐘',d.extraMinutes,10]].map(([key,label,value,max])=><div className="field" key={key}><label>{label}</label><input aria-label={d.date+' '+label} type="number" min="0" max={max} step={key==='taskHours'?0.25:1} disabled={!pending||busy} value={a[key]??value} onChange={e=>setDay(d,key,Number(e.target.value))}/></div>)}
      </div><div className="field"><label>工時調整原因</label><input disabled={!pending||busy} value={a.note||''} onChange={e=>setDay(d,'note',e.target.value)} placeholder="有調整時必填，例如：依 104 打卡紀錄核對"/></div></div>})}
    </section>
    <section className="section"><h3>逐筆核銷</h3><p className="helper">保留原申報；不核准為零元，核減及不核准需填原因。</p><div style={{overflowX:'auto'}}><table className="table approval-table"><thead><tr><th>項目</th><th>原申報</th><th>核定狀態</th><th>核定金額</th><th>原因／備註</th></tr></thead><tbody>{rows.map(r=><tr key={r.key}><td>{r.label}</td><td>{money(r.claim)}</td><td><select aria-label={r.label+' 核定狀態'} disabled={!pending||busy} value={r.status} onChange={e=>setRow(r,'status',e.target.value)}><option>核准</option><option>部分核准</option><option>不核准</option></select></td><td><input aria-label={r.label+' 核定金額'} disabled={!pending||busy||r.status==='不核准'} type="number" min="0" value={r.amount} onChange={e=>setRow(r,'amount',Number(e.target.value))}/></td><td><input aria-label={r.label+' 核定原因'} readOnly={!pending||busy} value={r.note} onChange={e=>setRow(r,'note',e.target.value)} placeholder="核減時請填原因"/></td></tr>)}</tbody></table></div><div className="summary mt10"><div className="sum accent"><span>系統申請合計（含住宿上限）</span><b>{money(base.total)}</b></div><div className="sum good"><span>逐筆核定合計</span><b>{money(approvedTotal(draft,settings))}</b></div></div></section>
    <section className="section"><h3>成本與行政欄位</h3><div className="grid g3">{[['costCenter','成本中心'],['costType','成本類型'],['overtimePay','核定加班費']].map(([key,label])=><div className="field" key={key}><label>{label}</label><input readOnly={!pending||busy} type={key==='overtimePay'?'number':'text'} min={key==='overtimePay'?0:undefined} value={review[key]??''} onChange={e=>set(key,e.target.value)}/></div>)}</div><div className="grid g2 mt10">{[['customerRecharge','可向客戶轉嫁'],['quotationCost','列入報價成本']].map(([key,label])=><div className="field" key={key}><label>{label}</label><select disabled={!pending||busy} value={review[key]||'不適用'} onChange={e=>set(key,e.target.value)}>{['不適用','是','否','待確認'].map(s=><option key={s}>{s}</option>)}</select></div>)}</div></section>
    <section className="section"><div className="callout info">紙本流程：員工親簽 → 主管紙本簽核 → 會計／行政紙本簽核。</div><div className="field"><label>會計／行政備註</label><textarea readOnly={!pending||busy} value={review.note||''} onChange={e=>set('note',e.target.value)}/></div>{pending&&<div className="actions-row"><button className="btn" disabled={busy} onClick={()=>run('save')}>儲存核定</button><button className="btn danger" disabled={busy} onClick={()=>run('returnEmployee')}>退回員工補件</button><button className="btn good" disabled={busy} onClick={()=>run('approve')}>完成核銷</button></div>}</section>
  </div>
}
