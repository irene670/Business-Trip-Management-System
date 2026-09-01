import React,{useMemo,useState} from 'react'
import AttachmentsSection from './AttachmentsSection.jsx'
import { totals, money } from '../lib/rules.js'

export default function ManagerReview({c,settings,onAction,onPdf}){
  const sum=useMemo(()=>totals(c,settings),[c,settings])
  const ot=(c.overtimeRows||[]).reduce((s,r)=>s+Number(r.hours||0),0)
  const [note,setNote]=useState(c.managerApproval?.note||'')
  const [approvedOt,setApprovedOt]=useState(c.managerApproval?.approvedOtHours??ot)
  const [otDecision,setOtDecision]=useState(c.managerApproval?.overtimeDecision||((c.overtimeRows||[]).length?'同意認列':'不適用'))
  const [privateDecision,setPrivateDecision]=useState(c.managerApproval?.privateDecision||(c.hasPrivate?'確認公私費用已切分':'不適用'))
  const pending=c.status==='待主管審核'
  return <div>
    <div className="detail-top"><div><div className="case-id">{c.id}</div><h2>主管審核</h2><span className="badge warn">{c.status}</span></div><button className="btn" onClick={onPdf}>下載／列印 PDF</button></div>
    <section className="section"><div className="section-head"><div><h3>任務摘要</h3><p>主管直接看實際任務、代墊費用與加班明細，不需要看會計成本欄位。</p></div></div><div className="review-grid"><div><span>員工</span><b>{c.employee}｜{c.dept}</b></div><div><span>差旅</span><b>{c.tripMode}｜{c.taskType}</b></div><div><span>目的地</span><b>{c.destination}</b></div><div><span>日期</span><b>{c.startDate}～{c.endDate}</b></div><div className="wide"><span>任務說明</span><b>{c.purpose}</b></div></div></section>
    <section className="section"><div className="summary"><div className="sum"><span>交通／車輛</span><b>{money(sum.transport)}</b></div><div className="sum"><span>住宿</span><b>{money(sum.lodging)}</b></div><div className="sum"><span>餐費／其他</span><b>{money(sum.meal+sum.other)}</b></div><div className="sum accent"><span>員工代墊申報</span><b>{money(sum.total)}</b></div><div className="sum"><span>申報加班</span><b>{ot} h</b></div></div></section>
    {(c.overtimeRows||[]).length>0&&<section className="section"><div className="section-head"><div><h3>實際加班明細</h3><p>日期、起訖時間、時數與工作內容全部攤開後再核准。</p></div></div><table className="table"><thead><tr><th>日期</th><th>起</th><th>迄</th><th>時數</th><th>工作內容</th></tr></thead><tbody>{c.overtimeRows.map(r=><tr key={r.id}><td>{r.date}</td><td>{r.start}</td><td>{r.end}</td><td>{r.hours}</td><td>{r.note}</td></tr>)}</tbody></table>{pending&&<div className="grid g2 mt10"><div className="field"><label>加班認定</label><select value={otDecision} onChange={e=>setOtDecision(e.target.value)}><option>同意認列</option><option>不認列</option><option>需補充說明</option></select></div><div className="field"><label>核准時數</label><input type="number" step="0.5" value={approvedOt} onChange={e=>setApprovedOt(e.target.value)}/></div></div>}</section>}
    {c.hasPrivate&&<section className="section"><div className="section-head"><div><h3>私人延長</h3><p>確認私人增加的住宿、改票或交通沒有列入公司報支。</p></div></div><div className="callout warn">私人期間：{c.privateStart||'—'} ～ {c.privateEnd||'—'}<br/>{c.privateNote||'未填公私切分說明'}</div>{pending&&<div className="field"><label>主管確認</label><select value={privateDecision} onChange={e=>setPrivateDecision(e.target.value)}><option>確認公私費用已切分</option><option>需補充說明</option><option>不接受目前切分</option></select></div>}</section>}
    <section className="section"><div className="section-head"><div><h3>票據照片</h3><p>核對每筆員工代墊費用與對應票據。</p></div></div><AttachmentsSection c={c} readonly onUpload={()=>{}} onDelete={()=>{}}/></section>
    <section className="section"><div className="field"><label>主管意見</label><textarea readOnly={!pending} value={note} onChange={e=>setNote(e.target.value)} placeholder="必要時說明核准／退回原因"/></div>{pending&&<div className="actions-row"><button className="btn danger" onClick={()=>onAction({action:'reject',note})}>退回員工補充</button><button className="btn good" onClick={()=>onAction({action:'approve',note,overtimeDecision:otDecision,approvedOtHours:Number(approvedOt||0),privateDecision})}>核准並送會計</button></div>}</section>
  </div>
}
