/* Assistente da FHP Fibra.
   - Entende perguntas sobre planos (por nome, velocidade ou preço), recomenda um plano em duas
     perguntas, consulta cobertura na própria conversa (bairro ou CEP), explica pagamento,
     suporte, contratação e conta.
   - Sabe em que página está e quem está logado (saudação e atalhos mudam).
   - A conversa continua ao trocar de página (sessionStorage) e pode ser passada ao atendente
     pelo WhatsApp com o histórico.
   - Com o servidor ligado (ANTHROPIC_API_KEY), perguntas livres vão para a IA; sem ele, ou se
     a IA falhar, as respostas prontas daqui assumem. Os dados vêm de js/dados.js. */
(() => {
  const D = window.FHP_DADOS || { empresa: {}, bairros: [], planos: [], faq: [], formatarValor: () => '' };
  const C = window.FHP_CONFIG || {};
  const A = () => window.FHP;
  const W = () => window.FHPWhats;
  const STORE = 'fhp_bot';
  const MAX_HISTORY = 12;

  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const L = (href, txt) => `<a href="${href}">${txt}</a>`;
  const wa = (text, label) => W()?.ativo
    ? `<a href="${W().link(text)}" target="_blank" rel="noopener">${label}</a>`
    : L('fale-conosco.html', label);
  const has = (t, words) => words.some(w => new RegExp('(^|[^a-z0-9])' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '($|[^a-z0-9])').test(t));

  /* ---------- Contexto: página, usuário, plano ---------- */
  const page = (location.pathname.split('/').pop() || 'index.html').replace(/\.html$/, '') || 'index';
  const params = new URLSearchParams(location.search);
  const user = () => A()?.session?.() || null;
  const firstName = () => (user()?.nome || '').split(' ')[0];
  const isClient = () => user()?.nivel === 'cliente';
  const planInView = () => D.planos.find(p => p.nome === params.get('plano')) || null;
  const residential = () => D.planos.filter(p => p.tipo === 'residencial' && p.valor);
  const business = () => D.planos.filter(p => p.tipo === 'empresarial');

  /* ---------- Planos: localizar e descrever ---------- */
  const findPlan = t => {
    const byName = D.planos.find(p => has(t, [norm(p.nome), norm(p.nome.replace(/^fhp\s+/i, ''))]));
    if (byName) return byName;
    const speed = /(\d{3,4})\s*(mega|mb|megas)?\b/.exec(t);
    if (speed) {
      const n = Number(speed[1]);
      const hit = D.planos.find(p => p.download === n && p.tipo === 'residencial') || D.planos.find(p => p.download === n);
      if (hit) return hit;
    }
    if (/\b(1|um)\s*(giga|gb)\b/.test(t)) return D.planos.find(p => p.download === 1000 && p.tipo === 'residencial');
    const price = /(\d{2,3})[,.](\d{2})/.exec(t);
    if (price) {
      const v = Number(`${price[1]}.${price[2]}`);
      const hit = D.planos.find(p => p.valor && Math.abs(p.valor - v) < 0.01);
      if (hit) return hit;
    }
    return null;
  };

  const planCard = (p, intro = '') => {
    const price = p.valor ? `<b>${esc(D.formatarValor(p.valor))}/mês</b>` : '<b>preço sob consulta</b>';
    const action = p.valor
      ? `${L(`checkout.html?plano=${encodeURIComponent(p.nome)}`, 'Assinar agora')} · ${wa(`Oi! Vi o plano ${p.nome} no site e quero tirar umas dúvidas antes de assinar.`, 'tirar dúvidas no WhatsApp')}`
      : wa(`Oi! Tenho interesse no ${p.nome} para a minha empresa. Podem me enviar uma proposta?`, 'Pedir proposta no WhatsApp');
    return `${intro}<b>${esc(p.nome)}</b> — ${esc(p.velocidade)} por ${price}.<br>${esc(p.ideal || '')}<br>Inclui: ${p.destaques.map(esc).join(' · ')}.<br>${action}`;
  };

  const planList = () => residential().map(p => `• <b>${esc(p.nome)}</b> — ${esc(p.velocidade)}, ${esc(D.formatarValor(p.valor))}/mês${p.recomendado ? ' ⭐' : ''}`).join('<br>');

  /* ---------- Recomendação em duas perguntas ---------- */
  const recommend = (people, usage) => {
    const list = residential().sort((a, b) => a.download - b.download);
    let index = people === '1-2' ? 0 : people === '3-4' ? 1 : 2;
    if (usage === 'jogos' || usage === 'casa-cheia') index += 1;
    if (usage === 'basico') index -= 1;
    index = Math.max(0, Math.min(list.length - 1, index));
    const pick = list[index], next = list[index + 1];
    const why = {
      basico: 'redes sociais e vídeos',
      office: 'home office e aulas online',
      jogos: 'jogos e lives',
      'casa-cheia': 'muitas TVs, câmeras e aparelhos ao mesmo tempo'
    }[usage] || 'o dia a dia';
    return `${planCard(pick, `Para ${people === '5+' ? '5 pessoas ou mais' : people + ' pessoas'} com foco em ${why}, eu indicaria o `)}${next ? `<br><br>Se quiser folga para crescer, o próximo é o <b>${esc(next.nome)}</b> (${esc(next.velocidade)}, ${esc(D.formatarValor(next.valor))}/mês).` : ''}`;
  };

  /* ---------- Cobertura dentro da conversa ---------- */
  const coverageAnswer = async raw => {
    const cep = raw.replace(/\D/g, '');
    let bairro = raw.trim();
    if (/^\d{8}$/.test(cep)) {
      try {
        const r = await fetch(`https://viacep.com.br/ws/${cep}/json/`, { signal: AbortSignal.timeout(6000) });
        const data = await r.json();
        if (data.erro) return { html: 'Não encontrei esse CEP. Pode me dizer o nome do bairro?', flow: 'cobertura' };
        if (data.localidade && norm(data.localidade) !== 'rio de janeiro') {
          return { html: `Por enquanto atendemos só o Rio de Janeiro (${esc(D.empresa.regiao)}). Se quiser, ${wa(`Oi! Vocês atendem ${data.localidade}? CEP ${raw}.`, 'confirme com a equipe')}.` };
        }
        bairro = data.bairro || data.localidade || raw;
      } catch {
        return { html: `Não consegui consultar o CEP agora. ${wa(`Oi! Quero saber se a FHP Fibra atende o CEP ${raw}.`, 'Mande para a equipe no WhatsApp')} que eles confirmam na hora.` };
      }
    }
    if (!D.bairros.length) {
      return { html: `Vou precisar da equipe para confirmar <b>${esc(bairro)}</b>: ${wa(`Oi! Quero saber se a FHP Fibra atende em ${bairro}${bairro !== raw.trim() ? ` (CEP ${raw})` : ''}.`, 'clique para perguntar no WhatsApp')} — eles respondem rapidinho.`, chips: ['Ver planos', 'Qual plano é melhor para mim?'] };
    }
    const hit = D.bairros.find(b => norm(b) === norm(bairro) || norm(bairro).includes(norm(b)));
    if (hit) return { html: `Boa notícia: atendemos em <b>${esc(hit)}</b>! 🎉 ${L('planos.html#residencial', 'Escolha seu plano')} e assine online — a instalação é inclusa.`, chips: ['Qual plano é melhor para mim?', 'Como contratar?'] };
    return { html: `Ainda não tenho confirmação para <b>${esc(bairro)}</b>. A rede está sempre crescendo — ${wa(`Oi! Vocês atendem em ${bairro}? Quero ser avisado quando chegar.`, 'deixe seu contato com a equipe')} e avisamos quando chegar.` };
  };

  /* ---------- Intenções ---------- */
  const DEFAULT_CHIPS = ['Ver planos', 'Qual plano é melhor para mim?', 'Cobertura', 'Formas de pagamento', 'Suporte técnico'];
  const intents = [
    { id: 'saudacao', k: ['oi', 'ola', 'olá', 'bom dia', 'boa tarde', 'boa noite', 'e ai', 'eai', 'hello', 'hey', 'opa'], w: 1,
      r: () => ({ html: `Olá${firstName() ? `, ${esc(firstName())}` : ''}! 👋 Posso ajudar com planos, cobertura, pagamento, suporte e a área do cliente. O que você precisa?` }) },
    { id: 'recomendar', k: ['melhor para mim', 'melhor plano', 'qual plano', 'recomenda', 'indica', 'indicacao', 'escolher', 'ideal', 'preciso de quanto', 'quantos mega', 'nao sei qual', 'me ajuda a escolher'], w: 3,
      r: () => ({ html: 'Boa, vamos achar o plano certo em duas perguntas. 😉<br><b>Quantas pessoas usam a internet na casa?</b>', chips: ['1-2 pessoas', '3-4 pessoas', '5 ou mais'], flow: 'rec-pessoas' }) },
    { id: 'planos', k: ['plano', 'planos', 'valor', 'valores', 'preco', 'precos', 'quanto custa', 'quanto e', 'mega', 'giga', 'velocidade', 'tabela', 'opcoes'], w: 2,
      r: () => ({ html: `Nossos planos residenciais (todos com Wi-Fi e instalação inclusos):<br>${planList()}<br>${L('planos.html', 'Ver detalhes e comparar')}`, chips: ['Qual plano é melhor para mim?', 'Planos para empresa', 'Como contratar?'] }) },
    { id: 'empresa', k: ['empresa', 'empresarial', 'business', 'negocio', 'cnpj', 'loja', 'escritorio', 'comercio', 'corporativo'], w: 3,
      r: () => ({ html: `Para empresas temos ${business().map(p => `<b>${esc(p.nome)}</b> (${esc(p.velocidade)})`).join(', ')}, com proposta sob medida. ${wa('Oi! Quero uma proposta de internet empresarial da FHP Fibra.', 'Pedir proposta no WhatsApp')} ou ${L('planos.html#empresarial', 'ver os planos')}.` }) },
    { id: 'cobertura', k: ['cobertura', 'atende', 'atendem', 'chega', 'onde', 'regiao', 'bairro', 'zona oeste', 'zona norte', 'meu endereco', 'minha rua', 'cep', 'disponivel', 'disponibilidade', 'tem na', 'tem no', 'pega'], w: 2,
      r: text => {
        // "vocês atendem em campo grande?" → já confere o bairro citado
        const m = /\b(?:em|no|na|de)\s+([a-z][a-z ]{2,40}?)\s*\??$/.exec(norm(text || ''));
        const known = D.bairros.find(b => has(norm(text || ''), [norm(b)]));
        if (known) return coverageAnswer(known);
        if (m && !has(m[1], ['zona oeste', 'zona norte', 'rio', 'minha rua', 'meu bairro', 'minha casa', 'casa', 'endereco'])) return coverageAnswer(m[1]);
        return ({ html: `A FHP atende a <b>${esc(D.empresa.regiao || 'Zona Oeste do Rio de Janeiro')}</b>.${D.bairros.length ? ` Bairros: ${D.bairros.map(esc).join(', ')}.` : ''}<br><b>Me diga seu bairro ou CEP</b> que eu confiro agora.`, flow: 'cobertura' });
      } },
    { id: 'contratar', k: ['contratar', 'assinar', 'assinatura', 'quero internet', 'quero o plano', 'quero fechar', 'instalacao', 'instalar', 'prazo', 'demora', 'quanto tempo', 'agendar', 'tecnico vem'], w: 2,
      r: () => ({ html: `É rápido: 1) escolha o plano em ${L('planos.html', 'Planos')} e clique em ASSINAR; 2) crie sua conta e informe o endereço; 3) pague a 1ª mensalidade por Pix, cartão ou boleto. Depois a equipe combina a instalação com você pelo WhatsApp — e ela é inclusa. Se preferir, ${wa('Oi! Vim pelo site e quero contratar a internet da FHP Fibra.', 'contrate direto pelo WhatsApp')}.`, chips: ['Ver planos', 'Cobertura', 'Formas de pagamento'] }) },
    { id: 'pagamento', k: ['pagamento', 'pagar', 'pix', 'cartao', 'boleto', 'mensalidade', 'fatura', 'faturas', 'vencimento', 'segunda via', '2 via', '2a via', 'debito', 'parcel', 'cobranca', 'atrasado', 'atraso', 'comprovante'], w: 2,
      r: () => ({ html: isClient()
        ? `Suas faturas ficam em ${L('painel.html?secao=faturas', 'Faturas')}: dá para pagar por Pix, cartão ou boleto e baixar o comprovante. Vencimento todo mês no dia escolhido na contratação.`
        : `Aceitamos <b>Pix</b>, <b>cartão de crédito</b> e <b>boleto</b>. A 1ª mensalidade é paga na contratação; as seguintes ficam na ${L('login.html', 'área do cliente')}, em Faturas, com comprovante para baixar. Mensalidade em atraso pode ter a velocidade reduzida após aviso — qualquer dúvida, ${wa('Oi! Preciso de ajuda com o pagamento da minha fatura.', 'fale com a equipe')}.`, chips: isClient() ? ['Abrir um chamado', 'Falar com atendente'] : ['Entrar na minha conta', 'Como contratar?'] }) },
    { id: 'wifi', k: ['wifi', 'wi-fi', 'roteador', 'sinal fraco', 'nao pega no quarto', 'alcance', '5g', '2.4', 'senha do wifi', 'trocar senha do wifi'], w: 3,
      r: () => ({ html: `Dicas rápidas de Wi-Fi: 📶<br>1. Deixe o roteador no meio da casa, no alto e longe de TV, micro-ondas e paredes grossas.<br>2. Perto do roteador use a rede <b>5 GHz</b> (mais rápida); longe, a <b>2.4 GHz</b> (mais alcance).<br>3. Teste a velocidade no cabo: se no cabo está certo, o problema é o Wi-Fi, não a fibra.<br>Se continuar fraco, ${wa('Oi! Meu Wi-Fi está com sinal fraco em parte da casa. Podem me ajudar?', 'chame o suporte')}.`, chips: ['Internet lenta', 'Abrir um chamado', 'Falar com atendente'] }) },
    { id: 'suporte', k: ['lenta', 'lento', 'lentidao', 'caiu', 'sem internet', 'nao funciona', 'travando', 'trava', 'oscilando', 'oscila', 'suporte', 'problema', 'luz vermelha', 'los', 'sem sinal', 'nao conecta', 'desconecta', 'ping', 'instavel'], w: 2,
      r: () => ({ html: `Sinto muito pelo transtorno. Vamos testar: 🔧<br>1. Tire o roteador (e o aparelho da fibra, se houver) da tomada por 1 minuto e ligue de novo.<br>2. Veja se os cabos estão firmes e se há <b>luz vermelha</b> (LOS) no equipamento — se tiver, é rompimento na fibra e precisa de técnico.<br>3. Teste em outro aparelho ou no cabo.<br>Não resolveu? ${isClient() ? L('painel.html?secao=mensagens', 'Abra um chamado') : L('login.html', 'Entre na conta e abra um chamado')} ou ${wa(`Oi! Estou com problema na internet${firstName() ? `, sou cliente (${firstName()})` : ''}: já reiniciei o roteador e continua. Podem verificar?`, 'chame o suporte no WhatsApp')}.`, chips: ['Wi-Fi fraco', 'Abrir um chamado', 'Falar com atendente'] }) },
    { id: 'conta', k: ['login', 'entrar', 'area do cliente', 'minha conta', 'senha', 'esqueci', 'recuperar', 'acesso', 'painel', 'cadastro', 'criar conta', 'cadastrar'], w: 2,
      r: () => ({ html: isClient()
        ? `Você já está na sua conta, ${esc(firstName())}. Atalhos: ${L('painel.html', 'Início')} · ${L('painel.html?secao=faturas', 'Faturas')} · ${L('painel.html?secao=meus-dados', 'Meus dados')} · ${L('painel.html?secao=mensagens', 'Mensagens')}.`
        : `Na ${L('login.html', 'área do cliente')} você vê seu plano, paga faturas e abre chamados. Ainda não tem conta? ${L('cadastro.html', 'Crie em 1 minuto')}. Esqueceu a senha? Use "Esqueceu a senha?" na tela de login.`, chips: isClient() ? ['Minhas faturas', 'Abrir um chamado'] : ['Entrar na minha conta', 'Criar conta'] }) },
    { id: 'mudar', k: ['trocar de plano', 'mudar de plano', 'upgrade', 'aumentar', 'diminuir', 'downgrade', 'mudar plano', 'trocar plano', 'mudanca de endereco', 'mudar de endereco', 'transferir'], w: 3,
      r: () => ({ html: `Troca de plano ou de endereço é com a equipe: ${isClient() ? L('painel.html?secao=mensagens', 'abra um chamado na sua conta') : L('login.html', 'entre na sua conta e abra um chamado')} ou ${wa(`Oi! Quero trocar meu plano da FHP Fibra.${firstName() ? ` Sou cliente, ${firstName()}.` : ''}`, 'fale pelo WhatsApp')}. Não tem custo para subir de plano.` }) },
    { id: 'cancelar', k: ['cancelar', 'cancelamento', 'desistir', 'encerrar', 'rescisao', 'multa', 'fidelidade'], w: 3,
      r: () => ({ html: `Você pode cancelar a qualquer momento pelos canais de atendimento. Antes disso, se o motivo for algum problema, me conta — talvez eu consiga resolver. Para seguir com o cancelamento, ${wa(`Oi! Quero cancelar minha internet da FHP Fibra.${firstName() ? ` Sou cliente, ${firstName()}.` : ''}`, 'fale com a equipe no WhatsApp')}. Os detalhes estão nos ${L('termos.html', 'termos de uso')}.`, chips: ['Internet lenta', 'Trocar de plano', 'Falar com atendente'] }) },
    { id: 'horario', k: ['horario', 'funcionamento', 'aberto', 'que horas', 'atendimento 24', 'fim de semana', 'domingo', 'feriado'], w: 2,
      r: () => ({ html: D.empresa.horario ? `Nosso atendimento funciona ${esc(D.empresa.horario)}.` : `Fale com a equipe pelo WhatsApp e respondemos assim que possível. ${wa('Oi! Vim pelo site da FHP Fibra e quero tirar uma dúvida.', 'Chamar no WhatsApp')}` }) },
    { id: 'endereco-empresa', k: ['endereco da fhp', 'loja', 'sede', 'onde fica', 'presencial', 'ir ai'], w: 3,
      r: () => ({ html: D.empresa.endereco ? `Estamos em ${esc(D.empresa.endereco)}, ${esc(D.empresa.cidade)}.${D.empresa.horario ? ` Atendimento ${esc(D.empresa.horario)}.` : ''}` : `O atendimento é pelo WhatsApp e pela área do cliente — resolve quase tudo sem sair de casa. ${wa('Oi! Vim pelo site da FHP Fibra e quero tirar uma dúvida.', 'Chamar no WhatsApp')}` }) },
    { id: 'contato', k: ['contato', 'falar', 'atendente', 'humano', 'pessoa', 'telefone', 'numero', 'email', 'e-mail', 'whatsapp', 'zap', 'ligar'], w: 2,
      r: () => ({ html: `${W()?.ativo ? `Fale com a equipe pelo <a href="${W().link('Oi! Vim pelo site da FHP Fibra e quero falar com a equipe.')}" target="_blank" rel="noopener">WhatsApp ${W().numero}</a>` : `Fale com a equipe pelo ${L('fale-conosco.html', 'Fale Conosco')}`}${D.empresa.telefone ? ` ou telefone ${esc(D.empresa.telefone)}` : ''}${D.empresa.email ? ` ou e-mail ${esc(D.empresa.email)}` : ''}. Se quiser, eu já envio nossa conversa para eles: use o botão <b>Atendente</b> aqui em cima.` }) },
    { id: 'fibra', k: ['fibra', 'optica', 'ftth', 'tecnologia', 'diferenca', 'radio', 'cabo', 'velox', 'upload'], w: 1,
      r: () => ({ html: 'Nossa rede é <b>fibra óptica até dentro da sua casa</b> (FTTH): o sinal viaja por luz, sem cabo de cobre no caminho, por isso é mais estável, tem menos oscilação e aguenta várias pessoas ao mesmo tempo. ✨' }) },
    { id: 'quem', k: ['quem somos', 'sobre a fhp', 'historia', 'missao', 'visao', 'valores', 'comunidade'], w: 2,
      r: () => ({ html: `A FHP é uma provedora da ${esc(D.empresa.regiao || 'Zona Oeste do Rio')}, com rede própria de fibra e equipe da região. Conheça mais em ${L('quem-somos.html', 'Quem Somos')}.` }) },
    { id: 'obrigado', k: ['obrigado', 'obrigada', 'valeu', 'thanks', 'tchau', 'ate mais', 'brigado', 'show', 'top'], w: 2,
      r: () => ({ html: 'Por nada! Se precisar de mais alguma coisa, é só chamar. 💜', chips: DEFAULT_CHIPS }) }
  ];

  const fallback = () => ({
    html: `Não entendi muito bem 🤔. Posso ajudar com <b>planos</b>, <b>cobertura</b>, <b>pagamento</b>, <b>suporte</b> e <b>sua conta</b>. Ou, se preferir, ${wa('Oi! Vim pelo site da FHP Fibra e quero falar com a equipe.', 'fale com uma pessoa da equipe')}.`,
    chips: DEFAULT_CHIPS
  });

  // Atalhos dos chips que não são perguntas "naturais".
  const shortcuts = {
    'ver planos': 'planos', 'planos para empresa': 'empresa', 'cobertura': 'cobertura', 'formas de pagamento': 'pagamento',
    'suporte tecnico': 'suporte', 'como contratar?': 'contratar', 'qual plano e melhor para mim?': 'recomendar',
    'internet lenta': 'suporte', 'wi-fi fraco': 'wifi', 'trocar de plano': 'mudar', 'falar com atendente': 'contato',
    'minhas faturas': 'pagamento', 'entrar na minha conta': 'conta', 'criar conta': 'conta', 'abrir um chamado': 'suporte'
  };

  const localAnswer = async text => {
    const t = norm(text);
    const short = shortcuts[t];
    if (short) return intents.find(i => i.id === short).r(text);
    // Pergunta sobre um plano específico ("quanto é o turbo", "500 mega", "o de 79,90")
    const plan = findPlan(t);
    if (plan && !has(t, ['melhor', 'recomenda', 'indica'])) return { html: planCard(plan), chips: ['Qual plano é melhor para mim?', 'Cobertura', 'Como contratar?'] };
    // CEP solto
    if (/^\d{5}-?\d{3}$/.test(t)) return coverageAnswer(text);
    let best = null, bestScore = 0;
    intents.forEach(i => {
      const hits = i.k.filter(w => has(t, [norm(w)])).length;
      const score = hits ? hits + i.w : 0;
      if (score > bestScore) { best = i; bestScore = score; }
    });
    return best ? best.r(text) : fallback();
  };

  /* ---------- Fluxos (recomendação e cobertura) ---------- */
  const flowStep = async (flow, text) => {
    const t = norm(text);
    if (flow.id === 'rec-pessoas') {
      const people = /\b(1|2|uma|duas|um|dois|sozinh|casal)\b/.test(t) && !/\b(3|4|5)\b/.test(t) ? '1-2' : /\b(3|4|tres|quatro)\b/.test(t) ? '3-4' : /\b(5|cinco|mais|muit)\b/.test(t) ? '5+' : null;
      if (!people) return { html: 'Me diz só o número de pessoas: 1-2, 3-4 ou 5 ou mais?', chips: ['1-2 pessoas', '3-4 pessoas', '5 ou mais'], flow: 'rec-pessoas' };
      return { html: 'E o que mais vocês fazem na internet?', chips: ['Redes sociais e vídeos', 'Home office e aulas', 'Jogos e lives', 'Casa cheia: TVs, câmeras e tudo junto'], flow: 'rec-uso', data: { people } };
    }
    if (flow.id === 'rec-uso') {
      const usage = has(t, ['jogo', 'jogos', 'game', 'gamer', 'live', 'lives', 'stream']) ? 'jogos'
        : has(t, ['casa cheia', 'camera', 'cameras', 'tudo junto', 'tvs', 'muitos']) ? 'casa-cheia'
          : has(t, ['office', 'trabalho', 'aula', 'aulas', 'reuniao', 'reunioes', 'estudo']) ? 'office'
            : has(t, ['rede', 'redes', 'video', 'videos', 'filme', 'filmes', 'netflix', 'youtube', 'basico']) ? 'basico' : null;
      if (!usage) return { html: 'Escolha a opção mais parecida com a sua casa:', chips: ['Redes sociais e vídeos', 'Home office e aulas', 'Jogos e lives', 'Casa cheia: TVs, câmeras e tudo junto'], flow: 'rec-uso', data: flow.data };
      return { html: recommend(flow.data.people, usage), chips: ['Cobertura', 'Como contratar?', 'Ver todos os planos'] };
    }
    if (flow.id === 'cobertura') {
      if (t.length < 3 || has(t, ['nao sei', 'depois', 'cancela', 'deixa'])) return { html: 'Sem problema. Quando souber o bairro ou CEP, é só me mandar.', chips: DEFAULT_CHIPS };
      return coverageAnswer(text);
    }
    return null;
  };

  /* ---------- Interface ---------- */
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.body) return;
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'css/bot.css';
    document.head.appendChild(css);

    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <div class="bot-teaser" hidden><button type="button" class="bot-teaser-text"></button><button type="button" class="bot-teaser-close" aria-label="Fechar">✕</button></div>
      <button class="bot-fab" aria-label="Abrir assistente virtual" aria-expanded="false" aria-controls="bot-panel">💬<span class="bot-badge" hidden></span></button>
      <section class="bot-panel" id="bot-panel" role="dialog" aria-label="Assistente virtual FHP">
        <header class="bot-head">
          <span class="bot-avatar" aria-hidden="true"><img src="img/logo-mark.svg" alt="" width="26" height="26"></span>
          <div><b>Assistente FHP</b><small class="bot-status">● Online</small></div>
          <a class="bot-handoff" href="#" target="_blank" rel="noopener" title="Falar com uma pessoa da equipe no WhatsApp" hidden>Atendente</a>
          <button class="bot-reset" type="button" aria-label="Limpar conversa" title="Limpar conversa">↺</button>
          <button class="bot-close" aria-label="Fechar">✕</button>
        </header>
        <div class="bot-body" role="log" aria-live="polite"></div>
        <div class="bot-chips" aria-label="Sugestões"></div>
        <form class="bot-form"><input type="text" placeholder="Digite sua dúvida..." aria-label="Mensagem" autocomplete="off" maxlength="500"><button type="submit" aria-label="Enviar">➤</button></form>
        <p class="bot-note">Assistente automático: respostas podem conter erros. Para contratar ou resolver um problema, fale com a equipe.</p>
      </section>`;
    document.body.append(...wrap.children);

    const fab = document.querySelector('.bot-fab'), panel = document.querySelector('#bot-panel');
    const body = panel.querySelector('.bot-body'), chipBox = panel.querySelector('.bot-chips');
    const form = panel.querySelector('.bot-form'), input = form.querySelector('input');
    const status = panel.querySelector('.bot-status'), handoff = panel.querySelector('.bot-handoff');
    const badge = fab.querySelector('.bot-badge'), teaser = document.querySelector('.bot-teaser');
    const ENDPOINT = (window.FHP_BOT && window.FHP_BOT.endpoint) || (location.protocol === 'file:' ? 'http://localhost:3000/api/chat' : (C.apiUrl ? C.apiUrl.replace(/\/+$/, '') + '/api/chat' : '/api/chat'));

    /* Estado persistente entre páginas */
    const load = () => { try { return JSON.parse(sessionStorage.getItem(STORE)) || {}; } catch { return {}; } };
    const state = Object.assign({ transcript: [], history: [], flow: null, open: false, teased: false, aiFailed: false }, load());
    const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify({ ...state, transcript: state.transcript.slice(-40), history: state.history.slice(-MAX_HISTORY) })); } catch { /* sem storage */ } };
    let busy = false;

    const fmt = s => esc(s)
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      .replace(/\[([^\]]+)\]\(((?:https?:\/\/|[a-z0-9-]+\.html)[^)\s]*)\)/g, '<a href="$2">$1</a>')
      .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank" rel="noopener">$2</a>')
      .replace(/\n/g, '<br>');

    const render = (msg, animate = true) => {
      const m = document.createElement('div');
      m.className = `bot-msg ${msg.who}${animate ? '' : ' still'}`;
      if (msg.who === 'user') m.textContent = msg.text;
      else {
        m.innerHTML = `<div class="bot-text">${msg.html}</div>` + (msg.feedback !== undefined ? `<div class="bot-feedback" data-id="${msg.id}">${msg.feedback ? `<span>${msg.feedback === 'up' ? 'Obrigado! 😊' : 'Vou melhorar. Se quiser, fale com a equipe.'}</span>` : '<span>Ajudou?</span><button type="button" data-fb="up" aria-label="Sim, ajudou">👍</button><button type="button" data-fb="down" aria-label="Não ajudou">👎</button>'}</div>` : '');
      }
      body.appendChild(m);
      body.scrollTop = body.scrollHeight;
      return m;
    };

    const setChips = list => {
      state.lastChips = list || DEFAULT_CHIPS; // restaurado ao trocar de página
      chipBox.innerHTML = '';
      (list || DEFAULT_CHIPS).forEach(c => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = c;
        b.onclick = () => send(c);
        chipBox.appendChild(b);
      });
    };

    const addBot = (html, { chips, feedback = true } = {}) => {
      const msg = { who: 'bot', html, id: Date.now().toString(36), ...(feedback ? { feedback: null } : {}) };
      state.transcript.push(msg);
      render(msg);
      setChips(chips);
      if (!state.open) { badge.hidden = false; badge.textContent = '1'; }
      save();
    };
    const addUser = text => { const msg = { who: 'user', text }; state.transcript.push(msg); render(msg); save(); };

    const contextFor = () => ({
      pagina: page,
      nome: firstName() || '',
      nivel: user()?.nivel || '',
      plano: planInView()?.nome || ''
    });

    // Resumo da conversa para o atendente (WhatsApp).
    const updateHandoff = () => {
      if (!W()?.ativo) return;
      const last = state.transcript.slice(-6).map(m => m.who === 'user' ? `Eu: ${m.text}` : `Assistente: ${m.html.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').slice(0, 140)}`).join('\n');
      handoff.href = W().link(`Oi! Estava falando com o assistente do site da FHP Fibra e quero continuar com a equipe.${firstName() ? ` Sou ${firstName()}.` : ''}${last ? `\n\nResumo:\n${last}` : ''}`);
      handoff.hidden = false;
    };

    const typing = () => {
      const t = document.createElement('div');
      t.className = 'bot-msg bot bot-typing';
      t.innerHTML = '<i></i><i></i><i></i>';
      body.appendChild(t);
      body.scrollTop = body.scrollHeight;
      return t;
    };

    const askAI = async text => {
      state.history.push({ role: 'user', content: text });
      const r = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ messages: state.history.slice(-MAX_HISTORY), contexto: contextFor() }), signal: AbortSignal.timeout(25000) });
      if (r.status === 429) { state.history.pop(); return { html: 'Você enviou muitas mensagens em pouco tempo. Aguarde um minutinho e tente de novo. 🙂', chips: DEFAULT_CHIPS }; }
      if (r.status === 503) { state.history.pop(); throw new Error('sem IA'); }
      if (!r.ok) { state.history.pop(); throw new Error(String(r.status)); }
      const d = await r.json();
      state.history.push({ role: 'assistant', content: d.reply });
      status.textContent = '● Online · IA';
      return { html: fmt(d.reply), chips: DEFAULT_CHIPS };
    };

    const reply = async text => {
      busy = true;
      const t = typing();
      let out;
      try {
        if (state.flow) {
          const flow = state.flow;
          state.flow = null;
          out = await flowStep(flow, text);
        }
        if (!out) {
          const n = norm(text);
          const direct = shortcuts[n] || findPlan(n) || /^\d{5}-?\d{3}$/.test(n) || has(n, ['melhor para mim', 'qual plano', 'recomenda']);
          if (!direct && !state.aiFailed) {
            try { out = await askAI(text); } catch { state.aiFailed = true; status.textContent = '● Online · respostas automáticas'; }
          }
          if (!out) out = await localAnswer(text);
        }
      } catch {
        out = fallback();
      }
      if (out.flow) state.flow = { id: out.flow, data: out.data || {} };
      t.remove();
      addBot(out.html, { chips: out.chips });
      updateHandoff();
      busy = false;
      window.FHPTrack?.('assistente_mensagem', { pagina: page });
    };

    const send = text => {
      text = String(text || '').trim();
      if (!text || busy) return;
      addUser(text);
      input.value = '';
      reply(text);
    };

    const greeting = () => {
      const name = firstName();
      const plan = planInView();
      if (page === 'checkout' && plan) return { html: `Oi${name ? `, ${esc(name)}` : ''}! Vi que você está assinando o <b>${esc(plan.nome)}</b> (${esc(plan.velocidade)}). Se tiver qualquer dúvida sobre pagamento ou instalação, é só perguntar.`, chips: ['Formas de pagamento', 'Quando a instalação acontece?', 'Falar com atendente'] };
      if (page === 'checkout') return { html: 'Oi! Precisa de ajuda com o pagamento ou com a fatura?', chips: ['Formas de pagamento', 'Falar com atendente'] };
      if (page === 'planos') return { html: `Oi${name ? `, ${esc(name)}` : ''}! Quer ajuda para escolher? Em duas perguntas eu indico o plano certo para a sua casa.`, chips: ['Qual plano é melhor para mim?', 'Cobertura', 'Planos para empresa'] };
      if (page === 'fale-conosco') return { html: 'Oi! Posso resolver dúvidas rápidas aqui mesmo ou te passar para a equipe no WhatsApp.', chips: ['Suporte técnico', 'Formas de pagamento', 'Falar com atendente'] };
      if (isClient()) return { html: `Oi, ${esc(name)}! 👋 Posso ajudar com faturas, suporte e sua conta. O que você precisa?`, chips: ['Minhas faturas', 'Internet lenta', 'Abrir um chamado', 'Trocar de plano'] };
      return { html: 'Olá! 👋 Sou o assistente da <b>FHP Fibra</b>. Posso te ajudar a escolher um plano, conferir a cobertura ou resolver uma dúvida.', chips: DEFAULT_CHIPS };
    };

    const restore = () => {
      body.innerHTML = '';
      if (!state.transcript.length) {
        const g = greeting();
        addBot(g.html, { chips: g.chips, feedback: false });
        badge.hidden = true;
      } else {
        state.transcript.forEach(m => render(m, false));
        setChips(state.lastChips);
      }
      updateHandoff();
    };

    const toggle = open => {
      panel.classList.toggle('open', open);
      fab.setAttribute('aria-expanded', open);
      fab.textContent = open ? '✕' : '💬';
      fab.append(badge);
      state.open = open;
      if (open) { badge.hidden = true; teaser.hidden = true; input.focus(); body.scrollTop = body.scrollHeight; }
      save();
    };

    fab.onclick = () => toggle(!panel.classList.contains('open'));
    panel.querySelector('.bot-close').onclick = () => toggle(false);
    panel.querySelector('.bot-reset').onclick = () => { state.transcript = []; state.history = []; state.flow = null; state.aiFailed = false; restore(); input.focus(); };
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && panel.classList.contains('open')) toggle(false); });
    form.addEventListener('submit', e => { e.preventDefault(); send(input.value); });
    body.addEventListener('click', e => {
      const b = e.target.closest('[data-fb]');
      if (!b) return;
      const box = b.closest('.bot-feedback');
      const msg = state.transcript.find(m => m.id === box.dataset.id);
      if (msg) msg.feedback = b.dataset.fb;
      box.innerHTML = `<span>${b.dataset.fb === 'up' ? 'Obrigado! 😊' : 'Vou melhorar. Se quiser, fale com a equipe.'}</span>`;
      try {
        const fb = JSON.parse(localStorage.getItem('fhp_bot_feedback') || '[]');
        fb.push({ em: new Date().toISOString(), util: b.dataset.fb === 'up', pergunta: (state.transcript[state.transcript.indexOf(msg) - 1] || {}).text || '' });
        localStorage.setItem('fhp_bot_feedback', JSON.stringify(fb.slice(-200)));
      } catch { /* sem storage */ }
      window.FHPTrack?.('assistente_feedback', { util: b.dataset.fb });
      save();
    });
    Object.defineProperty(window, 'FHPBot', { value: { send, open: () => toggle(true) } });

    // Balão convidando para a conversa (uma vez por sessão, só nas páginas públicas).
    const teaserText = () => page === 'planos' ? 'Quer ajuda para escolher o plano?' : page === 'fale-conosco' ? 'Posso tirar sua dúvida agora mesmo.' : 'Oi! Posso ajudar a escolher um plano?';
    if (!state.teased && page !== 'checkout' && page !== 'painel') {
      setTimeout(() => {
        if (state.open) return;
        teaser.querySelector('.bot-teaser-text').textContent = teaserText();
        teaser.hidden = false;
        state.teased = true;
        save();
      }, 7000);
    }
    teaser.querySelector('.bot-teaser-text').onclick = () => { toggle(true); if (page === 'planos') send('Qual plano é melhor para mim?'); };
    teaser.querySelector('.bot-teaser-close').onclick = () => { teaser.hidden = true; state.teased = true; save(); };

    restore();
    if (state.open) toggle(true);
  });
})();
