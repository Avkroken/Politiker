const RECIPIENT_META_CACHE_KEY='politiker:recipient-meta:v2';
const RECIPIENT_META_TTL_MS=6*60*60*1000;

function readRecipientMetaCache(){try{const c=JSON.parse(localStorage.getItem(RECIPIENT_META_CACHE_KEY)||'null');if(!c||!c.savedAt||Date.now()-c.savedAt>RECIPIENT_META_TTL_MS)return null;if(!Array.isArray(c.areas)||!Array.isArray(c.parties)||!Array.isArray(c.roles))return null;return c}catch{return null}}
function writeRecipientMetaCache(meta){try{localStorage.setItem(RECIPIENT_META_CACHE_KEY,JSON.stringify({...meta,savedAt:Date.now()}))}catch{}}

ensureRecipientData=async function(){
  if(state.areas&&state.parties&&state.roles)return;
  const cached=readRecipientMetaCache();
  if(cached){state.areas=cached.areas;state.parties=cached.parties;state.roles=cached.roles;return}
  // Statisk asset: ingen session/D1 behövs för filtermetadata. Exportjobbet
  // uppdaterar filen när kontaktregistret saneras eller skrapas om.
  const resp=await fetch('/recipient-meta.json',{cache:'force-cache'});
  if(!resp.ok)throw new Error('Kunde inte ladda mottagarmetadata');
  const meta=await resp.json();
  if(!Array.isArray(meta.areas)||!Array.isArray(meta.parties)||!Array.isArray(meta.roles))throw new Error('Ogiltig mottagarmetadata');
  state.areas=meta.areas;state.parties=meta.parties;state.roles=meta.roles;
  writeRecipientMetaCache(meta);
};

function localRecipientEstimate(){const selected=state.selectedAreas||new Set();if(!selected.size)return{count:(state.includeEmails?.size||0),approximate:false};let count=(state.areas||[]).reduce((sum,a)=>selected.has(a.area_name)?sum+Number(a.count||0):sum,0);if(state.excludeParties?.size)count-=(state.parties||[]).reduce((sum,p)=>selected.has(p.area_name)&&state.excludeParties.has(p.party)?sum+Number(p.count||0):sum,0);count+=state.includeEmails?.size||0;count-=state.excludeEmails?.size||0;return{count:Math.max(0,count),approximate:true}}
function paintLocalRecipientCount(){const estimate=localRecipientEstimate(),text=`${estimate.approximate?'≈ ':''}${num(estimate.count)} mottagare`;const e=$('#recipient-count');if(e){e.textContent=text;e.title='Beräknat lokalt från kontaktmetadata. Exakt mottagarlista fastställs först när utskicket startas.'}const r=$('#review-count');if(r){r.textContent=`${estimate.approximate?'≈ ':''}${num(estimate.count)}`;r.title='Exakt antal fastställs när utskicket startas.'}return estimate.count}
