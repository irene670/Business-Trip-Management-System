export const COMPANIES=['東瑭國際有限公司','栢貨科技有限公司','豪世邁科技股份有限公司']
export const TASKS=['客戶拜訪','設備維修／現場施工','展覽／活動','通路／業務開發','採購／取送貨','會議／教育訓練','行政／公部門','其他']
export const TRANSPORTS=['高鐵／台鐵','飛機','客運／捷運','計程車','自用汽車','自用機車','公務車','其他']
export const CLAIM_CATEGORIES=[
  {value:'住宿費',group:'lodging',detailLabel:'飯店／住宿名稱',receipt:'住宿發票／收據'},
  {value:'自用車／汽車',group:'vehicle',detailLabel:'起訖地／Google 地圖路線',receipt:'里程／路線佐證'},
  {value:'自用車／機車',group:'vehicle',detailLabel:'起訖地／Google 地圖路線',receipt:'里程／路線佐證'},
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
export const itemAmount=item=>item.category==='自用車／汽車'?Number(item.km||0)*6:item.category==='自用車／機車'?Number(item.km||0)*3:Number(item.amount||0)
const dayKey=d=>d.toISOString().slice(0,10)
const isHolidayDate=(d,settings)=>d.getDay()===0||d.getDay()===6||(settings.holidays||[]).includes(dayKey(d))
export const lodgingLimit=(item,settings={})=>{
  const start=item.checkIn||item.date,end=item.checkOut
  if(!start||!end)return 0
  let d=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00'),limit=0
  while(d<last){
    const holiday=isHolidayDate(d,settings)
    const base=item.region==='other'?(holiday?3500:2500):(holiday?4500:3500)
    const approved=Number(item.approvedNightlyLimit||0)
    limit+=item.specialApproved&&approved>0?Math.max(base,holiday?approved*1.2:approved):base
    d.setDate(d.getDate()+1)
  }
  return Math.round(limit)
}
export const taskHours=c=>{
  if(!c.taskStartAt||!c.taskEndAt)return 0
  const a=new Date(c.taskStartAt),b=new Date(c.taskEndAt)
  return Math.max(0,Math.floor(((b-a)/3600000)*4)/4)
}
export const foreignDailyUsd=(destination,settings={})=>Number((settings.foreignPerDiems||[]).find(x=>String(destination||'').includes(x.destination))?.dailyUsd||0)
export const tripAllowance=(c,settings={})=>{
  const hours=taskHours(c),employee=(settings.employees||[]).find(x=>x.name===c.employee)
  const hourly=Number(employee?.monthlySalary||0)/30/8
  if(!hourly||!hours)return {hours,amount:0,note:''}
  const d=new Date(c.taskStartAt),day=d.getDay();let amount=0,note=''
  if(day>=1&&day<=5){const payable=Math.max(0,hours-12);amount=hourly*payable*1.67;note='平日第 13 小時起'}
  else if(day===6){const h=Math.min(hours,12);amount=hourly*(Math.min(h,2)*1.34+Math.min(Math.max(h-2,0),6)*1.67+Math.min(Math.max(h-8,0),4)*2.67);note='休息日分段計算'}
  else {amount=hourly*(Math.min(Math.max(hours-8,0),2)*1.34+Math.min(Math.max(hours-10,0),2)*1.67);note='休假日 8 小時內另給一日薪資及一日補休'}
  return {hours,amount:Math.round(amount),note}
}
export const totals=(c,settings={mealBasis:'tripDays'})=>{
  const items=claimItemsFor(c)
  const reimbursable=items.filter(x=>x.personalAdvance!==false)
  const cappedAmount=x=>x.category==='住宿費'?Math.min(itemAmount(x),lodgingLimit(x,settings)||itemAmount(x)):itemAmount(x)
  const byGroup=group=>reimbursable.filter(x=>claimCategory(x.category).group===group).reduce((s,r)=>s+cappedAmount(r),0)
  const transport=byGroup('transport')+byGroup('vehicle')
  const lodging=byGroup('lodging')
  const meal=byGroup('meal')
  const other=byGroup('activity')+byGroup('other')
  const hasLodging=items.some(x=>x.category==='住宿費')
  const mealAllowance=hasLodging?tripDays(c.startDate,c.endDate)*300:0
  const allowance=tripAllowance(c,settings).amount
  const foreignPerDiem=c.tripMode==='國外出差'?Math.round(Number(c.foreignDailyUsd||0)*Number(c.usdRate||0)*tripDays(c.startDate,c.endDate)*0.3):0
  const employeePaid=transport+lodging+meal+other
  return {transport,lodging,meal,other,mealAllowance,allowance,foreignPerDiem,total:employeePaid+mealAllowance+allowance+foreignPerDiem,itemCount:items.length,companyPaid:items.filter(x=>x.personalAdvance===false).reduce((s,x)=>s+itemAmount(x),0)}
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
  while(count<7){d.setDate(d.getDate()+1);if(isWorkday(d,settings))count++}
  return d.toISOString().slice(0,10)
}
export const canEmployeeEdit=c=>['草稿','主管退回','會計退回'].includes(c?.status)
export const costFieldsRelevant=c=>!!(c.projectName||['客戶拜訪','設備維修／現場施工','展覽／活動','通路／業務開發'].includes(c.taskType))
