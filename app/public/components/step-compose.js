// Steg 2: skrivläget. Subject/textarea/AI-utkast är enkla fält i
// index.html med befintlig logik kvar i app.js. Den här modulen äger
// bygglogiken för bifogade-filer-listan (attach/extract-läge per fil).

let mammothPromise = null;

function loadMammoth() {
  if (window.mammoth) return Promise.resolve(window.mammoth);
  if (!mammothPromise) {
    mammothPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/mammoth@1.12.1/mammoth.browser.min.js";
      script.crossOrigin = "anonymous";
      script.onload = () => window.mammoth ? resolve(window.mammoth) : reject(new Error("Mammoth kunde inte laddas."));
      script.onerror = () => reject(new Error("Kunde inte ladda DOCX-konverteraren."));
      document.head.appendChild(script);
    });
  }
  return mammothPromise;
}

function filenameSubject(filename) {
  return filename.replace(/\.[^.]+$/, "").trim();
}

function removeFileFromInput(fileToRemove) {
  const input = document.getElementById("letter-files");
  if (!input || typeof DataTransfer === "undefined") return false;
  const dt = new DataTransfer();
  for (const file of input.files) {
    if (file !== fileToRemove) dt.items.add(file);
  }
  input.files = dt.files;
  return true;
}

async function importAsLetterText(file, row) {
  const body = document.getElementById("letter-body");
  const subject = document.getElementById("letter-subject");
  if (!body || !subject) throw new Error("Brevfälten kunde inte hittas.");

  const ext = file.name.toLowerCase().split(".").pop();
  let html;

  if (ext === "docx") {
    const mammoth = await loadMammoth();
    const result = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    html = result.value;
  } else if (ext === "txt") {
    html = await file.text();
  } else {
    throw new Error(`Direkt förhandsvisning av .${ext} stöds inte ännu.`);
  }

  body.value = body.value.trim() ? `${body.value}\n\n${html}` : html;
  if (!subject.value.trim()) subject.value = filenameSubject(file.name);
  body.dispatchEvent(new Event("input", { bubbles: true }));
  subject.dispatchEvent(new Event("input", { bubbles: true }));

  // Dokumentet är nu själva brevtexten och tas därför bort ur FileList innan
  // /api/send byggs; annars skulle backend konvertera och lägga till det igen.
  removeFileFromInput(file);
  row.dataset.importedAsText = "true";
}

export function renderFileModeList(container, files, { t }) {
  container.innerHTML = "";
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const row = document.createElement("div");
    const isDoc = file.name.toLowerCase().endsWith(".doc");
    const modeName = `mode-${i}-${file.name}`;

    const span = document.createElement("span");
    span.textContent = `${file.name} (${(file.size / 1024).toFixed(0)} KB)`;

    const attachLabel = document.createElement("label");
    const attachInput = document.createElement("input");
    attachInput.type = "radio";
    attachInput.name = modeName;
    attachInput.value = "attach";
    attachInput.checked = true;
    attachLabel.appendChild(attachInput);
    attachLabel.append(" " + t("btn_attach"));

    const extractLabel = document.createElement("label");
    const extractInput = document.createElement("input");
    extractInput.type = "radio";
    extractInput.name = modeName;
    extractInput.value = "extract";
    extractInput.disabled = isDoc;
    extractLabel.appendChild(extractInput);
    extractLabel.append(` ${t("btn_use_as_text")}${isDoc ? t("hint_not_possible_for_doc") : ""}`);

    extractInput.addEventListener("change", async () => {
      if (!extractInput.checked || row.dataset.importedAsText === "true") return;
      extractInput.disabled = true;
      attachInput.disabled = true;
      try {
        await importAsLetterText(file, row);
        const status = document.createElement("span");
        status.className = "hint";
        status.textContent = " Importerad som brevtext";
        row.appendChild(status);
        extractInput.checked = true;
      } catch (err) {
        attachInput.checked = true;
        alert(err instanceof Error ? err.message : String(err));
      } finally {
        if (row.dataset.importedAsText !== "true") {
          extractInput.disabled = isDoc;
          attachInput.disabled = false;
        }
      }
    });

    row.appendChild(span);
    row.appendChild(attachLabel);
    row.appendChild(extractLabel);
    container.appendChild(row);
  }
}
