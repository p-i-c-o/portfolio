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
  buttons.forEach(button => button.addEventListener('click', () => selectNode(button.dataset.node)));
})();
