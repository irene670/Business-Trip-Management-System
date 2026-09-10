import React,{useEffect,useMemo,useState} from 'react'
import { api } from './api.js'
import CaseList from './components/CaseList.jsx'
import EmployeeEditor from './components/EmployeeEditor.jsx'
import AccountingReview from './components/AccountingReview.jsx'
import Toast from './components/Toast.jsx'
import { generatePdf } from './lib/pdf.js'

export default function App(){
  const [cases,setCases]=useState([]),[settings,setSettings]=useState({holidays:[],workdays:[],mealBasis:'tripDays'})
  const [user,setUser]=useState(null),[authReady,setAuthReady]=useState(false),[needsSetup,setNeedsSetup]=useState(false)
  const [role,setRole]=useState('employee'),[selected,setSelected]=useState(null),[search,setSearch]=useState(''),[filter,setFilter]=useState('pending'),[toast,setToast]=useState(''),[rulesOpen,setRulesOpen]=useState(false)
  const selectedCase=useMemo(()=>cases.find(c=>c.id===selected)||null,[cases,selected])
  const showToast=m=>{setToast(m);setTimeout(()=>setToast(''),2200)}
  const refresh=async(preferId=selected)=>{const st=await api.state();setCases(st.cases||[]);setSettings(st.settings||settings);if(preferId&&st.cases.some(c=>c.id===preferId))setSelected(preferId)}
  useEffect(()=>{Promise.all([api.authStatus(),api.me().catch(()=>null)]).then(([s,u])=>{setNeedsSetup(s.needsSetup);setUser(u);if(u)setRole(u.role==='accounting'?'accounting':'employee')}).finally(()=>setAuthReady(true))},[])
  useEffect(()=>{if(user)refresh().catch(e=>showToast(e.message))},[user])
  const replace=c=>{setCases(x=>x.map(v=>v.id===c.id?c:v));setSelected(c.id)}
  const create=async()=>{const c=await api.createCase();setCases(x=>[c,...x]);setSelected(c.id);setRole('employee')}
  const save=async c=>{const v=await api.updateCase(c.id,c);replace(v);showToast('已儲存');return v}
  const printAndSubmit=async c=>{try{const saved=await api.updateCase(c.id,c);const v=await api.submit(saved.id);replace(v);await generatePdf(v,settings);showToast('已列印並送會計／行政')}catch(e){showToast((e.details||[e.message]).join('、'));throw e}}
  const upload=async(id,g,cat,files,claimItemId)=>{try{const v=await api.upload(id,g,cat,files,claimItemId);replace(v);showToast('票據照片已上傳')}catch(e){showToast(e.message)}}
  const delAtt=async id=>{if(!selectedCase)return;const v=await api.deleteAttachment(selectedCase.id,id);replace(v);showToast('附件已刪除')}
  const accountingAction=async body=>{const v=await api.accounting(selectedCase.id,body);replace(v);showToast(body.action==='approve'?'核銷完成':body.action==='returnManager'?'已退回主管':'已退回員工補件')}
  const seed=async()=>{const c=await api.demo();await refresh(c.id);showToast('已載入示範案件')}
  const clear=async()=>{await api.clearDemo();await refresh(null);setSelected(null);showToast('示範案件已清除')}
  const saveSettings=async next=>{const v=await api.settings(next);setSettings(v);showToast('公司規則已儲存')}
  const roleCases=role==='employee'?cases:cases.filter(c=>['待會計審核','會計退回','核銷完成'].includes(c.status))
  if(!authReady)return <div className="login-shell">載入中…</div>
  if(!user)return <LoginScreen needsSetup={needsSetup} onDone={u=>{setUser(u);setNeedsSetup(false);setRole(u.role==='accounting'?'accounting':'employee')}}/>
  return <>
    <header className="topbar"><div className="brand"><div className="logo">TR</div><div><h1>集團差旅事後報支系統</h1><small>{user.name}｜{user.role==='accounting'?'會計／行政':'員工'}</small></div></div><div className="top-actions">{user.role==='accounting'&&<><button className="btn hide-mobile" onClick={seed}>載入示範</button><button className="btn hide-mobile" onClick={clear}>清除示範</button></>}{user.role==='employee'&&<button className="btn primary" onClick={create}>＋ 新增報支</button>}<button className="btn" onClick={async()=>{await api.logout();setUser(null);setCases([]);setSelected(null)}}>登出</button></div></header>
    <div className="main"><aside className="sidebar"><div className="role-title">登入身分</div><div className="nav"><button className="active">{role==='employee'?'員工報支':'會計行政'} <span className="count">{cases.length}</span></button></div><div className="side-note">所有差旅費用由出差人員填寫；勾選「個人代墊」才列入應付員工金額，未勾選視為公司掛帳。</div><div className="side-note test-note"><strong>測試版備註</strong><span>目前僅驗證報支流程；員工資料自動帶入、帳號與資料權限將於正式上線前另行確認。</span></div></aside>
      <main className="content"><div className="page-head"><div><h2>{role==='employee'?'員工事後報支':'會計／行政核銷'}</h2><p>{role==='employee'?'出差結束隔日起算 7 個工作日內完成填寫、上傳票據並列印紙本。':'核對紙本簽核、票據與系統金額後完成核銷。'}</p></div>{role==='accounting'&&<button className="btn" onClick={()=>setRulesOpen(true)}>公司行事曆／規則</button>}</div>
        <div className="grid-layout"><div className="card list-card"><div className="list-head"><strong>{role==='employee'?'我的報支案件':'會計案件'}</strong></div><div className="filterbar">{role!=='employee'&&<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="pending">待處理</option><option value="done">已處理</option><option value="all">全部</option></select>}<input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜尋案件／員工／地點"/></div><div className="case-list"><CaseList cases={roleCases} selectedId={selected} onSelect={setSelected} search={search} filter={role==='employee'?'all':filter}/></div></div>
          <div className={`card detail ${selectedCase?'':'blank'}`}>{!selectedCase?'選擇案件，或建立新的事後報支。':role==='employee'?<EmployeeEditor caseData={selectedCase} settings={settings} onSave={save} onUpload={upload} onDeleteAttachment={delAtt} onPdf={(c,submit)=>submit?printAndSubmit(c):generatePdf(c,settings)}/>:<AccountingReview c={selectedCase} settings={settings} onAction={accountingAction} onPdf={()=>generatePdf(selectedCase,settings)}/>}</div></div>
      </main></div>
    {rulesOpen&&<RulesModal settings={settings} onClose={()=>setRulesOpen(false)} onSave={saveSettings}/>}<Toast message={toast}/>
  </>
}

