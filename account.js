(() => {
  const page = document.querySelector('.account-page');
  if (!page) return;
  const find = selector => page.querySelector(selector);
  const auth = find('.account-auth');
  const dashboard = find('.account-dashboard');
  const keyCard = find('.account-key-card');
  const loading = find('.account-loading');
  const createForm = find('.account-create-form');
  const loginForm = find('.account-login-form');
  const rotateForm = find('.account-rotate-form');
  const deleteForm = find('.account-delete-form');
  const createName = createForm.elements.namedItem('username');
  const availability = find('.account-availability');
  const myList = find('.account-comment-list');
  const inboxList = find('.account-inbox-list');
  const myMore = find('.account-comments-more');
  const inboxMore = find('.account-inbox-more');
  const tabs = [...page.querySelectorAll('.account-nav [role="tab"]')];
  let availabilityTimer;
  let availabilityRequest = 0;
  let myOffset = 0;
  let inboxOffset = 0;

  function selectTab(hash = window.location.hash, scroll = false) {
    const selected = tabs.find(tab => tab.getAttribute('href') === hash) || tabs[0];
    for (const tab of tabs) {
      const active = tab === selected;
      tab.setAttribute('aria-selected', String(active));
      tab.tabIndex = active ? 0 : -1;
      find(`#${tab.getAttribute('aria-controls')}`).hidden = !active;
    }
    if (scroll) find('.account-nav').scrollIntoView({ block: 'start' });
  }

  for (const tab of tabs) {
    tab.addEventListener('click', event => {
      event.preventDefault();
      if (window.location.hash !== tab.getAttribute('href')) {
        history.pushState(null, '', tab.getAttribute('href'));
      }
      selectTab(tab.getAttribute('href'), true);
    });
    tab.addEventListener('keydown', event => {
      const index = tabs.indexOf(tab);
      const next = event.key === 'ArrowRight' ? tabs[(index + 1) % tabs.length]
        : event.key === 'ArrowLeft' ? tabs[(index + tabs.length - 1) % tabs.length]
          : event.key === 'Home' ? tabs[0] : event.key === 'End' ? tabs[tabs.length - 1] : null;
      if (!next) return;
      event.preventDefault();
      next.click();
      next.focus();
    });
  }
  window.addEventListener('popstate', () => selectTab());
  window.addEventListener('hashchange', () => selectTab());

  async function get(query) {
    const response = await fetch(`/api/comments.php?${query}`, { headers: { Accept: 'application/json' } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The request failed.');
    return result;
  }

  async function api(method, payload) {
    const response = await fetch('/api/comments.php', {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'The request failed.');
    return result;
  }

  function dateLabel(value) {
    const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    return Number.isNaN(parsed.valueOf()) ? '' : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function articleLink(slug) {
    const link = document.createElement('a');
    link.href = `../blog/${encodeURIComponent(slug)}/#comments`;
    link.textContent = slug.replaceAll('-', ' ');
    return link;
  }

  async function claimLegacyComments() {
    const claims = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key?.startsWith('blog-comment-owner:')) continue;
        const id = Number(key.slice('blog-comment-owner:'.length));
        if (Number.isSafeInteger(id) && id > 0) claims.push({ id, token: localStorage.getItem(key) });
      }
    } catch { return; }
    for (let i = 0; i < claims.length; i += 100) {
      const result = await api('POST', { action: 'account_claim', claims: claims.slice(i, i + 100) });
      for (const id of result.claimed) {
        try { localStorage.removeItem(`blog-comment-owner:${id}`); } catch {}
      }
    }
  }

  function showKey(key) {
    find('.account-key-value').textContent = key;
    find('.account-key-status').textContent = '';
    auth.hidden = true;
    dashboard.hidden = true;
    keyCard.hidden = false;
    keyCard.scrollIntoView({ block: 'start' });
  }

  function renderProfile(profile) {
    loading.hidden = true;
    page.classList.toggle('is-signed-in', profile.signed_in);
    auth.hidden = profile.signed_in;
    dashboard.hidden = !profile.signed_in;
    if (!profile.signed_in) {
      keyCard.hidden = true;
      return;
    }
    selectTab();
    const name = profile.username || '(no username)';
    find('.account-current-username').textContent = name;
    find('.account-comment-count').textContent = profile.comment_count;
    find('.account-session-count').textContent = profile.session_count;
    find('.account-unread-count').textContent = profile.unread_count;
    find('.account-unread-nav').textContent = profile.unread_count ? `(${profile.unread_count})` : '';
    find('.account-public-profile').href = profile.username
      ? `../profile/?u=${encodeURIComponent(profile.username)}` : '../profile/';
    find('.account-public-profile').hidden = !profile.username;
  }

  async function loadMyComments(reset = false) {
    const status = find('.account-comments-status');
    if (reset) { myOffset = 0; myList.replaceChildren(); }
    myMore.disabled = true;
    try {
      const result = await get(`my_comments=1&offset=${myOffset}`);
      if (reset && !result.comments.length) myList.textContent = 'No comments yet.';
      for (const comment of result.comments) {
        const row = document.createElement('div');
        row.className = 'account-comment-row';
        const heading = document.createElement('div');
        heading.className = 'account-row-heading';
        heading.append(articleLink(comment.slug));
        const when = document.createElement('span');
        when.textContent = dateLabel(comment.created_at);
        heading.append(when);
        const body = document.createElement('p');
        const unavailable = comment.deleted_at || comment.hidden_at;
        body.textContent = comment.deleted_at ? 'Comment deleted.'
          : (comment.hidden_at ? 'Comment hidden after reports.' : comment.body);
        row.append(heading, body);
        if (!unavailable) {
          const actions = document.createElement('div');
          actions.className = 'account-row-actions';
          const edit = document.createElement('button');
          edit.type = 'button';
          edit.textContent = 'Edit';
          const remove = document.createElement('button');
          remove.type = 'button';
          remove.textContent = 'Delete';
          const editForm = document.createElement('form');
          editForm.className = 'account-comment-edit';
          editForm.hidden = true;
          const textarea = document.createElement('textarea');
          textarea.value = comment.body;
          textarea.maxLength = 1000;
          textarea.required = true;
          const save = document.createElement('button');
          save.type = 'submit';
          save.textContent = 'Save';
          const cancel = document.createElement('button');
          cancel.type = 'button';
          cancel.textContent = 'Cancel';
          cancel.addEventListener('click', () => { editForm.hidden = true; });
          const message = document.createElement('span');
          message.setAttribute('role', 'status');
          editForm.append(textarea, save, cancel, message);
          edit.addEventListener('click', () => { editForm.hidden = !editForm.hidden; if (!editForm.hidden) textarea.focus(); });
          editForm.addEventListener('submit', async event => {
            event.preventDefault();
            save.disabled = true;
            message.textContent = 'Saving…';
            try {
              await api('PATCH', { slug: comment.slug, id: Number(comment.id), body: textarea.value });
              body.textContent = textarea.value.trim();
              editForm.hidden = true;
              message.textContent = '';
            } catch (error) { message.textContent = error.message; }
            finally { save.disabled = false; }
          });
          remove.addEventListener('click', async () => {
            if (!window.confirm('Delete this comment? Replies will stay visible.')) return;
            remove.disabled = true;
            try {
              await api('DELETE', { slug: comment.slug, id: Number(comment.id) });
              body.textContent = 'Comment deleted.';
              actions.remove();
              editForm.remove();
              const count = find('.account-comment-count');
              count.textContent = Math.max(0, Number(count.textContent) - 1);
            } catch (error) { status.textContent = error.message; remove.disabled = false; }
          });
          actions.append(edit, remove);
          row.append(actions, editForm);
        }
        myList.append(row);
      }
      myOffset += result.comments.length;
      myMore.hidden = !result.has_more;
      status.textContent = '';
    } catch (error) { status.textContent = error.message; }
    finally { myMore.disabled = false; }
  }

  async function loadInbox(reset = false) {
    const status = find('.account-inbox-status');
    if (reset) { inboxOffset = 0; inboxList.replaceChildren(); }
    inboxMore.disabled = true;
    try {
      const result = await get(`inbox=1&offset=${inboxOffset}`);
      if (reset && !result.notifications.length) inboxList.textContent = 'No replies yet.';
      for (const notification of result.notifications) {
        const row = document.createElement('div');
        row.className = `account-inbox-row${notification.read_at ? '' : ' is-unread'}`;
        const heading = document.createElement('div');
        heading.className = 'account-row-heading';
        const actor = document.createElement('strong');
        actor.textContent = notification.actor_name;
        const when = document.createElement('span');
        when.textContent = dateLabel(notification.created_at);
        heading.append(actor, when);
        const excerpt = document.createElement('p');
        excerpt.textContent = notification.deleted_at ? 'Reply deleted.'
          : (notification.hidden_at ? 'Reply hidden after reports.' : notification.excerpt);
        const actions = document.createElement('div');
        actions.className = 'account-row-actions';
        const link = articleLink(notification.slug);
        link.textContent = 'Open discussion';
        link.addEventListener('click', async event => {
          event.preventDefault();
          try { await api('POST', { action: 'notifications_read', id: Number(notification.id) }); }
          finally { window.location.href = link.href; }
        });
        actions.append(link);
        if (!notification.read_at) {
          const mark = document.createElement('button');
          mark.type = 'button';
          mark.textContent = 'Mark read';
          mark.addEventListener('click', async () => {
            mark.disabled = true;
            try {
              await api('POST', { action: 'notifications_read', id: Number(notification.id) });
              row.classList.remove('is-unread');
              mark.remove();
              const count = find('.account-unread-count');
              count.textContent = Math.max(0, Number(count.textContent) - 1);
              find('.account-unread-nav').textContent = Number(count.textContent) ? `(${count.textContent})` : '';
            } catch (error) { status.textContent = error.message; mark.disabled = false; }
          });
          actions.append(mark);
        }
        row.append(heading, excerpt, actions);
        inboxList.append(row);
      }
      inboxOffset += result.notifications.length;
      inboxMore.hidden = !result.has_more;
      status.textContent = '';
    } catch (error) { status.textContent = error.message; }
    finally { inboxMore.disabled = false; }
  }

  async function loadSessions() {
    const list = find('.account-session-list');
    const status = find('.account-sessions-status');
    try {
      const result = await get('sessions=1');
      list.replaceChildren();
      for (const session of result.sessions) {
        const row = document.createElement('div');
        row.className = 'account-session-row';
        const details = document.createElement('div');
        const label = document.createElement('strong');
        label.textContent = session.current ? 'This session' : 'Other session';
        const agent = document.createElement('p');
        agent.textContent = session.user_agent || 'Unknown browser';
        const seen = document.createElement('small');
        seen.textContent = `Last seen ${dateLabel(session.last_seen_at)} · expires ${dateLabel(session.expires_at)}`;
        details.append(label, agent, seen);
        const revoke = document.createElement('button');
        revoke.type = 'button';
        revoke.textContent = 'Revoke';
        revoke.addEventListener('click', async () => {
          revoke.disabled = true;
          try {
            const response = await api('POST', { action: 'account_revoke_session', id: session.id });
            if (response.signed_out) await refresh();
            else { row.remove(); find('.account-session-count').textContent = Math.max(0, Number(find('.account-session-count').textContent) - 1); }
          } catch (error) { status.textContent = error.message; revoke.disabled = false; }
        });
        row.append(details, revoke);
        list.append(row);
      }
      status.textContent = '';
    } catch (error) { status.textContent = error.message; }
  }

  async function refresh() {
    try {
      const profile = await get('account=1');
      renderProfile(profile);
      if (profile.signed_in) {
        await Promise.allSettled([loadMyComments(true), loadInbox(true), loadSessions()]);
        if (tabs.some(tab => tab.getAttribute('href') === window.location.hash)) {
          requestAnimationFrame(() => find('.account-nav').scrollIntoView({ block: 'start' }));
        }
      }
    } catch (error) {
      loading.textContent = error.message;
      loading.hidden = false;
    }
  }

  createName.addEventListener('input', () => {
    clearTimeout(availabilityTimer);
    const request = ++availabilityRequest;
    availability.textContent = '';
    if (!createName.validity.valid) return;
    availabilityTimer = setTimeout(async () => {
      try {
        const result = await get(`username_available=${encodeURIComponent(createName.value)}`);
        if (request === availabilityRequest) availability.textContent = result.available ? 'Username is available.' : 'Username is already taken.';
      } catch (error) { if (request === availabilityRequest) availability.textContent = error.message; }
    }, 450);
  });

  createForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = createForm.querySelector('button[type="submit"]');
    const status = find('.account-create-status');
    button.disabled = true;
    status.textContent = 'Creating account…';
    try {
      const result = await api('POST', { action: 'account_create', username: createName.value });
      try { await claimLegacyComments(); } catch { /* The account is still usable. */ }
      await refresh();
      showKey(result.key);
      status.textContent = '';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });

  loginForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = loginForm.querySelector('button[type="submit"]');
    const status = find('.account-login-status');
    button.disabled = true;
    status.textContent = 'Signing in…';
    try {
      await api('POST', { action: 'account_login', key: loginForm.elements.namedItem('key').value });
      loginForm.reset();
      try { await claimLegacyComments(); } catch { /* The account is still usable. */ }
      await refresh();
      status.textContent = '';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });

  rotateForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = rotateForm.querySelector('button[type="submit"]');
    const status = find('.account-rotate-status');
    button.disabled = true;
    status.textContent = 'Replacing key…';
    try {
      const result = await api('POST', { action: 'account_rotate_key', current_key: rotateForm.elements.namedItem('current_key').value });
      rotateForm.reset();
      await refresh();
      showKey(result.key);
      status.textContent = '';
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });

  find('.account-copy-key').addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(find('.account-key-value').textContent);
      find('.account-key-status').textContent = 'Copied. Keep it somewhere safe.';
    } catch { find('.account-key-status').textContent = 'Select and copy the key above.'; }
  });
  find('.account-key-done').addEventListener('click', () => {
    keyCard.hidden = true;
    dashboard.hidden = false;
    find('.account-key-value').textContent = '';
  });

  myMore.addEventListener('click', () => loadMyComments());
  inboxMore.addEventListener('click', () => loadInbox());
  find('.account-read-all').addEventListener('click', async () => {
    const status = find('.account-inbox-status');
    try {
      await api('POST', { action: 'notifications_read' });
      await refresh();
    } catch (error) { status.textContent = error.message; }
  });

  find('.account-export').addEventListener('click', async () => {
    const status = find('.account-export-status');
    status.textContent = 'Preparing download…';
    try {
      const data = await get('account_export=1');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'monnickendam-account.json';
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      status.textContent = 'Download ready.';
    } catch (error) { status.textContent = error.message; }
  });

  deleteForm.addEventListener('submit', async event => {
    event.preventDefault();
    const button = deleteForm.querySelector('button[type="submit"]');
    const status = find('.account-delete-status');
    button.disabled = true;
    status.textContent = 'Deleting account…';
    try {
      await api('POST', {
        action: 'account_delete',
        comments: deleteForm.elements.namedItem('comments').value,
        current_key: deleteForm.elements.namedItem('current_key').value,
        confirm: deleteForm.elements.namedItem('confirm').value
      });
      deleteForm.reset();
      await refresh();
      loading.textContent = 'Account deleted. Your key can no longer be used.';
      loading.hidden = false;
    } catch (error) { status.textContent = error.message; }
    finally { button.disabled = false; }
  });

  for (const [selector, action] of [['.account-signout', 'account_logout'], ['.account-signout-all', 'account_logout_all']]) {
    find(selector).addEventListener('click', async () => {
      const status = find('.account-session-status');
      status.textContent = 'Signing out…';
      try {
        await api('POST', { action });
        keyCard.hidden = true;
        await refresh();
        status.textContent = '';
      } catch (error) { status.textContent = error.message; }
    });
  }

  refresh();
})();
