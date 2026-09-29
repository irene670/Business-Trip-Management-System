import test from 'node:test'
import assert from 'node:assert/strict'
import {claimItemsFor, requiredReceipts, missingReceiptItems, totals, deadline, itemAmount, lodgingLimit, lodgingNightlyLimits, taskDaySegments, taskHours, tripAllowance, lunchAllowance, isNationalHoliday, CALENDAR_COVERAGE} from './rules.js'

test('只合計員工新增的代墊核銷項目',()=>{
  const c={claimItems:[
    {id:'a',category:'高鐵票',amount:700},
    {id:'b',category:'住宿費',amount:2800},
    {id:'c',category:'門票',amount:300}
  ]}
  assert.deepEqual(totals(c),{transport:700,lodging:2800,meal:0,other:300,mealAllowance:0,allowance:0,lunchAllowance:0,extraAllowance:0,foreignPerDiem:0,total:3800,itemCount:3,companyPaid:0})
})

test('申請期限為出差結束隔日起 7 個工作日',()=>{
  assert.equal(deadline('2026-09-04',{holidays:[],workdays:[]}), '2026-09-15')
})

test('自用汽機車依里程自動計算且公司掛帳不列入員工應付',()=>{
  assert.equal(itemAmount({category:'自用車／汽車',km:12.5}),75)
  assert.equal(itemAmount({category:'自用車／機車',km:12.5}),37.5)
  const sum=totals({claimItems:[{category:'自用車／汽車',km:10,personalAdvance:true},{category:'高鐵票',amount:700,personalAdvance:false}]})
  assert.equal(sum.transport,60)
  assert.equal(sum.companyPaid,700)
  assert.equal(sum.total,60)
})

test('住宿依地區與平假日上限核銷並自動計算膳雜費',()=>{
  const item={category:'住宿費',checkIn:'2026-09-04',checkOut:'2026-09-06',region:'metro',amount:10000,personalAdvance:true}
  assert.equal(lodgingLimit(item,{holidays:[]}),8000)
  const sum=totals({startDate:'2026-09-04',endDate:'2026-09-06',claimItems:[item]},{holidays:[]})
  assert.equal(sum.lodging,8000)
  assert.equal(sum.mealAllowance,900)
  assert.equal(sum.total,8900)
})

test('國定假日住宿使用專屬上限，專案加成不重複累加',()=>{
  assert.deepEqual(CALENDAR_COVERAGE,{from:'2026-01-01',to:'2027-12-31'})
  assert.equal(isNationalHoliday('2026-10-09'),true)
  const item={category:'住宿費',checkIn:'2026-10-09',checkOut:'2026-10-11',region:'metro',specialApproved:true,amount:20000}
  const nights=lodgingNightlyLimits(item)
  assert.deepEqual(nights,[
    {date:'2026-10-09',dayType:'nationalHoliday',limit:5400},
    {date:'2026-10-10',dayType:'nationalHoliday',limit:5400}
  ])
  assert.equal(lodgingLimit(item),10800)
})

test('專案住宿一般平假日提高 20%',()=>{
  const item={category:'住宿費',checkIn:'2026-09-04',checkOut:'2026-09-06',region:'other',specialApproved:true}
  assert.deepEqual(lodgingNightlyLimits(item,{holidays:[],workdays:[]}),[
    {date:'2026-09-04',dayType:'weekday',limit:3000},
    {date:'2026-09-05',dayType:'holiday',limit:4200}
  ])
})

test('任務區間以 15 分鐘為單位並計算平日第 13 小時後出差津貼',()=>{
  const c={employee:'測試員工',taskStartAt:'2026-09-07T08:00',taskEndAt:'2026-09-07T21:15'}
  assert.equal(taskHours(c),13.25)
  const out=tripAllowance(c,{employees:[{name:'測試員工',monthlySalary:72000}]})
  assert.equal(out.amount,626)
})

test('跨日任務逐日採首末日實際時間與中間日 08:00–17:00',()=>{
  const c={taskStartAt:'2026-09-01T09:30',taskEndAt:'2026-09-03T16:30',taskDays:[{date:'2026-09-02',start:'07:30',end:'18:00'}]}
  assert.deepEqual(taskDaySegments(c).map(({date,start,end,hours})=>({date,start,end,hours})),[
    {date:'2026-09-01',start:'09:30',end:'17:00',hours:7.5},
    {date:'2026-09-02',start:'07:30',end:'18:00',hours:10.5},
    {date:'2026-09-03',start:'08:00',end:'16:30',hours:8.5}
  ])
  assert.equal(taskHours(c),26.5)
})

