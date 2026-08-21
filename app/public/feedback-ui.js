(()=>{
  function $(s,r=document){return r.querySelector(s)}
  async function readMe(){try{const r=await fetch('/api/me',{headers:{Accept:'application/json'}});return r.ok?await r.json():null}catch{return null}}
  function openFeedback(){
    const modal=$('#modal'), title=$('#modal-title'), body=$('#modal-body');
    if(!modal||!title||!body)return;
    title.textContent='Kontakt och feedback';
    body.innerHTML=`<form id="feedback-form" class="stack">
      <p class="hint">Skicka en fråga, idé eller synpunkt direkt till administratören. E-post är valfritt.</p>
      <label class="field"><span>Meddelande</span><textarea id="feedback-message" rows="7" maxlength="5000" required placeholder="Skriv ditt meddelande…"></textarea></label>
      <label class="field"><span>E-post (valfritt)</span><input id="feedback-email" type="email" autocomplete="email" placeholder="namn@example.com"></label>
      <label class="check-row"><input id="feedback-reply" type="checkbox"><span>Jag vill ha återkoppling via e-post</span></label>
      <p class="hint" id="feedback-reply-hint">E-postadressen används bara för att svara på detta ärende.</p>
      <button class="primary" type="submit">Skicka</button>
      <div id="feedback-result"></div>
    </form>`;
    modal.classList.add('open');
    const email=$('#feedback-email'), reply=$('#feedback-reply'), result=$('#feedback-result');
    readMe().then(me=>{if(me?.email&&!email.value)email.value=me.email});
    reply.onchange=()=>{email.required=reply.checked};
    $('#feedback-form').onsubmit=async e=>{
      e.preventDefault();
      const message=$('#feedback-message').value.trim();
      const wantsReply=reply.checked;
      const replyTo=email.value.trim();
      if(!message)return;
      if(wantsReply&&!replyTo){result.innerHTML='<div class="notice error">Fyll i en e-postadress om du vill ha återkoppling.</div>';return}
      const button=e.submitter; if(button)button.disabled=true;
      try{
        const r=await fetch('/api/feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message,type:'contact',replyTo:wantsReply?replyTo:undefined})});
        const data=await r.json().catch(()=>({}));
        if(!r.ok)throw new Error(data.error||`HTTP ${r.status}`);
        result.innerHTML='<div class="notice success">Tack. Meddelandet är skickat.</div>';
        $('#feedback-message').value='';
      }catch(err){result.innerHTML=`<div class="notice error">${String(err.message||err)}</div>`}
      finally{if(button)button.disabled=false}
    };
  }
  function bind(){
    document.querySelectorAll('[data-feedback-open]').forEach(el=>{el.addEventListener('click',e=>{e.preventDefault();document.querySelector('#drawer')?.classList.remove('open');openFeedback()})});
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind);else bind();
})();
