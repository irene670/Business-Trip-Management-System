import test from 'node:test'
import assert from 'node:assert/strict'
import {buildPdfHtml} from './pdf.js'

const settings={employees:[{employeeId:'E001',name:'測試員工',monthlySalary:57600}]}
const baseCase={
  id:'TR-TEST',status:'會計退回',company:'測試公司',employee:'測試員工',employeeId:'E001',dept:'測試部',manager:'主管',
  tripMode:'國內出差',taskType:'客戶拜訪',startDate:'2026-09-01',endDate:'2026-09-01',
  taskStartAt:'2026-09-01T08:00',taskEndAt:'2026-09-01T17:00',destination:'台北',purpose:'拜訪客戶',
  claimItems:[{id:'claim-1',category:'高鐵票',date:'2026-09-01',detail:'台北至台中',amount:1500,personalAdvance:true}],
  attachments:[{id:'receipt-1',group:'receipt',claimItemId:'claim-1',category:'交通票券／訂票紀錄',name:'票據.jpg',mime:'image/jpeg',url:'/uploads/receipt.jpg'}],
  overtimeRows:[]
}

test('PDF 顯示原申報、核定狀態、核定金額及核減原因',()=>{
  const c={...baseCase,accounting:{itemApprovals:{'claim:claim-1':{status:'部分核准',amount:1200,note:'票面金額不符'}}}}
  const html=buildPdfHtml(c,settings)
  assert.match(html,/員工原申報/)
  assert.match(html,/部分核准/)
  assert.match(html,/NT\$ 1,200/)
  assert.match(html,/票面金額不符/)
  assert.match(html,/午休津貼/)
  assert.match(html,/超時津貼/)
})

test('PDF 內容會跳脫員工輸入，避免破壞列印版面',()=>{
  const html=buildPdfHtml({...baseCase,purpose:'<img src=x onerror=alert(1)>'},settings)
  assert.doesNotMatch(html,/<img src=x/)
  assert.match(html,/&lt;img src=x onerror=alert\(1\)&gt;/)
})
