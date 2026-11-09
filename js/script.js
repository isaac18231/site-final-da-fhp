/* Comportamentos comuns das páginas públicas: menu, animações de entrada, rodapé com
   os dados da empresa, consulta de cobertura, dados estruturados e analytics. */
(() => {
  const D = window.FHP_DADOS || { empresa: {}, bairros: [], planos: [], faq: [] };
  const C = window.FHP_CONFIG || {};
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

  /* ---------- Analytics (opcional) ----------
     FHP_CONFIG.analytics: { ga4: 'G-XXXX' } ou { plausible: 'fhpfibra.com.br' }.
     Eventos: clique em ASSINAR, WhatsApp e consulta de cobertura. */
  const track = (name, params = {}) => {
    try {
      if (window.gtag) window.gtag('event', name, params);
      if (window.plausible) window.plausible(name, { props: params });
    } catch { /* analytics nunca pode quebrar o site */ }
  };
  window.FHPTrack = track;
  const loadAnalytics = () => {
    const a = C.analytics || {};
    if (a.ga4) {
      const s = document.createElement('script');
      s.async = true;
      s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(a.ga4)}`;
      document.head.append(s);
      window.dataLayer = window.dataLayer || [];
      window.gtag = function () { window.dataLayer.push(arguments); };
      window.gtag('js', new Date());
      window.gtag('config', a.ga4, { anonymize_ip: true });
    }
    if (a.plausible) {
      const s = document.createElement('script');
      s.defer = true;
      s.dataset.domain = a.plausible;
      s.src = 'https://plausible.io/js/script.js';
      document.head.append(s);
    }
  };

  /* ---------- Dados estruturados (Google) ---------- */
  const jsonLd = () => {
    const e = D.empresa;
    const whats = String(C.whatsapp || '').replace(/\D/g, '');
    const org = {
      '@context': 'https://schema.org',
      '@type': 'InternetServiceProvider',
      name: e.nome,
      url: e.site,
      logo: e.site + 'img/logo.svg',
      image: e.site + 'img/og-cover.png',
      areaServed: e.regiao,
      ...(e.telefone ? { telephone: e.telefone } : {}),
      ...(e.email ? { email: e.email } : {}),
      ...(whats ? { contactPoint: { '@type': 'ContactPoint', contactType: 'customer service', telephone: '+' + whats, availableLanguage: 'Portuguese' } } : {}),
      ...(e.endereco ? { address: { '@type': 'PostalAddress', streetAddress: e.endereco, addressLocality: 'Rio de Janeiro', addressRegion: 'RJ', postalCode: e.cep || undefined, addressCountry: 'BR' } } : {}),
      sameAs: [e.instagram, e.facebook].filter(Boolean),
      makesOffer: D.planos.filter(p => p.valor).map(p => ({
        '@type': 'Offer', name: p.nome, description: `${p.velocidade} de fibra óptica com Wi-Fi e instalação`,
        price: Number(p.valor).toFixed(2), priceCurrency: 'BRL', url: e.site + 'planos.html'
      }))
    };
    const add = obj => {
      const s = document.createElement('script');
      s.type = 'application/ld+json';
      s.textContent = JSON.stringify(obj);
      document.head.append(s);
    };
    add(org);
    if (document.querySelector('[data-faq]') && D.faq.length) {
      add({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: D.faq.map(f => ({ '@type': 'Question', name: f.p, acceptedAnswer: { '@type': 'Answer', text: f.r } })) });
    }
  };

  /* ---------- Rodapé com os dados da empresa ---------- */
  const footer = () => {
    const e = D.empresa;
    const foot = document.querySelector('.site-footer');
    if (!foot) return;
    const nav = foot.querySelector('nav');
    if (nav && !nav.querySelector('a[href="termos.html"]')) {
      nav.insertAdjacentHTML('beforeend', '<a href="termos.html">Termos de uso</a><a href="privacidade.html">Privacidade</a>');
    }
    const lines = [
      e.razaoSocial ? esc(e.razaoSocial) : '',
      e.cnpj ? `CNPJ ${esc(e.cnpj)}` : '',
      e.endereco ? `${esc(e.endereco)}${e.cidade ? ' · ' + esc(e.cidade) : ''}${e.cep ? ' · CEP ' + esc(e.cep) : ''}` : '',
      e.horario ? `Atendimento: ${esc(e.horario)}` : '',
      e.telefone ? `Telefone: <a href="tel:${esc(e.telefone.replace(/\D/g, ''))}">${esc(e.telefone)}</a>` : '',
      e.email ? `E-mail: <a href="mailto:${esc(e.email)}">${esc(e.email)}</a>` : ''
    ].filter(Boolean);
    const social = [['Instagram', e.instagram], ['Facebook', e.facebook]].filter(([, url]) => url)
      .map(([name, url]) => `<a href="${esc(url)}" target="_blank" rel="noopener">${name}</a>`).join(' · ');
    const small = foot.querySelector('small');
    if (small) {
      small.innerHTML = `${lines.length ? `<span class="footer-info">${lines.join('<br>')}</span>` : ''}${social ? `<span class="footer-social">${social}</span>` : ''}<span>© ${new Date().getFullYear()} ${esc(e.nome)}. Todos os direitos reservados.</span>`;
    }
  };

  /* ---------- Consulta de cobertura ----------
     Com FHP_DADOS.bairros preenchido: responde na hora (bairro digitado ou bairro do CEP via ViaCEP).
     Sem a lista: encaminha o endereço para o WhatsApp. */
  const coverage = () => {
    document.querySelectorAll('[data-cobertura]').forEach(form => {
      const input = form.querySelector('input');
      const out = form.querySelector('.cobertura-result');
      const W = window.FHPWhats;
      const say = (html, cls = '') => { out.className = 'cobertura-result ' + cls; out.innerHTML = html; };
      const waLink = text => W?.ativo ? `<a href="${W.link(text)}" target="_blank" rel="noopener">confirme pelo WhatsApp</a>` : '<a href="fale-conosco.html?assunto=Cobertura">fale com a equipe</a>';
      form.addEventListener('submit', async event => {
        event.preventDefault();
        const raw = input.value.trim();
        if (!raw) { say('Digite seu bairro ou CEP.', 'warn'); input.focus(); return; }
        const cep = raw.replace(/\D/g, '');
        let bairro = raw;
        track('consulta_cobertura', { local: raw });
        if (/^\d{8}$/.test(cep)) {
          say('Consultando o CEP…');
          try {
            const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(6000) });
            const data = await r.json();
            if (data.erro) { say('CEP não encontrado. Tente digitar o nome do bairro.', 'warn'); return; }
            bairro = data.bairro || data.localidade || raw;
            if (data.localidade && norm(data.localidade) !== 'rio de janeiro') {
              say(`Por enquanto atendemos só o Rio de Janeiro (${esc(D.empresa.regiao)}). Se quiser, ${waLink(`Oi! Vocês atendem ${data.localidade}? CEP ${raw}.`)}.`, 'warn');
              return;
            }
          } catch {
            say(`Não consegui consultar o CEP agora. ${waLink(`Oi! Quero saber se a FHP Fibra atende o CEP ${raw}.`)}.`, 'warn');
            return;
          }
        }
        if (!D.bairros.length) {
          say(`Vamos confirmar seu endereço: ${waLink(`Oi! Quero saber se a FHP Fibra atende em ${bairro}${bairro !== raw ? ` (CEP ${raw})` : ''}.`)}.`);
          return;
        }
        const hit = D.bairros.find(b => norm(b) === norm(bairro) || norm(bairro).includes(norm(b)));
        if (hit) say(`Boa notícia: atendemos em <b>${esc(hit)}</b>! <a href="planos.html#residencial">Escolha seu plano</a> e assine online.`, 'ok');
        else say(`Ainda não temos confirmação para <b>${esc(bairro)}</b>. Estamos sempre expandindo a rede — ${waLink(`Oi! Vocês atendem em ${bairro}${bairro !== raw ? ` (CEP ${raw})` : ''}? Quero ser avisado quando chegar.`)}.`, 'warn');
      });
    });
  };

  /* ---------- Eventos de conversão ---------- */
  const events = () => {
    document.addEventListener('click', event => {
      const assinar = event.target.closest('[data-assinar]');
      if (assinar) track('clique_assinar', { plano: assinar.dataset.assinar });
      const wa = event.target.closest('a[href^="https://wa.me/"]');
      if (wa) track('clique_whatsapp', { pagina: location.pathname.split('/').pop() || 'index.html' });
    }, true);
  };

  document.addEventListener('DOMContentLoaded', () => {
    // Link "pular para o conteúdo"
    const main = document.querySelector('main');
    if (main && !document.querySelector('.skip-link')) {
      if (!main.id) main.id = 'conteudo';
      document.body.insertAdjacentHTML('afterbegin', `<a class="skip-link" href="#${main.id}">Pular para o conteúdo</a>`);
    }
    const toggle = document.querySelector('.menu-toggle'), nav = document.querySelector('.main-nav');
    if (toggle && nav) toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open);
    });
    const items = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window)) items.forEach(i => i.classList.add('visible'));
    else {
      const observer = new IntersectionObserver(entries => entries.forEach(e => {
        if (e.isIntersecting) { e.target.classList.add('visible'); observer.unobserve(e.target); }
      }), { threshold: .1 });
      items.forEach(i => observer.observe(i));
    }
    // No celular, os botões flutuantes somem enquanto os cartões do hero ou a consulta de
    // cobertura estão na tela (senão cobrem o conteúdo). O CSS está em css/home.css.
    if ('IntersectionObserver' in window) {
      const visible = new Set();
      const io = new IntersectionObserver(entries => {
        entries.forEach(e => e.isIntersecting ? visible.add(e.target) : visible.delete(e.target));
        document.body.classList.toggle('hero-stats-visible', visible.size > 0);
      }, { threshold: .2 });
      document.querySelectorAll('.hero-stats, .cobertura-card').forEach(el => io.observe(el));
    }
    footer();
    coverage();
    events();
    jsonLd();
    loadAnalytics();
  });
})();
