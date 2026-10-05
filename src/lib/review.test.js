import test from 'node:test'
import assert from 'node:assert/strict'
import {reviewRows,reviewErrors,approvedTotal} from './review.js'
import {totals,lunchAllowance,deadline,taskDaySegments} from './rules.js'
const settings={employees:[{employeeId:'TEST',monthlySalary:24000}],holidays:[],workdays:[]}
const base={employeeId:'TEST',taskStartAt:'2026-09-07T08:00',taskEndAt:'2026-09-07T17:00',claimItems:[{id:'a',category:'火車票',amount:100}]}
test('不核准強制零元且必填原因，包括津貼',()=>{
  const c={...base,accounting:{itemApprovals:{'claim:a':{status:'不核准',amount:100},'lunch-allowance':{status:'不核准',amount:100}}}}
  assert.equal(reviewRows(c,settings)[0].amount,0)
  assert.equal(reviewErrors(c,settings).length,2)
  c.accounting.itemApprovals['claim:a'].note='票據無效'
  c.accounting.itemApprovals['lunch-allowance'].note='未執行任務'
  assert.deepEqual(reviewErrors(c,settings),[])
  assert.equal(approvedTotal(c,settings),17)
})
test('104 核定調整不改變原申報數字',()=>{
  const c={...base,accounting:{allowanceAdjustments:{'2026-09-07':{minutes:30,extraMinutes:0,taskHours:8,note:'依104紀錄'}}}}
  assert.equal(totals(c,settings).lunchAllowance,117)
  const row=reviewRows(c,settings).find(r=>r.key==='lunch-allowance')
  assert.equal(row.claim,117)
  assert.equal(row.amount,50)
  assert.match(row.note,/104/)
  assert.equal(approvedTotal(c,settings),150)
  assert.deepEqual(reviewErrors(c,settings),[])
})
test('末日12點結束無午休；超過8小時1分鐘仍有額外10分鐘',()=>{
  assert.equal(lunchAllowance({...base,taskEndAt:'2026-09-07T12:00'},settings).minutes,0)
  assert.equal(lunchAllowance({...base,taskEndAt:'2026-09-07T16:01'},settings).extraMinutes,10)
  assert.equal(lunchAllowance({...base,taskStartAt:'2026-09-07T13:30:01'},settings).minutes,0)
})
test('跨國定假日與公司補班的7工作日期限',()=>{
  assert.equal(deadline('2026-09-24',settings),'2026-10-07')
  assert.equal(deadline('2026-09-24',{...settings,workdays:['2026-09-25']}),'2026-10-06')
})
test('無效每日時段保留以便使用者修正',()=>{
  const days=taskDaySegments({...base,taskDays:[{date:'2026-09-07',start:'18:00',end:'17:00'}]})
  assert.equal(days.length,1)
  assert.equal(days[0].hours,0)
})
