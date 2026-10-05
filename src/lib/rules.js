import {CALENDAR_COVERAGE, dateKey, isOfficialNationalHoliday} from './calendar.js'

export {CALENDAR_COVERAGE}
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
const hasOverride=(values,key)=>(values||[]).includes(key)
export const isNationalHoliday=(value,settings={})=>{
  const key=dateKey(value)
  if(hasOverride(settings.workdays,key))return false
  return hasOverride(settings.holidays,key)||isOfficialNationalHoliday(key)
}
const isHolidayDate=(d,settings)=>d.getDay()===0||d.getDay()===6||isNationalHoliday(d,settings)
export const lodgingNightlyLimits=(item,settings={},c={})=>{
  const start=item.checkIn||item.date,end=item.checkOut
  if(!start||!end)return []
  let d=new Date(start+'T12:00:00'),last=new Date(end+'T12:00:00'),result=[]
  while(d<last){
    const national=isNationalHoliday(d,settings)
    const weekend=d.getDay()===0||d.getDay()===6
    const dayType=national?'nationalHoliday':weekend?'holiday':'weekday'
    const metro=item.region!=='other'
    const base=national?(metro?5400:4200):(weekend?(metro?4500:3500):(metro?3500:2500))
    const foreign=item.region==='foreign'||c.tripMode==='國外出差'
    const limit=foreign?Number(c.foreignDailyUsd||0)*Number(c.usdRate||0)*(national||weekend?0.7:0.4):national?base:(item.specialApproved?base*1.2:base)
    result.push({date:dateKey(d),dayType,limit:Math.round(limit)})
    d.setDate(d.getDate()+1)
  }
  return result
}
export const lodgingLimit=(item,settings={},c={})=>{
  return lodgingNightlyLimits(item,settings,c).reduce((sum,night)=>sum+night.limit,0)
}
export const cappedItemAmount=(item,settings={},c={})=>item.category!=='住宿費'?itemAmount(item):Math.min(itemAmount(item),(item.region==='foreign'||c.tripMode==='國外出差')?lodgingLimit(item,settings,c):(lodgingLimit(item,settings,c)||itemAmount(item)))
const atTime=(date,hour,minute=0)=>new Date(date.getFullYear(),date.getMonth(),date.getDate(),hour,minute,0,0)
const timeText=date=>`${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`
const withClock=(date,text,fallback)=>{
  if(!/^\d{2}:\d{2}$/.test(text||''))return fallback
  const [hour,minute]=text.split(':').map(Number)
  return atTime(date,hour,minute)
}
export const taskDaySegments=(c,adjustments={})=>{
  if(!c.taskStartAt||!c.taskEndAt)return []
  const start=new Date(c.taskStartAt),end=new Date(c.taskEndAt)
  if(Number.isNaN(start.getTime())||Number.isNaN(end.getTime())||end<=start)return []
  const cursor=atTime(start,12),last=atTime(end,12),segments=[]
  while(cursor<=last){
    const key=dateKey(cursor),override=(c.taskDays||[]).find(day=>day.date===key)
    const same=dateKey(cursor)===dateKey(start)&&dateKey(cursor)===dateKey(end)
    let from=same?start:(dateKey(cursor)===dateKey(start)?start:atTime(cursor,8))
    let to=same?end:(dateKey(cursor)===dateKey(end)?end:atTime(cursor,17))
    from=withClock(cursor,override?.start,from)
    to=withClock(cursor,override?.end,to)
    {
      const actualHours=Math.max(0,(to-from)/3600000)
      const systemHours=Math.floor(actualHours*4)/4
      const adjusted=Number(adjustments?.[key]?.taskHours)
      segments.push({date:key,start:timeText(from),end:timeText(to),from,to,actualHours,systemHours,hours:Number.isFinite(adjusted)&&adjusted>=0?adjusted:systemHours})
    }
    cursor.setDate(cursor.getDate()+1)
  }
  return segments
}
export const taskHours=(c,adjustments={})=>Math.round(taskDaySegments(c,adjustments).reduce((sum,segment)=>sum+segment.hours,0)*100)/100
export const foreignDailyUsd=(destination,settings={})=>Number((settings.foreignPerDiems||[]).find(x=>x.destination&&x.destination===destination)?.dailyUsd||0)
export const overtimeReminderDays=c=>taskDaySegments(c).map(({date,hours})=>({date,hours,hr104Hours:Math.min(4,Math.max(0,hours-8)),extraHours:Math.max(0,hours-12)}))
const employeeFor=(c,settings={})=>(settings.employees||[]).find(x=>(c.employeeId&&x.employeeId===c.employeeId)||x.name===c.employee)
const employeeHourly=(c,settings={})=>Number(employeeFor(c,settings)?.monthlySalary||0)/30/8
const holidayMultiplier=(date,settings)=>isHolidayDate(date,settings)?1.34:1
export const lunchAllowance=(c,settings={},adjustments={})=>{
  if(c.tripMode==='國外出差')return {days:[],minutes:0,extraMinutes:0,amount:0,extraAmount:0,hourly:employeeHourly(c,settings)}
  const hourly=employeeHourly(c,settings),days=taskDaySegments(c,adjustments).map(segment=>{
    const d=new Date(segment.date+'T12:00:00')
    const lunchStart=atTime(d,12,30),lunchEnd=atTime(d,13,30)
    const systemMinutes=Math.max(0,Math.round((Math.min(segment.to,lunchEnd)-Math.max(segment.from,lunchStart))/60000))
    const systemExtraMinutes=segment.actualHours>8?10:0
    const minuteOverride=Number(adjustments?.[segment.date]?.minutes),extraOverride=Number(adjustments?.[segment.date]?.extraMinutes)
    const minutes=Number.isFinite(minuteOverride)&&minuteOverride>=0?minuteOverride:systemMinutes
    const extraMinutes=Number.isFinite(extraOverride)&&extraOverride>=0?extraOverride:systemExtraMinutes
    const multiplier=holidayMultiplier(d,settings)
    return {date:segment.date,hours:segment.hours,systemHours:segment.systemHours,systemMinutes,systemExtraMinutes,minutes,extraMinutes,multiplier,amount:Math.round(hourly*(minutes/60)*multiplier),extraAmount:Math.round(hourly*(extraMinutes/60)*multiplier)}
  })
  return {
    days,
    minutes:days.reduce((sum,day)=>sum+day.minutes,0),
    extraMinutes:days.reduce((sum,day)=>sum+day.extraMinutes,0),
    amount:days.reduce((sum,day)=>sum+day.amount,0),
    extraAmount:days.reduce((sum,day)=>sum+day.extraAmount,0),
    hourly
  }
}
export const tripAllowance=(c,settings={},adjustments={})=>{
  const segments=taskDaySegments(c,adjustments),hours=taskHours(c,adjustments),hourly=employeeHourly(c,settings)
  if(!hourly||!hours)return {hours,systemHours:taskHours(c),amount:0,systemAmount:0,note:'',days:[]}
  const calculateDay=(workHours,d)=>{
    const day=d.getDay(),h=Math.min(workHours,12)
    if(isNationalHoliday(d,settings)||day===0)return {amount:hourly*(Math.min(Math.max(h-8,0),2)*1.34+Math.min(Math.max(h-10,0),2)*1.67),note:'休假日分段計算'}
    if(day===6)return {amount:hourly*(Math.min(h,2)*1.34+Math.min(Math.max(h-2,0),6)*1.67+Math.min(Math.max(h-8,0),4)*2.67),note:'休息日分段計算'}
    return {amount:hourly*Math.max(0,workHours-12)*1.67,note:workHours>12?'平日第 13 小時起':''}
  }
  const days=segments.map(segment=>{
    const d=new Date(segment.date+'T12:00:00'),system=calculateDay(segment.systemHours,d),adjusted=calculateDay(segment.hours,d)
    return {date:segment.date,systemHours:segment.systemHours,hours:segment.hours,systemAmount:Math.round(system.amount),amount:Math.round(adjusted.amount),note:adjusted.note}
  })
  return {
    hours,
    systemHours:Math.round(segments.reduce((sum,segment)=>sum+segment.systemHours,0)*100)/100,
    amount:days.reduce((sum,day)=>sum+day.amount,0),
    systemAmount:days.reduce((sum,day)=>sum+day.systemAmount,0),
    note:[...new Set(days.map(day=>day.note).filter(Boolean))].join('、'),
    days
  }
}
export const totals=(c,settings={mealBasis:'tripDays'})=>{
  const items=claimItemsFor(c)
  const reimbursable=items.filter(x=>x.personalAdvance!==false)
  const cappedAmount=x=>cappedItemAmount(x,settings,c)
  const byGroup=group=>reimbursable.filter(x=>claimCategory(x.category).group===group).reduce((s,r)=>s+cappedAmount(r),0)
  const transport=byGroup('transport')+byGroup('vehicle')
  const lodging=byGroup('lodging')
  const meal=byGroup('meal')
  const other=byGroup('activity')+byGroup('other')
  const hasLodging=items.some(x=>x.category==='住宿費')
  const mealAllowance=hasLodging&&c.tripMode!=='國外出差'?tripDays(c.startDate,c.endDate)*300:0
  const allowance=tripAllowance(c,settings).amount
  const lunch=lunchAllowance(c,settings)
  const lunchAllowanceAmount=lunch.amount+lunch.extraAmount
  const extraAllowance=0
  const foreignPerDiem=c.tripMode==='國外出差'?Math.round(Number(c.foreignDailyUsd||0)*Number(c.usdRate||0)*tripDays(c.startDate,c.endDate)*0.3):0
  const employeePaid=transport+lodging+meal+other
  return {transport,lodging,meal,other,mealAllowance,allowance,lunchAllowance:lunchAllowanceAmount,extraAllowance,foreignPerDiem,total:employeePaid+mealAllowance+allowance+lunchAllowanceAmount+extraAllowance+foreignPerDiem,itemCount:items.length,companyPaid:items.filter(x=>x.personalAdvance===false).reduce((s,x)=>s+itemAmount(x),0)}
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
export const missingReceiptItems=c=>claimItemsFor(c).filter(item=>!(c.attachments||[]).some(a=>a.group==='receipt'&&a.mime?.startsWith('image/')&&(a.claimItemId===item.id||(!a.claimItemId&&a.category===claimCategory(item.category).receipt))))
export const isWorkday=(date,settings)=>{
  const key=dateKey(date)
  if((settings.workdays||[]).includes(key))return true
  if(isNationalHoliday(date,settings))return false
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
