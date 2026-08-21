(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const PROVIDERS = {
    google: {
      name: 'Google',
      logo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.23-.2-1.77H12v3.4h5.52a4.75 4.75 0 0 1-2.05 3.03l2.93 2.27c1.71-1.58 3.2-3.91 3.2-6.93Z"/><path fill="#34A853" d="M12 22c2.7 0 4.97-.89 6.62-2.42l-2.93-2.27c-.81.55-1.85.94-3.69.94-2.82 0-5.2-1.9-6.05-4.46l-3.03 2.34A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M5.95 13.79A6 6 0 0 1 5.64 12c0-.62.11-1.22.3-1.79L2.92 7.87A10 10 0 0 0 2 12c0 1.48.32 2.88.92 4.13l3.03-2.34Z"/><path fill="#EA4335" d="M12 5.75c1.92 0 3.23.83 3.97 1.52l2.9-2.83C17.08 2.78 14.7 2 12 2a10 10 0 0 0-9.08 5.87l3.03 2.34C6.8 7.65 9.18 5.75 12 5.75Z"/></svg>`,
    },
    github: {
      name: 'GitHub',
      logo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 .7a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2.03c-3.22.7-3.9-1.37-3.9-1.37-.52-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.71.08-.71 1.17.08 1.78 1.2 1.78 1.2 1.04 1.78 2.72 1.27 3.38.97.1-.75.4-1.27.74-1.56-2.57-.29-5.27-1.29-5.27-5.69 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.47.11-3.05 0 0 .97-.31 3.16 1.18A10.9 10.9 0 0 1 12 6.31c.98 0 1.95.13 2.87.39 2.2-1.49 3.16-1.18 3.16-1.18.63 1.58.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.71 5.39-5.29 5.68.42.36.79 1.07.79 2.16v3.05c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .7Z"/></svg>`,
    },
    microsoft: {
      name: 'Microsoft',
      logo: `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#f25022" d="M2 2h9.5v9.5H2z"/><path fill="#7fba00" d="M12.5 2H22v9.5h-9.5z"/><path fill="#00a4ef" d="M2 12.5h9.5V22H2z"/><path fill="#ffb900" d="M12.5 12.5H22V22h-9.5z"/></svg>`,
    },
  };

  function formatDate(value) {
    return value ? new Date(value).toLocaleString('sv-SE') : '';
  }

  async function json(path, options = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  }

  let oauthBusy = false;
  async function enhanceOAuthList() {
    const list = $('#oauth-list');
    if (!list || list.dataset.rich === '1' || oauthBusy) return;
    oauthBusy = true;
    try {
      const identities = await json('/api/oauth-identities');
      if (!document.contains(list)) return;
      list.innerHTML = '';
      list.dataset.rich = '1';
      if (!identities.length) {
        list.innerHTML = '<div class="empty">Inga externa inloggningar länkade.</div>';
        return;
      }
      for (const identity of identities) {
        const provider = PROVIDERS[identity.provider] || { name: identity.provider, logo: '' };
        const card = document.createElement('div');
        card.className = 'credential-card oauth-identity-card';
        const email = identity.provider_email
          ? `<div class="oauth-email">${escapeHtml(identity.provider_email)}</div>`
          : '<div class="hint oauth-email">Mailadress sparas nästa gång du använder den här inloggningen.</div>';
        card.innerHTML = `
          <div class="oauth-identity-main">
            <span class="oauth-provider-logo">${provider.logo}</span>
            <div class="oauth-identity-copy">
              <strong class="oauth-provider-name">${escapeHtml(provider.name)}</strong>
              ${email}
              <div class="hint">Kopplad ${formatDate(identity.created_at)}</div>
            </div>
          </div>
          <button class="danger oauth-unlink" type="button">Koppla bort</button>`;
        $('.oauth-unlink', card).onclick = async () => {
          try {
            await json(`/api/oauth-identities/${encodeURIComponent(identity.provider)}`, { method: 'DELETE' });
            list.dataset.rich = '0';
            await enhanceOAuthList();
          } catch (error) {
            showNotice(error.message);
          }
        };
        list.append(card);
      }
    } catch (_) {
      // Låt ordinarie frontend visa sitt fallback-läge om API-anropet misslyckas.
    } finally {
      oauthBusy = false;
    }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function showNotice(message) {
    const box = $('#global-notices');
    if (!box) return;
    const notice = document.createElement('div');
    notice.className = 'notice error';
    notice.textContent = message;
    box.replaceChildren(notice);
  }

  let jobsBusy = false;
  async function enhanceCancelButtons() {
    const cards = $$('.job-card');
    if (!cards.length || jobsBusy) return;
    const pending = cards.filter(card => !card.dataset.safeCancel);
    if (!pending.length) return;
    jobsBusy = true;
    try {
      const jobs = await json('/api/send-jobs');
      cards.forEach((card, index) => {
        const job = jobs[index];
        if (!job) return;
        card.dataset.jobId = job.id;
        card.dataset.safeCancel = '1';
        const cancel = $$('.button-row button', card).find(button => button.textContent.trim() === 'Avbryt');
        if (!cancel) return;
        const safeButton = cancel.cloneNode(true);
        cancel.replaceWith(safeButton);
        safeButton.onclick = () => openCancelDialog(job);
      });
    } catch (_) {
      // Behåll ordinarie knapp om jobblistan inte kan hämtas.
    } finally {
      jobsBusy = false;
    }
  }

  function openCancelDialog(job) {
    const sent = Number(job.sent_count || 0);
    const failed = Number(job.bounce_count || 0);
    const total = Number(job.total_recipients || 0);
    const remaining = Math.max(0, total - sent - failed);
    const body = document.createElement('div');
    body.className = 'stack cancel-confirmation';
    body.innerHTML = `
      <div class="notice warn">
        <strong>Avbryt utskick?</strong><br>
        ${remaining.toLocaleString('sv-SE')} mottagare återstår. Redan skickade brev påverkas inte.
      </div>
      <p class="hint">Utskicket kan inte fortsätta automatiskt efter att det avbrutits. Du kan senare använda Försök igen för kvarvarande eller misslyckade mottagare.</p>
      <div class="button-row cancel-actions">
        <button class="primary" type="button" id="keep-sending">Fortsätt skicka</button>
        <button class="danger" type="button" id="confirm-cancel-send">Avbryt utskicket</button>
      </div>`;
    openModal('Bekräfta avbrott', body);
    setTimeout(() => {
      $('#keep-sending')?.focus();
      $('#keep-sending').onclick = closeModal;
      $('#confirm-cancel-send').onclick = async () => {
        const button = $('#confirm-cancel-send');
        button.disabled = true;
        try {
          await json(`/api/send-jobs/${job.id}/rate`, {
            method: 'PATCH',
            body: JSON.stringify({ action: 'cancel' }),
          });
          closeModal();
          location.reload();
        } catch (error) {
          button.disabled = false;
          showNotice(error.message);
        }
      };
    }, 0);
  }

  function openModal(title, body) {
    const modal = $('#modal');
    if (!modal) return;
    $('#modal-title').textContent = title;
    const content = $('#modal-body');
    content.replaceChildren(body);
    modal.classList.add('open');
  }

  function closeModal() {
    $('#modal')?.classList.remove('open');
  }

  const observer = new MutationObserver(() => {
    enhanceOAuthList();
    enhanceCancelButtons();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  enhanceOAuthList();
  enhanceCancelButtons();
})();
