(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{try{return new Date(Number(v)).toLocaleString('sv-SE')}catch{return String(v??'')}};
  const confirmDialog=opts=>window.appConfirm?window.appConfirm(opts):Promise.resolve(false);
  const startOfDay=v=>{const d=new Date(v);d.setHours(0,0,0,0);return d.getTime()};
  const endOfDay=v=>{const d=new Date(v);d.setHours(23,59,59,999);return d.getTime()};
  let accountById=new Map();

  function modal(title,html){
    const m=document.querySelector('#modal'),t=document.querySelector('#modal-title'),b=document.querySelector('#modal-body');
    if(!m||!t||!b)return;
    t.textContent=title;b.innerHTML=html;m.classList.add('open');
  }

  async function removeFeedback(id){
    const r=await fetch(`/api/admin/feedback/${encodeURIComponent(id)}`,{method:'DELETE',headers:{Accept:'application/json'}});
    if(!r.ok){const body=await r.json().catch(()=>({}));throw new Error(body.error||`HTTP ${r.status}`)}
  }

  async function clearFeedback(){
    const r=await fetch('/api/admin/feedback',{method:'DELETE',headers:{Accept:'application/json'}});
    if(!r.ok){const body=await r.json().catch(()=>({}));throw new Error(body.error||`HTTP ${r.status}`)}
  }

  async function allFeedback(){
    const r=await fetch('/api/admin/export?section=feedback&format=json',{headers:{Accept:'application/json'}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const rows=await r.json();
    return Array.isArray(rows)?rows:[];
  }

  async function removeMany(ids,onProgress){
    const unique=[...new Set(ids.filter(Boolean))];
    let done=0;
    for(let i=0;i<unique.length;i+=12){
      const batch=unique.slice(i,i+12);
      await Promise.all(batch.map(id=>removeFeedback(id)));
      done+=batch.length;
      onProgress?.(done,unique.length);
    }
    return done;
  }

  function reload(){
    const list=document.querySelector('#admin-feedback');
    if(!list)return;
    list.dataset.feedbackEnhanced='0';
    list.innerHTML='';
    enhance();
  }

  async function clearByRange(from,to,accountId=null){
    const rows=await allFeedback();
    const matches=rows.filter(f=>Number(f.created_at)>=from&&Number(f.created_at)<=to&&(!accountId||String(f.account_id||'')===String(accountId)));
    if(!matches.length)return 0;
    const label=accountId?'från det här kontot ':'';
    const yes=await confirmDialog({
      title:`Ta bort ${matches.length} feedbackärende${matches.length===1?'':'n'}?`,
      message:`Alla matchande poster ${label}i det valda tidsintervallet tas bort permanent.`,
      confirmLabel:`Ta bort ${matches.length}`,
    });
    if(!yes)return -1;
    return removeMany(matches.map(x=>x.id));
  }

  function openItem(f){
    const canReply=Boolean(f.wants_reply&&f.reply_to),subject='Angående din kontakt med Politikerkontakt',mailto=canReply?`mailto:${encodeURIComponent(f.reply_to)}?subject=${encodeURIComponent(subject)}`:'';
    const account=f.account_id?accountById.get(String(f.account_id)):null;
    modal('Feedbackärende',`<div class="stack"><div class="panel feedback-detail"><div class="credential-head"><strong>${f.kind==='contact'?'Kontaktfråga':'Feedback'}</strong><span class="hint">${esc(fmt(f.created_at))}</span></div><p style="white-space:pre-wrap">${esc(f.message)}</p></div><div class="panel"><div class="stack"><div><span class="hint">Återkoppling</span><br><strong>${canReply?'Önskas':'Inte begärd eller saknas på äldre post'}</strong></div>${f.reply_to?`<div><span class="hint">E-post</span><br><a href="${mailto}">${esc(f.reply_to)}</a></div>`:''}${f.account_id?`<div><span class="hint">Konto</span><br><a class="feedback-account-link" href="#admin/accounts/${encodeURIComponent(f.account_id)}"><code>${esc(f.account_id)}</code></a>${account?.email?` <span class="hint">· ${esc(account.email)}</span>`:''}</div>`:''}<div><span class="hint">Ärende-ID</span><br><code>${esc(f.id)}</code></div></div></div>${canReply?`<a class="primary feedback-reply-link" href="${mailto}">Svara via e-post</a>`:'<div class="notice">Det finns ingen sparad svarsadress för detta ärende.</div>'}<div class="button-row feedback-detail-actions">${f.account_id?'<button type="button" class="secondary feedback-clear-account-day">Rensa senaste 24 h från kontot</button>':''}<button type="button" class="danger feedback-delete">Ta bort feedback</button></div></div>`);
    document.querySelector('.feedback-account-link')?.addEventListener('click',()=>document.querySelector('#modal')?.classList.remove('open'));
    document.querySelector('.feedback-delete')?.addEventListener('click',async()=>{
      const yes=await confirmDialog({title:'Ta bort feedback?',message:'Det här feedbackärendet tas bort permanent.',confirmLabel:'Ta bort'});
      if(!yes)return;
      try{await removeFeedback(f.id);document.querySelector('#modal')?.classList.remove('open');reload()}catch(e){showError(e)}
    });
    document.querySelector('.feedback-clear-account-day')?.addEventListener('click',async()=>{
      try{
        const now=Date.now();
        const n=await clearByRange(now-24*60*60*1000,now,f.account_id);
        if(n>0){document.querySelector('#modal')?.classList.remove('open');reload()}
      }catch(e){showError(e)}
    });
  }

  function showError(e){
    const box=document.querySelector('#global-notices');if(!box)return;
    const d=document.createElement('div');d.className='notice error';d.textContent=e instanceof Error?e.message:String(e||'Kunde inte utföra åtgärden');box.replaceChildren(d);
  }

  function openRangeDialog(){
    const today=new Date().toISOString().slice(0,10);
    const yesterday=new Date(Date.now()-24*60*60*1000).toISOString().slice(0,10);
    modal('Rensa feedback efter datum',`<div class="stack"><p class="hint">Välj intervallet som ska tas bort. Övrig feedback lämnas orörd.</p><div class="grid-2"><label class="field"><span>Från datum</span><input id="feedback-purge-from" type="date" value="${yesterday}"></label><label class="field"><span>Till datum</span><input id="feedback-purge-to" type="date" value="${today}"></label></div><div class="button-row"><button type="button" class="secondary" id="feedback-purge-24h">Senaste 24 timmarna</button><button type="button" class="danger" id="feedback-purge-range">Rensa intervallet</button></div><div class="hint" id="feedback-purge-status"></div></div>`);
    const run=async(from,to)=>{
      const status=document.querySelector('#feedback-purge-status');
      try{
        status.textContent='Kontrollerar matchande poster…';
        const n=await clearByRange(from,to);
        if(n===-1){status.textContent='Avbrutet.';return}
        if(n===0){status.textContent='Ingen feedback matchade intervallet.';return}
        document.querySelector('#modal')?.classList.remove('open');reload();
      }catch(e){status.textContent=e instanceof Error?e.message:'Kunde inte rensa feedback'}
    };
    document.querySelector('#feedback-purge-24h').onclick=()=>run(Date.now()-24*60*60*1000,Date.now());
    document.querySelector('#feedback-purge-range').onclick=()=>{
      const from=document.querySelector('#feedback-purge-from').value,to=document.querySelector('#feedback-purge-to').value;
      if(!from||!to)return;
      run(startOfDay(from),endOfDay(to));
    };
  }

  function ensureControls(list,hasRows){
    const panel=list.closest('.panel');
    if(!panel)return;
    let controls=panel.querySelector('#admin-feedback-controls');
    if(!controls){
      controls=document.createElement('div');
      controls.id='admin-feedback-controls';
      controls.className='feedback-controls button-row';
      controls.innerHTML='<button type="button" class="secondary" id="admin-feedback-range">Rensa efter datum…</button><button type="button" class="danger" id="admin-feedback-clear">Rensa all feedback</button>';
      panel.insertBefore(controls,list);
      controls.querySelector('#admin-feedback-range')?.addEventListener('click',openRangeDialog);
      controls.querySelector('#admin-feedback-clear')?.addEventListener('click',async()=>{
        const yes=await confirmDialog({title:'Rensa all feedback?',message:'Alla feedbackärenden tas bort permanent. Det går inte att ångra.',confirmLabel:'Rensa allt'});
        if(!yes)return;
        try{await clearFeedback();reload()}catch(e){showError(e)}
      });
    }
    controls.hidden=!hasRows;
  }

  async function enhance(){
    const list=document.querySelector('#admin-feedback');
    if(!list||list.dataset.feedbackEnhanced==='1'||list.dataset.feedbackEnhanced==='loading')return;
    list.dataset.feedbackEnhanced='loading';
    try{
      const [fr,ar]=await Promise.all([fetch('/api/admin/feedback',{headers:{Accept:'application/json'}}),fetch('/api/admin/accounts',{headers:{Accept:'application/json'}})]);
      if(!fr.ok)throw new Error(`HTTP ${fr.status}`);
      const rows=await fr.json();
      if(ar.ok){const accounts=await ar.json();accountById=new Map(accounts.map(a=>[String(a.id),a]))}
      list.innerHTML='';
      ensureControls(list,rows.length>0);
      if(!rows.length){list.innerHTML='<div class="empty">Ingen feedback.</div>';list.dataset.feedbackEnhanced='1';return}
      for(const f of rows){
        const item=document.createElement('button');
        item.type='button';item.className='admin-row feedback-ticket';
        const a=f.account_id?accountById.get(String(f.account_id)):null;
        item.innerHTML=`<div class="credential-head"><div><strong>${esc((f.message||'').slice(0,90))}${(f.message||'').length>90?'…':''}</strong><div class="hint">${esc(fmt(f.created_at))}${a?.email?' · '+esc(a.email):f.reply_to?' · '+esc(f.reply_to):''}</div></div><span class="feedback-chevron" aria-hidden="true">›</span></div>${f.wants_reply?'<div class="feedback-badge">Svar önskas</div>':''}`;
        item.addEventListener('click',()=>openItem(f));list.append(item);
      }
      list.dataset.feedbackEnhanced='1';
    }catch{list.dataset.feedbackEnhanced='0'}
  }

  const observer=new MutationObserver(()=>queueMicrotask(enhance));
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();
