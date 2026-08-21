const STATUS_LABELS = {
  sv: { pending: "Väntar", sending: "Skickar", done: "Klar", aborted: "Stoppad", cancelled: "Avbruten" },
  en: { pending: "Pending", sending: "Sending", done: "Done", aborted: "Stopped", cancelled: "Cancelled" },
};

function lang() {
  return document.documentElement.lang?.slice(0, 2) || "sv";
}

function text(sv, en) {
  return lang() === "sv" ? sv : en;
}

async function request(path, opts = {}) {
  const response = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || text("Åtgärden misslyckades", "Action failed"));
  return data;
}

function button(label, className, handler) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.textContent = label;
  el.addEventListener("click", async () => {
    el.disabled = true;
    try { await handler(); }
    catch (error) { window.alert(`${text("Åtgärden misslyckades", "Action failed")}: ${error.message}`); }
    finally { el.disabled = false; }
  });
  return el;
}

function stat(label, value, tone = "") {
  const el = document.createElement("div");
  el.className = `send-job-stat ${tone}`.trim();
  const valueEl = document.createElement("strong");
  valueEl.textContent = String(value);
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  el.append(valueEl, labelEl);
  return el;
}

function progress(job) {
  const total = Number(job.total_recipients) || 0;
  const done = (Number(job.sent_count) || 0) + (Number(job.bounce_count) || 0);
  return total ? Math.min(100, Math.round(done / total * 100)) : 0;
}

function credentialSelect(credentials, selectedId) {
  const select = document.createElement("select");
  select.className = "send-job-credential-select";
  select.setAttribute("aria-label", text("Mailkonto för nytt försök", "Mail account for retry"));
  for (const credential of credentials) {
    const option = document.createElement("option");
    option.value = credential.id;
    option.textContent = `${credential.from_address} · ${credential.provider}`;
    option.selected = credential.id === selectedId;
    select.appendChild(option);
  }
  return select;
}

function rateEditor(job, reload) {
  const details = document.createElement("details");
  details.className = "send-job-rate send-job-rate-modern";
  const summary = document.createElement("summary");
  summary.textContent = text("Ändra utskickstakt", "Change send rate");
  details.appendChild(summary);

  const fields = document.createElement("div");
  fields.className = "send-job-rate-fields";
  const switchDays = job.limit_switch_at == null ? "" : String(Math.max(1, Math.ceil((job.limit_switch_at - Date.now()) / 86400000)));
  const defs = [
    [text("Högst per dag nu", "Maximum per day now"), job.daily_limit ?? ""],
    [text("Växla efter dagar", "Switch after days"), switchDays],
    [text("Högst per dag därefter", "Maximum per day after"), job.next_daily_limit ?? ""],
  ];
  const inputs = defs.map(([labelText, value]) => {
    const label = document.createElement("label");
    label.textContent = labelText;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "1";
    input.max = "10000";
    input.value = value;
    label.appendChild(input);
    fields.appendChild(label);
    return input;
  });
  fields.appendChild(button(text("Spara takt", "Save rate"), "btn-secondary", async () => {
    const value = (input) => input.value.trim() === "" ? null : Number(input.value);
    await request(`/api/send-jobs/${job.id}/rate`, {
      method: "PATCH",
      body: JSON.stringify({ dailyLimit: value(inputs[0]), switchAfterDays: value(inputs[1]), nextDailyLimit: value(inputs[2]) }),
    });
    await reload();
  }));
  details.appendChild(fields);
  return details;
}

