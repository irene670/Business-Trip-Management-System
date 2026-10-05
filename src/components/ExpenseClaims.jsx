import React, {useState} from 'react'
import {CLAIM_CATEGORIES, claimCategory, itemAmount, lodgingLimit, lodgingNightlyLimits, money} from '../lib/rules.js'

const rid=()=>`claim-${Date.now()}-${Math.random().toString(36).slice(2,7)}`

function Field({label,required,children,className=''}){
  return <div className={`field ${className}`}><label className={required?'req':''}>{label}</label>{children}</div>
}

function ClaimFields({item,editable,onChange,settings,claimContext}){
  const meta=claimCategory(item.category)
  const isForeignLodging=item.region==='foreign'||claimContext.tripMode==='國外出差'
  const nightly=item.category==='住宿費'?lodgingNightlyLimits(item,settings,claimContext):[]
  return <div className="row-grid claim-fields">
    {item.category==='住宿費'?<>
      <Field label="入住日期" required><input disabled={!editable} type="date" value={item.checkIn||item.date||''} onChange={e=>onChange('checkIn',e.target.value)}/></Field>
      <Field label="退房日期" required><input disabled={!editable} type="date" value={item.checkOut||''} onChange={e=>onChange('checkOut',e.target.value)}/></Field>
    </>:<Field label="費用日期" required><input disabled={!editable} type="date" value={item.date||''} onChange={e=>onChange('date',e.target.value)}/></Field>}
    <Field label={meta.detailLabel} required className={item.category==='住宿費'?'':'span2'}><input readOnly={!editable} value={item.detail||''} onChange={e=>onChange('detail',e.target.value)} placeholder="請填寫憑證上可核對的內容"/></Field>
    {item.category==='住宿費'&&<><Field label="住宿地區" required><select disabled={!editable} value={item.region||'metro'} onChange={e=>onChange('region',e.target.value)}><option value="metro">六都（雙北、桃園、新竹、台中、高雄）</option><option value="other">其他縣市</option><option value="foreign">國外</option></select></Field>{!isForeignLodging&&<Field label="專案核准提高上限"><label className="checkline"><input type="checkbox" disabled={!editable} checked={!!item.specialApproved} onChange={e=>onChange('specialApproved',e.target.checked)}/> 已取得專案核准（一般上限加成 20%）</label></Field>}</>}
    {(item.category==='自用車／汽車'||item.category==='自用車／機車')&&<Field label="Google 地圖里程（公里）" required><input disabled={!editable} type="number" min="0" step="0.1" value={item.km||''} onChange={e=>onChange('km',Number(e.target.value||0))}/></Field>}
    <Field label="金額" required><input readOnly={!editable||item.category.startsWith('自用車／')} inputMode="numeric" min="0" type="number" value={itemAmount(item)||''} onChange={e=>onChange('amount',Number(e.target.value||0))}/></Field>
    {item.category==='住宿費'&&<div className="callout span4" style={{background:"#f1f3f5",color:"#475569"}}><strong>核准住宿上限（系統自動計算）</strong>{isForeignLodging&&<div className="helper">國外平日：目的地日支標準 × 美元匯率 × 40%；假日：目的地日支標準 × 美元匯率 × 70%。</div>}{nightly.length?<><div className="helper">{nightly.map(x=>`${x.date} ${{nationalHoliday:"國定假日",holiday:"假日",weekday:"平日"}[x.dayType]} ${money(x.limit)}`).join('　｜　')}</div><div>合計 {money(lodgingLimit(item,settings,claimContext))}{itemAmount(item)>0&&`；超過上限由員工自行負擔 ${money(Math.max(0,itemAmount(item)-lodgingLimit(item,settings,claimContext)))}`}</div></>:<div className="helper">填寫入住及退房日期後，系統會逐晚顯示上限。</div>}</div>}
    {item.category==='計程車'&&<Field label="搭乘必要原因" required className="span4"><select disabled={!editable} value={item.taxiReason||''} onChange={e=>onChange('taxiReason',e.target.value)}><option value="">請選擇</option><option>攜帶設備／樣品／展品</option><option>大眾運輸不便</option><option>夜間返回／安全考量</option><option>時間緊急</option><option>多人同行較具成本效益</option><option>客戶／活動時間特殊</option><option>其他必要原因</option></select></Field>}
    <Field label="費用說明（選填）" className="span4"><input readOnly={!editable} value={item.note||''} onChange={e=>onChange('note',e.target.value)} placeholder="例如：客戶拜訪、展覽布展、設備維修"/></Field>
  </div>
}

