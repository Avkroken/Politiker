(()=>{
  const STYLE_ID='scroll-top-style';
  const BUTTON_ID='scroll-top-button';

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #${BUTTON_ID}{position:fixed;right:max(12px,env(safe-area-inset-right));bottom:max(108px,calc(env(safe-area-inset-bottom) + 92px));z-index:2147483000;width:48px;height:48px;display:none;place-items:center;padding:0;border:1px solid var(--accent,#9b87f5);border-radius:999px;background:var(--surface,#171a24);color:var(--accent,#9b87f5);box-shadow:0 8px 24px rgba(0,0,0,.34);font:inherit;font-size:1.45rem;font-weight:800;line-height:1;cursor:pointer;-webkit-tap-highlight-color:transparent}
      #${BUTTON_ID}.is-visible{display:grid!important}
      #${BUTTON_ID}:focus-visible{outline:2px solid var(--accent,#9b87f5);outline-offset:3px}
      @media(min-width:641px){#${BUTTON_ID}{width:auto;min-width:48px;padding:0 .9rem;font-size:1rem}#${BUTTON_ID} .label{display:inline;margin-left:.4rem}}
      @media(max-width:640px){#${BUTTON_ID} .label{display:none}}
    `;
    document.head.append(style);
  }

  function pageLongEnough(){
    const root=document.scrollingElement||document.documentElement;
    return Math.max(root?.scrollHeight||0,document.body?.scrollHeight||0)>window.innerHeight+260;
  }

  function ensureButton(){
    let button=document.getElementById(BUTTON_ID);
    if(button)return button;
    button=document.createElement('button');
    button.id=BUTTON_ID;
    button.type='button';
    button.setAttribute('aria-label','Till toppen');
    button.innerHTML='<span aria-hidden="true">↑</span><span class="label">Till toppen</span>';
    button.addEventListener('click',()=>{
      const behavior=matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
      window.scrollTo({top:0,left:0,behavior});
      const root=document.scrollingElement||document.documentElement;
      if(root&&root.scrollTop)root.scrollTo({top:0,left:0,behavior});
    });
    document.body.append(button);
    return button;
  }

  function update(){
    const button=ensureButton();
    const visible=document.body.dataset.mode==='app'&&pageLongEnough();
    button.classList.toggle('is-visible',visible);
    button.setAttribute('aria-hidden',visible?'false':'true');
    button.tabIndex=visible?0:-1;
  }

  function init(){
    ensureStyle();
    ensureButton();
    let raf=0;
    const schedule=()=>{if(raf)return;raf=requestAnimationFrame(()=>{raf=0;update()})};
    window.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule,{passive:true});
    window.addEventListener('hashchange',()=>setTimeout(schedule,0));
    window.addEventListener('pageshow',()=>setTimeout(schedule,0));
    new MutationObserver(schedule).observe(document.body,{attributes:true,attributeFilter:['data-mode'],childList:true,subtree:true});
    update();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
