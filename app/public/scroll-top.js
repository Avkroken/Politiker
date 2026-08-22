(()=>{
  const STYLE_ID='scroll-top-style';
  const BUTTON_ID='scroll-top-button';
  const SHOW_AFTER=360;

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #${BUTTON_ID}{
        position:fixed;
        right:max(14px,env(safe-area-inset-right));
        bottom:max(108px,calc(env(safe-area-inset-bottom) + 92px));
        z-index:2147483000;
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        padding:0;
        border:1px solid var(--accent,#9b87f5);
        border-radius:999px;
        background:var(--surface,#171a24);
        color:var(--accent,#9b87f5);
        box-shadow:0 8px 24px rgba(0,0,0,.34);
        font:inherit;
        font-size:1.45rem;
        font-weight:800;
        line-height:1;
        cursor:pointer;
        opacity:0;
        visibility:hidden;
        pointer-events:none;
        transform:translateY(6px);
        transition:opacity .16s ease,transform .16s ease;
        -webkit-tap-highlight-color:transparent;
      }
      #${BUTTON_ID}.is-visible{opacity:1;visibility:visible;pointer-events:auto;transform:none}
      #${BUTTON_ID}:focus-visible{outline:2px solid var(--accent,#9b87f5);outline-offset:3px}
      @media(min-width:641px){#${BUTTON_ID}{width:auto;min-width:48px;padding:0 .9rem;font-size:1rem}#${BUTTON_ID} .label{display:inline;margin-left:.4rem}}
      @media(max-width:640px){#${BUTTON_ID} .label{display:none}}
      @media(prefers-reduced-motion:reduce){#${BUTTON_ID}{transition:none}}
    `;
    document.head.append(style);
  }

  function rootScroller(){return document.scrollingElement||document.documentElement}
  function rootPosition(){
    const root=rootScroller();
    return Math.max(window.scrollY||window.pageYOffset||0,root?.scrollTop||0,document.documentElement.scrollTop||0,document.body?.scrollTop||0);
  }
  function rootLongEnough(){
    const root=rootScroller();
    return Math.max(root?.scrollHeight||0,document.documentElement.scrollHeight||0,document.body?.scrollHeight||0)>window.innerHeight+260;
  }
  function scrollableAncestor(node){
    for(let el=node instanceof Element?node:null;el&&el!==document.body;el=el.parentElement){
      const css=getComputedStyle(el);
      if(/(auto|scroll|overlay)/.test(css.overflowY)&&el.scrollHeight>el.clientHeight+1)return el;
    }
    return null;
  }

  let lastElementScroller=null;
  function currentPosition(){return Math.max(rootPosition(),lastElementScroller?.scrollTop||0)}
  function pageLongEnough(){return rootLongEnough()||!!(lastElementScroller&&lastElementScroller.scrollHeight>lastElementScroller.clientHeight+260)}

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
      if(lastElementScroller&&lastElementScroller.scrollTop>0)lastElementScroller.scrollTo({top:0,left:0,behavior});
      window.scrollTo({top:0,left:0,behavior});
      const root=rootScroller();
      if(root)root.scrollTo({top:0,left:0,behavior});
    });
    document.body.append(button);
    return button;
  }

  function update(){
    const button=ensureButton();
    const visible=pageLongEnough()&&currentPosition()>SHOW_AFTER;
    button.classList.toggle('is-visible',visible);
    button.setAttribute('aria-hidden',visible?'false':'true');
    button.tabIndex=visible?0:-1;
  }

  function init(){
    ensureStyle();
    ensureButton();
    let timer=0;
    const schedule=()=>{
      if(timer)return;
      timer=setTimeout(()=>{timer=0;update()},32);
    };

    document.addEventListener('scroll',event=>{
      const scroller=scrollableAncestor(event.target);
      if(scroller)lastElementScroller=scroller;
      schedule();
    },{passive:true,capture:true});
    window.addEventListener('scroll',schedule,{passive:true});
    window.visualViewport?.addEventListener('scroll',schedule,{passive:true});
    window.addEventListener('resize',schedule,{passive:true});
    window.addEventListener('hashchange',()=>setTimeout(schedule,0));
    window.addEventListener('pageshow',()=>setTimeout(schedule,0));
    document.addEventListener('app:rendered',schedule);
    document.addEventListener('touchmove',schedule,{passive:true});
    update();
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
