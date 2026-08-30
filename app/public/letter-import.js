(function installLetterImport(global){
  const COMMON_MOJIBAKE=/(?:Ã¥|Ã¤|Ã¶|Ã…|Ã„|Ã–|Ã©|Ã¨|Ã¼|Ã±|â€“|â€”|â€™|â€œ|â€|â€¦|Â |ï¿½)/;
  const SAFE_TAGS=new Set(['p','br','strong','em','b','i','u','ul','ol','li','blockquote','h1','h2','h3','div','span','a']);
  const DROP_TAGS=new Set(['script','style','iframe','object','embed','svg','math','form','input','button','textarea','select','option','link','meta','base']);

  function normalizeCharset(value){
    const charset=String(value||'').trim().toLowerCase().replace(/["']/g,'');
    if(!charset)return null;
    if(charset==='utf8')return'utf-8';
    if(['latin1','latin-1','iso-8859-1','iso8859-1','cp1252','x-cp1252'].includes(charset))return'windows-1252';
    return charset;
  }

  function sniffHtmlCharset(bytes){
    const sample=new TextDecoder('windows-1252').decode(bytes.subarray(0,Math.min(bytes.length,4096)));
    const direct=sample.match(/<meta\b[^>]*\bcharset\s*=\s*["']?\s*([^\s"'/>;]+)/i);
    if(direct)return normalizeCharset(direct[1]);
    const content=sample.match(/<meta\b[^>]*\bcontent\s*=\s*["'][^"']*charset\s*=\s*([^\s"';>]+)/i);
    return normalizeCharset(content?.[1]);
  }

  function validateText(text){
    if(text.includes('\uFFFD'))throw new Error('Texten innehåller trasiga ersättningstecken (�). Importen stoppades så att de inte skickas vidare.');
    if(/[\u0000\u0001-\u0008\u000B\u000C\u000E-\u001F]/.test(text))throw new Error('Texten innehåller ogiltiga kontrolltecken och kan inte importeras säkert.');
    if(COMMON_MOJIBAKE.test(text))throw new Error('Texten ser felkodad ut (t.ex. Ã¥/â€“). Importen stoppades. Spara dokumentet som UTF-8 eller Windows-1252 och försök igen.');
    return text;
  }

  function decodeTextBytes(input,{html=false}={}){
    const bytes=input instanceof Uint8Array?input:new Uint8Array(input);
    const candidates=[];
    if(bytes.length>=3&&bytes[0]===0xEF&&bytes[1]===0xBB&&bytes[2]===0xBF)candidates.push('utf-8');
    else if(bytes.length>=2&&bytes[0]===0xFF&&bytes[1]===0xFE)candidates.push('utf-16le');
    else if(bytes.length>=2&&bytes[0]===0xFE&&bytes[1]===0xFF)candidates.push('utf-16be');
    if(html){const declared=sniffHtmlCharset(bytes);if(declared)candidates.push(declared)}
    candidates.push('utf-8','windows-1252');
    let lastError=null;
    for(const encoding of [...new Set(candidates)]){
      try{
        const text=new TextDecoder(encoding,{fatal:true}).decode(bytes);
        validateText(text);
        return{text,encoding};
      }catch(error){lastError=error}
    }
    if(lastError instanceof Error&&/felkodad|trasiga|kontrolltecken/.test(lastError.message))throw lastError;
    throw new Error('Alla tecken i dokumentet kunde inte avkodas korrekt. Importen stoppades.');
  }

  async function readFileText(file,{html=false}={}){
    return decodeTextBytes(new Uint8Array(await file.arrayBuffer()),{html}).text;
  }

  function escapeHtmlText(value){
    return String(value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  function textToHtml(text){
    validateText(text);
    const normalized=String(text).replace(/\r\n?/g,'\n').trim();
    if(!normalized)return'';
    return normalized.split(/\n{2,}/).map(para=>`<p>${escapeHtmlText(para).replace(/\n/g,'<br>')}</p>`).join('\n');
  }

  function requireDom(){
    if(typeof DOMParser==='undefined'||typeof document==='undefined')throw new Error('HTML-import stöds inte i den här miljön.');
  }

  function safeHref(value){
    const href=String(value||'').trim();
    return /^(?:https?:|mailto:)/i.test(href)?href:null;
  }

  function sanitizeHtml(html){
    requireDom();
    const parsed=new DOMParser().parseFromString(String(html||''),'text/html');
    for(const el of [...parsed.body.querySelectorAll('*')]){
      const tag=el.tagName.toLowerCase();
      if(DROP_TAGS.has(tag)){el.remove();continue}
      if(!SAFE_TAGS.has(tag)){el.replaceWith(...el.childNodes);continue}
      const href=tag==='a'?safeHref(el.getAttribute('href')):null;
      for(const attr of [...el.attributes])el.removeAttribute(attr.name);
      if(tag==='a'&&href){el.setAttribute('href',href);el.setAttribute('rel','noopener noreferrer')}
    }
    validateText(parsed.body.textContent||'');
    return parsed.body.innerHTML;
  }

  function htmlToText(html){
    requireDom();
    const parsed=new DOMParser().parseFromString(sanitizeHtml(html),'text/html');
    for(const br of [...parsed.body.querySelectorAll('br')])br.replaceWith('\n');
    for(const el of [...parsed.body.querySelectorAll('p,div,li,blockquote,h1,h2,h3')])el.append('\n');
    const text=(parsed.body.textContent||'').replace(/\u00a0/g,' ').replace(/[ \t]+\n/g,'\n').replace(/\n{3,}/g,'\n\n').trim();
    validateText(text);
    return text;
  }

  function normalizeStoredHtml(value){
    const text=String(value||'');
    if(!text)return'';
    return /<\/?(?:p|br|div|strong|em|b|i|u|ul|ol|li|blockquote|h[1-3]|span|a)\b/i.test(text)?sanitizeHtml(text):textToHtml(text);
  }

  global.PolitikerLetterImport={decodeTextBytes,readFileText,validateText,textToHtml,sanitizeHtml,htmlToText,normalizeStoredHtml,sniffHtmlCharset};
})(globalThis);
