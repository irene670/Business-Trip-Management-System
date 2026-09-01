import test from 'node:test'
import assert from 'node:assert/strict'
import {claimItemsFor, requiredReceipts, totals} from './rules.js'

test('只合計員工新增的代墊核銷項目',()=>{
  const c={claimItems:[
    {id:'a',category:'高鐵票',amount:700},
    {id:'b',category:'住宿費',amount:2800},
    {id:'c',category:'門票',amount:300}
  ]}
  assert.deepEqual(totals(c),{transport:700,lodging:2800,meal:0,other:300,total:3800,itemCount:3})
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
