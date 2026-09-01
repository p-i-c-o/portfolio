(() => {
  const button = document.querySelector(".save-contact");
  if (!button) return;

  const userAgent = navigator.userAgent;
  const isAndroid = /Android/i.test(userAgent);
  const supportsChromeIntents =
    isAndroid && /(Chrome|Chromium|SamsungBrowser|EdgA|OPR|GSA)/i.test(userAgent);

  if (!supportsChromeIntents) return;

  const value = encodeURIComponent;
  const fallback = new URL("elie-monnickendam.vcf", window.location.href).href;
  const notes = [
    "Website: https://monnickendam.ch",
    "LinkedIn: https://linkedin.com/in/monnickendam",
    "Instagram: https://www.instagram.com/___elie___/",
    "Telegram: https://t.me/picolovesroot",
    "GitHub: https://github.com/p-i-c-o"
  ].join("\n");

  button.href = [
    "intent:#Intent",
    "action=android.intent.action.INSERT",
    "category=android.intent.category.BROWSABLE",
    "type=vnd.android.cursor.dir/contact",
    `S.name=${value("Elie Monnickendam")}`,
    `S.email=${value("elie@monnickendam.ch")}`,
    `S.secondary_email=${value("Elie.Monnickendam@warwick.ac.uk")}`,
    `S.job_title=${value("BSc Cybersecurity Student")}`,
    `S.notes=${value(notes)}`,
    `S.browser_fallback_url=${value(fallback)}`,
    "end"
  ].join(";");

  button.querySelector("strong").textContent = "Add to contacts";
  button.querySelector("small").textContent = "Open directly in your Contacts app";
})();
