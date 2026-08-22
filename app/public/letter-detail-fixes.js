(()=>{
  const $=(s,r=document)=>r.querySelector(s);
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  // admin-account-search.js kunde tidigare kasta i ett kort race-fönster när
  // brevdetaljen renderades om och knapparna ännu inte fanns i DOM:en.
  window.addEventListener('error',event=>{
    const msg=String(event.message||event.error?.message||'');
    if(msg.includes("null is not an object")&&msg.includes('#letter-edit')){
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  },true);

  async function json(path,options={}){
    const r=await fetch(path,{...options,headers:{'Content-Type':'application/json',Accept:'application/json',...(options.headers||{})}});
    const d=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(d.error||`HTTP ${r.status}`);
    return d;
  }

  function showError(error){
    const box=$('#global-notices');
    if(!box)return;
    box.innerHTML=`<div class="notice error">${esc(error?.message||error)}</div>`;
  }

  function openModal(title,html){
    const modal=$('#modal');
    if(!modal)return;
    $('#modal-title').textContent=title;
    $('#modal-body').innerHTML=html;
    modal.classList.add('open');
  }

  function bindLetterActions(){
    const m=location.hash.match(/^#letters\/([^/]+)$/);
    if(!m)return;
    const id=decodeURIComponent(m[1]);
    const edit=$('#letter-edit');
    const del=$('#letter-delete');

    if(edit&&!edit.dataset.bound){
      edit.dataset.bound='1';
      edit.onclick=async()=>{
        try{
          const x=await json(`/api/public/letters/${encodeURIComponent(id)}`);
          openModal('Redigera brev',`<div class="stack"><label class="field"><span>Ämne</span><input id="edit-letter-subject" value="${esc(x.subject)}"></label><label class="field"><span>Brev</span><textarea id="edit-letter-body" rows="14">${esc(x.body)}</textarea></label><button class="primary" id="save-letter" type="button">Spara</button></div>`);
          setTimeout(()=>{
            const save=$('#save-letter');
            if(!save)return;
            save.onclick=async()=>{
              try{
                await json(`/api/admin/public-letters/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({subject:$('#edit-letter-subject')?.value||'',body:$('#edit-letter-body')?.value||''})});
                $('#modal')?.classList.remove('open');
                location.reload();
              }catch(error){showError(error)}
            };
          },0);
        }catch(error){showError(error)}
      };
    }

    if(del&&!del.dataset.bound){
      del.dataset.bound='1';
      del.onclick=async()=>{
        const yes=window.appConfirm?await window.appConfirm({title:'Ta bort brevet?',message:'Det publicerade brevet raderas permanent.',confirmLabel:'Ta bort'}):false;
        if(!yes)return;
        try{
          await json(`/api/admin/public-letters/${encodeURIComponent(id)}`,{method:'DELETE'});
          location.hash='#letters';
        }catch(error){showError(error)}
      };
    }
  }

  function ensureTopButton(){
    let button=$('#back-to-top');
    if(button)return button;
    button=document.createElement('button');
    button.id='back-to-top';
    button.type='button';
    button.className='back-to-top secondary';
    button.setAttribute('aria-label','Till toppen');
    button.textContent='↑ Till toppen';
    button.hidden=true;
    button.onclick=()=>window.scrollTo({top:0,behavior:'smooth'});
    document.body.append(button);

    const style=document.createElement('style');
    style.textContent=`
      .back-to-top{position:fixed;right:max(18px,env(safe-area-inset-right));bottom:calc(92px + env(safe-area-inset-bottom));z-index:80;width:auto;min-width:0;padding:10px 14px;border-radius:999px;box-shadow:0 10px 30px rgba(0,0,0,.28);backdrop-filter:blur(12px)}
      .back-to-top[hidden]{display:none!important}
      @media (min-width:900px){.back-to-top{bottom:24px;right:24px}}
    `;
    document.head.append(style);
    return button;
  }

  function updateTopButton(){
    const button=ensureTopButton();
    const longPage=document.documentElement.scrollHeight>window.innerHeight*1.6;
    button.hidden=!(longPage&&window.scrollY>650);
  }

  const observer=new MutationObserver(()=>{
    queueMicrotask(bindLetterActions);
    queueMicrotask(updateTopButton);
  });
  observer.observe(document.documentElement,{subtree:true,childList:true});
  window.addEventListener('scroll',updateTopButton,{passive:true});
  window.addEventListener('resize',updateTopButton,{passive:true});
  window.addEventListener('hashchange',()=>{queueMicrotask(bindLetterActions);queueMicrotask(updateTopButton)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{bindLetterActions();updateTopButton()});
  else{bindLetterActions();updateTopButton()}
})();
