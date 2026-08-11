document.addEventListener("DOMContentLoaded", () => {
  fetch("https://api.ipify.org?format=json")
    .then((r) => r.json())
    .then((data) => {
      document.getElementById("ipAddress").textContent =
        `You're visiting from ${data.ip}`;
    })
    .catch((err) => console.error(err));
});
