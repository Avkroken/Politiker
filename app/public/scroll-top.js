(()=>{
  const STYLE_ID='scroll-top-style';
  const BUTTON_ID='scroll-top-button';
  const SHOW_AFTER=650;

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #${BUTTON_ID}{
        position:fixed;
        right:max(18px,env(safe-area-inset-right));
        bottom:max(92px,calc(env(safe-area-inset-bottom) + 76px));
        z-index:80;
        display:flex;
        align-items:center;
        gap:.45rem;
        min-height:46px;
        padding:.72rem .95rem;
        border:1px solid var(--border,#36394a);
        border-radius:999px;
        background:color-mix(in srgb,var(--surface,#171a24) 92%,transparent);
        color:var(--text,#f5f5f7);
        box-shadow:0 10px 28px rgba(0,0,0,.28);
        backdrop-filter:blur(14px);
        -webkit-backdrop-filter:blur(14px);
        font:inherit;
        font-weight:700;
        cursor:pointer;
        opacity:0;
        transform:translateY(8px);
        pointer-events:none;
        transition:opacity .18s ease,transform .18s ease,border-color .18s ease;
      }
      #${BUTTON_ID}.is-visible{opacity:1;transform:none;pointer-events:auto}
      #${BUTTON_ID}:hover,#${BUTTON_ID}:focus-visible{border-color:var(--accent,#9b87f5);outline:none}
      @media (max-width:640px){
        #${BUTTON_ID}{right:16px;bottom:max(98px,calc(env(safe-area-inset-bottom) + 82px));padding:.68rem .82rem}
      }
      @media (prefers-reduced-motion:reduce){#${BUTTON_ID}{transition:none}}
    `;
    document.head.append(style);
  }

  function ensureButton(){
    let button=document.getElementById(BUTTON_ID);
    if(button)return button;
    button=document.createElement('button');
    button.id=BUTTON_ID;
    button.type='button';
    button.setAttribute('aria-label','Till toppen');
    button.innerHTML='<span aria-hidden="true">↑</span><span>Till toppen</span>';
    button.addEventListener('click',()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'}));
    document.body.append(button);
    return button;
  }

  function update(){
    const button=ensureButton();
    const pageIsLong=document.documentElement.scrollHeight>window.innerHeight+500;
    const shouldShow=pageIsLong&&window.scrollY>SHOW_AFTER;
    button.classList.toggle('is-visible',shouldShow);
    button.setAttribute('aria-hidden',shouldShow?'false':'true');
    button.tabIndex=shouldShow?0:-1;
  }

  function init(){
    ensureStyle();
    ensureButton();
    let ticking=false;
    const schedule=()=>{if(ticking)return;ticking=true;requestAnimationFrame(()=>{ticking=false;update()})};
    addEventListener('scroll',schedule,{passive:true});
    addEventListener('resize',schedule,{passive:true});
    addEventListener('hashchange',()=>setTimeout(schedule,0));
    new MutationObserver(schedule).observe(document.body,{subtree:true,childList:true});
    update();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
