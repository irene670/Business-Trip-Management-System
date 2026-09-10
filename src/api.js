const json = async (url, options={}) => {
  const res = await fetch(url, { credentials:'include', headers:{'Content-Type':'application/json', ...(options.headers||{})}, ...options })
  const data = await res.json().catch(()=>({}))
  if(!res.ok) throw Object.assign(new Error(data.error||'操作失敗'), { details:data.details, data })
  return data
}
export const api = {
  authStatus:()=>json('/api/auth/status'),
  me:()=>json('/api/auth/me'),
  setup:(body)=>json('/api/auth/setup',{method:'POST',body:JSON.stringify(body)}),
  login:(body)=>json('/api/auth/login',{method:'POST',body:JSON.stringify(body)}),
  demoLogin:(role)=>json('/api/auth/demo-login',{method:'POST',body:JSON.stringify({role})}),
  logout:()=>json('/api/auth/logout',{method:'POST',body:'{}'}),
  state:()=>json('/api/state'),
  createCase:(body={})=>json('/api/cases',{method:'POST',body:JSON.stringify(body)}),
  updateCase:(id,body)=>json(`/api/cases/${id}`,{method:'PUT',body:JSON.stringify(body)}),
  submit:(id)=>json(`/api/cases/${id}/submit`,{method:'POST',body:'{}'}),
  accounting:(id,body)=>json(`/api/cases/${id}/accounting`,{method:'POST',body:JSON.stringify(body)}),
  settings:(body)=>json('/api/settings',{method:'PUT',body:JSON.stringify(body)}),
  exchangeRate:(date)=>json(`/api/exchange-rate?date=${encodeURIComponent(date)}`),
  demo:()=>json('/api/demo',{method:'POST',body:'{}'}),
  clearDemo:()=>json('/api/demo',{method:'DELETE'}),
  deleteAttachment:(caseId,id)=>json(`/api/cases/${caseId}/attachments/${id}`,{method:'DELETE'}),
  upload: async (caseId, group, category, files, claimItemId='') => {
    if(!files?.length) throw new Error('請先選擇票據照片')
    const fd = new FormData(); fd.append('group',group); fd.append('category',category); fd.append('claimItemId',claimItemId)
    ;[...files].forEach(f=>fd.append('files',f))
    const res = await fetch(`/api/cases/${caseId}/attachments`,{method:'POST',body:fd,credentials:'include'})
    const data = await res.json().catch(()=>({}))
    if(!res.ok) throw new Error(data.error||'上傳失敗')
    return data
  }
}
