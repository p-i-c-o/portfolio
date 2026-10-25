(() => {
  const card = document.querySelector('.blog-account-card');
  if (!card) return;

  const loading = card.querySelector('.blog-account-loading');
  const guest = card.querySelector('.blog-account-guest');
  const member = card.querySelector('.blog-account-member');
  const retry = document.createElement('button');
  retry.className = 'retry-button';
  retry.type = 'button';
  retry.textContent = 'Try again';
  retry.hidden = true;
  card.querySelector('.body').append(retry);

  async function refreshAccount() {
    retry.hidden = true;
    loading.hidden = false;
    loading.textContent = 'Checking account…';
    guest.hidden = true;
    member.hidden = true;
    try {
      const account = await CommentAPI.request('/api/comments.php?account=1', {},
        result => typeof result.signed_in === 'boolean');
      loading.hidden = true;
      guest.hidden = account.signed_in;
      member.hidden = !account.signed_in;
      if (account.signed_in) {
        card.querySelector('.blog-account-username').textContent = account.username || 'your account';
        card.querySelector('.blog-account-unread').textContent = account.unread_count ? `(${account.unread_count})` : '';
      }
    } catch (error) {
      loading.textContent = error.message;
      retry.hidden = false;
    }
  }

  retry.addEventListener('click', refreshAccount);

  refreshAccount();
  window.addEventListener('pageshow', event => { if (event.persisted) refreshAccount(); });
})();
