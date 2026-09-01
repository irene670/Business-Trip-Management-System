const json = async (url, options={}) => {
  const res = await fetch(url, { headers:{'Content-Type':'application/json', ...(options.headers||{})}, ...options })
  const data = await res.json().catch(()=>({}))
  if(!res.ok) throw Object.assign(new Error(data.error||'操作失敗'), { details:data.details, data })
  return data
}
export const api = {
  state:()=>json('/api/state'),
  createCase:(body={})=>json('/api/cases',{method:'POST',body:JSON.stringify(body)}),
  updateCase:(id,body)=>json(`/api/cases/${id}`,{method:'PUT',body:JSON.stringify(body)}),
  submit:(id)=>json(`/api/cases/${id}/submit`,{method:'POST',body:'{}'}),
  manager:(id,body)=>json(`/api/cases/${id}/manager`,{method:'POST',body:JSON.stringify(body)}),
  accounting:(id,body)=>json(`/api/cases/${id}/accounting`,{method:'POST',body:JSON.stringify(body)}),
  settings:(body)=>json('/api/settings',{method:'PUT',body:JSON.stringify(body)}),
  demo:()=>json('/api/demo',{method:'POST',body:'{}'}),
  clearDemo:()=>json('/api/demo',{method:'DELETE'}),
  deleteAttachment:(caseId,id)=>json(`/api/cases/${caseId}/attachments/${id}`,{method:'DELETE'}),
  upload: async (caseId, group, category, files, claimItemId='') => {
    if(!files?.length) throw new Error('請先選擇票據照片')
    const fd = new FormData(); fd.append('group',group); fd.append('category',category); fd.append('claimItemId',claimItemId)
    ;[...files].forEach(f=>fd.append('files',f))
    const res = await fetch(`/api/cases/${caseId}/attachments`,{method:'POST',body:fd})
    const data = await res.json().catch(()=>({}))
    if(!res.ok) throw new Error(data.error||'上傳失敗')
    return data
  }
}