function LoginScreen({needsSetup,onDone}){
  const [username,setUsername]=useState(needsSetup?'accounting':''),[password,setPassword]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false)
  const submit=async e=>{e.preventDefault();setBusy(true);setError('');try{onDone(needsSetup?await api.setup({username,password}):await api.login({username,password}))}catch(err){setError(err.message)}finally{setBusy(false)}}
  return <div className="login-shell"><form className="login-card" onSubmit={submit}><div className="logo">TR</div><h1>{needsSetup?'首次設定會計管理員':'差旅報支登入'}</h1><p>{needsSetup?'請建立第一組會計／行政帳號；密碼至少 8 個字元。':'員工請使用員工編號與會計設定的密碼登入。'}</p><div className="field"><label>{needsSetup?'管理員帳號':'帳號／員工編號'}</label><input autoFocus required value={username} onChange={e=>setUsername(e.target.value)}/></div><div className="field"><label>密碼</label><input required minLength="8" type="password" value={password} onChange={e=>setPassword(e.target.value)}/></div>{error&&<div className="callout danger">{error}</div>}<button className="btn primary" disabled={busy}>{busy?'登入中…':needsSetup?'建立並登入':'登入'}</button></form></div>
}

function RulesModal({settings,onClose,onSave}){
  const [s,setS]=useState(()=>JSON.parse(JSON.stringify({...settings,employees:settings.employees||[],foreignPerDiems:settings.foreignPerDiems||[]})))
  const add=(key,v)=>{if(v&&!s[key].includes(v))setS(x=>({...x,[key]:[...x[key],v].sort()}))}
  const [holiday,setHoliday]=useState(''),[workday,setWorkday]=useState('')
  const setEmployee=(i,k,v)=>setS(x=>({...x,employees:x.employees.map((p,n)=>n===i?{...p,[k]:v}:p)}))
  const addEmployee=()=>setS(x=>({...x,employees:[...x.employees,{name:'',employeeId:'',dept:'',manager:'',monthlySalary:0}]}))
  const setPerDiem=(i,k,v)=>setS(x=>({...x,foreignPerDiems:x.foreignPerDiems.map((p,n)=>n===i?{...p,[k]:v}:p)}))
  return <div className="modal show" onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal-card"><div className="modal-head"><h3>公司行事曆／規則</h3><button className="btn" onClick={onClose}>關閉</button></div><div className="modal-body">
    <div className="calendar-panel"><h3>7 個工作日計算</h3><div className="grid g2"><div className="field"><label>額外休假日</label><div className="inline"><input type="date" value={holiday} onChange={e=>setHoliday(e.target.value)}/><button className="btn" onClick={()=>{add('holidays',holiday);setHoliday('')}}>加入</button></div><div className="pill-row">{s.holidays.map(d=><span className="pill" key={d}>{d}<button onClick={()=>setS(x=>({...x,holidays:x.holidays.filter(v=>v!==d)}))}>×</button></span>)}</div></div><div className="field"><label>週末補班／特殊工作日</label><div className="inline"><input type="date" value={workday} onChange={e=>setWorkday(e.target.value)}/><button className="btn" onClick={()=>{add('workdays',workday);setWorkday('')}}>加入</button></div><div className="pill-row">{s.workdays.map(d=><span className="pill" key={d}>{d}<button onClick={()=>setS(x=>({...x,workdays:x.workdays.filter(v=>v!==d)}))}>×</button></span>)}</div></div></div></div>
    <div className="calendar-panel mt10"><h3>膳雜費 NT$300／日</h3><p className="helper">有住宿費時，依出差起訖日數自動計算。</p></div>
    <div className="calendar-panel mt10"><div className="section-head compact"><div><h3>出差人員資料（會計端）</h3><p>姓名相符時，自動帶入員工編號、部門與主管；總薪只供出差津貼計算。輸入新密碼才會建立或更新登入密碼。</p></div><button className="btn" type="button" onClick={addEmployee}>＋ 新增人員</button></div><div className="employee-admin-list">{s.employees.map((p,i)=><div className="employee-admin-row" key={i}><input aria-label={`第 ${i+1} 位姓名`} placeholder="姓名" value={p.name} onChange={e=>setEmployee(i,'name',e.target.value)}/><input aria-label={`第 ${i+1} 位員工編號`} placeholder="員工編號／帳號" value={p.employeeId} onChange={e=>setEmployee(i,'employeeId',e.target.value)}/><input aria-label={`第 ${i+1} 位部門`} placeholder="部門" value={p.dept} onChange={e=>setEmployee(i,'dept',e.target.value)}/><input aria-label={`第 ${i+1} 位主管`} placeholder="主管" value={p.manager} onChange={e=>setEmployee(i,'manager',e.target.value)}/><input aria-label={`第 ${i+1} 位月總薪`} type="number" min="0" placeholder="月總薪" value={p.monthlySalary||''} onChange={e=>setEmployee(i,'monthlySalary',Number(e.target.value||0))}/><input aria-label={`第 ${i+1} 位新登入密碼`} type="password" minLength="8" placeholder="新登入密碼" value={p.loginPassword||''} onChange={e=>setEmployee(i,'loginPassword',e.target.value)}/><button className="btn danger" type="button" onClick={()=>setS(x=>({...x,employees:x.employees.filter((_,n)=>n!==i)}))}>移除</button></div>)}</div></div>
    <div className="calendar-panel mt10"><div className="section-head compact"><div><h3>國外日支數額表</h3><p>依目的地關鍵字自動帶入 USD／日標準。</p></div><button className="btn" type="button" onClick={()=>setS(x=>({...x,foreignPerDiems:[...x.foreignPerDiems,{destination:'',dailyUsd:0}]}))}>＋ 新增目的地</button></div><div className="employee-admin-list">{s.foreignPerDiems.map((p,i)=><div className="per-diem-row" key={i}><input aria-label={`第 ${i+1} 個目的地`} placeholder="例如：日本－東京" value={p.destination} onChange={e=>setPerDiem(i,'destination',e.target.value)}/><input aria-label={`第 ${i+1} 個日支標準`} type="number" min="0" placeholder="USD／日" value={p.dailyUsd||''} onChange={e=>setPerDiem(i,'dailyUsd',Number(e.target.value||0))}/><button className="btn danger" onClick={()=>setS(x=>({...x,foreignPerDiems:x.foreignPerDiems.filter((_,n)=>n!==i)}))}>移除</button></div>)}</div></div>
  </div><div className="modal-foot"><button className="btn primary" onClick={()=>{onSave(s);onClose()}}>儲存規則</button></div></div></div>
}
