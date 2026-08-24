ensureRecipientData=async function(){
  if(state.areas&&state.parties&&state.roles)return;
  // Statisk asset: ingen session/D1 behövs för filtermetadata. Hämta med
  // revalidering per sidladdning så en ny export används direkt.
  const resp=await fetch('/recipient-meta.json',{cache:'no-cache'});
  if(!resp.ok)throw new Error('Kunde inte ladda mottagarmetadata');
  const meta=await resp.json();
  if(!Array.isArray(meta.areas)||!Array.isArray(meta.parties)||!Array.isArray(meta.roles))throw new Error('Ogiltig mottagarmetadata');
  state.areas=meta.areas;state.parties=meta.parties;state.roles=meta.roles;
};

function localRecipientEstimate(){const selected=state.selectedAreas||new Set();if(!selected.size)return{count:(state.includeEmails?.size||0),approximate:false};let count=(state.areas||[]).reduce((sum,a)=>selected.has(a.area_name)?sum+Number(a.count||0):sum,0);if(state.excludeParties?.size)count-=(state.parties||[]).reduce((sum,p)=>selected.has(p.area_name)&&state.excludeParties.has(p.party)?sum+Number(p.count||0):sum,0);count+=state.includeEmails?.size||0;count-=state.excludeEmails?.size||0;return{count:Math.max(0,count),approximate:true}}
function paintLocalRecipientCount(){const estimate=localRecipientEstimate(),text=`${estimate.approximate?'≈ ':''}${num(estimate.count)} mottagare`;const e=$('#recipient-count');if(e){e.textContent=text;e.title='Beräknat lokalt från kontaktmetadata. Exakt mottagarlista fastställs först när utskicket startas.'}const r=$('#review-count');if(r){r.textContent=`${estimate.approximate?'≈ ':''}${num(estimate.count)}`;r.title='Exakt antal fastställs när utskicket startas.'}return estimate.count}
