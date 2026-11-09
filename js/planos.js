/* Página de planos: cards, tabela e FAQ montados a partir de js/dados.js. */
(() => {
  const D = window.FHP_DADOS;
  const esc = window.FHP?.esc || (v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]));
  const speed = plan => {
    const [n, u] = String(plan.velocidade).split(' ');
    return `<strong>${esc(n)} <small>${esc(u || '')}</small></strong>`;
  };

  const card = plan => {
    const business = plan.tipo === 'empresarial';
    const upload = plan.upload ? `<li>Upload de ${esc(plan.upload)} Mega</li>` : '';
    const price = plan.valor
      ? `<p class="price">${esc(D.formatarValor(plan.valor))}<small>/mês</small></p>`
      : '<p class="price price-consult">Preço sob consulta</p>';
    const button = plan.valor
      ? `<button class="btn btn-primary" type="button" data-assinar="${esc(plan.nome)}">ASSINAR</button>`
      : `<button class="btn btn-primary" type="button" data-assinar="${esc(plan.nome)}">PEDIR PROPOSTA</button>`;
    return `<article class="plan-card${plan.recomendado ? ' recommended' : ''}" data-plano="${esc(plan.slug)}">${plan.recomendado ? '<b>MAIS ESCOLHIDO</b>' : ''}
<h3>${esc(plan.nome).toUpperCase()}</h3>${speed(plan)}
${price}
<p class="plan-ideal">${esc(plan.ideal || '')}</p>
<ul>${plan.destaques.map(d => `<li>${esc(d)}</li>`).join('')}${upload}</ul>${button}</article>`;
  };

  document.querySelectorAll('[data-planos]').forEach(grid => {
    grid.innerHTML = D.planos.filter(p => p.tipo === grid.dataset.planos).map(card).join('');
  });
  const minimo = Math.min(...D.planos.filter(p => p.valor).map(p => p.valor));
  document.querySelectorAll('[data-preco-minimo]').forEach(el => { if (isFinite(minimo)) el.textContent = D.formatarValor(minimo); });

  const table = document.querySelector('[data-tabela-planos]');
  if (table) {
    const hasUpload = D.planos.some(p => p.upload); // a coluna só aparece quando algum plano informa upload
    const rows = D.planos.map(p => `<tr><td>${esc(p.nome)}</td><td>${esc(p.velocidade)}</td>${hasUpload ? `<td>${p.upload ? esc(p.upload) + ' Mega' : '—'}</td>` : ''}<td>${p.tipo === 'residencial' ? 'Incluso' : 'Sob consulta'}</td><td>${p.tipo === 'residencial' ? 'Inclusa' : 'Sob consulta'}</td><td>${p.valor ? esc(D.formatarValor(p.valor)) + '/mês' : 'Sob consulta'}</td></tr>`).join('');
    table.innerHTML = `<table><thead><tr><th>Plano</th><th>Velocidade</th>${hasUpload ? '<th>Upload</th>' : ''}<th>Wi-Fi</th><th>Instalação</th><th>Mensalidade</th></tr></thead><tbody>${rows}</tbody></table>`;
  }

  const faq = document.querySelector('[data-faq]');
  if (faq) {
    faq.innerHTML = D.faq.map(item => `<details class="faq-item"><summary>${esc(item.p)}</summary><p>${esc(item.r)}</p></details>`).join('');
  }

  // Alternância Residencial / Empresarial
  document.querySelectorAll('.plan-switch button').forEach(button => button.addEventListener('click', () => {
    document.querySelectorAll('.plan-switch button').forEach(b => b.classList.remove('selected'));
    button.classList.add('selected');
    document.getElementById(button.dataset.target).scrollIntoView({ behavior: 'smooth' });
  }));

  // Botões ASSINAR / PEDIR PROPOSTA (o fhp.js cuida dos planos com preço; os empresariais vão para o WhatsApp ou Fale Conosco)
  document.querySelectorAll('[data-assinar]').forEach(button => {
    const plan = D.planos.find(p => p.nome === button.dataset.assinar);
    if (!plan || plan.valor) return;
    button.addEventListener('click', event => {
      event.stopImmediatePropagation();
      const W = window.FHPWhats;
      if (W?.ativo) window.open(W.link(`Oi! Tenho interesse no ${plan.nome} para a minha empresa. Podem me enviar uma proposta?`), '_blank', 'noopener');
      else location.href = `fale-conosco.html?assunto=${encodeURIComponent('Proposta ' + plan.nome)}`;
    }, true);
  });
})();
