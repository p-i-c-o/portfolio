(() => {
  const page = document.querySelector('.profile-page');
  if (!page) return;
  const requested = new URLSearchParams(window.location.search).get('u');
  const name = page.querySelector('.profile-name');
  const meta = page.querySelector('.profile-meta');
  const avatar = page.querySelector('.profile-avatar');
  const list = page.querySelector('.profile-comments');
  const more = page.querySelector('.profile-more');
  let offset = 0;

  function dateLabel(value) {
    const parsed = new Date(value.includes('T') ? value : `${value.replace(' ', 'T')}Z`);
    return Number.isNaN(parsed.valueOf()) ? '' : parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function paintAvatar(seed) {
    avatar.replaceChildren();
    const hue = parseInt(seed.slice(0, 2), 16) * 360 / 255;
    avatar.style.setProperty('--avatar-color', `hsl(${hue} 70% 72%)`);
    for (let row = 0; row < 5; row++) {
      for (let column = 0; column < 5; column++) {
        const index = row * 3 + Math.min(column, 4 - column);
        const cell = document.createElement('span');
        if (parseInt(seed[index + 2], 16) % 2) cell.className = 'filled';
        avatar.append(cell);
      }
    }
  }

  async function load(reset = false) {
    if (!requested) {
      list.textContent = 'Open a username from a comment to view its profile.';
      more.hidden = true;
      return;
    }
    if (reset) { offset = 0; list.replaceChildren(); }
    more.disabled = true;
    try {
      const query = new URLSearchParams({ profile: requested, offset: String(offset) });
      const response = await fetch(`/api/comments.php?${query}`, { headers: { Accept: 'application/json' } });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not load profile.');
      name.textContent = result.username;
      document.title = `${result.username} | monnickendam.ch`;
      meta.textContent = `${result.comment_count} public comments · joined ${dateLabel(result.created_at)}`;
      paintAvatar(result.avatar_seed);
      if (offset === 0 && !result.comments.length) list.textContent = 'No public comments yet.';
      for (const comment of result.comments) {
        const row = document.createElement('div');
        row.className = 'account-comment-row';
        const heading = document.createElement('div');
        heading.className = 'account-row-heading';
        const link = document.createElement('a');
        link.href = `../blog/${encodeURIComponent(comment.slug)}/#comments`;
        link.textContent = comment.slug.replaceAll('-', ' ');
        const when = document.createElement('span');
        when.textContent = dateLabel(comment.created_at);
        heading.append(link, when);
        const excerpt = document.createElement('p');
        excerpt.textContent = comment.excerpt;
        row.append(heading, excerpt);
        list.append(row);
      }
      offset += result.comments.length;
      more.hidden = !result.has_more;
    } catch (error) {
      if (reset) list.textContent = error.message;
      else list.append(document.createTextNode(error.message));
    } finally { more.disabled = false; }
  }

  more.addEventListener('click', () => load());
  load(true);
})();
