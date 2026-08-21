(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s??'').trim().toLowerCase();
  const fmt=v=>{try{return new Date(Number(v)).toLocaleString('sv-SE')}catch{return String(v??'')}};
  const day=86400000;
  const startOfDay=d=>{const x=new Date(d);x.setHours(0,0,0,0);return x.getTime()};
  const endOfDay=d=>{const x=new Date(d);x.setHours(23,59,59,999);return x.getTime()};
  function weekRange(value){const m=String(value||'').match(/^(\d{4})-W(\d{2})$/);if(!m)return null;const year=Number(m[1]),week=Number(m[2]);const jan4=new Date(year,0,4);const dow=jan4.getDay()||7;const monday=new Date(year,0,4-(dow-1)+(week-1)*7);monday.setHours(0,0,0,0);return [monday.getTime(),monday.getTime()+7*day-1]}
  const detailId=()=>{const m=location.hash.match(/^#admin\/accounts\/([^/]+)$/);return m?decodeURIComponent(m[1]):null};

  async function enhance(){
    const host=document.querySelector('#admin-accounts');if(!host||host.dataset.searchEnhanced==='1')return;host.dataset.searchEnhanced='loading';
    try{
      const r=await fetch('/api/admin/accounts',{headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`HTTP ${r.status}`);const rows=await r.json();const panel=host.closest('.panel');if(!panel)return;
      const wanted=detailId();
      if(wanted){const a=rows.find(x=>String(x.id)===wanted);panel.innerHTML=a?`<div class="stack"><a class="ghost" href="#admin/accounts">← Alla konton</a><div class="panel"><h2>${esc(a.email)}</h2><p><span class="hint">Konto-ID</span><br><code>${esc(a.id)}</code></p><p><span class="hint">Skapat</span><br>${esc(fmt(a.created_at))}</p><p><span class="hint">Status</span><br>${a.disabled?'Inaktiverat':'Aktivt'}${a.is_admin?' · Admin':''}${a.email_verified?' · Verifierad e-post':''}</p></div></div>`:'<div class="notice error">Kontot hittades inte.</div>';host.dataset.searchEnhanced='1';return}
      const wrap=document.createElement('div');wrap.className='stack';wrap.innerHTML=`<section class="panel"><h2>Hitta konto</h2><label class="field"><span>Sök på e-post eller konto-ID</span><input id="admin-account-search" type="search" autocomplete="off" placeholder="namn@example.com eller konto-ID"></label><div class="hint" id="admin-account-count"></div></section><section class="panel"><h2>Nya konton under period</h2><div class="button-row"><button class="secondary period-preset" data-days="7">Senaste 7 dagar</button><button class="secondary period-preset" data-days="30">Senaste 30 dagar</button></div><div class="grid-2"><label class="field"><span>Från datum</span><input id="accounts-from-date" type="date"></label><label class="field"><span>Till datum</span><input id="accounts-to-date" type="date"></label></div><div class="grid-2"><label class="field"><span>Från vecka</span><input id="accounts-from-week" type="week"></label><label class="field"><span>Till vecka</span><input id="accounts-to-week" type="week"></label></div><div class="notice" id="accounts-period-result">Välj en period.</div></section>`;panel.insertBefore(wrap,host);
      const input=wrap.querySelector('#admin-account-search'),count=wrap.querySelector('#admin-account-count');
      [...host.children].forEach((el,i)=>{const a=rows[i];if(!a)return;const meta=el.querySelector('.hint');if(meta){const link=document.createElement('div');link.className='hint';link.innerHTML=`<a href="#admin/accounts/${encodeURIComponent(a.id)}"><code>${esc(a.id)}</code></a>`;meta.after(link)}});
      function applySearch(){const q=norm(input.value);let visible=0;[...host.children].forEach((el,i)=>{const a=rows[i];const hit=!q||norm(a?.email).includes(q)||norm(a?.id).includes(q);el.hidden=!hit;if(hit)visible++});count.textContent=q?`${visible} träff${visible===1?'':'ar'}`:`${rows.length} konton`}
      function showRange(from,to,label){const n=rows.filter(a=>Number(a.created_at)>=from&&Number(a.created_at)<=to).length;wrap.querySelector('#accounts-period-result').textContent=`${n} konto${n===1?'':'n'} skapades ${label}.`}
      input.addEventListener('input',applySearch);wrap.querySelectorAll('.period-preset').forEach(b=>b.onclick=()=>{const days=Number(b.dataset.days),to=Date.now(),from=to-days*day;showRange(from,to,`de senaste ${days} dagarna`)});
      const fd=wrap.querySelector('#accounts-from-date'),td=wrap.querySelector('#accounts-to-date'),fw=wrap.querySelector('#accounts-from-week'),tw=wrap.querySelector('#accounts-to-week');const dates=()=>{if(fd.value&&td.value)showRange(startOfDay(fd.value),endOfDay(td.value),`mellan ${fd.value} och ${td.value}`)};fd.onchange=dates;td.onchange=dates;const weeks=()=>{const a=weekRange(fw.value),b=weekRange(tw.value);if(a&&b)showRange(a[0],b[1],`mellan ${fw.value} och ${tw.value}`)};fw.onchange=weeks;tw.onchange=weeks;applySearch();host.dataset.searchEnhanced='1';
    }catch{host.dataset.searchEnhanced='0'}
  }
  const observer=new MutationObserver(()=>queueMicrotask(enhance));observer.observe(document.documentElement,{subtree:true,childList:true});window.addEventListener('hashchange',()=>queueMicrotask(enhance));if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();
