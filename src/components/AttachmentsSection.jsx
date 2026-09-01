import React, {useMemo, useState} from 'react'
import { RECEIPT_CATEGORIES, requiredReceipts } from '../lib/rules.js'

function FileRow({a,onDelete,readonly}){
  return <div className="doc ok">
    <div className="doc-left"><div className="doc-icon">{a.mime?.startsWith('image/')?'IMG':'PDF'}</div><div><b>{a.category}</b><small>{a.name}</small></div></div>
    <div className="attachment-actions"><a className="btn small" href={a.url} target="_blank" rel="noreferrer">預覽</a>{!readonly&&<button className="btn small danger" onClick={()=>onDelete(a.id)}>刪除</button>}</div>
  </div>
}

export default function AttachmentsSection({c,onUpload,onDelete,readonly=false}){
  const [cat,setCat]=useState(RECEIPT_CATEGORIES[0])
  const receipts=(c.attachments||[]).filter(a=>a.group==='receipt')
  const required=useMemo(()=>requiredReceipts(c),[c])
  return <div className="attachment-single">
    <div className="attachment-panel">
      <div className="section-head compact"><div><h4>票據照片</h4><p>上傳員工代墊項目對應的車票、住宿、加油、門票或其他憑證照片。</p></div><span className="badge blue">核銷依據</span></div>
      <div className="required-tags">{required.length?required.map(x=><span key={x} className={`badge ${receipts.some(a=>a.category===x)?'good':'warn'}`}>{receipts.some(a=>a.category===x)?'✓ ':'缺 '} {x}</span>):<span className="helper">目前沒有系統判定的必要報支憑證。</span>}</div>
      <div className="doc-list">{receipts.map(a=><FileRow key={a.id} a={a} onDelete={onDelete} readonly={readonly}/>)}</div>
      {!readonly&&<div className="uploadbar"><select value={cat} onChange={e=>setCat(e.target.value)}>{RECEIPT_CATEGORIES.map(x=><option key={x}>{x}</option>)}</select><label className="btn upload-btn">＋ 上傳票據照片<input type="file" multiple accept="image/*" onChange={e=>{const files=[...e.target.files];e.target.value='';if(files.length)onUpload('receipt',cat,files)}}/></label></div>}
    </div>
  </div>
}
