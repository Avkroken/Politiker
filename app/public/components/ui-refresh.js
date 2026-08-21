// Sammanhållen UI-förbättring för den inloggade appen.
// Laddas som side-effect från step-landing.js så app.js kan fortsätta äga state.

const styleHref = "/ui-refresh.css";
if (!document.querySelector(`link[href="${styleHref}"]`)) {
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = styleHref;
  document.head.appendChild(link);
}

const labels = {
  sv: {
    pending: "Väntar",
    sending: "Skickar",
    done: "Klar",
    aborted: "Stoppad",
    cancelled: "Avbruten",
    sent: "Skickade",
    failed: "Misslyckade",
    remaining: "Kvar",
    created: "Skapad",
    retry: "Försök igen",
    cancel: "Avbryt",
    delete: "Ta bort",
    publish: "Publicera brev",
    published: "Publicerat",
    rate: "Ändra utskickstakt",
    saveRate: "Spara takt",
    saving: "Sparar…",
    saved: "Sparat",
    rateNow: "Högst per dag nu",
    rateDays: "Växla efter dagar",
    rateAfter: "Högst per dag därefter",
    retryConfirm: "Försöka skicka de misslyckade/återstående mottagarna igen? Redan lyckade mail skickas inte om.",
    cancelConfirm: "Avbryta utskicket? Redan skickade mail kan inte återkallas.",
    deleteConfirm: "Ta bort utskicket från listan? Redan skickade mail påverkas inte.",
    noJobs: "Inga utskick ännu.",
    lastError: "Senaste fel",
    actionFailed: "Åtgärden misslyckades",
  },
  en: {
    pending: "Pending",
    sending: "Sending",
    done: "Done",
    aborted: "Stopped",
    cancelled: "Cancelled",
    sent: "Sent",
    failed: "Failed",
    remaining: "Remaining",
    created: "Created",
    retry: "Retry",
    cancel: "Cancel",
    delete: "Delete",
    publish: "Publish letter",
    published: "Published",
    rate: "Change send rate",
    saveRate: "Save rate",
    saving: "Saving…",
    saved: "Saved",
    rateNow: "Maximum per day now",
    rateDays: "Switch after days",
    rateAfter: "Maximum per day after",
    retryConfirm: "Retry failed/remaining recipients? Successfully sent mail will not be sent again.",
    cancelConfirm: "Cancel this send? Messages already sent cannot be recalled.",
    deleteConfirm: "Delete this send from the list? Messages already sent are unaffected.",
    noJobs: "No sends yet.",
    lastError: "Latest error",
    actionFailed: "Action failed",
  },
};

function uiText(key) {
  const lang = document.documentElement.lang?.slice(0, 2) || "sv";
  return (labels[lang] || labels.en)[key] || labels.en[key] || key;
}

async function request(path, opts = {}) {
  const response = await fetch(path, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts.headers || {}) },
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || uiText("actionFailed"));
  return data;
}

function statusLabel(status) {
  return uiText(status) || status;
}

function progressFor(job) {
  const total = Number(job.total_recipients) || 0;
  const sent = Number(job.sent_count) || 0;
  const failed = Number(job.bounce_count) || 0;
  return total > 0 ? Math.min(100, Math.round(((sent + failed) / total) * 100)) : 0;
}

function makeStat(label, value, tone = "") {
  const el = document.createElement("div");
  el.className = `send-job-stat ${tone}`.trim();
  const valueEl = document.createElement("strong");
  valueEl.textContent = String(value);
  const labelEl = document.createElement("span");
  labelEl.textContent = label;
  el.append(valueEl, labelEl);
  return el;
}

