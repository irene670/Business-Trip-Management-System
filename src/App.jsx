import React,{useEffect,useMemo,useState} from 'react'
import { api } from './api.js'
import CaseList from './components/CaseList.jsx'
import EmployeeEditor from './components/EmployeeEditor.jsx'
import ManagerReview from './components/ManagerReview.jsx'
import AccountingReview from './components/AccountingReview.jsx'
import Toast from './components/Toast.jsx'
import { generatePdf } from './lib/pdf.js'

export default function App(){
  const [cases,setCases]=useState([]),[settings,setSettings]=useState({holidays:[],workdays:[],mealBasis:'tripDays'})
  const [role,setRole]=useState('employee'),[selected,setSelected]=useState(null),[search,setSearch]=useState(''),[filter,setFilter]=useState('pending'),[toast,setToast]=useState(''),[rulesOpen,setRulesOpen]=useState(false)
  const selectedCase=useMemo(()=>cases.find(c=>c.id===selected)||null,[cases,selected])
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(''),2200)}
  const refresh=async(preferId=selected)=>{const st=await api.state();setCases(st.cases||[]);setSettings(st.settings||settings);if(preferId&&st.cases.some(c=>c.id===preferId))setSelected(preferId)}
  useEffect(()=>{refresh().catch(e=>showToast(e.message))},[])
  const replace=c=>{setCases(x=>x.map(v=>v.id===c.id?c:v));setSelected(c.id)}
  const create=async()=>{const c=await api.createCase();setCases(x=>[c,...x]);setSelected(c.id);setRole('employee')}
  const save=async c=>{const v=await api.updateCase(c.id,c);replace(v);showToast('已儲存');return v}
  const submit=async id=>{try{const v=await api.submit(id);replace(v);showToast('已送主管審核')}catch(e){showToast((e.details||[e.message]).join('、'))}}
  const upload=async(id,g,cat,files,claimItemId)=>{try{const v=await api.upload(id,g,cat,files,claimItemId);replace(v);showToast('票據照片已上傳')}catch(e){showToast(e.message)}}
  const delAtt=async id=>{if(!selectedCase)return;const v=await api.deleteAttachment(selectedCase.id,id);replace(v);showToast('附件已刪除')}
  const managerAction=async body=>{const v=await api.manager(selectedCase.id,body);replace(v);showToast(body.action==='approve'?'已核准送會計':'已退回員工')}
  const accountingAction=async body=>{const v=await api.accounting(selectedCase.id,body);replace(v);showToast(body.action==='approve'?'核銷完成':body.action==='returnManager'?'已退回主管':'已退回員工補件')}
  const seed=async()=>{const c=await api.demo();await refresh(c.id);showToast('已載入示範案件')}
  const clear=async()=>{await api.clearDemo();await refresh(null);setSelected(null);showToast('示範案件已清除')}
  const saveSettings=async next=>{const v=await api.settings(next);setSettings(v);showToast('公司規則已儲存')}
  const roleCases=role==='employee'?cases:role==='manager'?cases.filter(c=>['待主管審核','主管退回','待會計審核','核銷完成'].includes(c.status)):cases.filter(c=>['待會計審核','會計退回','核銷完成','待主管審核'].includes(c.status))
  return <>
    <header className="topbar"><div className="brand"><div className="logo">TR</div><div><h1>集團差旅事後報支系統</h1><small>員工代墊費用與票據核銷</small></div></div><div className="top-actions"><button className="btn hide-mobile" onClick={seed}>載入示範</button><button className="btn hide-mobile" onClick={clear}>清除示範</button><button className="btn primary" onClick={create}>＋ 新增報支</button></div></header>
    <div className="main"><aside className="sidebar"><div className="role-title">角色</div><div className="nav"><button className={role==='employee'?'active':''} onClick={()=>{setRole('employee');setFilter('all')}}>員工報支 <span className="count">{cases.length}</span></button><button className={role==='manager'?'active':''} onClick={()=>{setRole('manager');setFilter('pending')}}>主管審核 <span className="count">{cases.filter(c=>c.status==='待主管審核').length}</span></button><button className={role==='accounting'?'active':''} onClick={()=>{setRole('accounting');setFilter('pending')}}>會計行政 <span className="count">{cases.filter(c=>c.status==='待會計審核').length}</span></button></div><div className="side-note">純事後報支。只申報員工自行代墊的費用，並上傳對應票據照片；公司已付款或公司信用卡支付的項目不需申報。</div></aside>
      <main className="content"><div className="page-head"><div><h2>{role==='employee'?'員工事後報支':role==='manager'?'主管審核':'會計／行政核銷'}</h2><p>{role==='employee'?'活動結束後 3 個工作日內，填寫代墊項目並上傳票據照片。':role==='manager'?'檢視實際任務、代墊費用與票據，再核准或退回。':'逐筆核銷代墊費用、成本歸屬與加班費。'}</p></div>{role==='accounting'&&<button className="btn" onClick={()=>setRulesOpen(true)}>公司行事曆／規則</button>}</div>
        <div className="grid-layout"><div className="card list-card"><div className="list-head"><strong>{role==='employee'?'我的報支案件':role==='manager'?'主管案件':'會計案件'}</strong></div><div className="filterbar">{role!=='employee'&&<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="pending">待處理</option><option value="done">已處理</option><option value="all">全部</option></select>}<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜尋案件／員工／地點"/></div><div className="case-list"><CaseList cases={roleCases} selectedId={selected} onSelect={setSelected} search={search} filter={role==='employee'?'all':filter}/></div></div>
          <div className={`card detail ${selectedCase?'':'blank'}`}>{!selectedCase?'選擇案件，或建立新的事後報支。':role==='employee'?<EmployeeEditor caseData={selectedCase} settings={settings} onSave={save} onSubmit={submit} onUpload={upload} onDeleteAttachment={delAtt} onPdf={()=>generatePdf(selectedCase,settings)}/>:role==='manager'?<ManagerReview c={selectedCase} settings={settings} onAction={managerAction} onPdf={()=>generatePdf(selectedCase,settings)}/>:<AccountingReview c={selectedCase} settings={settings} onAction={accountingAction} onPdf={()=>generatePdf(selectedCase,settings)}/>}</div></div>
      </main></div>
    {rulesOpen&&<RulesModal settings={settings} onClose={()=>setRulesOpen(false)} onSave={saveSettings}/>}<Toast message={toast}/>
  </>
}

