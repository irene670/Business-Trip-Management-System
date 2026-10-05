import test from 'node:test'
import assert from 'node:assert/strict'
import {totals,lunchAllowance,lodgingNightlyLimits,foreignDailyUsd,overtimeReminderDays} from './rules.js'
import {reviewRows,approvedTotal,editableReview} from './review.js'
import {buildPdfHtml} from './pdf.js'
const settings={employees:[{employeeId:'TEST',monthlySalary:24000}],foreignPerDiems:[{destination:'日本－東京',dailyUsd:200},{destination:'日本－大阪',dailyUsd:180}]}
const c={employeeId:'TEST',tripMode:'國外出差',foreignDailyUsd:200,usdRate:32,startDate:'2026-10-05',endDate:'2026-10-05',taskStartAt:'2026-10-05T08:00',taskEndAt:'2026-10-05T22:00',claimItems:[]}
test('國外日支精確比對，無匹配不沿用舊值',()=>{
  assert.equal(foreignDailyUsd('日本－東京',settings),200)
  assert.equal(foreignDailyUsd('日本',settings),0)
  assert.equal(foreignDailyUsd('',settings),0)
})
test('國外排除午休及10分鐘，包含舊核定調整；日支和超時保留',()=>{
  const foreign={...c,accounting:{allowanceAdjustments:{'2026-10-05':{minutes:60,extraMinutes:10,note:'舊值'}}}}
  assert.equal(lunchAllowance(foreign,settings,foreign.accounting.allowanceAdjustments).amount,0)
  assert.equal(totals(foreign,settings).lunchAllowance,0)
  assert.equal(totals(foreign,settings).extraAllowance,0)
  assert.equal(totals(foreign,settings).allowance,334)
  assert.equal(totals(foreign,settings).foreignPerDiem,1920)
  assert.ok(!reviewRows(foreign,settings).some(r=>r.key==='lunch-allowance'))
})
test('國外住宿逐晚40%與70%，不疊加國內專案額度',()=>{
  const item={id:'hotel',category:'住宿費',region:'foreign',checkIn:'2026-10-08',checkOut:'2026-10-11',amount:20000,specialApproved:true}
  assert.deepEqual(lodgingNightlyLimits(item,settings,c).map(n=>n.limit),[2560,4480,4480])
  const claim={...c,claimItems:[item]}
  assert.equal(totals(claim,settings).lodging,11520)
  assert.equal(reviewRows(claim,settings)[0].amount,11520)
  assert.equal(totals({...claim,usdRate:0},settings).lodging,0)
  assert.equal(totals({...claim,claimItems:[{...item,personalAdvance:false}]},settings).lodging,0)
  assert.equal(totals({...claim,claimItems:[{...item,personalAdvance:false}]},settings).companyPaid,20000)
})
test('14小時提醒104四小時及額外兩小時，逐日獨立',()=>{
  assert.deepEqual(overtimeReminderDays(c),[{date:'2026-10-05',hours:14,hr104Hours:4,extraHours:2}])
  assert.deepEqual(overtimeReminderDays({...c,taskEndAt:'2026-10-05T20:00'})[0],{date:'2026-10-05',hours:12,hr104Hours:4,extraHours:0})
})
test('國內午休合併為單一金額，不重複加總且保留舊核定',()=>{
  const domestic={...c,tripMode:'國內出差',taskEndAt:'2026-10-05T17:00'}
  assert.equal(totals(domestic,settings).lunchAllowance,117)
  const old={...domestic,accounting:{itemApprovals:{'lunch-allowance':{amount:80,note:'午休核減'},'extra-allowance':{amount:0,status:'不核准',note:'加給不符'}}}}
  const row=reviewRows(old,settings).find(r=>r.key==='lunch-allowance')
  assert.equal(row.amount,80)
  assert.equal(row.claim,117)
  assert.match(row.note,/加給不符/)
  assert.equal(approvedTotal(old,settings),approvedTotal({...old,accounting:editableReview(old,settings)},settings))
  const html=buildPdfHtml(domestic,settings)
  assert.doesNotMatch(html,/逾 8 小時加給 10 分鐘：/)
  assert.match(html,/午休津貼：NT\$ 117/)
  assert.match(buildPdfHtml(c,settings),/104 需送 4 小時加班單；另有 2 小時/)
})
