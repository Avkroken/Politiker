(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>{try{return new Date(Number(v)).toLocaleString('sv-SE')}catch{return String(v??'')}};
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

  function reload(){
    const list=document.querySelector('#admin-feedback');
    if(!list)return;
    list.dataset.feedbackEnhanced='0';
    list.innerHTML='';
    enhance();
  }

  function openItem(f){
    const canReply=Boolean(f.wants_reply&&f.reply_to),subject='Angående din kontakt med Politikerkontakt',mailto=canReply?`mailto:${encodeURIComponent(f.reply_to)}?subject=${encodeURIComponent(subject)}`:'';
    const account=f.account_id?accountById.get(String(f.account_id)):null;
    modal('Feedbackärende',`<div class="stack"><div class="panel feedback-detail"><div class="credential-head"><strong>${f.kind==='contact'?'Kontaktfråga':'Feedback'}</strong><span class="hint">${esc(fmt(f.created_at))}</span></div><p style="white-space:pre-wrap">${esc(f.message)}</p></div><div class="panel"><div class="stack"><div><span class="hint">Återkoppling</span><br><strong>${canReply?'Önskas':'Inte begärd eller saknas på äldre post'}</strong></div>${f.reply_to?`<div><span class="hint">E-post</span><br><a href="${mailto}">${esc(f.reply_to)}</a></div>`:''}${f.account_id?`<div><span class="hint">Konto</span><br><a class="feedback-account-link" href="#admin/accounts/${encodeURIComponent(f.account_id)}"><code>${esc(f.account_id)}</code></a>${account?.email?` <span class="hint">· ${esc(account.email)}</span>`:''}</div>`:''}<div><span class="hint">Ärende-ID</span><br><code>${esc(f.id)}</code></div></div></div>${canReply?`<a class="primary feedback-reply-link" href="${mailto}">Svara via e-post</a>`:'<div class="notice">Det finns ingen sparad svarsadress för detta ärende.</div>'}<button type="button" class="danger feedback-delete">Ta bort feedback</button></div>`);
    document.querySelector('.feedback-account-link')?.addEventListener('click',()=>document.querySelector('#modal')?.classList.remove('open'));
    document.querySelector('.feedback-delete')?.addEventListener('click',async()=>{
      if(!confirm('Ta bort detta feedbackärende permanent? Detta går inte att ångra.'))return;
      try{
        await removeFeedback(f.id);
        document.querySelector('#modal')?.classList.remove('open');
        reload();
      }catch(e){alert(e instanceof Error?e.message:'Kunde inte ta bort feedback')}
    });
  }

  function ensureControls(list,hasRows){
    const panel=list.closest('.panel');
    if(!panel)return;
    let controls=panel.querySelector('#admin-feedback-controls');
    if(!controls){
      controls=document.createElement('div');
      controls.id='admin-feedback-controls';
      controls.className='feedback-controls';
      controls.innerHTML='<button type="button" class="danger" id="admin-feedback-clear">Rensa all feedback</button>';
      panel.insertBefore(controls,list);
      controls.querySelector('#admin-feedback-clear')?.addEventListener('click',async()=>{
        if(!confirm('Radera ALL feedback permanent? Detta går inte att ångra.'))return;
        if(!confirm('Är du helt säker? Alla feedbackärenden kommer att tas bort.'))return;
        try{await clearFeedback();reload()}catch(e){alert(e instanceof Error?e.message:'Kunde inte rensa feedback')}
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
