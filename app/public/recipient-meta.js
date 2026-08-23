const RECIPIENT_META_CACHE_KEY='politiker:recipient-meta:v1';
const RECIPIENT_META_TTL_MS=6*60*60*1000;

function readRecipientMetaCache(){
  try{
    const cached=JSON.parse(localStorage.getItem(RECIPIENT_META_CACHE_KEY)||'null');
    if(!cached||!cached.savedAt||Date.now()-cached.savedAt>RECIPIENT_META_TTL_MS)return null;
    if(!Array.isArray(cached.areas)||!Array.isArray(cached.parties)||!Array.isArray(cached.roles))return null;
    return cached;
  }catch{return null}
}
function writeRecipientMetaCache(areas,parties,roles){
  try{localStorage.setItem(RECIPIENT_META_CACHE_KEY,JSON.stringify({savedAt:Date.now(),areas,parties,roles}))}catch{}
}

ensureRecipientData=async function(){
  if(state.areas&&state.parties&&state.roles)return;
  const cached=readRecipientMetaCache();
  if(cached){state.areas=cached.areas;state.parties=cached.parties;state.roles=cached.roles;return}
  const [areas,parties,roles]=await Promise.all([
    api('/api/areas'),api('/api/parties'),api('/api/roles')
  ]);
  state.areas=areas;state.parties=parties;state.roles=roles;
  writeRecipientMetaCache(areas,parties,roles);
};

function localRecipientEstimate(){
  const selected=state.selectedAreas||new Set();
  if(!selected.size)return{count:(state.includeEmails?.size||0),approximate:false};
  let count=(state.areas||[]).reduce((sum,a)=>selected.has(a.area_name)?sum+Number(a.count||0):sum,0);
  if(state.excludeParties?.size){
    count-=(state.parties||[]).reduce((sum,p)=>selected.has(p.area_name)&&state.excludeParties.has(p.party)?sum+Number(p.count||0):sum,0);
  }
  count+=state.includeEmails?.size||0;
  count-=state.excludeEmails?.size||0;
  return{count:Math.max(0,count),approximate:true};
}

function paintLocalRecipientCount(){
  const estimate=localRecipientEstimate();
  const text=`${estimate.approximate?'≈ ':''}${num(estimate.count)} mottagare`;
  const e=$('#recipient-count');if(e){e.textContent=text;e.title='Beräknat lokalt från kontaktmetadata. Exakt mottagarlista fastställs först när utskicket startas.'}
  const r=$('#review-count');if(r){r.textContent=`${estimate.approximate?'≈ ':''}${num(estimate.count)}`;r.title='Exakt antal fastställs när utskicket startas.'}
  return estimate.count;
}
