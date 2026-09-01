// contact.js — drop-in contact form handler (n8n)

(() => {
    const WEBHOOK_URL =
      "https://n8n.devkey.ch/webhook/c3219ad0-2620-41b1-afb1-e2a6ca4b2b0d";
  
    const form = document.querySelector(".contact form");
    if (!form) return;
  
    const email = form.querySelector("#email");
    const message = form.querySelector("#message");
    const button = form.querySelector(".send-box");
  
    const resetButton = () => {
      button.textContent = "Send";
      button.disabled = false;
    };
  
    const setState = (text, disabled = false) => {
      button.textContent = text;
      button.disabled = disabled;
    };
  
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
  
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
  
      const data = new FormData();
      data.append("email", email.value.trim());
      data.append("message", message.value.trim());
      data.append("page", location.href);
      data.append("ts", new Date().toISOString());
  
      setState("Sending…", true);
  
      try {
        const res = await fetch(WEBHOOK_URL, {
          method: "POST",
          body: data,
          headers: { Accept: "application/json" }
        });
  
        if (!res.ok) throw new Error("Request failed");
  
        setState("Sent ✓", true);
        form.reset();
  
        // 🔁 reset after 3 seconds
        setTimeout(resetButton, 3000);
      } catch {
        setState("Failed — retry", false);
      }
    });
  })();
