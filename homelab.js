(() => {
  const lab = document.querySelector('.homelab');
  if (!lab) return;

  // Example content only. Replace these descriptions with the actual lab inventory.
  const nodes = {
    internet: { name: 'Internet', kind: '01 / Upstream', description: 'The outside connection. Requests to public services leave the home network through the gateway.', services: 'Example role: upstream connectivity' },
    router: { name: 'Gateway', kind: '02 / Networking', description: 'The junction between the home network and the outside world. A gateway routes traffic and can enforce firewall rules.', services: 'Example roles: routing · firewall · DHCP' },
    compute: { name: 'Compute', kind: '03 / Services', description: 'A place to run self-hosted applications. This could be a small computer, a server, or a host running several virtual machines.', services: 'Example workloads: web apps · automation · containers' },
    storage: { name: 'Storage', kind: '04 / Data', description: 'A shared home for files used by devices on the network. A separate backup would protect against losing this device.', services: 'Example roles: file shares · archives' },
    client: { name: 'Client', kind: '05 / Access', description: 'The laptop or desktop you use to reach your services, manage the lab, and occasionally figure out why something stopped working.', services: 'Example tools: browser · terminal · SSH' }
  };
  const buttons = [...lab.querySelectorAll('[data-node]')];
  const links = [...lab.querySelectorAll('[data-link]')];
  function selectNode(id) {
    const node = nodes[id];
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.node === id)));
    links.forEach(link => link.classList.toggle('is-connected', link.dataset.link.split(' ').includes(id)));
    for (const field of ['name', 'kind', 'description', 'services']) {
      lab.querySelector(`#lab-${field}`).textContent = node[field];
    }
  }
  const traceButton = lab.querySelector('#lab-trace');
  const traceStatus = lab.querySelector('#lab-trace-status');
  let timers = [];
  function resetTrace() {
    timers.forEach(clearTimeout);
    timers = [];
    links.forEach(link => link.classList.remove('is-tracing'));
    traceButton.disabled = false;
  }
  buttons.forEach(button => button.addEventListener('click', () => {
    resetTrace();
    traceStatus.textContent = 'Follow a simulated request from the client to the server.';
    selectNode(button.dataset.node);
  }));
  traceButton.addEventListener('click', () => {
    resetTrace();
    traceButton.disabled = true;
    const steps = [
      ['client', null, '1 / 3 — The client requests a self-hosted app.'],
      ['router', 'router client', '2 / 3 — The gateway routes it to the server subnet in this example.'],
      ['compute', 'router compute', '3 / 3 — The server receives the request. Destination reached.']
    ];
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const showStep = ([id, edge, message]) => {
      selectNode(id);
      links.forEach(link => link.classList.toggle('is-tracing', link.dataset.link === edge));
      traceStatus.textContent = message;
    };
    if (reducedMotion) {
      showStep(steps[2]);
      traceStatus.textContent = 'Simulation complete: client → gateway → compute. The gateway routes between subnets in this example.';
      resetTrace();
      return;
    }
    showStep(steps[0]);
    steps.slice(1).forEach((step, i) => timers.push(setTimeout(() => showStep(step), (i + 1) * 1100)));
    timers.push(setTimeout(resetTrace, 3300));
  });
})();
