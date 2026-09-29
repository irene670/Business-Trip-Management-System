import React from 'react'
import {money} from '../lib/rules.js'
import {reviewRows,approvedTotal} from '../lib/review.js'

export default function AccountingResult({c,settings}) {
  if(!c.accounting?.reviewedAt&&!c.accounting?.at&&!c.accounting?.returnedAt)return null
  return <section className="section"><div className="section-head"><div><h3>會計核定結果</h3><p>保留原申報金額；不核准項目以零元計入。</p></div></div><div style={{overflowX:'auto'}}><table className="table"><thead><tr><th>項目</th><th>原申報</th><th>狀態</th><th>核定金額</th><th>原因</th></tr></thead><tbody>{reviewRows(c,settings).map(r=><tr key={r.key}><td>{r.label}</td><td>{money(r.claim)}</td><td>{r.status}</td><td>{money(r.amount)}</td><td>{r.note||'—'}</td></tr>)}</tbody></table></div>{Object.entries(c.accounting.allowanceAdjustments||{}).map(([date,a])=><p key={date}>{date} 104 核對：午休 {a.minutes??'原值'} 分鐘、額外 {a.extraMinutes??'原值'} 分鐘、任務 {a.taskHours??'原值'} 小時；原因：{a.note}</p>)}<p>核定合計：<strong>{money(approvedTotal(c,settings))}</strong></p>{c.accounting.note&&<p>會計備註：{c.accounting.note}</p>}</section>
}
