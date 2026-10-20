(() => {
  const section = document.querySelector(".comments[data-comment-slug]");
  if (!section) return;

  const slug = section.dataset.commentSlug;
  const list = section.querySelector(".comments-list");
  const more = section.querySelector(".comments-more");
  const sortBar = section.querySelector(".comments-discussion-bar");
  const sortSelect = section.querySelector(".comments-sort");
  const formCard = document.querySelector(".comment-form-card");
  const formHome = formCard.querySelector(".comments-form-home");
  const form = formCard.querySelector(".comments-form");
  new MutationObserver(() => { formCard.hidden = !formHome.contains(form); }).observe(formHome, { childList: true });
  const title = form.querySelector(".comments-form-title");
  const target = form.querySelector(".comments-target");
  const cancel = form.querySelector(".comments-cancel");
  const status = form.querySelector(".comments-status");
  const submit = form.querySelector('button[type="submit"]');
  const bodyInput = form.elements.namedItem("body");
  const websiteInput = form.elements.namedItem("website");
  const accountCard = document.querySelector(".comment-account-card");
  const accountGuest = accountCard.querySelector(".comment-account-guest");
  const accountMember = accountCard.querySelector(".comment-account-member");
  const accountUsername = accountCard.querySelector(".comment-account-username");
  const unreadCount = accountCard.querySelector(".comment-unread-count");
  const identity = form.querySelector('.comment-identity');
  const threads = new Map();
  const memoryTokens = new Map();
  let offset = 0;
  let loading = false;
  let posting = false;
  let submissionToken = null;
  let sortMode = sortSelect.value;
  let pendingSortReload = false;
  let truncationFrame = 0;
  let currentUsername = null;
  let mode = { kind: "create", parent: null, rootId: null };

  function ownerToken(id) {
    if (memoryTokens.has(id)) return memoryTokens.get(id);
    try { return localStorage.getItem(`blog-comment-owner:${id}`); } catch { return null; }
  }

  function saveOwnerToken(id, token) {
    memoryTokens.set(id, token);
    try { localStorage.setItem(`blog-comment-owner:${id}`, token); } catch {}
  }

  function forgetOwnerToken(id) {
    memoryTokens.delete(id);
    try { localStorage.removeItem(`blog-comment-owner:${id}`); } catch {}
  }

  function showAccount(signedInNow, username, unread = 0) {
    currentUsername = signedInNow ? username : null;
    accountGuest.hidden = signedInNow;
    accountMember.hidden = !signedInNow;
    accountUsername.textContent = username || "an account without a username";
    unreadCount.textContent = unread ? `(${unread})` : "";
    identity.textContent = signedInNow
      ? (username ? `Posting as ${username}` : 'This account has no username and cannot post.')
      : 'Posting as Anonymous commenter';
    updateSubmitReady();
  }

  function updateSubmitReady() {
    const age = submissionToken ? Date.now() / 1000 - Number(submissionToken.split(".")[0]) : 0;
    submit.disabled = posting || !submissionToken || (accountMember.hidden === false && !currentUsername)
      || (mode.kind === "create" && age < 3);
    if (!posting && submissionToken && mode.kind === "create" && age < 3) {
      setTimeout(updateSubmitReady, Math.max(100, (3 - age) * 1000));
    }
  }

  async function api(method, payload) {
    const response = await fetch("/api/comments.php", {
      method,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ slug, ...payload })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "The request failed.");
    return result;
  }

  function setStatus(message) {
    status.textContent = message;
  }

  function resetForm() {
    formHome.append(form);
    form.reset();
    mode = { kind: "create", parent: null, rootId: null };
    title.textContent = "Leave a comment";
    target.hidden = true;
    cancel.hidden = true;
    submit.textContent = "Post comment";
    updateSubmitReady();
  }

  function focusForm() {
    bodyInput.focus({ preventScroll: true });
  }

  function startReply(comment, rootId, host) {
    resetForm();
    host.append(form);
    mode = { kind: "create", parent: comment.id, rootId };
    title.textContent = "Write a reply";
    target.textContent = `Replying to ${comment.name}`;
    target.hidden = false;
    cancel.hidden = false;
    submit.textContent = "Post reply";
    setStatus("");
    focusForm();
  }

  function startEdit(comment, host) {
    resetForm();
    host.append(form);
    mode = { kind: "edit", comment };
    bodyInput.value = comment.body;
    title.textContent = "Edit comment";
    target.textContent = "Your changes will appear immediately.";
    target.hidden = false;
    cancel.hidden = false;
    submit.textContent = "Save changes";
    setStatus("");
    updateSubmitReady();
    focusForm();
  }

  function actionButton(label, onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  }

  function formatScore(value) {
    const magnitude = Math.abs(value);
    if (magnitude < 1000) return String(value);
    const units = [["k", 1e3], ["m", 1e6], ["b", 1e9], ["t", 1e12]];
    let index = 0;
    while (index < units.length - 1 && magnitude >= units[index + 1][1]) index++;
    let scaled = Math.round(magnitude / units[index][1] * 10) / 10;
    if (scaled >= 1000 && index < units.length - 1) {
      index++;
      scaled = Math.round(magnitude / units[index][1] * 10) / 10;
    }
    return `${value < 0 ? "−" : ""}${scaled}${units[index][0]}`;
  }

  function scheduleTruncation() {
    if (truncationFrame) return;
    truncationFrame = requestAnimationFrame(() => {
      truncationFrame = 0;
      for (const body of list.querySelectorAll(".comment-body")) {
        const toggle = body.nextElementSibling;
        if (!toggle?.classList.contains("comment-more")) continue;
        const expanded = toggle.getAttribute("aria-expanded") === "true";
        body.classList.add("is-collapsed");
        const overflows = body.scrollHeight > body.clientHeight + 1;
        if (expanded && overflows) body.classList.remove("is-collapsed");
        else if (expanded) {
          toggle.textContent = "More";
          toggle.setAttribute("aria-expanded", "false");
        }
        toggle.hidden = !overflows;
      }
    });
  }

  function sortContainer(container) {
    const articles = Array.from(container.children).filter(element => element.classList.contains("comment"));
    if (articles.length < 2) return;
    articles.sort((a, b) => {
      const newest = Number(b.dataset.commentId) - Number(a.dataset.commentId);
      return sortMode === "top" ? Number(b.dataset.score) - Number(a.dataset.score) || newest : newest;
    });
    container.append(...articles);
  }

  function sortVisibleComments() {
    sortContainer(list);
    for (const container of list.querySelectorAll(".comment-replies, .comment-children")) {
      sortContainer(container);
    }
  }

  function makeComment(comment, rootId = null) {
    const article = document.createElement("article");
    article.className = rootId === null ? "comment" : "comment comment-reply";
    article.id = `comment-${comment.id}`;
    article.dataset.commentId = String(comment.id);

    const content = document.createElement("div");
    content.className = "comment-content";
    const votes = document.createElement("div");
    votes.className = "comment-votes";
    votes.setAttribute("role", "group");
    votes.setAttribute("aria-label", `Votes for comment by ${comment.name}`);
    const main = document.createElement("div");
    main.className = "comment-main";
    const score = document.createElement("span");
    score.className = "comment-score";
    score.setAttribute("aria-live", "polite");
    const voteStatus = document.createElement("span");
    voteStatus.className = "comment-vote-status";
    voteStatus.setAttribute("role", "status");
    const upvote = actionButton("+", () => castVote(1));
    const downvote = actionButton("−", () => castVote(-1));
    upvote.setAttribute("aria-label", `Upvote comment by ${comment.name}`);
    downvote.setAttribute("aria-label", `Downvote comment by ${comment.name}`);
    function paintVotes() {
      article.dataset.score = String(comment.score);
      score.textContent = formatScore(comment.score);
      score.setAttribute("aria-label", `Score ${comment.score.toLocaleString()}`);
      score.title = `Score ${comment.score.toLocaleString()}`;
      upvote.setAttribute("aria-pressed", String(comment.user_vote === 1));
      downvote.setAttribute("aria-pressed", String(comment.user_vote === -1));
    }
    async function castVote(direction) {
      const previousVote = comment.user_vote;
      const previousScore = comment.score;
      const value = previousVote === direction ? 0 : direction;
      comment.user_vote = value;
      comment.score = previousScore + value - previousVote;
      voteStatus.textContent = "";
      paintVotes();
      upvote.disabled = downvote.disabled = true;
      try {
        const result = await api("POST", { action: "vote", id: comment.id, value });
        if (!Number.isInteger(result.score) || ![-1, 0, 1].includes(result.user_vote)) {
          throw new Error("Vote response was invalid.");
        }
        comment.score = result.score;
        comment.user_vote = result.user_vote;
        paintVotes();
        if (sortMode === "top") sortVisibleComments();
      } catch (error) {
        comment.score = previousScore;
        comment.user_vote = previousVote;
        paintVotes();
        voteStatus.textContent = error.message || "Vote could not be saved.";
      }
      finally { upvote.disabled = downvote.disabled = false; }
    }
    paintVotes();
    if (comment.deleted || comment.hidden) upvote.disabled = downvote.disabled = true;
    votes.append(downvote, score, upvote);
    content.append(main);
    article.append(content);

    const heading = document.createElement("div");
    heading.className = "comment-meta";
    const name = document.createElement("strong");
    if (comment.profile_username) {
      const profile = document.createElement("a");
      profile.href = `/profile/?u=${encodeURIComponent(comment.profile_username)}`;
      profile.textContent = comment.name;
      name.append(profile);
      const badge = document.createElement("span");
      badge.className = "comment-account-badge";
      badge.textContent = "account";
      heading.append(name, badge);
    } else name.textContent = comment.name;
    const date = document.createElement("time");
    date.dateTime = comment.created_at;
    const parsedDate = new Date(comment.created_at);
    date.textContent = Number.isNaN(parsedDate.valueOf())
      ? ""
      : parsedDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
    if (!comment.profile_username) heading.append(name);
    heading.append(date);
    if (comment.edited_at && !comment.deleted && !comment.hidden) {
      const edited = document.createElement("span");
      edited.textContent = "edited";
      heading.append(edited);
    }
    main.append(heading);

    const body = document.createElement("p");
    body.className = "comment-body is-collapsed";
    body.id = `comment-body-${comment.id}`;
    body.textContent = comment.deleted ? "Comment deleted." : (comment.hidden ? "Comment hidden after reports." : comment.body);
    main.append(body);
    if (!comment.deleted && !comment.hidden) {
      const expand = actionButton("More", () => {
        const expanded = expand.getAttribute("aria-expanded") === "true";
        body.classList.toggle("is-collapsed", expanded);
        expand.textContent = expanded ? "More" : "Less";
        expand.setAttribute("aria-expanded", String(!expanded));
      });
      expand.className = "comment-more";
      expand.setAttribute("aria-controls", body.id);
      expand.setAttribute("aria-expanded", "false");
      expand.hidden = true;
      main.append(expand);
    }

    if (!comment.deleted && !comment.hidden) {
      const actions = document.createElement("div");
      actions.className = "comment-actions";
      actions.append(votes, voteStatus);
      actions.append(actionButton("Reply", () => startReply(comment, rootId ?? comment.id, inlineHost)));

      const report = actionButton("", () => {
        reportForm.hidden = !reportForm.hidden;
      });
      report.className = "comment-report-toggle";
      const flag = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      flag.setAttribute("viewBox", "0 0 24 24");
      flag.setAttribute("width", "14");
      flag.setAttribute("height", "14");
      flag.setAttribute("aria-hidden", "true");
      const flagPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
      flagPath.setAttribute("d", "M5 21V3m1 1h13l-3 4 3 4H6");
      flagPath.setAttribute("fill", "none");
      flagPath.setAttribute("stroke", "currentColor");
      flagPath.setAttribute("stroke-width", "1.8");
      flagPath.setAttribute("stroke-linecap", "round");
      flagPath.setAttribute("stroke-linejoin", "round");
      flag.append(flagPath);
      report.append(flag);
      report.title = comment.reported_by_me ? "Reported" : "Report comment";
      report.setAttribute("aria-label", `${comment.reported_by_me ? "Reported" : "Report"} comment by ${comment.name}`);
      report.disabled = comment.reported_by_me;
      actions.append(report);

      if (comment.owned_by_me || ownerToken(comment.id)) {
        actions.append(actionButton("Edit", () => startEdit(comment, inlineHost)));
        actions.append(actionButton("Delete", async () => {
          if (!window.confirm("Delete this comment? Replies will stay visible.")) return;
          try {
            await api("DELETE", { id: comment.id, owner_token: ownerToken(comment.id) });
            forgetOwnerToken(comment.id);
            setStatus("Comment deleted.");
            if (rootId === null) await loadComments(true);
            else await threads.get(rootId)?.expand(true);
          } catch (error) { setStatus(error.message); }
        }));
      }

      main.append(actions);

      const reportForm = document.createElement("div");
      reportForm.className = "comment-report";
      reportForm.hidden = true;
      const reason = document.createElement("select");
      reason.setAttribute("aria-label", "Reason for report");
      for (const [value, label] of [["spam", "Spam"], ["harassment", "Harassment"], ["other", "Other"]]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = label;
        reason.append(option);
      }
      const sendReport = actionButton("Send report", async () => {
        sendReport.disabled = true;
        try {
          const result = await api("POST", { action: "report", id: comment.id, reason: reason.value });
          reportForm.hidden = true;
          report.disabled = true;
          report.title = "Reported";
          report.setAttribute("aria-label", `Reported comment by ${comment.name}`);
          setStatus("Report received.");
          if (result.hidden) {
            if (rootId === null) await loadComments(true);
            else await threads.get(rootId)?.expand(true);
          }
        } catch (error) { setStatus(error.message); sendReport.disabled = false; }
      });
      reportForm.append(reason, sendReport, actionButton("Cancel", () => { reportForm.hidden = true; }));
      main.append(reportForm);
    } else {
      votes.classList.add("comment-votes-inactive");
      main.append(votes);
    }

    const inlineHost = document.createElement("div");
    inlineHost.className = "comment-inline-form";
    main.append(inlineHost);

    if (rootId === null) {
      const replies = document.createElement("div");
      replies.className = "comment-thread";
      const show = actionButton(`Show replies (${comment.reply_count})`, () => thread.expand());
      show.hidden = comment.reply_count === 0;
      const replyList = document.createElement("div");
      replyList.className = "comment-replies";
      const moreReplies = actionButton("Load more replies", () => thread.load());
      moreReplies.hidden = true;
      replies.append(show, replyList, moreReplies);
      article.append(replies);

      const thread = {
        offset: 0,
        loading: false,
        items: [],
        render() {
          const activeId = mode.kind === "edit" ? mode.comment.id : mode.parent;
          const activeRootId = mode.kind === "edit" ? mode.comment.root_id : mode.rootId;
          const moveForm = activeId !== null && activeId !== comment.id
            && activeRootId === comment.id && !formHome.contains(form);
          if (moveForm) formHome.append(form);
          replyList.replaceChildren();
          const nodes = new Map(this.items.map(reply => [reply.id, { reply, children: [] }]));
          const topLevel = [];
          for (const reply of this.items) {
            const node = nodes.get(reply.id);
            const parent = nodes.get(reply.parent_id);
            if (parent) parent.children.push(node);
            else topLevel.push(node);
          }
          function appendNode(node, container, depth) {
            const element = makeComment(node.reply, comment.id);
            container.append(element);
            if (node.children.length) {
              const branch = document.createElement("div");
              branch.className = depth >= 5 ? "comment-children comment-children-flat" : "comment-children";
              element.append(branch);
              for (const child of node.children) appendNode(child, branch, depth + 1);
            }
          }
          for (const node of topLevel) appendNode(node, replyList, 1);
          if (this.items.length === 0) replyList.textContent = "No replies yet.";
          sortVisibleComments();
          scheduleTruncation();
          if (moveForm) {
            const host = replyList.querySelector(`[data-comment-id="${activeId}"] > .comment-inline-form`);
            if (host) host.append(form);
          }
        },
        async load(reset = false) {
          if (this.loading) return;
          this.loading = true;
          show.disabled = true;
          moreReplies.disabled = true;
          if (reset) { this.offset = 0; this.items = []; replyList.replaceChildren(); }
          try {
            const query = new URLSearchParams({ slug, sort: sortMode, thread_id: String(comment.id), offset: String(this.offset) });
            const response = await fetch(`/api/comments.php?${query}`, { headers: { Accept: "application/json" } });
            if (!response.ok) throw new Error("Could not load replies.");
            const data = await response.json();
            this.items.push(...data.comments);
            this.render();
            this.offset += data.comments.length;
            moreReplies.hidden = !data.has_more;
            show.hidden = true;
          } catch (error) { setStatus(error.message); }
          finally { this.loading = false; show.disabled = false; moreReplies.disabled = false; }
        },
        async expand(reset = false) {
          await this.load(reset || this.offset === 0);
        }
      };
      threads.set(comment.id, thread);
    }
    return article;
  }

  async function loadComments(reset = false) {
    if (loading) {
      if (reset) pendingSortReload = true;
      return;
    }
    loading = true;
    more.disabled = true;
    const requestedSort = sortMode;
    const activeId = mode.kind === "edit" ? mode.comment.id : mode.parent;
    if (reset) {
      if (activeId !== null && !formHome.contains(form)) formHome.append(form);
      offset = 0;
      threads.clear();
      list.textContent = "Loading comments…";
      more.hidden = true;
    }
    try {
      const query = new URLSearchParams({ slug, sort: requestedSort, offset: String(offset) });
      const response = await fetch(`/api/comments.php?${query}`, { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Could not load comments.");
      const data = await response.json();
      if (requestedSort !== sortMode) return;
      showAccount(Boolean(data.signed_in), data.username, data.unread_count);
      if (!submissionToken || Date.now() / 1000 - Number(submissionToken.split(".")[0]) > 7000) {
        submissionToken = data.submission_token;
      }
      updateSubmitReady();
      if (reset) list.replaceChildren();
      const expanded = [];
      for (const comment of data.comments) {
        list.append(makeComment(comment));
        if (comment.reply_count) expanded.push(threads.get(comment.id).expand());
      }
      offset += data.comments.length;
      more.hidden = !data.has_more;
      sortBar.hidden = offset === 0;
      if (offset === 0) list.textContent = "No comments yet. Be the first to write one.";
      await Promise.allSettled(expanded);
      sortVisibleComments();
      scheduleTruncation();
      if (reset && activeId !== null) {
        const host = list.querySelector(`[data-comment-id="${activeId}"] > .comment-inline-form`);
        if (host) host.append(form);
        else resetForm();
      }
    } catch (error) {
      if (reset) list.textContent = "Comments are unavailable right now.";
      else setStatus(error.message);
    } finally {
      loading = false;
      more.disabled = false;
      if (pendingSortReload) {
        pendingSortReload = false;
        loadComments(true);
      }
    }
  }

  cancel.addEventListener("click", () => { resetForm(); setStatus(""); });
  more.addEventListener("click", () => loadComments());
  window.addEventListener("resize", scheduleTruncation);
  sortSelect.addEventListener("change", () => {
    sortMode = sortSelect.value;
    loadComments(true);
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    posting = true;
    updateSubmitReady();
    setStatus(mode.kind === "edit" ? "Saving…" : "Posting…");
    const currentMode = mode;
    const body = bodyInput.value.trim();
    try {
      if (currentMode.kind === "edit") {
        await api("PATCH", {
          id: currentMode.comment.id,
          owner_token: ownerToken(currentMode.comment.id),
          body
        });
        resetForm();
        setStatus("Comment updated.");
        if (currentMode.comment.root_id === null) await loadComments(true);
        else await threads.get(currentMode.comment.root_id)?.expand(true);
      } else {
        const result = await api("POST", {
          action: "create",
          parent_id: currentMode.parent,
          body,
          website: websiteInput.value,
          submission_token: submissionToken
        });
        if (result.owner_token) saveOwnerToken(result.id, result.owner_token);
        resetForm();
        setStatus(currentMode.parent === null ? "Comment posted." : "Reply posted.");
        if (currentMode.rootId === null) await loadComments(true);
        else await threads.get(currentMode.rootId)?.expand(true);
      }
    } catch (error) { setStatus(error.message || "Could not save comment."); }
    finally { posting = false; updateSubmitReady(); }
  });

  loadComments(true);
})();
