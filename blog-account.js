(() => {
  const card = document.querySelector('.blog-account-card');
  if (!card) return;

  async function refreshAccount() {
    let account = { signed_in: false };
    try {
      const response = await fetch('/api/comments.php?account=1', {
        headers: { Accept: 'application/json' },
        cache: 'no-store'
      });
      if (response.ok) account = await response.json();
    } catch { /* Keep the account link available when the API is offline. */ }

    card.querySelector('.blog-account-loading').hidden = true;
    card.querySelector('.blog-account-guest').hidden = Boolean(account.signed_in);
    card.querySelector('.blog-account-member').hidden = !account.signed_in;
    if (account.signed_in) {
      card.querySelector('.blog-account-username').textContent = account.username || 'your account';
      card.querySelector('.blog-account-unread').textContent = account.unread_count ? `(${account.unread_count})` : '';
    }
  }

  refreshAccount();
  window.addEventListener('pageshow', event => { if (event.persisted) refreshAccount(); });
})();
