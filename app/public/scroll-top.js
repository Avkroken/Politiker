(()=>{
  const STYLE_ID='scroll-top-style';
  const BUTTON_ID='scroll-top-button';
  const SHOW_AFTER=360;
  let activeScroller=null;

  function ensureStyle(){
    if(document.getElementById(STYLE_ID))return;
    const style=document.createElement('style');
    style.id=STYLE_ID;
    style.textContent=`
      #${BUTTON_ID}{
        position:fixed;
        right:max(16px,env(safe-area-inset-right));
        bottom:max(104px,calc(env(safe-area-inset-bottom) + 88px));
        z-index:95;
        display:flex;
        align-items:center;
        gap:.45rem;
        min-height:46px;
        padding:.72rem .95rem;
        border:1px solid var(--border,#36394a);
        border-radius:999px;
        background:color-mix(in srgb,var(--surface,#171a24) 94%,transparent);
        color:var(--text,#f5f5f7);
        box-shadow:0 10px 28px rgba(0,0,0,.32);
        backdrop-filter:blur(14px);
        -webkit-backdrop-filter:blur(14px);
        font:inherit;
        font-weight:700;
        cursor:pointer;
        opacity:0;
        transform:translateY(8px);
        visibility:hidden;
        pointer-events:none;
        transition:opacity .18s ease,transform .18s ease,border-color .18s ease;
      }
      #${BUTTON_ID}.is-visible{opacity:1;transform:none;visibility:visible;pointer-events:auto}
      #${BUTTON_ID}:hover,#${BUTTON_ID}:focus-visible{border-color:var(--accent,#9b87f5);outline:none}
      @media(max-width:640px){
        #${BUTTON_ID}{right:14px;bottom:max(112px,calc(env(safe-area-inset-bottom) + 96px));padding:.68rem .82rem}
      }
      @media (prefers-reduced-motion:reduce){#${BUTTON_ID}{transition:none}}
    `;
    document.head.append(style);
  }

  function documentScroller(){return document.scrollingElement||document.documentElement}
  function isScrollable(el){
    if(!(el instanceof Element))return false;
    const style=getComputedStyle(el);
    return /(auto|scroll|overlay)/.test(style.overflowY)&&el.scrollHeight>el.clientHeight+1;
  }
  function scrollerFor(target){
    for(let el=target instanceof Element?target:null;el&&el!==document.body;el=el.parentElement){if(isScrollable(el))return el}
    return documentScroller();
  }
  function position(el){
    if(el===documentScroller())return Math.max(window.scrollY||0,el.scrollTop||0,document.body.scrollTop||0);
    return Math.max(0,el.scrollTop||0);
  }
  function longEnough(el){
    if(el===documentScroller())return el.scrollHeight>window.innerHeight+260;
    return el.scrollHeight>el.clientHeight+260;
  }

  function ensureButton(){
    let button=document.getElementById(BUTTON_ID);
    if(button)return button;
    button=document.createElement('button');
    button.id=BUTTON_ID;
    button.type='button';
    button.setAttribute('aria-label','Till toppen');
    button.innerHTML='<span aria-hidden="true">↑</span><span>Till toppen</span>';
    button.addEventListener('click',()=>{
      const behavior=matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
      const scroller=activeScroller||documentScroller();
      if(scroller===documentScroller())window.scrollTo({top:0,left:0,behavior});
      else scroller.scrollTo({top:0,left:0,behavior});
    });
    document.body.append(button);
    return button;
  }

  function update(scroller=activeScroller||documentScroller()){
    activeScroller=scroller;
    const button=ensureButton();
    const shouldShow=longEnough(scroller)&&position(scroller)>SHOW_AFTER;
    button.classList.toggle('is-visible',shouldShow);
    button.setAttribute('aria-hidden',shouldShow?'false':'true');
    button.tabIndex=shouldShow?0:-1;
  }

  function init(){
    ensureStyle();
    ensureButton();
    let timer=0;
    const schedule=scroller=>{
      activeScroller=scroller||activeScroller||documentScroller();
      if(timer)return;
      timer=setTimeout(()=>{timer=0;update()},32);
    };
    document.addEventListener('scroll',event=>schedule(scrollerFor(event.target)),{passive:true,capture:true});
    addEventListener('scroll',()=>schedule(documentScroller()),{passive:true});
    addEventListener('resize',()=>schedule(activeScroller),{passive:true});
    addEventListener('hashchange',()=>setTimeout(()=>schedule(documentScroller()),0));
    addEventListener('pageshow',()=>setTimeout(()=>schedule(documentScroller()),0));
    document.addEventListener('app:rendered',()=>schedule(documentScroller()));
    update(documentScroller());
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