function jobCard(job, credentials, reload) {
  const card = document.createElement("li");
  card.className = `send-job-card status-${job.status}`;

  const header = document.createElement("div");
  header.className = "send-job-header";
  const meta = document.createElement("div");
  const badge = document.createElement("span");
  badge.className = `send-job-badge status-${job.status}`;
  badge.textContent = (STATUS_LABELS[lang()] || STATUS_LABELS.en)[job.status] || job.status;
  const date = document.createElement("div");
  date.className = "send-job-date";
  date.textContent = `${text("Skapad", "Created")}: ${new Date(job.created_at).toLocaleString()}`;
  meta.append(badge, date);
  header.appendChild(meta);
  card.appendChild(header);

  const sent = Number(job.sent_count) || 0;
  const failed = Number(job.bounce_count) || 0;
  const remaining = Math.max(0, Number(job.total_recipients) - sent - failed);
  const stats = document.createElement("div");
  stats.className = "send-job-stats";
  stats.append(
    stat(text("Skickade", "Sent"), sent, "ok"),
    stat(text("Misslyckade", "Failed"), failed, failed ? "danger" : ""),
    stat(text("Kvar", "Remaining"), remaining),
  );
  card.appendChild(stats);

  const progressEl = document.createElement("div");
  progressEl.className = "send-job-progress";
  const fill = document.createElement("div");
  fill.className = "send-job-progress-fill";
  fill.style.width = `${progress(job)}%`;
  progressEl.appendChild(fill);
  card.appendChild(progressEl);

  if (job.last_error) {
    const error = document.createElement("div");
    error.className = "send-job-error";
    const strong = document.createElement("strong");
    strong.textContent = `${text("Senaste fel", "Latest error")}: `;
    error.append(strong, document.createTextNode(job.last_error));
    card.appendChild(error);
  }

  if (["pending", "sending"].includes(job.status)) card.appendChild(rateEditor(job, reload));

  const actions = document.createElement("div");
  actions.className = "send-job-actions";

  if (["pending", "sending"].includes(job.status)) {
    actions.appendChild(button(text("Avbryt", "Cancel"), "btn-secondary", async () => {
      if (!confirm(text("Avbryta utskicket? Redan skickade mail kan inte återkallas.", "Cancel this send? Already sent messages cannot be recalled."))) return;
      await request(`/api/send-jobs/${job.id}/rate`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) });
      await reload();
    }));
  }

  const retryable = job.status === "aborted" || job.status === "cancelled" || failed > 0;
  if (retryable) {
    const retryGroup = document.createElement("div");
    retryGroup.className = "send-job-retry-group";
    const select = credentialSelect(credentials, job.mail_credential_id);
    if (!credentials.length) select.disabled = true;
    retryGroup.appendChild(select);
    retryGroup.appendChild(button(text("Försök igen", "Retry"), "btn-primary", async () => {
      if (!credentials.length) throw new Error(text("Koppla ett mailkonto först", "Connect a mail account first"));
      if (!confirm(text("Skicka misslyckade och återstående mottagare igen? Redan lyckade mail skickas inte om.", "Retry failed and remaining recipients? Successful messages will not be resent."))) return;
      await request(`/api/send-jobs/${job.id}/rate`, {
        method: "PATCH",
        body: JSON.stringify({ action: "retry", mailCredentialId: select.value }),
      });
      await reload();
    }));
    actions.appendChild(retryGroup);
  }

  if (job.status === "done" && job.letter_id) {
    actions.appendChild(button(text("Publicera brev", "Publish letter"), "btn-secondary", async () => {
      await request(`/api/letters/${job.letter_id}/publish`, { method: "POST" });
      window.alert(text("Publicerat", "Published"));
    }));
  }

  if (!["pending", "sending"].includes(job.status)) {
    actions.appendChild(button(text("Ta bort", "Delete"), "btn-danger-ghost", async () => {
      if (!confirm(text("Ta bort utskicket från historiken? Redan skickade mail påverkas inte.", "Delete this send from history? Already sent messages are unaffected."))) return;
      await request(`/api/send-jobs/${job.id}/rate`, { method: "PATCH", body: JSON.stringify({ action: "delete" }) });
      await reload();
    }));
  }

  card.appendChild(actions);
  return card;
}

export async function renderSendJobs(container) {
  const [jobs, credentials] = await Promise.all([
    request("/api/send-jobs"),
    request("/api/mail-credentials"),
  ]);
  container.classList.add("send-jobs-grid");
  container.innerHTML = "";
  if (!jobs.length) {
    const empty = document.createElement("li");
    empty.className = "send-jobs-empty";
    empty.textContent = text("Inga utskick ännu.", "No sends yet.");
    container.appendChild(empty);
    return;
  }
  const reload = () => renderSendJobs(container);
  for (const job of jobs) container.appendChild(jobCard(job, credentials, reload));
}

export function installSendJobsController() {
  window.loadSendJobs = async function loadSendJobs() {
    const container = document.getElementById("send-jobs-list");
    if (container) await renderSendJobs(container);
  };
}
