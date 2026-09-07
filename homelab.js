(() => {
  const lab = document.querySelector('.homelab');
  if (!lab) return;

  // Editorial groupings for the portfolio, not deployment topology.
  // Keep private infrastructure identifiers and configuration out of this file.
  const topics = [
    { name: 'Automate', subtitle: 'Less repetition', description: 'Connecting services, automating tasks, and making everyday systems work together. This is where a little tinkering can save a lot of clicking.', takeaway: 'Workflows · home automation · repeatable setup', tools: [
      ['n8n', 'Connect the dots', 'A visual workbench for connecting services and automating tasks. It also powers the contact form on this portfolio: your message goes straight into an n8n workflow.', 'The small bit of automation behind this very page.'],
      ['Home Assistant', 'Make home programmable', 'A central place to bring home automation together. Devices and actions become pieces you can combine into something useful.', 'Exploring the meeting point of software and the physical world.'],
      ['Ansible', 'Write it down. Run it again.', 'Repeatable server configuration in playbooks. A way to turn a sequence of manual maintenance steps into something you can read, reuse, and improve.', 'Infrastructure as code, with fewer steps to remember.']
    ] },
    { name: 'Keep it yours', subtitle: 'Photos, files & media', description: 'Some of the most satisfying things to self-host are the things you use every day: photos, media, files, and email.', takeaway: 'Personal media · file sharing · synchronisation', tools: [
      ['Immich', 'A home for photos', 'A self-hosted photo library for organising and browsing pictures. A good example of a homelab becoming part of everyday life.', 'Personal software, with a place on your own server.'],
      ['Jellyfin', 'Press play', 'A media server that turns a collection into a browsable library. One of the more immediately enjoyable reasons to run a server at home.', 'The entertainment corner of the lab.'],
      ['Syncthing', 'Keep files in step', 'Synchronises folders between devices. A useful building block when your files need to follow you between machines.', 'A small tool that makes several computers feel more connected.'],
      ['Copyparty', 'Files through the browser', 'A lightweight way to browse, upload, and share files through a web interface.', 'Simple tools can solve surprisingly practical problems.'],
      ['Roundcube', 'An inbox of my own', 'A browser-based email client. Another familiar everyday interface with a self-hosted home.', 'Taking an interest in the services behind everyday habits.']
    ] },
    { name: 'Connect it', subtitle: 'Behind the scenes', description: 'The networking side of self-hosting: giving applications somewhere to run, connecting them, and making them reachable.', takeaway: 'Virtualisation · containers · networking', tools: [
      ['Proxmox', 'Room to experiment', 'Virtual machines and containers give different projects their own space. Proxmox is the foundation underneath the homelab.', 'A playground for learning how systems fit together.'],
      ['Docker', 'Package the moving parts', 'Containers make it practical to work with applications and their dependencies as a unit.', 'Trying tools, building services, and keeping them organised.'],
      ['Tailscale', 'Take the lab with you', 'Private networking that helps connect devices across different places.', 'Useful infrastructure should still be useful away from home.'],
      ['AdGuard', 'Start with DNS', 'DNS filtering brings a useful layer of control to the network. A small service with a role in everyday browsing.', 'One more reason to learn what happens behind a web request.'],
      ['Nginx Proxy Manager', 'Give services a front door', 'A visual interface for managing reverse proxies: the layer that directs incoming requests to the right application.', 'Making a collection of applications easier to reach.'],
      ['Cloudflare Tunnel', 'A path to the outside', 'A tunnel connector provides another way to make a self-hosted application reachable.', 'Exploring different approaches to connecting services.']
    ] },
    { name: 'Tinker', subtitle: 'The utility bench', description: 'Dashboards, little utilities, and tools for figuring things out. The part of the lab for curiosity, troubleshooting, and the occasional rabbit hole.', takeaway: 'Data tools · dashboards · monitoring', tools: [
      ['CyberChef', 'Cook up a transformation', 'Chain together operations to decode, convert, and inspect data. A handy workbench for understanding an unfamiliar string or format.', 'A natural fit for an interest in security and forensics.'],
      ['IT Tools', 'The little helpers', 'A collection of small utilities for everyday technical tasks. The kind of toolbox that is useful to keep close by.', 'Sometimes the best tool is a very small one.'],
      ['Glance', 'A place to start', 'A dashboard that brings links and widgets together. A front page for the collection of tools behind the homelab.', 'A little organisation goes a long way.'],
      ['Uptime Kuma', 'Is it still there?', 'Service monitoring makes availability easier to keep an eye on.', 'Building something also means learning to look after it.'],
      ['MySpeed', 'How fast, really?', 'Network speed measurements turn a vague feeling about a connection into something you can inspect.', 'Measure first. Tinker second.']
    ] }
  ];
  const projectLinks = {
    "n8n": {
      "Website": "https://n8n.io/",
      "GitHub": "https://github.com/n8n-io/n8n"
    },
    "Home Assistant": {
      "Website": "https://www.home-assistant.io/",
      "GitHub": "https://github.com/home-assistant/core"
    },
    "Ansible": {
      "Website": "https://www.ansible.com/",
      "GitHub": "https://github.com/ansible/ansible"
    },
    "Immich": {
      "Website": "https://immich.app/",
      "GitHub": "https://github.com/immich-app/immich"
    },
    "Jellyfin": {
      "Website": "https://jellyfin.org/",
      "GitHub": "https://github.com/jellyfin/jellyfin"
    },
    "Syncthing": {
      "Website": "https://syncthing.net/",
      "GitHub": "https://github.com/syncthing/syncthing"
    },
    "Copyparty": {
      "Website": "https://copyparty.eu/",
      "GitHub": "https://github.com/9001/copyparty"
    },
    "Roundcube": {
      "Website": "https://roundcube.net/",
      "GitHub": "https://github.com/roundcube/roundcubemail"
    },
    "Proxmox": {
      "Website": "https://www.proxmox.com/en/products/proxmox-virtual-environment/overview",
      "Source code": "https://git.proxmox.com/"
    },
    "Docker": {
      "Website": "https://www.docker.com/",
      "Engine source": "https://github.com/moby/moby"
    },
    "Tailscale": {
      "Website": "https://tailscale.com/",
      "GitHub": "https://github.com/tailscale/tailscale"
    },
    "AdGuard": {
      "Website": "https://adguard.com/en/adguard-home/overview.html",
      "GitHub": "https://github.com/AdguardTeam/AdGuardHome"
    },
    "Nginx Proxy Manager": {
      "Website": "https://nginxproxymanager.com/",
      "GitHub": "https://github.com/NginxProxyManager/nginx-proxy-manager"
    },
    "Cloudflare Tunnel": {
      "Website": "https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflare-tunnel/",
      "GitHub": "https://github.com/cloudflare/cloudflared"
    },
    "CyberChef": {
      "Website": "https://gchq.github.io/CyberChef/",
      "GitHub": "https://github.com/gchq/CyberChef"
    },
    "IT Tools": {
      "Website": "https://it-tools.tech/",
      "GitHub": "https://github.com/CorentinTh/it-tools"
    },
    "Glance": {
      "GitHub": "https://github.com/glanceapp/glance"
    },
    "Uptime Kuma": {
      "Website": "https://uptime.kuma.pet/",
      "GitHub": "https://github.com/louislam/uptime-kuma"
    },
    "MySpeed": {
      "Website": "https://myspeed.dev/",
      "GitHub": "https://github.com/gnmyt/MySpeed"
    }
  };
  const map = lab.querySelector('.lab-map');
  const graph = lab.querySelector('.lab-graph-nodes');
  const wires = lab.querySelector('.lab-wires');
  const back = lab.querySelector('.lab-back');
  const surprise = lab.querySelector('.lab-surprise');
  let activeTopic = null;
  let selectedButton = null;
  let lastSurprise = -1;

  function showDetails(name, kind, description, takeaway) {
    for (const [field, value] of Object.entries({ name, kind, description, services: takeaway })) {
      lab.querySelector(`#lab-${field}`).textContent = value;
    }
    const links = lab.querySelector('.lab-project-links');
    links.replaceChildren();
    for (const [label, url] of Object.entries(projectLinks[name] || {})) {
      const link = document.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      if (new URL(url).hostname === 'github.com') {
        const icon = document.createElement('span');
        icon.className = 'github-icon';
        icon.setAttribute('aria-hidden', 'true');
        link.append(icon);
      }
      link.append(document.createTextNode(`${label} ↗`));
      link.setAttribute('aria-label', `${name}: ${label} (opens in a new tab)`);
      links.append(link);
    }
    links.hidden = links.children.length === 0;
  }
  function select(button, path = null) {
    if (selectedButton) selectedButton.setAttribute('aria-pressed', 'false');
    selectedButton = button;
    button.setAttribute('aria-pressed', 'true');
    [...wires.children].forEach(edge => edge.classList.toggle('is-connected', edge === path));
  }
  function node(label, subtitle, x, y, onClick, path = null) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lab-node';
    button.style.setProperty('--x', `${x}%`);
    button.style.setProperty('--y', `${y}px`);
    button.setAttribute('aria-pressed', 'false');
    const title = document.createElement('span');
    title.textContent = label;
    const small = document.createElement('small');
    small.textContent = subtitle;
    button.append(title, small);
    button.addEventListener('click', () => { select(button, path); onClick(); });
    graph.append(button);
    return button;
  }
  function branch(x, y) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    const rail = x < 50 ? 18 : 582;
    path.setAttribute('d', `M300 100V145H${rail}V${y}H${x * 6}`);
    wires.append(path);
    return path;
  }
  function prepare(height) {
    graph.replaceChildren();
    wires.replaceChildren();
    selectedButton = null;
    map.style.height = `${height}px`;
    wires.setAttribute('viewBox', `0 0 600 ${height}`);
    wires.setAttribute('preserveAspectRatio', 'none');
  }
  function showTopic(index, toolIndex = null) {
    activeTopic = index;
    const topic = topics[index];
    prepare(240 + Math.ceil(topic.tools.length / 2) * 84);
    back.hidden = false;
    lab.querySelector('.lab-map-label').textContent = 'FOLLOW YOUR CURIOSITY / PICK A TOOL';
    const describeTopic = () => showDetails(topic.name, 'Inside my toolbox', topic.description, topic.takeaway);
    const root = node(topic.name, topic.subtitle, 50, 100, describeTopic);
    const tools = topic.tools.map(([name, subtitle, description, takeaway], i) => {
      const x = i % 2 === 0 ? 25 : 75;
      const y = 210 + Math.floor(i / 2) * 84;
      return node(name, subtitle, x, y, () => showDetails(name, topic.name, description, takeaway), branch(x, y));
    });
    if (toolIndex !== null) {
      tools[toolIndex].click();
      tools[toolIndex].focus({ preventScroll: true });
    } else {
      select(root);
      describeTopic();
      root.focus({ preventScroll: true });
    }
  }
  function showOverview(focusTopic = null) {
    activeTopic = null;
    prepare(420);
    back.hidden = true;
    lab.querySelector('.lab-map-label').textContent = 'FOUR WAYS INTO THE LAB / CHOOSE A BRANCH';
    const describeLab = () => showDetails('A place to try things.', 'Self-hosting / hardware / curiosity',
      'I like understanding the tools I use, and running them myself is a good way to learn. My homelab is where networking, useful software, and side projects come together.',
      'Pick a branch to explore the tools behind it.');
    const root = node('My homelab', 'Always tinkering', 50, 100, describeLab);
    const branches = topics.map((topic, i) => {
      const x = i % 2 === 0 ? 25 : 75;
      const y = 210 + Math.floor(i / 2) * 100;
      const button = node(topic.name, topic.subtitle, x, y, () => showTopic(i), branch(x, y));
      button.setAttribute('aria-label', `Explore ${topic.name}: ${topic.subtitle}`);
      return button;
    });
    select(root);
    describeLab();
    if (focusTopic !== null) branches[focusTopic].focus({ preventScroll: true });
  }
  back.addEventListener('click', () => showOverview(activeTopic));
  map.addEventListener('keydown', event => {
    if (event.key === 'Escape' && activeTopic !== null) {
      event.preventDefault();
      showOverview(activeTopic);
    }
  });
  const destinations = topics.flatMap((topic, i) => topic.tools.map((_, j) => [i, j]));
  surprise.addEventListener('click', () => {
    // Pick a different tool each time without retry loops.
    const offset = 1 + Math.floor(Math.random() * (destinations.length - 1));
    lastSurprise = (lastSurprise + offset) % destinations.length;
    showTopic(...destinations[lastSurprise]);
  });
  showOverview();
  lab.querySelector('.lab-layout').hidden = false;
})();
