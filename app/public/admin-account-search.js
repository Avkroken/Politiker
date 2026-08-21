(()=>{
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const norm=s=>String(s??'').trim().toLowerCase();

  async function enhance(){
    const host=document.querySelector('#admin-accounts');
    if(!host||host.dataset.searchEnhanced==='1')return;
    host.dataset.searchEnhanced='loading';
    try{
      const r=await fetch('/api/admin/accounts',{headers:{Accept:'application/json'}});
      if(!r.ok)throw new Error(`HTTP ${r.status}`);
      const rows=await r.json();
      const panel=host.closest('.panel');
      if(!panel)return;
      const wrap=document.createElement('div');
      wrap.className='stack';
      wrap.innerHTML=`<label class="field"><span>Sök konto</span><input id="admin-account-search" type="search" autocomplete="off" placeholder="E-post eller konto-ID"></label><div class="hint" id="admin-account-count"></div>`;
      panel.insertBefore(wrap,host);
      const input=wrap.querySelector('#admin-account-search');
      const count=wrap.querySelector('#admin-account-count');

      function apply(){
        const q=norm(input.value);
        let visible=0;
        [...host.children].forEach((el,i)=>{
          const a=rows[i];
          const hit=!q||norm(a?.email).includes(q)||norm(a?.id).includes(q);
          el.hidden=!hit;
          if(hit)visible++;
        });
        count.textContent=q?`${visible} träff${visible===1?'':'ar'}`:`${rows.length} konton`;
      }
      input.addEventListener('input',apply);
      const pending=sessionStorage.getItem('admin:accountSearch');
      if(pending){input.value=pending;sessionStorage.removeItem('admin:accountSearch');}
      apply();
      host.dataset.searchEnhanced='1';
    }catch{
      host.dataset.searchEnhanced='0';
    }
  }

  const observer=new MutationObserver(()=>queueMicrotask(enhance));
  observer.observe(document.documentElement,{subtree:true,childList:true});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',enhance);else enhance();
})();
