import React from 'react'
import { STATUS_CLASS } from '../lib/rules.js'
export default function CaseList({cases,selectedId,onSelect,search='',filter='all'}){
  const q=search.trim().toLowerCase()
  let rows=cases.filter(c=>!q||[c.id,c.employee,c.destination,c.projectName,c.taskType].some(v=>String(v||'').toLowerCase().includes(q)))
  if(filter==='pending') rows=rows.filter(c=>c.status.includes('待'))
  if(filter==='done') rows=rows.filter(c=>!c.status.includes('待')&&c.status!=='草稿')
  if(!rows.length)return <div className="empty">目前沒有符合的案件</div>
  return <>{rows.map(c=><div key={c.id} className={`case-item ${selectedId===c.id?'active':''}`} onClick={()=>onSelect(c.id)}>
    <div className="case-top"><span className="case-id">{c.id}</span><span className={`badge ${STATUS_CLASS(c.status)}`}>{c.status}</span></div>
    <b>{c.employee||'未填姓名'}｜{c.destination||'未填目的地'}</b>
    <div className="case-sub">{c.tripMode}・{c.taskType}{c.projectName?`・${c.projectName}`:''}</div>
  </div>)}</>
}