test('午休津貼依實際重疊分鐘，超過 8 小時另計 10 分鐘',()=>{
  const settings={employees:[{employeeId:'E001',name:'測試員工',monthlySalary:24000}]}
  const partial=lunchAllowance({employeeId:'E001',taskStartAt:'2026-09-07T13:00',taskEndAt:'2026-09-07T17:00'},settings)
  assert.equal(partial.minutes,30)
  assert.equal(partial.extraMinutes,0)
  assert.equal(partial.amount,50)
  const exact=lunchAllowance({employeeId:'E001',taskStartAt:'2026-09-08T08:00',taskEndAt:'2026-09-08T16:00'},settings)
  assert.equal(exact.minutes,60)
  assert.equal(exact.extraMinutes,0)
  const over=lunchAllowance({employeeId:'E001',taskStartAt:'2026-09-09T08:00',taskEndAt:'2026-09-09T16:30'},settings)
  assert.equal(over.extraMinutes,10)
  assert.equal(over.extraAmount,17)
})

test('週末與國定假日午休津貼皆採 1.34 倍',()=>{
  const settings={employees:[{name:'測試員工',monthlySalary:24000}]}
  const saturday=lunchAllowance({employee:'測試員工',taskStartAt:'2026-09-05T08:00',taskEndAt:'2026-09-05T17:00'},settings)
  const national=lunchAllowance({employee:'測試員工',taskStartAt:'2026-10-09T08:00',taskEndAt:'2026-10-09T17:00'},settings)
  assert.equal(saturday.days[0].multiplier,1.34)
  assert.equal(saturday.amount,134)
  assert.equal(national.days[0].multiplier,1.34)
})

test('會計可逐日調整分鐘與工時且保留系統計算值',()=>{
  const c={employeeId:'E001',taskStartAt:'2026-09-07T08:00',taskEndAt:'2026-09-07T17:00'}
  const settings={employees:[{employeeId:'E001',monthlySalary:24000}]}
  const adjustments={'2026-09-07':{minutes:45,extraMinutes:0,taskHours:8,note:'依打卡紀錄'}}
  const lunch=lunchAllowance(c,settings,adjustments)
  assert.equal(lunch.days[0].systemMinutes,60)
  assert.equal(lunch.days[0].systemExtraMinutes,10)
  assert.equal(lunch.minutes,45)
  assert.equal(lunch.extraMinutes,0)
  assert.equal(taskDaySegments(c,adjustments)[0].systemHours,9)
  assert.equal(taskDaySegments(c,adjustments)[0].hours,8)
  const trip=tripAllowance(c,settings,adjustments)
  assert.equal(trip.days[0].systemHours,9)
  assert.equal(trip.days[0].hours,8)
  assert.equal(trip.systemHours,9)
  assert.equal(trip.hours,8)
})

test('國外日支依 USD 標準乘匯率、天數與 3 折',()=>{
  const sum=totals({tripMode:'國外出差',startDate:'2026-09-01',endDate:'2026-09-07',foreignDailyUsd:299,usdRate:31.86,claimItems:[{category:'住宿費',checkIn:'2026-09-01',checkOut:'2026-09-02',amount:2000}]})
  assert.equal(sum.foreignPerDiem,20005)
  assert.equal(sum.mealAllowance,0)
})

test('根據已新增的項目列出對應憑證',()=>{
  const c={claimItems:[
    {id:'a',category:'汽油費',amount:900},
    {id:'b',category:'火車票',amount:120},
    {id:'c',category:'火車票',amount:120}
  ]}
  assert.deepEqual(requiredReceipts(c),['加油／停車／過路費','交通票券／訂票紀錄'])
})

test('逐筆找出票據照片缺漏',()=>{
  const c={claimItems:[{id:'a',category:'汽油費'},{id:'b',category:'火車票'}],attachments:[{group:'receipt',mime:'image/jpeg',claimItemId:'a'}]}
  assert.deepEqual(missingReceiptItems(c).map(x=>x.id),['b'])
})

test('舊案件的交通和住宿資料會轉成新核銷項目',()=>{
  const legacy={
    transports:[{id:'t1',type:'高鐵／台鐵',date:'2026-08-01',detail:'台北到台中',amount:700}],
    lodgings:[{id:'l1',checkIn:'2026-08-01',checkOut:'2026-08-02',name:'測試飯店',amount:2400}]
  }
  const items=claimItemsFor(legacy)
  assert.equal(items.length,2)
  assert.equal(items[0].category,'高鐵票')
  assert.equal(items[1].category,'住宿費')
  assert.equal(totals(legacy).total,3100)
})
