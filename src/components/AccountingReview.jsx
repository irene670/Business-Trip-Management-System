import React,{useEffect,useMemo,useState} from 'react'
import AttachmentsSection from './AttachmentsSection.jsx'
import { claimItemsFor, totals, money, costFieldsRelevant } from '../lib/rules.js'

export default function AccountingReview({c,settings,onAction,onPdf}){
  const base=useMemo(()=>totals(c,settings),[c,settings])
  const [approvals,setApprovals]=useState(c.accounting?.itemApprovals||{})
  const [note,setNote]=useState(c.accounting?.note||'')
  const [costCenter,setCostCenter]=useState(c.accounting?.costCenter||'')
  const [costType,setCostType]=useState(c.accounting?.costType||c.taskType||'')
  const [recharge,setRecharge]=useState(c.accounting?.customerRecharge||'不適用')
  const [quotation,setQuotation]=useState(c.accounting?.quotationCost||'不適用')
  const [overtimePay,setOvertimePay]=useState(c.accounting?.overtimePay||0)
  const pending=c.status==='待會計審核'
  useEffect(()=>setApprovals(c.accounting?.itemApprovals||{}),[c.id,c.updatedAt])
  const rows=useMemo(()=>[
    ...claimItemsFor(c).map((r,i)=>({key:`claim:${r.id}`,label:`${i+1}｜${r.category}　${r.detail||''}`,claim:Number(r.amount||0)})),
    ...(Number(overtimePay)>0?[{key:'otpay',label:'核定加班費',claim:Number(overtimePay)}]:[])
  ],[c,overtimePay])
  const approvedTotal=rows.reduce((s,r)=>s+Number((approvals[r.key]?.amount ?? r.claim)||0),0)
  const setRow=(key,k,v)=>setApprovals(x=>({...x,[key]:{status:x[key]?.status||'核准',amount:x[key]?.amount??rows.find(r=>r.key===key)?.claim??0,note:x[key]?.note||'',[k]:v}}))
  return <div>
    <div className="detail-top"><div><div className="case-id">{c.id}</div><h2>會計／行政核銷</h2><span className="badge warn">{c.status}</span></div><button className="btn" onClick={onPdf}>下載／列印 PDF</button></div>
    <section className="section"><div className="section-head"><div><h3>票據照片</h3><p>先核對員工代墊項目與票據，再逐筆核定金額。</p></div></div><AttachmentsSection c={c} readonly onUpload={()=>{}} onDelete={()=>{}}/></section>
    <section className="section"><div className="section-head"><div><h3>逐筆核銷</h3><p>不要直接手打最後總額；每一筆保留申報、核定與核減原因。</p></div></div><table className="table approval-table"><thead><tr><th>項目</th><th>員工申報</th><th>核定狀態</th><th>核定金額</th><th>原因／備註</th></tr></thead><tbody>{rows.map(r=>{const a=approvals[r.key]||{};return <tr key={r.key}><td>{r.label}</td><td>{money(r.claim)}</td><td><select disabled={!pending} value={a.status||'核准'} onChange={e=>setRow(r.key,'status',e.target.value)}><option>核准</option><option>部分核准</option><option>不核准</option></select></td><td><input disabled={!pending} type="number" value={a.amount??r.claim} onChange={e=>setRow(r.key,'amount',Number(e.target.value||0))}/></td><td><input readOnly={!pending} value={a.note||''} onChange={e=>setRow(r.key,'note',e.target.value)} placeholder="核減時請填原因"/></td></tr>})}</tbody></table><div className="summary mt10"><div className="sum accent"><span>員工申報</span><b>{money(base.total)}</b></div><div className="sum good"><span>系統逐筆核定合計</span><b>{money(approvedTotal)}</b></div></div></section>
    <section className="section"><div className="section-head"><div><h3>成本與行政欄位</h3><p>這些欄位不會出現在員工申請頁。</p></div></div><div className="grid g3"><div className="field"><label>成本中心</label><input readOnly={!pending} value={costCenter} onChange={e=>setCostCenter(e.target.value)}/></div><div className="field"><label>成本類型</label><input readOnly={!pending} value={costType} onChange={e=>setCostType(e.target.value)}/></div><div className="field"><label>核定加班費</label><input disabled={!pending} type="number" value={overtimePay} onChange={e=>setOvertimePay(e.target.value)}/></div></div>{costFieldsRelevant(c)&&<div className="grid g2 mt10"><div className="field"><label>可向客戶轉嫁</label><select disabled={!pending} value={recharge} onChange={e=>setRecharge(e.target.value)}><option>不適用</option><option>是</option><option>否</option><option>待確認</option></select></div><div className="field"><label>列入報價成本</label><select disabled={!pending} value={quotation} onChange={e=>setQuotation(e.target.value)}><option>不適用</option><option>是</option><option>否</option><option>待確認</option></select></div></div>}</section>
    <section className="section"><div className="field"><label>會計／行政備註</label><textarea readOnly={!pending} value={note} onChange={e=>setNote(e.target.value)}/></div>{pending&&<div className="actions-row"><button className="btn danger" onClick={()=>onAction({action:'returnEmployee',note,itemApprovals:approvals,costCenter,costType,customerRecharge:recharge,quotationCost:quotation,overtimePay})}>退回員工補件</button><button className="btn" onClick={()=>onAction({action:'returnManager',note,itemApprovals:approvals,costCenter,costType,customerRecharge:recharge,quotationCost:quotation,overtimePay})}>退回主管確認</button><button className="btn good" onClick={()=>onAction({action:'approve',note,itemApprovals:approvals,costCenter,costType,customerRecharge:recharge,quotationCost:quotation,overtimePay})}>完成核銷</button></div>}</section>
  </div>
}
