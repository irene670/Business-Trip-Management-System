import test from 'node:test'
import assert from 'node:assert/strict'
import {claimItemsFor, requiredReceipts, totals, deadline, itemAmount, lodgingLimit, taskHours, tripAllowance} from './rules.js'

test('只合計員工新增的代墊核銷項目',()=>{
  const c={claimItems:[
    {id:'a',category:'高鐵票',amount:700},
    {id:'b',category:'住宿費',amount:2800},
    {id:'c',category:'門票',amount:300}
  ]}
  assert.deepEqual(totals(c),{transport:700,lodging:2800,meal:0,other:300,mealAllowance:0,allowance:0,foreignPerDiem:0,total:3800,itemCount:3,companyPaid:0})
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

test('任務區間以 15 分鐘為單位並計算平日第 13 小時後出差津貼',()=>{
  const c={employee:'測試員工',taskStartAt:'2026-09-07T08:00',taskEndAt:'2026-09-07T21:15'}
  assert.equal(taskHours(c),13.25)
  const out=tripAllowance(c,{employees:[{name:'測試員工',monthlySalary:72000}]})
  assert.equal(out.amount,626)
})

test('國外日支依 USD 標準乘匯率、天數與 3 折',()=>{
  const sum=totals({tripMode:'國外出差',startDate:'2026-09-01',endDate:'2026-09-07',foreignDailyUsd:299,usdRate:31.86,claimItems:[]})
  assert.equal(sum.foreignPerDiem,20005)
})

test('根據已新增的項目列出對應憑證',()=>{
  const c={claimItems:[
    {id:'a',category:'汽油費',amount:900},
    {id:'b',category:'火車票',amount:120},
    {id:'c',category:'火車票',amount:120}
  ]}
  assert.deepEqual(requiredReceipts(c),['加油／停車／過路費','交通票券／訂票紀錄'])
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
