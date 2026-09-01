export const COMPANIES=['東瑭國際有限公司','栢貨科技有限公司','豪世邁科技股份有限公司']
export const TASKS=['客戶拜訪','設備維修／現場施工','展覽／活動','通路／業務開發','採購／取送貨','會議／教育訓練','行政／公部門','其他']
export const TRANSPORTS=['高鐵／台鐵','飛機','客運／捷運','計程車','自用汽車','自用機車','公務車','其他']
export const CLAIM_CATEGORIES=[
  {value:'住宿費',group:'lodging',detailLabel:'飯店／住宿名稱',receipt:'住宿發票／收據'},
  {value:'汽油費',group:'vehicle',detailLabel:'車號／加油地點',receipt:'加油／停車／過路費'},
  {value:'停車費',group:'vehicle',detailLabel:'車號／停車地點',receipt:'加油／停車／過路費'},
  {value:'過路費',group:'vehicle',detailLabel:'車輛／路段',receipt:'加油／停車／過路費'},
  {value:'高鐵票',group:'transport',detailLabel:'起訖站／班次',receipt:'交通票券／訂票紀錄'},
  {value:'火車票',group:'transport',detailLabel:'起訖站／車次',receipt:'交通票券／訂票紀錄'},
  {value:'飛機票',group:'transport',detailLabel:'起訖地／班次',receipt:'交通票券／訂票紀錄'},
  {value:'客運／捷運',group:'transport',detailLabel:'路線／用途',receipt:'交通票券／訂票紀錄'},
  {value:'計程車',group:'transport',detailLabel:'起訖地／用途',receipt:'計程車收據'},
  {value:'門票',group:'activity',detailLabel:'場館／活動名稱',receipt:'門票／報名／場租憑證'},
  {value:'報名費／場租',group:'activity',detailLabel:'活動／場地名稱',receipt:'門票／報名／場租憑證'},
  {value:'餐費',group:'meal',detailLabel:'就餐人數／用途',receipt:'餐費憑證'},
  {value:'其他代墊費用',group:'other',detailLabel:'費用內容',receipt:'其他報支憑證'}
]
export const RECEIPT_CATEGORIES=[...new Set(CLAIM_CATEGORIES.map(x=>x.receipt).concat('訂房紀錄','換匯／匯率證明'))]
export const STATUS_CLASS=s=>s==='核銷完成'?'good':s.includes('退回')?'red':s.includes('待')?'warn':'blue'
export const money=n=>`NT$ ${Math.round(Number(n||0)).toLocaleString('zh-TW')}`
export const nights=(a,b)=>{if(!a||!b)return 0;return Math.max(0,Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000))}
export const tripDays=(a,b)=>{if(!a||!b)return 0;return Math.max(1,Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/86400000)+1)}
export const calcTransport=r=>r.type==='自用汽車'?Number(r.km||0)*6:r.type==='自用機車'?Number(r.km||0)*3:Number(r.amount||0)
const legacyCategory=type=>({
  '高鐵／台鐵':'高鐵票','飛機':'飛機票','客運／捷運':'客運／捷運','計程車':'計程車',
  '公務車':'汽油費','自用汽車':'其他代墊費用','自用機車':'其他代墊費用','其他':'其他代墊費用'
}[type]||'其他代墊費用')
export const claimItemsFor=c=>{
  if(Array.isArray(c?.claimItems))return c.claimItems
  return [
    ...(c?.transports||[]).map(r=>({
      id:`legacy-t-${r.id}`,category:legacyCategory(r.type),date:r.date||'',
      detail:r.detail||[r.from,r.to].filter(Boolean).join('→'),amount:calcTransport(r),taxiReason:r.taxiReason||''
    })),
    ...(c?.lodgings||[]).map(r=>({
      id:`legacy-l-${r.id}`,category:'住宿費',date:r.checkIn||'',checkIn:r.checkIn||'',checkOut:r.checkOut||'',detail:r.name||'',amount:Number(r.amount||0)
    }))
  ]
}
export const claimCategory=value=>CLAIM_CATEGORIES.find(x=>x.value===value)||CLAIM_CATEGORIES.at(-1)
export const totals=(c,settings={mealBasis:'tripDays'})=>{
  const items=claimItemsFor(c)
  const byGroup=group=>items.filter(x=>claimCategory(x.category).group===group).reduce((s,r)=>s+Number(r.amount||0),0)
  const transport=byGroup('transport')+byGroup('vehicle')
  const lodging=byGroup('lodging')
  const meal=byGroup('meal')
  const other=byGroup('activity')+byGroup('other')
  return {transport,lodging,meal,other,total:transport+lodging+meal+other,itemCount:items.length}
}
export const overtimeHours=r=>{
  if(!r.start||!r.end)return 0
  const [sh,sm]=r.start.split(':').map(Number),[eh,em]=r.end.split(':').map(Number)
  let v=((eh*60+em)-(sh*60+sm))/60; if(v<0)v+=24
  return Math.round(v*100)/100
}
export const requiredReceipts=c=>{
  const items=claimItemsFor(c)
  const req=items.map(x=>claimCategory(x.category).receipt)
  if(items.some(x=>x.category==='住宿費')) req.push('訂房紀錄')
  if(c.tripMode==='國外出差') req.push('換匯／匯率證明')
  return [...new Set(req)]
}
export const isWorkday=(date,settings)=>{
  const key=date.toISOString().slice(0,10)
  if((settings.workdays||[]).includes(key))return true
  if((settings.holidays||[]).includes(key))return false
  const d=date.getDay(); return d!==0&&d!==6
}
export const deadline=(endDate,settings)=>{
  if(!endDate)return ''
  const d=new Date(endDate+'T12:00:00'); let count=0
  while(count<3){d.setDate(d.getDate()+1);if(isWorkday(d,settings))count++}
  return d.toISOString().slice(0,10)
}
export const canEmployeeEdit=c=>['草稿','主管退回','會計退回'].includes(c?.status)
export const costFieldsRelevant=c=>!!(c.projectName||['客戶拜訪','設備維修／現場施工','展覽／活動','通路／業務開發'].includes(c.taskType))
