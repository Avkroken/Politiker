(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const fmt=v=>v?new Date(Number(v)).toLocaleString('sv-SE'):'';
  const n=v=>Number(v||0).toLocaleString('sv-SE');
  const status=s=>({queued:'Köad',sending:'Skickar',completed:'Klar',done:'Klar',failed:'Misslyckad',cancelled:'Avbruten',stopped:'Stoppad'}[s]||s||'Okänd');
  let timer=0;

  async function json(path){
    const r=await fetch(path,{headers:{Accept:'application/json'}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);
    return d;
  }

  function providerLabel(p){return ({github:'GitHub',google:'Google',microsoft:'Microsoft'})[String(p||'').toLowerCase()]||p||'Inloggning'}
  function providerMark(p){
    p=String(p||'').toLowerCase();
    if(p==='microsoft')return '<span class="provider-mark microsoft" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
    if(p==='google')return '<span class="provider-mark google" aria-hidden="true">G</span>';
    if(p==='github')return '<span class="provider-mark github" aria-hidden="true">GH</span>';
    return '<span class="provider-mark" aria-hidden="true">•</span>';
  }

  function ensureStyles(){
    if($('#render-stability-style'))return;
    const s=document.createElement('style');s.id='render-stability-style';s.textContent=`
      .provider-card-head{display:flex;align-items:flex-start;gap:14px}.provider-card-main{min-width:0;flex:1}.provider-name{font-size:1.05rem}.provider-mark{width:42px;height:42px;flex:0 0 42px;border:1px solid var(--border);border-radius:12px;display:grid;place-items:center;font-weight:800;background:var(--surface-2)}
      .provider-mark.github{border-radius:50%;font-size:.72rem}.provider-mark.google{font-size:1.4rem;font-weight:800;color:#9f8cff}.provider-mark.microsoft{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:2px;padding:8px}.provider-mark.microsoft i{display:block;background:currentColor;border-radius:1px}.provider-meta{margin-top:3px}.provider-card .danger{margin-top:14px}
      .stat-link{display:flex!important;flex-direction:column;align-items:flex-start;gap:2px;text-decoration:none}.stat-link small{display:block;margin-top:7px;color:var(--accent)}
      #letters-list>a[data-stable-letter]{color:inherit}.stable-clickable{cursor:pointer}
    `;document.head.append(s);
  }

  async function stabilizeLetters(){
    if(location.hash!=='#letters')return;
    const host=$('#letters-list');if(!host)return;
    if(host.querySelector(':scope > [data-stable-letter]'))return;
    const d=await json('/api/public/letters');
    if(location.hash!=='#letters'||!document.contains(host))return;
    host.innerHTML='';
    for(const x of d.letters||[]){
      const a=document.createElement('a');
      a.dataset.stableLetter='1';a.href=`#letters/${encodeURIComponent(x.id)}`;a.className='panel stable-clickable';a.style.cssText='display:block;text-decoration:none';
      a.innerHTML=`<h2>${esc(x.subject)}</h2><p class="hint">${esc(fmt(x.published_at))}</p><p>${esc(x.excerpt||'')}</p><div class="hint">Öppna brev →</div>`;
      host.append(a);
    }
    if(!d.letters?.length)host.innerHTML='<div class="panel empty">Inga publicerade brev.</div>';
  }

  async function stabilizeStats(){
    if(location.hash!=='#admin/stats')return;
    const panel=$('#admin-panel');if(!panel||panel.querySelector('[data-stable-stats]'))return;
    const s=await json('/api/admin/stats');
    if(location.hash!=='#admin/stats'||!document.contains(panel))return;
    const countries=(s.visitorCountries||[]).slice(0,12),leaders=(s.leaderboard||[]).slice(0,12);
    panel.innerHTML=`<div data-stable-stats="1"><div class="review-kpis"><a class="kpi stat-link" href="#admin/accounts"><strong>${n(s.totalAccounts)}</strong><span>Konton</span><small>Visa konton →</small></a><div class="kpi"><strong>${n(s.totalVisitors)}</strong><span>Besökare</span></div><div class="kpi"><strong>${n(s.totalLetters)}</strong><span>Brev</span></div></div><div class="review-kpis" style="margin-top:10px"><div class="kpi"><strong>${n(s.totalSent)}</strong><span>Skickade</span></div><div class="kpi"><strong>${n(s.totalBounced)}</strong><span>Misslyckade</span></div><div class="kpi"><strong>${n((s.dailySeries||[]).length)}</strong><span>Aktiva dagar</span></div></div><div class="grid-2" style="margin-top:14px"><div class="panel"><h2>Besökare per land</h2><div class="stack">${countries.length?countries.map(x=>`<div class="admin-row"><div class="credential-head"><strong>${esc(x.country==='??'?'Okänt':x.country)}</strong><span>${n(x.n)}</span></div></div>`).join(''):'<div class="empty">Ingen besöksdata ännu.</div>'}</div></div><div class="panel"><h2>Mest aktiva konton</h2><div class="stack">${leaders.length?leaders.map(x=>x.accountId?`<a class="admin-row" href="#admin/accounts/${encodeURIComponent(x.accountId)}" style="display:block;text-decoration:none"><div class="credential-head"><strong>${esc(x.email)}</strong><span>${n(x.sentCount)}</span></div><div class="hint">Visa konto →</div></a>`:`<div class="admin-row"><div class="credential-head"><strong>${esc(x.email)}</strong><span>${n(x.sentCount)}</span></div></div>`).join(''):'<div class="empty">Ingen utskicksdata ännu.</div>'}</div></div></div></div>`;
  }

  async function stabilizeSends(){
    if(location.hash!=='#admin/sends')return;
    const host=$('#admin-sends');if(!host||host.querySelector(':scope > [data-stable-send]'))return;
    const rows=await json('/api/admin/send-jobs');
    if(location.hash!=='#admin/sends'||!document.contains(host))return;
    host.innerHTML='';
    for(const j of rows){const a=document.createElement('a');a.dataset.stableSend='1';a.href=`#admin/sends/${encodeURIComponent(j.id)}`;a.className='admin-row stable-clickable';a.style.cssText='display:block;text-decoration:none';a.innerHTML=`<strong>${esc(j.email||j.account_email||'Konto')}</strong><div class="hint">${esc(status(j.status))} · ${n(j.sent_count)}/${n(j.total_recipients)} · ${esc(fmt(j.created_at))}</div><div class="hint">Visa detaljer →</div>`;host.append(a)}
    if(!rows.length)host.innerHTML='<div class="empty">Inga utskick.</div>';
  }

  async function stabilizeOAuth(){
    if(location.hash!=='#settings/security')return;
    const list=$('#oauth-list');if(!list||list.querySelector('[data-stable-oauth]'))return;
    const ids=await json('/api/oauth-identities');
    if(location.hash!=='#settings/security'||!document.contains(list))return;
    list.innerHTML='';
    for(const x of ids){
      const d=document.createElement('div');d.className='credential-card provider-card';d.dataset.stableOauth='1';
      const email=x.provider_email?`<div class="hint provider-meta">${esc(x.provider_email)}</div>`:'<div class="hint provider-meta">Mailadress sparas nästa gång du använder den här inloggningen.</div>';
      const date=x.created_at?`<div class="hint provider-meta">Kopplad ${esc(fmt(x.created_at))}</div>`:'';
      d.innerHTML=`<div class="provider-card-head">${providerMark(x.provider)}<div class="provider-card-main"><strong class="provider-name">${esc(providerLabel(x.provider))}</strong>${email}${date}</div></div><button class="danger" type="button">Koppla bort</button>`;
      d.querySelector('button').onclick=async()=>{const yes=window.appConfirm?await window.appConfirm({title:`Koppla bort ${providerLabel(x.provider)}?`,message:'Du kan länka inloggningssättet igen senare.',confirmLabel:'Koppla bort'}):true;if(!yes)return;const r=await fetch(`/api/oauth-identities/${encodeURIComponent(x.provider)}`,{method:'DELETE'});if(!r.ok)return;list.innerHTML='Laddar…';schedule(10)};
      list.append(d);
    }
    if(!ids.length)list.innerHTML='<div class="empty">Inga externa inloggningar länkade.</div>';
  }

  async function stabilize(){
    ensureStyles();
    try{await Promise.all([stabilizeLetters(),stabilizeStats(),stabilizeSends(),stabilizeOAuth()])}catch(e){console.warn('render-stability',e)}
  }
  function schedule(delay=45){clearTimeout(timer);timer=setTimeout(stabilize,delay)}

  new MutationObserver(()=>schedule()).observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('hashchange',()=>schedule(20));
  window.addEventListener('pageshow',()=>schedule(20));
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>schedule(20));else schedule(20);
})();
