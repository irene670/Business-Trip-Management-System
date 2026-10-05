import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import { claimItemsFor, totals, money, itemAmount, taskHours, missingReceiptItems, overtimeReminderDays } from './rules.js'
import { reviewRows, approvedTotal } from './review.js'

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))
const receiptAttachments=c=>(c.attachments||[]).filter(a=>a.group==='receipt')
const reviewStatus=(row,hasReview)=>hasReview?(row.status||'核准'):'尚未核定'

export function buildPdfHtml(c,settings={}){
  const sum=totals(c,settings)
  const claimItems=claimItemsFor(c)
  const rows=reviewRows(c,settings)
  const hasReview=!!(c.accounting?.reviewedAt||c.accounting?.at||c.accounting?.returnedAt||Object.keys(c.accounting?.itemApprovals||{}).length)
  const finalTotal=hasReview?approvedTotal(c,settings):sum.total
  const receiptList=receiptAttachments(c)
  return `<div class="pdf-sheet">
    <div class="pdf-header"><div><b>${esc(c.company)}</b><h1>員工差旅事後費用報支單</h1></div><div>${esc(c.id)}<br>${esc(c.status)}</div></div>
    <h3>一、申請人與任務</h3><div class="pdf-grid2"><div><small>姓名／員編／部門</small><b>${esc(c.employee)}／${esc(c.employeeId)}／${esc(c.dept)}</b></div><div><small>主管</small><b>${esc(c.manager)}</b></div><div><small>差旅／任務</small><b>${esc(c.tripMode)}／${esc(c.taskType)}</b></div><div><small>日期</small><b>${esc(c.startDate)}～${esc(c.endDate)}</b></div><div><small>任務時間</small><b>${esc(c.taskStartAt)}～${esc(c.taskEndAt)}（${taskHours(c)}h）</b></div><div><small>目的地</small><b>${esc(c.destination)}</b></div><div class="wide"><small>任務說明</small><b>${esc(c.purpose)}</b></div></div>
    <h3>二、費用明細</h3><table><thead><tr><th>項目</th><th>日期／區間</th><th>內容</th><th>付款方式</th><th>原申報金額</th></tr></thead><tbody>
      ${claimItems.map(r=>`<tr><td>${esc(r.category)}</td><td>${esc(r.category==='住宿費'?`${r.checkIn||''}～${r.checkOut||''}`:r.date)}</td><td>${esc(r.detail)}${r.km?`<br>${esc(r.km)} 公里`:''}${r.note?`<br><small>${esc(r.note)}</small>`:''}</td><td>${r.personalAdvance!==false?'個人代墊':'公司掛帳'}</td><td>${money(itemAmount(r))}</td></tr>`).join('')||'<tr><td colspan="5">無費用</td></tr>'}
    </tbody></table>
    <div class="pdf-total">膳雜費：${money(sum.mealAllowance)}　超時津貼：${money(sum.allowance)}<br>午休津貼：${money(sum.lunchAllowance)}<br>國外日支：${money(sum.foreignPerDiem)}　公司掛帳：${money(sum.companyPaid)}<br>員工原申報合計：${money(sum.total)}</div>
    <h3>三、會計核定結果</h3><table><thead><tr><th>項目</th><th>員工原申報</th><th>核定狀態</th><th>核定金額</th><th>原因／備註</th></tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${esc(r.label)}</td><td>${money(r.claim)}</td><td>${esc(reviewStatus(r,hasReview))}</td><td>${hasReview?money(r.amount):'—'}</td><td>${esc(r.note||'')}</td></tr>`).join('')||'<tr><td colspan="5">無核定項目</td></tr>'}
    </tbody></table>
    <div class="pdf-total">${hasReview?'會計核定應付員工合計':'會計尚未核定'}：${hasReview?money(finalTotal):'—'}</div>
    <h3>四、超時津貼</h3><p>本系統不代送 104 企業大師加班單，請另行提送。</p>${overtimeReminderDays(c).filter(d=>d.hr104Hours>0).map(d=>`<p>${esc(d.date)} 任務 ${d.hours} 小時：104 需送 ${d.hr104Hours} 小時加班單；另有 ${d.extraHours} 小時可申請超時津貼。</p>`).join('')}<table><thead><tr><th>日期</th><th>起訖</th><th>時數</th><th>工作內容</th></tr></thead><tbody>${(c.overtimeRows||[]).map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.start)}～${esc(r.end)}</td><td>${esc(r.hours)}h</td><td>${esc(r.note)}</td></tr>`).join('')||'<tr><td colspan="4">無</td></tr>'}</tbody></table>
    <h3>五、紙本簽核</h3><table><tbody><tr><td style="height:72px">申請人親簽：<br><br>日期：</td><td>主管親簽：<br><br>日期：</td><td>會計／行政親簽：<br><br>日期：</td></tr></tbody></table>
    <h3>六、票據照片</h3><p>${receiptList.length} 張：${receiptList.map(a=>`${esc(a.category)}｜${esc(a.name)}`).join('、')||'無'}</p>
  </div>`
}

const nextFrame=()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))

