  /* ============================================================
     1) PASTE YOUR RELAY WEBHOOK TRIGGER URL BELOW.
        In Relay: swap the "Row in Trequest" trigger for a
        "Webhook" trigger, copy its URL, and paste it here.
     ============================================================ */
  const RELAY_WEBHOOK_URL = "https://hook.relay.app/api/v1/playbook/cmr4r1ebp0okw0pm3br3cgunp/trigger/u4RGadgMA0Ew_ZXEPxFhqg";

  // --- element refs ---
  const $ = (id) => document.getElementById(id);
  const sourceUrl = $("sourceUrl");
  const sourceText = $("sourceText");
  const modeLink = $("modeLink");
  const modeText = $("modeText");
  const panelLink = $("panelLink");
  const panelText = $("panelText");
  const targetLanguage = $("targetLanguage");
  const eventFormat = $("eventFormat");
  const documentType = $("documentType");
  const humanTranslator = $("humanTranslator");
  const requestedByName = $("requestedByName");
  const requestedByEmail = $("requestedByEmail");
  const notes = $("notes");
  const sendBtn = $("sendBtn");
  const statusEl = $("status");
  const requestFields = $("requestFields");
  const resultBox = $("result");
  const resultText = $("resultText");
  const copyBtn = $("copyBtn");

  const isConfigured = RELAY_WEBHOOK_URL && !RELAY_WEBHOOK_URL.startsWith("PASTE_");
  if (!isConfigured) $("setup").style.display = "block";

  const emailOk = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const setInvalid = (fieldId, bad) => $(fieldId).classList.toggle("invalid", bad);

  let inputMode = "link"; // "link" | "text"
  function setMode(mode) {
    inputMode = mode;
    const link = mode === "link";
    modeLink.setAttribute("aria-pressed", String(link));
    modeText.setAttribute("aria-pressed", String(!link));
    panelLink.hidden = !link;
    panelText.hidden = link;
    // Human translator / event format / requester / notes only apply to a tracked request
    requestFields.hidden = !link;
    sendBtn.textContent = link ? "Send request" : "Translate";
    resultBox.hidden = true;
    statusEl.textContent = "";
    $("f-source").classList.remove("invalid");
    (link ? sourceUrl : sourceText).focus();
  }
  modeLink.addEventListener("click", () => setMode("link"));
  modeText.addEventListener("click", () => setMode("text"));

  function validate() {
    let ok = true;
    const badSource = inputMode === "link"
      ? (!sourceUrl.value.trim() || !/^https?:\/\//i.test(sourceUrl.value.trim()))
      : !sourceText.value.trim();
    setInvalid("f-source", badSource); if (badSource) ok = false;

    const badLang = !targetLanguage.value;
    setInvalid("f-lang", badLang); if (badLang) ok = false;

    const badFormat = !eventFormat.value;
    setInvalid("f-format", badFormat); if (badFormat) ok = false;

    const badDocType = !documentType.value;
    setInvalid("f-doctype", badDocType); if (badDocType) ok = false;

    const badHuman = humanTranslator.value.trim() && !emailOk(humanTranslator.value.trim());
    setInvalid("f-human", badHuman); if (badHuman) ok = false;

    const badReq = requestedByEmail.value.trim() && !emailOk(requestedByEmail.value.trim());
    setInvalid("f-remail", badReq); if (badReq) ok = false;

    return ok;
  }

  async function submit() {
    statusEl.className = "status";
    statusEl.textContent = "";

    if (!validate()) {
      statusEl.className = "status err";
      statusEl.textContent = "Check the highlighted fields.";
      return;
    }
    if (!isConfigured) {
      statusEl.className = "status err";
      statusEl.textContent = "This form isn't connected to Relay yet.";
      return;
    }

    const payload = {
      inputType: inputMode,                                        // "link" or "text"
      sourceUrl: inputMode === "link" ? sourceUrl.value.trim() : "",
      sourceText: inputMode === "text" ? sourceText.value.trim() : "",
      targetLanguage: targetLanguage.value,
      eventFormat: eventFormat.value,
      documentType: documentType.value,
      humanTranslator: humanTranslator.value.trim(),
      requestedByName: requestedByName.value.trim(),
      requestedByEmail: requestedByEmail.value.trim(),
      notes: notes.value.trim(),
      submittedAt: new Date().toISOString()
    };

    sendBtn.disabled = true;
    sendBtn.textContent = "Sending…";
    statusEl.textContent = "";

    try {
      // Sent as a "simple" request (text/plain body) so the browser
      // won't fire a CORS preflight the webhook can't answer. Relay
      // parses the JSON body fine. The response is opaque (no-cors),
      // so a completed request is treated as submitted.
      await fetch(RELAY_WEBHOOK_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payload)
      });
      showDone();
    } catch (err) {
      sendBtn.disabled = false;
      sendBtn.textContent = "Send request";
      statusEl.className = "status err";
      statusEl.textContent = "Couldn't reach Relay. Check your connection and the webhook URL, then try again.";
    }
  }

  function showDone() {
    $("formView").style.display = "none";
    $("doneView").style.display = "block";
  }

  async function translate() {
    statusEl.className = "status";
    statusEl.textContent = "";
    resultBox.hidden = true;

    const badText = !sourceText.value.trim();
    const badLang = !targetLanguage.value;
    setInvalid("f-source", badText);
    setInvalid("f-lang", badLang);
    if (badText || badLang) {
      statusEl.className = "status err";
      statusEl.textContent = "Add some text and pick a language.";
      return;
    }

    if (!isConfigured) {
      statusEl.className = "status err";
      statusEl.textContent = "This form isn't connected to Relay yet.";
      return;
    }

    sendBtn.disabled = true;
    sendBtn.textContent = "Translating…";

    try {
      // Quick text hits the same Relay webhook, which responds synchronously
      // with { translation }. Sent as text/plain to avoid a CORS preflight;
      // Relay's response must include an Access-Control-Allow-Origin header
      // for the browser to read it back.
      const res = await fetch(RELAY_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify({
          inputType: "text",
          sourceText: sourceText.value.trim(),
          targetLanguage: targetLanguage.value
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || ("Relay returned " + res.status));
      resultText.textContent = data.translation || "";
      resultBox.hidden = false;
      resultBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (err) {
      statusEl.className = "status err";
      statusEl.textContent = "Couldn't get the translation back. If this keeps happening, the Relay webhook response likely needs an Access-Control-Allow-Origin header.";
    } finally {
      sendBtn.disabled = false;
      sendBtn.textContent = "Translate";
    }
  }

  function reset() {
    [sourceUrl, sourceText, humanTranslator, requestedByName, requestedByEmail, notes].forEach(el => el.value = "");
    targetLanguage.selectedIndex = 0;
    eventFormat.selectedIndex = 0;
    documentType.selectedIndex = 0;
    ["f-source","f-lang","f-format","f-doctype","f-human","f-remail"].forEach(id => $(id).classList.remove("invalid"));
    sendBtn.disabled = false;
    sendBtn.textContent = "Send request";
    statusEl.textContent = "";
    $("doneView").style.display = "none";
    $("formView").style.display = "block";
    setMode("link");
  }

  sendBtn.addEventListener("click", () => (inputMode === "text" ? translate() : submit()));
  $("againBtn").addEventListener("click", reset);
  copyBtn.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(resultText.textContent);
      copyBtn.textContent = "Copied";
    } catch {
      copyBtn.textContent = "Copy failed";
    }
    setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
  });
  // clear a field's error as the user fixes it
  [["sourceUrl","f-source"],["sourceText","f-source"],["targetLanguage","f-lang"],["eventFormat","f-format"],["documentType","f-doctype"],["humanTranslator","f-human"],["requestedByEmail","f-remail"]]
    .forEach(([el,f]) => $(el).addEventListener("input", () => $(f).classList.remove("invalid")));
