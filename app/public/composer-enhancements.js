(() => {
  const $ = (s, r = document) => r.querySelector(s);

  function subjectFromFilename(name) {
    return name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();
  }

  function setDraft(subject, body) {
    const subjectInput = $('#letter-subject');
    const bodyInput = $('#letter-body');
    if (!subjectInput || !bodyInput) return;
    subjectInput.value = subject;
    bodyInput.value = body;
    bodyInput.dataset.contentFormat = 'html';
    subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
    bodyInput.dispatchEvent(new Event('input', { bubbles: true }));
  }

  async function fileToHtml(file) {
    const ext = file.name.toLowerCase().split('.').pop();
    if (ext === 'docx') {
      if (!window.mammoth) throw new Error('DOCX-konverteraren kunde inte laddas. Försök igen.');
      const buffer = await file.arrayBuffer();
      const result = await window.mammoth.convertToHtml({ arrayBuffer: buffer });
      return result.value || '';
    }
    if (ext === 'html' || ext === 'htm') return await file.text();
    if (ext === 'txt') {
      const text = await file.text();
      return text.split(/\n{2,}/).map(p => `<p>${p.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\n/g,'<br>')}</p>`).join('\n');
    }
    throw new Error('Använd DOCX, HTML eller TXT för att fylla brevtexten automatiskt. PDF kan fortfarande bifogas.');
  }

  function ensurePreview(body) {
    let preview = $('#letter-html-preview');
    if (preview) return preview;
    preview = document.createElement('div');
    preview.id = 'letter-html-preview';
    preview.className = 'letter-html-preview';
    preview.hidden = true;
    body.insertAdjacentElement('afterend', preview);
    return preview;
  }

  function injectComposerTools() {
    const fileInput = $('#letter-files');
    if (!fileInput || fileInput.dataset.enhanced === '1') return;
    fileInput.dataset.enhanced = '1';

    const host = fileInput.closest('details') || fileInput.parentElement;
    const tools = document.createElement('div');
    tools.className = 'attachment-tools';
    tools.innerHTML = `
      <div class="button-row">
        <button type="button" class="secondary" id="use-file-as-letter">Använd filen som brev</button>
        <button type="button" class="secondary" id="preview-html" disabled>Förhandsvisa brevet</button>
      </div>
      <p class="attachment-mode-note">DOCX, HTML och TXT konverteras automatiskt till HTML när du använder filen som brev. Du behöver inte välja HTML-läge själv. Originalfilen ligger kvar som bilaga tills du väljer bort den.</p>
      <div id="attachment-tool-status" class="hint"></div>`;
    host.append(tools);

    $('#use-file-as-letter').onclick = async () => {
      const file = fileInput.files?.[0];
      const status = $('#attachment-tool-status');
      if (!file) {
        status.textContent = 'Välj en fil först.';
        return;
      }
      const button = $('#use-file-as-letter');
      button.disabled = true;
      status.textContent = 'Läser dokumentet…';
      try {
        const html = await fileToHtml(file);
        if (!html.trim()) throw new Error('Dokumentet innehöll ingen läsbar text.');
        setDraft(subjectFromFilename(file.name), html);
        status.textContent = 'Ämnesrad och brevtext fylldes från dokumentet och skickas automatiskt som HTML.';
        const badge = document.createElement('span');
        badge.className = 'html-mode-badge';
        badge.textContent = 'HTML från bilaga';
        const bodyLabel = $('#letter-body')?.closest('.field')?.querySelector('span');
        if (bodyLabel && !bodyLabel.querySelector('.html-mode-badge')) bodyLabel.append(badge);
        $('#preview-html').disabled = false;
      } catch (err) {
        status.textContent = err instanceof Error ? err.message : String(err);
      } finally {
        button.disabled = false;
      }
    };

    $('#preview-html').onclick = () => {
      const body = $('#letter-body');
      if (!body) return;
      const preview = ensurePreview(body);
      const showingPreview = !preview.hidden;
      if (showingPreview) {
        preview.hidden = true;
        body.hidden = false;
        $('#preview-html').textContent = 'Förhandsvisa brevet';
        return;
      }
      preview.innerHTML = body.value;
      body.hidden = true;
      preview.hidden = false;
      $('#preview-html').textContent = 'Visa HTML-kod';
    };
  }

  const observer = new MutationObserver(injectComposerTools);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  injectComposerTools();
})();