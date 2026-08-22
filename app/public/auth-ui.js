(() => {
  const ROOT_ID = 'root';
  const TURNSTILE_SITEKEY = '0x4AAAAAADtfk0hF05HrDLLJ';
  let enhancedLogin = false;

  const json = async (path, opts = {}) => {
    const response = await fetch(path, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(opts.headers || {}),
      },
    });
    let data = {};
    try { data = await response.json(); } catch {}
    if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
    return data;
  };

  function clearLegacyTotpNotice() {
    try {
      const raw = sessionStorage.getItem('ui:lastNotice');
      const notice = raw ? JSON.parse(raw) : null;
      if (notice?.text === 'TOTP_REQUIRED') sessionStorage.removeItem('ui:lastNotice');
    } catch {}
    const notices = document.getElementById('global-notices');
    if (notices?.textContent?.includes('TOTP_REQUIRED')) notices.innerHTML = '';
  }

  function authBrand() {
    return `<div class="auth-brand"><div class="brand" style="justify-content:center"><span class="brand-mark">🇸🇪</span><span>Politikerkontakt</span></div><p class="hint">Skriv till dina folkvalda från ditt eget mailkonto.</p></div>`;
  }

  function showSignup() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.innerHTML = `<div class="auth-shell auth-single">${authBrand()}<section class="panel auth-single-card"><button class="ghost auth-back" type="button">← Till inloggning</button><h1 class="page-title" style="font-size:2rem">Skapa konto</h1><p class="hint">Skapa ett konto med e-post och lösenord. E-postadressen verifieras innan kontot kan användas.</p><form id="standalone-signup" class="stack"><label class="field"><span>E-post</span><input name="email" type="email" autocomplete="email" required></label><label class="field"><span>Lösenord</span><input name="password" type="password" autocomplete="new-password" minlength="10" required></label><div class="cf-turnstile" id="signup-turnstile"></div><button class="primary">Skapa konto</button></form><div id="standalone-signup-msg"></div></section></div>`;
    root.querySelector('.auth-back').onclick = () => location.reload();
    renderSignupTurnstile();
    root.querySelector('#standalone-signup').onsubmit = submitSignup;
  }

  function renderSignupTurnstile(attempt = 0) {
    const el = document.getElementById('signup-turnstile');
    if (!el) return;
    if (!window.turnstile) {
      if (attempt < 50) setTimeout(() => renderSignupTurnstile(attempt + 1), 100);
      return;
    }
    if (el.dataset.rendered) return;
    el.dataset.rendered = '1';
    try { window.turnstile.render(el, { sitekey: TURNSTILE_SITEKEY, action: 'turnstile-spin-v1' }); } catch {}
  }

  async function submitSignup(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const msg = document.getElementById('standalone-signup-msg');
    const data = new FormData(form);
    const token = form.querySelector('[name="cf-turnstile-response"]')?.value || '';
    try {
      const result = await json('/api/signup', {
        method: 'POST',
        body: JSON.stringify({
          email: data.get('email'),
          password: data.get('password'),
          turnstileToken: token,
        }),
      });
      showVerification(result.accountId, data.get('email'));
    } catch (error) {
      msg.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
      try { window.turnstile?.reset(); } catch {}
    }
  }

  function showVerification(accountId, email) {
    const root = document.getElementById(ROOT_ID);
    root.innerHTML = `<div class="auth-shell auth-single">${authBrand()}<section class="panel auth-single-card"><h1 class="page-title" style="font-size:2rem">Bekräfta e-post</h1><p class="hint">Ange den sexsiffriga koden som skickades till <strong>${escapeHtml(email)}</strong>.</p><form id="standalone-verify" class="stack"><label class="field"><span>Verifieringskod</span><input name="code" inputmode="numeric" pattern="[0-9]*" autocomplete="one-time-code" required></label><button class="primary">Bekräfta konto</button></form><div id="standalone-verify-msg"></div></section></div>`;
    root.querySelector('#standalone-verify').onsubmit = async event => {
      event.preventDefault();
      const code = new FormData(event.currentTarget).get('code');
      const msg = document.getElementById('standalone-verify-msg');
      try {
        await json('/api/verify', { method: 'POST', body: JSON.stringify({ accountId, code }) });
        msg.innerHTML = '<div class="notice success">Kontot är verifierat. Du kan nu logga in.</div><button class="primary" id="verify-login">Till inloggning</button>';
        document.getElementById('verify-login').onclick = () => location.reload();
      } catch (error) {
        msg.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
      }
    };
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  }

  function makeLoginCompact(root) {
    const layout = root.querySelector('.auth-layout');
    const loginForm = root.querySelector('#login-form');
    if (!layout || !loginForm || loginForm.dataset.authEnhanced === '1') return false;
    loginForm.dataset.authEnhanced = '1';

    const signupPanel = root.querySelector('.auth-layout > aside.panel');
    if (signupPanel) {
      signupPanel.innerHTML = `<h2>Nytt konto</h2><p class="hint">Har du inget konto ännu?</p><button class="secondary auth-signup-button" type="button">Skapa konto</button>`;
      signupPanel.querySelector('.auth-signup-button').onclick = showSignup;
    }

    const totpRow = root.querySelector('#totp-row');
    if (totpRow) totpRow.hidden = true;

    const originalEmail = loginForm.querySelector('[name="email"]');
    const originalPassword = loginForm.querySelector('[name="password"]');
    const submit = loginForm.querySelector('button.primary');
    const forgot = root.querySelector('#forgot-btn');
    let credentials = null;
    let totpMode = false;

    loginForm.addEventListener('submit', async event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      const msg = root.querySelector('#auth-msg');
      if (msg) msg.innerHTML = '';

      if (!totpMode) {
        credentials = { email: originalEmail.value, password: originalPassword.value };
        try {
          await json('/api/login', { method: 'POST', body: JSON.stringify(credentials) });
          location.reload();
        } catch (error) {
          if (error.message !== 'TOTP_REQUIRED') {
            if (msg) msg.innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
            return;
          }
          clearLegacyTotpNotice();
          totpMode = true;
          loginForm.classList.add('totp-step');
          originalEmail.closest('.field').hidden = true;
          originalPassword.closest('.field').hidden = true;
          if (forgot) forgot.hidden = true;
          if (totpRow) {
            totpRow.hidden = false;
            const code = totpRow.querySelector('input');
            code.value = '';
            code.focus();
          }
          if (submit) submit.textContent = 'Verifiera och logga in';
          let back = loginForm.querySelector('.totp-back');
          if (!back) {
            back = document.createElement('button');
            back.type = 'button';
            back.className = 'ghost totp-back';
            back.textContent = '← Tillbaka';
            back.onclick = () => {
              totpMode = false;
              loginForm.classList.remove('totp-step');
              originalEmail.closest('.field').hidden = false;
              originalPassword.closest('.field').hidden = false;
              if (totpRow) totpRow.hidden = true;
              if (forgot) forgot.hidden = false;
              if (submit) submit.textContent = 'Logga in';
              back.remove();
              originalPassword.focus();
            };
            loginForm.append(back);
          }
        }
        return;
      }

      const code = totpRow?.querySelector('input')?.value || '';
      try {
        await json('/api/login', {
          method: 'POST',
          body: JSON.stringify({ ...credentials, totpCode: code }),
        });
        location.reload();
      } catch (error) {
        if (msg) msg.innerHTML = `<div class="notice error">${escapeHtml(error.message === 'TOTP_REQUIRED' ? 'Fel 2FA-kod.' : error.message)}</div>`;
      }
    }, true);

    clearLegacyTotpNotice();
    return true;
  }

  function enhanceAuth() {
    const root = document.getElementById(ROOT_ID);
    if (!root || enhancedLogin) return;
    if (makeLoginCompact(root)) enhancedLogin = true;
  }

  const start = () => {
    enhanceAuth();
    if (enhancedLogin) return;
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    const observer = new MutationObserver(() => {
      enhanceAuth();
      if (enhancedLogin) observer.disconnect();
    });
    observer.observe(root, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 15000);
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
  else start();
})();