function RulesModal({settings,onClose,onSave}){
  const [s,setS]=useState(JSON.parse(JSON.stringify(settings)))
  const add=(key,v)=>{if(v&&!s[key].includes(v))setS(x=>({...x,[key]:[...x[key],v].sort()}))}
  const [holiday,setHoliday]=useState(''),[workday,setWorkday]=useState('')
  return <div className="modal show" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal-card"><div className="modal-head"><h3>公司行事曆／規則</h3><button className="btn" onClick={onClose}>關閉</button></div><div className="modal-body"><div className="calendar-panel"><h3>3 個工作日計算</h3><div className="grid g2"><div className="field"><label>額外休假日</label><div className="inline"><input type="date" value={holiday} onChange={e=>setHoliday(e.target.value)}/><button className="btn" onClick={()=>{add('holidays',holiday);setHoliday('')}}>加入</button></div><div className="pill-row">{s.holidays.map(d=><span className="pill" key={d}>{d}<button onClick={()=>setS(x=>({...x,holidays:x.holidays.filter(v=>v!==d)}))}>×</button></span>)}</div></div><div className="field"><label>週末補班／特殊工作日</label><div className="inline"><input type="date" value={workday} onChange={e=>setWorkday(e.target.value)}/><button className="btn" onClick={()=>{add('workdays',workday);setWorkday('')}}>加入</button></div><div className="pill-row">{s.workdays.map(d=><span className="pill" key={d}>{d}<button onClick={()=>setS(x=>({...x,workdays:x.workdays.filter(v=>v!==d)}))}>×</button></span>)}</div></div></div></div><div className="calendar-panel mt10"><h3>膳雜費 NT$300／日</h3><select value={s.mealBasis} onChange={e=>setS(x=>({...x,mealBasis:e.target.value}))}><option value="tripDays">符合過夜資格的出差日數</option><option value="nights">住宿晚數</option></select></div></div><div className="modal-foot"><button className="btn primary" onClick={()=>{onSave(s);onClose()}}>儲存規則</button></div></div></div>
}