async function renderSummaryPdf(c,settings){
  const root=document.createElement('div')
  root.className='pdf-render-root'
  root.innerHTML=buildPdfHtml(c,settings)
  document.body.appendChild(root)
  try{
    await nextFrame()
    const sheet=root.querySelector('.pdf-sheet')
    const source=await html2canvas(sheet,{scale:1.6,backgroundColor:'#fff',useCORS:true})
    const origin=sheet.getBoundingClientRect().top,ratio=source.width/sheet.offsetWidth
    const blocks=[...sheet.querySelectorAll('tr,p,h3,.pdf-grid2>div')].map(node=>{const rect=node.getBoundingClientRect();return {top:Math.floor((rect.top-origin)*ratio),bottom:Math.ceil((rect.bottom-origin)*ratio)}})
    const pdf=new jsPDF({unit:'mm',format:'a4',orientation:'portrait'})
    const margin=8
    const pageW=210
    const pageH=297
    const imgW=pageW-margin*2
    const printableH=pageH-margin*2
    const sourcePageH=Math.max(1,Math.floor(source.width*printableH/imgW))
    let offset=0
    let pageIndex=0
    while(offset<source.height){
      let sliceH=Math.min(sourcePageH,source.height-offset)
      const crossing=blocks.filter(b=>b.top>offset&&b.top<offset+sliceH&&b.bottom>offset+sliceH)
      if(crossing.length)sliceH=Math.min(...crossing.map(b=>b.top))-offset
      const slice=document.createElement('canvas')
      slice.width=source.width
      slice.height=sliceH
      const context=slice.getContext('2d')
      if(!context)throw new Error('無法建立 PDF 頁面畫布。')
      context.fillStyle='#fff'
      context.fillRect(0,0,slice.width,slice.height)
      context.drawImage(source,0,offset,source.width,sliceH,0,0,source.width,sliceH)
      if(pageIndex>0)pdf.addPage()
      const renderedH=sliceH*imgW/source.width
      pdf.addImage(slice.toDataURL('image/jpeg',0.96),'JPEG',margin,margin,imgW,renderedH)
      offset+=sliceH
      pageIndex+=1
    }
    return pdf.output('arraybuffer')
  }finally{
    root.remove()
  }
}

const blobToPngBytes=async blob=>{
  const objectUrl=URL.createObjectURL(blob)
  try{
    const image=await new Promise((resolve,reject)=>{
      const node=new Image()
      node.onload=()=>resolve(node)
      node.onerror=()=>reject(new Error('瀏覽器無法讀取這張照片。'))
      node.src=objectUrl
    })
    const canvas=document.createElement('canvas')
    canvas.width=image.naturalWidth||image.width
    canvas.height=image.naturalHeight||image.height
    const context=canvas.getContext('2d')
    if(!context||!canvas.width||!canvas.height)throw new Error('無法轉換票據照片。')
    context.fillStyle='#fff'
    context.fillRect(0,0,canvas.width,canvas.height)
    context.drawImage(image,0,0)
    const png=await new Promise((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error('無法轉換票據照片。')),'image/png'))
    return png.arrayBuffer()
  }finally{
    URL.revokeObjectURL(objectUrl)
  }
}

async function appendReceipt(out,a,index){
  let response
  try{
    response=await fetch(a.url)
  }catch{
    throw new Error(`票據照片「${a.name||`第 ${index+1} 張`}」下載失敗，請確認網路後再試。`)
  }
  if(!response.ok)throw new Error(`票據照片「${a.name||`第 ${index+1} 張`}」下載失敗（${response.status}）。`)
  const blob=await response.blob()
  const mime=blob.type||a.mime||''
  if(mime==='application/pdf'){
    try{
      const source=await PDFDocument.load(await blob.arrayBuffer())
      const pages=await out.copyPages(source,source.getPageIndices())
      pages.forEach(page=>out.addPage(page))
      return
    }catch{
      throw new Error(`票據檔案「${a.name||`第 ${index+1} 張`}」不是可讀取的 PDF。`)
    }
  }
  if(!mime.startsWith('image/'))throw new Error(`票據「${a.name||`第 ${index+1} 張`}」不是可讀取的照片。`)
  let image
  try{
    image=await out.embedPng(await blobToPngBytes(blob))
  }catch{
    throw new Error(`票據照片「${a.name||`第 ${index+1} 張`}」無法轉入 PDF，請重新上傳 JPG 或 PNG。`)
  }
  const page=out.addPage([595.28,841.89])
  const maxW=535
  const maxH=760
  const scale=Math.min(maxW/image.width,maxH/image.height,1)
  const width=image.width*scale
  const height=image.height*scale
  // Keep this caption ASCII-only because pdf-lib's built-in font cannot encode Chinese filenames.
  page.drawText(`Receipt ${index+1}`,{x:30,y:810,size:10})
  page.drawImage(image,{x:(595.28-width)/2,y:35+(760-height)/2,width,height})
}

export async function generatePdf(c,settings={}){
  const items=claimItemsFor(c)
  if(!items.length)throw new Error('請先新增至少一筆核銷項目。')
  const missing=missingReceiptItems(c)
  if(missing.length){
    const labels=missing.map(x=>`第 ${items.findIndex(item=>item.id===x.id)+1} 筆 ${x.category} ${x.detail||''}`)
    throw new Error(`以下核銷項目尚未上傳票據照片：${labels.join('、')}`)
  }
  const bytes=await renderSummaryPdf(c,settings)
  const out=await PDFDocument.load(bytes)
  const receipts=receiptAttachments(c)
  for(let index=0;index<receipts.length;index+=1)await appendReceipt(out,receipts[index],index)
  const finalBytes=await out.save()
  const blob=new Blob([finalBytes],{type:'application/pdf'})
  const url=URL.createObjectURL(blob)
  const link=document.createElement('a')
  link.href=url
  link.download=`${c.id}_差旅事後報支.pdf`
  link.click()
  setTimeout(()=>URL.revokeObjectURL(url),3000)
}
