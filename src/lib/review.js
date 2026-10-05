import {claimItemsFor,itemAmount,cappedItemAmount,totals,lunchAllowance,tripAllowance,taskDaySegments} from './rules.js'

export function reviewRows(c,settings={}) {
  const base=totals(c,settings)
  const adjustments=c.accounting?.allowanceAdjustments||{}
  const lunch=lunchAllowance(c,settings,adjustments)
  const overtime=tripAllowance(c,settings,adjustments)
  const rows=[
    ...claimItemsFor(c).filter(r=>r.personalAdvance!==false).map((r,i)=>({key:`claim:${r.id}`,label:`${i+1}｜${r.category} ${r.detail||''}`,claim:itemAmount(r),suggested:cappedItemAmount(r,settings,c)})),
    {key:'meal-allowance',label:'膳雜費',claim:base.mealAllowance},
    {key:'lunch-allowance',label:'午休津貼',claim:base.lunchAllowance,suggested:lunch.amount+lunch.extraAmount},
    {key:'trip-allowance',label:'超時津貼',claim:base.allowance,suggested:overtime.amount},
    {key:'foreign-per-diem',label:'國外日支三折',claim:base.foreignPerDiem},
    {key:'otpay',label:'核定加班費',claim:Number(c.accounting?.overtimePay||0)}
  ].filter(r=>r.key.startsWith('claim:')||r.claim>0||r.suggested>0)
  return rows.map(r=>{
    let a=c.accounting?.itemApprovals?.[r.key]||{}
    if(r.key==='lunch-allowance'&&!c.accounting?.lunchCombined){
      const extra=c.accounting?.itemApprovals?.['extra-allowance']||{}
      if(Object.keys(a).length||Object.keys(extra).length){
        const value=(approval,fallback)=>approval.status==='不核准'?0:Number(approval.amount??fallback)
        a={amount:value(a,lunch.amount)+value(extra,lunch.extraAmount),note:[a.note,extra.note].filter(Boolean).join('；'),status:a.status==='不核准'&&extra.status==='不核准'?'不核准':'核准'}
      }
    }
    const amount=a.status==='不核准'?0:Number(a.amount??r.suggested??r.claim)
    const status=a.status==='不核准'?'不核准':amount<r.claim?'部分核准':(a.status||'核准')
    const adjustmentNote=['lunch-allowance','extra-allowance','trip-allowance'].includes(r.key)?Object.entries(adjustments).map(([date,v])=>v.note?`${date}：${v.note}`:'').filter(Boolean).join('；'):''
    return {...r,status,amount,note:a.note||adjustmentNote||((r.suggested!==undefined&&r.suggested<r.claim&&r.key.startsWith('claim:'))?'依住宿上限核定':'')}
  })
}
export const approvedTotal=(c,settings)=>reviewRows(c,settings).reduce((sum,r)=>sum+r.amount,0)
export function editableReview(c,settings={}) {
  const review=structuredClone(c.accounting||{})
  if(!review.lunchCombined){
    const row=reviewRows(c,settings).find(r=>r.key==='lunch-allowance')
    if(row&&(review.itemApprovals?.['lunch-allowance']||review.itemApprovals?.['extra-allowance'])){
      review.itemApprovals={...review.itemApprovals,'lunch-allowance':{status:row.status,amount:row.amount,note:row.note}}
    }
  }
  if(review.itemApprovals)delete review.itemApprovals['extra-allowance']
  if(c.tripMode==='國外出差'){
    if(review.itemApprovals)delete review.itemApprovals['lunch-allowance']
    for(const a of Object.values(review.allowanceAdjustments||{})){delete a.minutes;delete a.extraMinutes}
  }
  review.lunchCombined=true
  return review
}
export function reviewErrors(c,settings={}) {
  const errors=[]
  if(!Number.isFinite(Number(c.accounting?.overtimePay||0))||Number(c.accounting?.overtimePay||0)<0)errors.push('核定加班費必須為零或正數')
  for(const r of reviewRows(c,settings)) {
    if(!['核准','部分核准','不核准'].includes(r.status))errors.push(`${r.label}：核定狀態不正確`)
    if(!Number.isFinite(r.amount)||r.amount<0)errors.push(`${r.label}：金額必須為零或正數`)
    if((r.status!=='核准'||r.amount<r.claim)&&!r.note.trim())errors.push(`${r.label}：請填寫核減或不核准原因`)
  }
  const original=taskDaySegments(c)
  for(const [date,a] of Object.entries(c.accounting?.allowanceAdjustments||{})) {
    const day=original.find(d=>d.date===date)
    if(!day){errors.push(`${date}：不在任務日期範圍內`);continue}
    if(c.tripMode==='國外出差'&&(Number(a.minutes||0)>0||Number(a.extraMinutes||0)>0))errors.push(`${date}：國外出差不發午休津貼`)
    for(const [field,max] of [['minutes',60],['extraMinutes',10],['taskHours',24]])if(a[field]!==undefined&&(!Number.isFinite(Number(a[field]))||Number(a[field])<0||Number(a[field])>max))errors.push(`${date}：${field} 超出可填範圍`)
    if(!String(a.note||'').trim())errors.push(`${date}：請填寫 104 工時核對調整原因`)
  }
  return errors
}
