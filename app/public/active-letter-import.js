(function installActiveLetterImport(){
  const originalShowModal=window.showModal;
  if(typeof originalShowModal!=='function')return;

  let mammothPromise;
  function loadMammoth(){
    if(window.mammoth)return Promise.resolve(window.mammoth);
    if(mammothPromise)return mammothPromise;
    mammothPromise=new Promise((resolve,reject)=>{
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/mammoth/mammoth.browser.min.js';
      script.async=true;
      script.onload=()=>resolve(window.mammoth);
      script.onerror=()=>reject(new Error('Word-importen kunde inte laddas.'));
      document.head.append(script);
    });
    return mammothPromise;
  }

  function tools(){
    if(!window.PolitikerLetterImport)throw new Error('Dokumentimporten kunde inte laddas. Ladda om sidan.');
    return window.PolitikerLetterImport;
  }

  async function fileToText(file){
    const ext=file.name.toLowerCase().split('.').pop();
    const t=tools();
    if(ext==='docx'){
      const mammoth=await loadMammoth();
      const html=(await mammoth.convertToHtml({arrayBuffer:await file.arrayBuffer()})).value||'';
      return t.htmlToText(t.sanitizeHtml(html));
    }
    if(ext==='html'||ext==='htm'){
      const html=await t.readFileText(file,{html:true});
      return t.htmlToText(t.sanitizeHtml(html));
    }
    if(ext==='txt')return t.validateText(await t.readFileText(file));
    throw new Error('Bara DOCX, HTML och TXT kan importeras som ny brevtext.');
  }

  window.showModal=function(title,html){
    originalShowModal(title,html);
    if(title!=='Redigera kvarvarande brev')return;

    const form=document.querySelector('#letter-edit-form');
    const editor=document.querySelector('#job-letter-body');
    if(!form||!editor||form.querySelector('#job-letter-import'))return;

    const details=document.createElement('details');
    details.className='details';
    details.innerHTML='<summary>Importera brevet på nytt</summary><div class="stack"><input class="input" type="file" id="job-letter-file" accept=".txt,.docx,.html,.htm"><button class="button button--secondary" id="job-letter-import" type="button">Importera och ersätt brevtext</button><p class="muted">DOCX, HTML och TXT kontrolleras för trasiga tecken. Importen ersätter texten i redigeraren; spara sedan med “Uppdatera kvarvarande brev”.</p></div>';
    const submit=form.querySelector('button[type="submit"]');
    form.insertBefore(details,submit);

    const input=details.querySelector('#job-letter-file');
    const importButton=details.querySelector('#job-letter-import');
    importButton.onclick=async()=>{
      const file=input.files?.[0];
      if(!file)return notice('Välj ett dokument att importera.','error');
      importButton.disabled=true;
      try{
        const text=await fileToText(file);
        tools().validateText(text);
        editor.value=text;
        notice('Dokumentet importerades och teckenkodningen kontrollerades. Kontrollera texten och spara ändringen.','success');
      }catch(error){
        notice(error instanceof Error?error.message:'Dokumentet kunde inte importeras.','error');
      }finally{
        importButton.disabled=false;
      }
    };
  };
})();
