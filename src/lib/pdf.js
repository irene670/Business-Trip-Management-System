import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { PDFDocument } from 'pdf-lib'
import { claimItemsFor, totals, money } from './rules.js'

const esc=s=>String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]))

export async function generatePdf(c,settings){
  const sum=totals(c,settings)
  const claimItems=claimItemsFor(c)
  const root=document.createElement('div')
  root.className='pdf-render-root'
  root.innerHTML=`<div class="pdf-sheet">
    <div class="pdf-header"><div><b>${esc(c.company)}</b><h1>員工差旅事後費用報支單</h1></div><div>${esc(c.id)}<br>${esc(c.status)}</div></div>
    <h3>一、申請人與任務</h3><div class="pdf-grid2"><div><small>姓名／部門</small><b>${esc(c.employee)}／${esc(c.dept)}</b></div><div><small>主管</small><b>${esc(c.manager)}</b></div><div><small>差旅／任務</small><b>${esc(c.tripMode)}／${esc(c.taskType)}</b></div><div><small>日期</small><b>${esc(c.startDate)}～${esc(c.endDate)}</b></div><div><small>目的地</small><b>${esc(c.destination)}</b></div><div><small>專案</small><b>${esc(c.projectName||'—')}</b></div><div class="wide"><small>任務說明</small><b>${esc(c.purpose)}</b></div></div>
    <h3>二、費用明細</h3><table><thead><tr><th>項目</th><th>日期／區間</th><th>內容</th><th>申報</th></tr></thead><tbody>
      ${claimItems.map(r=>`<tr><td>${esc(r.category)}</td><td>${esc(r.category==='住宿費'?`${r.checkIn||''}～${r.checkOut||''}`:r.date)}</td><td>${esc(r.detail)}${r.note?`<br><small>${esc(r.note)}</small>`:''}</td><td>${money(r.amount)}</td></tr>`).join('')||'<tr><td colspan="4">無員工代墊費用</td></tr>'}
    </tbody></table>
    <div class="pdf-total">員工申報合計：${money(sum.total)}</div>
    <h3>三、加班與主管審核</h3><table><thead><tr><th>日期</th><th>起訖</th><th>時數</th><th>工作內容</th></tr></thead><tbody>${(c.overtimeRows||[]).map(r=>`<tr><td>${esc(r.date)}</td><td>${esc(r.start)}～${esc(r.end)}</td><td>${esc(r.hours)}h</td><td>${esc(r.note)}</td></tr>`).join('')||'<tr><td colspan="4">無</td></tr>'}</tbody></table><p>主管決議：${esc(c.managerApproval?.decision||'—')}　${esc(c.managerApproval?.note||'')}</p>
    <h3>四、會計／行政</h3><p>成本中心：${esc(c.accounting?.costCenter||'—')}　成本類型：${esc(c.accounting?.costType||'—')}</p><p>會計備註：${esc(c.accounting?.note||'—')}</p>
    <h3>五、票據照片</h3><p>${(c.attachments||[]).filter(a=>a.group==='receipt').length} 張：${(c.attachments||[]).filter(a=>a.group==='receipt').map(a=>esc(a.category)+'｜'+esc(a.name)).join('、')||'無'}</p>
  </div>`
  document.body.appendChild(root)
  await new Promise(r=>setTimeout(r,80))
  const canvas=await html2canvas(root.querySelector('.pdf-sheet'),{scale:1.6,backgroundColor:'#fff',useCORS:true})
  const img=canvas.toDataURL('image/jpeg',0.96)
  const pdf=new jsPDF({unit:'mm',format:'a4',orientation:'portrait'})
  const pageW=210,pageH=297,margin=8,imgW=pageW-margin*2,imgH=canvas.height*imgW/canvas.width
  let y=margin,remain=imgH
  pdf.addImage(img,'JPEG',margin,y,imgW,imgH)
  while(remain>pageH-margin*2){remain-=pageH-margin*2;pdf.addPage();pdf.addImage(img,'JPEG',margin,margin-remain,imgW,imgH)}
  root.remove()
  let bytes=pdf.output('arraybuffer')
  const out=await PDFDocument.load(bytes)
  const orderedAttachments=[...(c.attachments||[]).filter(a=>a.group==='receipt')]
  for(const a of orderedAttachments){
    try{
      const r=await fetch(a.url); if(!r.ok)continue; const blob=await r.blob(); const buf=await blob.arrayBuffer()
      if(a.mime==='application/pdf'){
        const src=await PDFDocument.load(buf); const pages=await out.copyPages(src,src.getPageIndices()); pages.forEach(p=>out.addPage(p))
      }else if(a.mime?.startsWith('image/')){
        const image=a.mime.includes('png')?await out.embedPng(buf):await out.embedJpg(buf)
        const page=out.addPage([595.28,841.89]); const maxW=535,maxH=760; const s=Math.min(maxW/image.width,maxH/image.height,1); const w=image.width*s,h=image.height*s
        page.drawText(`Receipt - ${a.name}`,{x:30,y:810,size:10})
        page.drawImage(image,{x:(595.28-w)/2,y:35+(760-h)/2,width:w,height:h})
      }
    }catch(e){console.warn('skip attachment',a.name,e)}
  }
  const finalBytes=await out.save(); const blob=new Blob([finalBytes],{type:'application/pdf'}); const url=URL.createObjectURL(blob); const link=document.createElement('a');link.href=url;link.download=`${c.id}_差旅事後報支.pdf`;link.click();setTimeout(()=>URL.revokeObjectURL(url),3000)
}
