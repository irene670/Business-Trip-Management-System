import {claimItemsFor,itemAmount,lodgingLimit,totals,lunchAllowance,tripAllowance} from './rules.js'

export function reviewRows(c,settings={}) {
  const base=totals(c,settings)
  const adjustments=c.accounting?.allowanceAdjustments||{}
  const lunch=lunchAllowance(c,settings,adjustments)
  const overtime=tripAllowance(c,settings,adjustments)
  const rows=[
    ...claimItemsFor(c).filter(r=>r.personalAdvance!==false).map((r,i)=>({key:`claim:${r.id}`,label:`${i+1}｜${r.category} ${r.detail||''}`,claim:itemAmount(r),suggested:r.category==='住宿費'?Math.min(itemAmount(r),lodgingLimit(r,settings)||itemAmount(r)):itemAmount(r)})),
    {key:'meal-allowance',label:'膳雜費',claim:base.mealAllowance},
    {key:'lunch-allowance',label:'午休津貼',claim:base.lunchAllowance,suggested:lunch.amount},
    {key:'extra-allowance',label:'超過八小時出差津貼',claim:base.extraAllowance,suggested:lunch.extraAmount},
    {key:'trip-allowance',label:'超時津貼',claim:base.allowance,suggested:overtime.amount},
    {key:'foreign-per-diem',label:'國外日支三折',claim:base.foreignPerDiem},
    {key:'otpay',label:'核定加班費',claim:Number(c.accounting?.overtimePay||0)}
  ].filter(r=>r.key.startsWith('claim:')||r.claim>0||r.suggested>0)
  return rows.map(r=>{
    const a=c.accounting?.itemApprovals?.[r.key]||{}
    const amount=a.status==='不核准'?0:Number(a.amount??r.suggested??r.claim)
    const status=a.status==='不核准'?'不核准':amount<r.claim?'部分核准':(a.status||'核准')
    const adjustmentNote=['lunch-allowance','extra-allowance','trip-allowance'].includes(r.key)?Object.entries(adjustments).map(([date,v])=>v.note?`${date}：${v.note}`:'').filter(Boolean).join('；'):''
    return {...r,status,amount,note:a.note||adjustmentNote||((r.suggested!==undefined&&r.suggested<r.claim&&r.key.startsWith('claim:'))?'依住宿上限核定':'')}
  })
}
export const approvedTotal=(c,settings)=>reviewRows(c,settings).reduce((sum,r)=>sum+r.amount,0)
export function reviewErrors(c,settings={}) {
  const errors=[]
  if(!Number.isFinite(Number(c.accounting?.overtimePay||0))||Number(c.accounting?.overtimePay||0)<0)errors.push('核定加班費必須為零或正數')
  for(const r of reviewRows(c,settings)) {
    if(!['核准','部分核准','不核准'].includes(r.status))errors.push(`${r.label}：核定狀態不正確`)
    if(!Number.isFinite(r.amount)||r.amount<0)errors.push(`${r.label}：金額必須為零或正數`)
    if((r.status!=='核准'||r.amount<r.claim)&&!r.note.trim())errors.push(`${r.label}：請填寫核減或不核准原因`)
  }
  const original=lunchAllowance(c,settings).days
  for(const [date,a] of Object.entries(c.accounting?.allowanceAdjustments||{})) {
    const day=original.find(d=>d.date===date)
    if(!day){errors.push(`${date}：不在任務日期範圍內`);continue}
    for(const [field,max] of [['minutes',60],['extraMinutes',10],['taskHours',24]])if(a[field]!==undefined&&(!Number.isFinite(Number(a[field]))||Number(a[field])<0||Number(a[field])>max))errors.push(`${date}：${field} 超出可填範圍`)
    if(!String(a.note||'').trim())errors.push(`${date}：請填寫 104 工時核對調整原因`)
  }
  return errors
}