function ReceiptPhotos({item,photos,editable,onUpload,onDelete}){
  const receiptLabel=claimCategory(item.category).receipt
  return <div className="claim-receipts">
    <div className="claim-receipt-head"><div><strong className="req">票據照片</strong><span>每一筆都必須上傳「{item.category}」的票據照片</span></div><span className={`badge ${photos.length?'good':'warn'}`}>{photos.length?`${photos.length} 張`:'尚未上傳'}</span></div>
    <div className="claim-receipt-grid">
      {photos.map((photo,index)=><figure className="claim-receipt-card" key={photo.id}>
        <a href={photo.url} target="_blank" rel="noreferrer" aria-label={`預覽第 ${index+1} 張${item.category}票據`}><img src={photo.url} alt={`${item.category}票據縮圖 ${index+1}`} loading="lazy"/></a>
        <figcaption><span title={photo.name}>{photo.name}</span>{editable&&<button type="button" className="receipt-delete" aria-label={`刪除第 ${index+1} 張${item.category}票據`} onClick={()=>onDelete(photo.id)}>刪除</button>}</figcaption>
      </figure>)}
      {editable&&<label className="claim-receipt-add">＋ 新增票據照片<input type="file" multiple accept="image/*" onChange={e=>{const files=[...e.target.files];e.target.value='';if(files.length)onUpload(item.id,receiptLabel,files)}}/></label>}
    </div>
  </div>
}

export default function ExpenseClaims({items=[],attachments=[],editable,onChange,onUpload,onDelete,settings={},claimContext={}}){
  const [adding,setAdding]=useState(false)
  const [category,setCategory]=useState('')
  const add=()=>{
    if(!category)return
    onChange([...items,{id:rid(),category,date:'',checkIn:'',checkOut:'',detail:'',amount:0,km:0,note:'',taxiReason:'',personalAdvance:false,region:claimContext.tripMode==='國外出差'?'foreign':'metro'}])
    setCategory('')
    setAdding(false)
  }
  const update=(id,key,value)=>onChange(items.map(item=>item.id===id?{...item,[key]:value}:item))
  const remove=async id=>{
    for(const photo of attachments.filter(a=>a.claimItemId===id)) await onDelete(photo.id)
    onChange(items.filter(item=>item.id!==id))
  }

  return <>
    <div className="claim-policy" role="note">
      <strong>每筆費用都要確認付款方式</strong>
      <span>勾選「個人代墊」才會列入應付員工金額；未勾選視為公司掛帳，不會計入員工還款。</span>
    </div>

    {!items.length&&<div className="claim-empty">
      <strong>尚未新增費用</strong>
      <span>有住宿、車油錢、交通票據或門票等個人代墊時，再按下方按鈕逐筆新增。</span>
    </div>}

    {!!items.length&&<div className="rows claim-rows">{items.map((item,index)=>{const receiptLabel=claimCategory(item.category).receipt;const photos=attachments.filter(a=>a.group==='receipt'&&a.mime?.startsWith('image/')&&(a.claimItemId===item.id||(!a.claimItemId&&a.category===receiptLabel)));return <article className="row claim-row" key={item.id}>
      <div className="row-head"><div><span className="claim-index">第 {index+1} 筆</span><b>{item.category}</b><small>{money(itemAmount(item))}</small></div>{editable&&<button type="button" className="remove" aria-label={`移除第 ${index+1} 筆${item.category}`} onClick={()=>remove(item.id)}>移除</button>}</div>
      <div className="advance-toggle"><label className="checkline"><input type="checkbox" disabled={!editable} checked={item.personalAdvance!==false} onChange={e=>update(item.id,'personalAdvance',e.target.checked)}/><span><strong>個人代墊</strong><small>{item.personalAdvance!==false?'此筆列入應付員工金額':'未勾選，視為公司掛帳，不列入員工還款'}</small></span></label></div>
      <ReceiptPhotos item={item} photos={photos} editable={editable} onUpload={onUpload} onDelete={onDelete}/>
      <ClaimFields item={item} editable={editable} settings={settings} claimContext={claimContext} onChange={(key,value)=>update(item.id,key,value)}/>
    </article>})}</div>}

    {editable&&<div className="claim-add-area after-items">
      {!adding?<button className="add claim-add-trigger" type="button" onClick={()=>setAdding(true)}>＋ 新增核銷項目</button>:<div className="claim-picker">
        <Field label="要新增哪一種費用？" required><select autoFocus value={category} onChange={e=>setCategory(e.target.value)}><option value="">請選擇核銷項目</option>{CLAIM_CATEGORIES.map(x=><option key={x.value} value={x.value}>{x.value}</option>)}</select></Field>
        <div className="claim-picker-actions"><button type="button" className="btn" onClick={()=>{setAdding(false);setCategory('')}}>取消</button><button type="button" className="btn primary" disabled={!category} onClick={add}>新增這一筆</button></div>
      </div>}
    </div>}

  </>
}