function actionButton(label, className, handler) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = label;
  button.addEventListener("click", async () => {
    button.disabled = true;
    try {
      await handler();
    } catch (error) {
      window.alert(`${uiText("actionFailed")}: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  });
  return button;
}

function buildRateEditor(job, reload) {
  const details = document.createElement("details");
  details.className = "send-job-rate send-job-rate-modern";
  const summary = document.createElement("summary");
  summary.textContent = uiText("rate");
  details.appendChild(summary);

  const fields = document.createElement("div");
  fields.className = "send-job-rate-fields";
  const remainingDays = job.limit_switch_at == null
    ? ""
    : String(Math.max(1, Math.ceil((job.limit_switch_at - Date.now()) / 86400000)));
  const specs = [
    [uiText("rateNow"), job.daily_limit ?? ""],
    [uiText("rateDays"), remainingDays],
    [uiText("rateAfter"), job.next_daily_limit ?? ""],
  ];
  const inputs = specs.map(([labelText, value]) => {
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
  const save = document.createElement("button");
  save.type = "button";
  save.className = "btn-secondary";
  save.textContent = uiText("saveRate");
  const status = document.createElement("span");
  status.className = "send-job-inline-status";
  save.addEventListener("click", async () => {
    save.disabled = true;
    status.textContent = uiText("saving");
    try {
      const value = (input) => input.value.trim() === "" ? null : Number(input.value);
      await request(`/api/send-jobs/${job.id}/rate`, {
        method: "PATCH",
        body: JSON.stringify({ dailyLimit: value(inputs[0]), switchAfterDays: value(inputs[1]), nextDailyLimit: value(inputs[2]) }),
      });
      status.textContent = uiText("saved");
      await reload();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      save.disabled = false;
    }
  });
  fields.append(save, status);
  details.appendChild(fields);
  return details;
}

function buildJobCard(job, reload) {
  const card = document.createElement("li");
  card.className = `send-job-card status-${job.status}`;

  const header = document.createElement("div");
  header.className = "send-job-header";
  const titleBlock = document.createElement("div");
  const date = document.createElement("div");
  date.className = "send-job-date";
  date.textContent = `${uiText("created")}: ${new Date(job.created_at).toLocaleString()}`;
  const badge = document.createElement("span");
  badge.className = `send-job-badge status-${job.status}`;
  badge.textContent = statusLabel(job.status);
  titleBlock.append(badge, date);
  header.appendChild(titleBlock);
  card.appendChild(header);

  const stats = document.createElement("div");
  stats.className = "send-job-stats";
  const remaining = Math.max(0, Number(job.total_recipients) - Number(job.sent_count) - Number(job.bounce_count));
  stats.append(
    makeStat(uiText("sent"), job.sent_count || 0, "ok"),
    makeStat(uiText("failed"), job.bounce_count || 0, Number(job.bounce_count) > 0 ? "danger" : ""),
    makeStat(uiText("remaining"), remaining),
  );
  card.appendChild(stats);

  const progress = document.createElement("div");
  progress.className = "send-job-progress";
  const fill = document.createElement("div");
  fill.className = "send-job-progress-fill";
  fill.style.width = `${progressFor(job)}%`;
  progress.appendChild(fill);
  card.appendChild(progress);

  if (job.last_error) {
    const error = document.createElement("div");
    error.className = "send-job-error";
    const label = document.createElement("strong");
    label.textContent = `${uiText("lastError")}: `;
    const text = document.createElement("span");
    text.textContent = job.last_error;
    error.append(label, text);
    card.appendChild(error);
  }

  if (job.status === "pending" || job.status === "sending") {
    card.appendChild(buildRateEditor(job, reload));
  }

  const actions = document.createElement("div");
  actions.className = "send-job-actions";

  if (job.status === "pending" || job.status === "sending") {
    actions.appendChild(actionButton(uiText("cancel"), "btn-secondary", async () => {
      if (!window.confirm(uiText("cancelConfirm"))) return;
      await request(`/api/send-jobs/${job.id}/rate`, { method: "PATCH", body: JSON.stringify({ action: "cancel" }) });
      await reload();
    }));
  }

  if (job.status === "aborted" || job.status === "cancelled" || Number(job.bounce_count) > 0) {
    actions.appendChild(actionButton(uiText("retry"), "btn-primary", async () => {
      if (!window.confirm(uiText("retryConfirm"))) return;
      await request(`/api/send-jobs/${job.id}/rate`, { method: "PATCH", body: JSON.stringify({ action: "retry" }) });
      await reload();
    }));
  }

  if (job.status === "done" && job.letter_id) {
    actions.appendChild(actionButton(uiText("publish"), "btn-secondary", async () => {
      await request(`/api/letters/${job.letter_id}/publish`, { method: "POST" });
      window.alert(uiText("published"));
    }));
  }

  actions.appendChild(actionButton(uiText("delete"), "btn-danger-ghost", async () => {
    if (!window.confirm(uiText("deleteConfirm"))) return;
    await request(`/api/send-jobs/${job.id}/rate`, { method: "PATCH", body: JSON.stringify({ action: "delete" }) });
    await reload();
  }));
  card.appendChild(actions);
  return card;
}

async function enhancedLoadSendJobs() {
  const ul = document.getElementById("send-jobs-list");
  if (!ul) return;
  const jobs = await request("/api/send-jobs");
  ul.classList.add("send-jobs-grid");
  ul.innerHTML = "";
  if (!jobs.length) {
    const empty = document.createElement("li");
    empty.className = "send-jobs-empty";
    empty.textContent = uiText("noJobs");
    ul.appendChild(empty);
    return;
  }
  for (const job of jobs) ul.appendChild(buildJobCard(job, enhancedLoadSendJobs));
}

// app.js är ett klassiskt script, så dess top-level function deklareras på window.
// Byt implementation efter att app.js har laddats och rendera om direkt.
queueMicrotask(() => {
  if (typeof window.loadSendJobs === "function") {
    window.loadSendJobs = enhancedLoadSendJobs;
    enhancedLoadSendJobs().catch(() => {});
  }
});
