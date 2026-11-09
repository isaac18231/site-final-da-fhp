/* Gerador de dados de demonstração (clientes, pedidos e chamados fictícios).
   Usado pelo navegador (modo local) e pelo servidor (POST /api/demo/carregar).
   Nenhum dado é real: e-mails @demo.exemplo.com, senha "cliente123". */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.FHP_DEMO = mod;
})(typeof self !== 'undefined' ? self : this, function () {
  const pad = n => String(n).padStart(2, '0');
  const monthOf = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
  const addMonths = (month, amount) => { const [y, m] = month.split('-').map(Number); return monthOf(new Date(y, m - 1 + amount, 1)); };
  const priceToNumber = value => typeof value === 'number' ? value : Number(String(value || '').replace(/[^\d,]/g, '').replace(',', '.')) || 0;
  const planSlug = name => String(name || '').replace(/^FHP\s+/i, '').trim().toLowerCase().replace(/\s+/g, '-');
  const paymentRef = (id, month, planName) => `FHP:${String(id).toLowerCase()}:${month}:${planSlug(planName)}`;
  const uuid = () => (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : require('crypto').randomUUID();
  const SENHA = 'cliente123';
  const DOMINIO = '@demo.exemplo.com';

  /* plans: [{ nome, velocidade, valor: 'R$ 79,90' | 79.9 }] */
  const gerar = (plans, now = new Date()) => {
    const plansByName = Object.fromEntries(plans.map(plan => [plan.nome, { nome: plan.nome, velocidade: plan.velocidade, valor: typeof plan.valor === 'number' ? 'R$ ' + plan.valor.toFixed(2).replace('.', ',') : plan.valor }]));
    const month = monthOf(now);
    const iso = (daysAgo, hour = 10) => { const d = new Date(now); d.setDate(d.getDate() - daysAgo); d.setHours(hour, 15, 0, 0); return d.toISOString(); };
    const people = [
      ['Juliana Martins', 'juliana.martins', '21987010001', '12345678909', 'Rua Artur Rios, 210 – Campo Grande', 'FHP Turbo', 10, 3, 'cartao', ['Visa', '4242']],
      ['Carlos Eduardo Lima', 'carlos.lima', '21987010002', '98765432100', 'Estrada do Mendanha, 1450 – Campo Grande', 'FHP Gamer', 15, 2, 'pix'],
      ['Fernanda Oliveira', 'fernanda.oliveira', '21987010003', '11144477735', 'Rua Felipe Cardoso, 88 – Santa Cruz', 'FHP Start', 5, 5, 'boleto'],
      ['Roberto Santos', 'roberto.santos', '21987010004', '39053344705', 'Av. Brasil, 32000 – Santa Cruz', 'FHP Ultra', 20, 1, 'pix'],
      ['Patrícia Gomes', 'patricia.gomes', '21987010005', '71428793860', 'Rua Fonseca, 410 – Bangu', 'FHP Turbo', 10, 4, 'cartao', ['Mastercard', '4444']],
      ['Lucas Pereira', 'lucas.pereira', '21987010006', '53303811866', 'Rua Campo Grande, 1020 – Campo Grande', 'FHP Start', 25, 0, 'pendente'],
      ['Mariana Costa', 'mariana.costa', '21987010007', '62471382386', 'Rua Marechal Soares de Andrea, 75 – Realengo', 'FHP Gamer', 15, 6, 'pix'],
      ['André Rodrigues', 'andre.rodrigues', '21987010008', '81231421858', 'Rua Coronel Tamarindo, 300 – Bangu', 'FHP Ultra', 5, 2, 'boleto'],
      ['Camila Ferreira', 'camila.ferreira', '21987010009', '20924818100', 'Estrada da Cachamorra, 560 – Campo Grande', 'FHP Turbo', 20, 1, 'cartao', ['Elo', '1234']],
      ['Bruno Almeida', 'bruno.almeida', '21987010010', '34587462903', 'Rua Viúva Dantas, 120 – Campo Grande', 'FHP Start', 10, 3, 'pix'],
      ['Tatiane Barbosa', 'tatiane.barbosa', '21987010011', '18932147096', 'Rua Padre Guilherme Decaminada, 45 – Santa Cruz', 'FHP Ultra', 15, 0, 'pendente'],
      ['Diego Carvalho', 'diego.carvalho', '21987010012', '47829561058', 'Rua Marechal Fontenele, 2200 – Realengo', 'FHP Gamer', 25, 8, 'cartao', ['Visa', '9876']],
      ['Vanessa Rocha', 'vanessa.rocha', '21987010013', '95372815011', 'Rua Silva Cardoso, 610 – Bangu', 'FHP Turbo', 10, 1, 'boleto'],
      ['Sem plano ainda — Felipe Moraes', 'felipe.moraes', '21987010014', '26817432022', 'Rua Engenheiro Trindade, 90 – Campo Grande', null, 10, 0, null]
    ];
    const customers = [], orders = [], tickets = [];
    people.forEach(([nome, slug, telefone, cpf, endereco, planName, vencimento, monthsAgo, metodo, card], index) => {
      const cleanName = nome.replace(/^Sem plano ainda — /, '');
      const customer = { id: uuid(), nome: cleanName, email: slug + DOMINIO, senha: SENHA, telefone, cpf, endereco, plano: null, preferencias: index % 3 !== 0, criadoEm: iso(monthsAgo * 30 + 3) };
      if (planName) {
        const plan = plansByName[planName];
        const start = addMonths(month, -monthsAgo);
        const pending = metodo === 'pendente';
        let firstOrderId = null;
        for (let m = start; m <= month; m = addMonths(m, 1)) {
          const first = m === start;
          const isCurrent = m === month;
          const id = `FHP-${String(100000 + index * 37 + Number(m.slice(5)) * 1000 + Number(m.slice(2, 4))).slice(0, 6)}`;
          const paidThisMonth = !pending && (!isCurrent || index % 4 !== 1); // alguns ainda não pagaram o mês atual
          const method = pending ? 'boleto' : (metodo === 'cartao' ? 'cartao' : metodo);
          const order = {
            id, tipo: first ? 'plano' : 'fatura', competencia: m, ref: paymentRef(customer.id, m, plan.nome),
            cliente: customer.email, nome: customer.nome, plano: { ...plan }, valor: priceToNumber(plan.valor),
            endereco: `${endereco}, Rio de Janeiro – RJ`, instalacao: first ? { data: iso(monthsAgo * 30), periodo: 'manhã' } : null, vencimento: String(vencimento),
            metodo: method, status: paidThisMonth ? 'Pago' : 'Aguardando pagamento',
            criadoEm: iso(Math.max(0, (Number(month.slice(5)) - Number(m.slice(5))) * 30 + 2)),
            pagoEm: paidThisMonth ? iso(Math.max(0, (Number(month.slice(5)) - Number(m.slice(5))) * 30 + 1), 14) : null,
            detalhes: method === 'cartao' && card ? { bandeira: card[0], final: card[1] } : (method === 'boleto' && !paidThisMonth ? { boletoLinha: '23793.38128 60000.000003 00000.000400 1 00000000' + (9990 + index) } : {})
          };
          if (first) firstOrderId = id;
          orders.push(order);
        }
        customer.enderecoInstalacao = `${endereco}, Rio de Janeiro – RJ`;
        customer.plano = { ...plan, vencimento: String(vencimento), status: pending ? 'Aguardando pagamento' : 'Ativo', pagamento: pending ? 'Pendente' : 'Pago', pedido: firstOrderId, inicio: start };
      }
      customers.push(customer);
    });
    const staffNames = { atendimento: 'Marcos Vinícius Souza', tecnico: 'Rafael Nogueira' };
    const ticketData = [
      [0, 'Internet lenta à noite', 'Boa noite, depois das 20h a internet fica muito lenta, principalmente para assistir Netflix. Já reiniciei o roteador.', 'Em atendimento', [['tecnico', 'Olá, Juliana! Verificamos aqui e a sua porta está com sinal estável. Vamos agendar uma visita para medir o Wi-Fi na sua casa. Pode ser amanhã à tarde?']], 1],
      [2, 'Segunda via do boleto', 'Não recebi o boleto deste mês, podem reenviar?', 'Encerrado', [['atendimento', 'Oi, Fernanda! A fatura está disponível na sua área do cliente, em Faturas, com opção de Pix, cartão ou boleto. Qualquer dúvida é só chamar.']], 6],
      [6, 'Trocar para o plano Gamer', 'Quero aumentar a velocidade, hoje tenho o Turbo. Tem custo de mudança?', 'Aberto', [], 0],
      [7, 'Sem sinal — luz vermelha no aparelho', 'A luz LOS está vermelha desde hoje cedo e não tenho internet.', 'Em atendimento', [['tecnico', 'André, luz LOS vermelha indica rompimento na fibra. Já abrimos a ordem de serviço, o técnico passa aí hoje entre 13h e 17h.']], 0],
      [10, 'Mudança de endereço', 'Vou me mudar para Bangu no fim do mês. Consigo levar o plano?', 'Aberto', [], 2],
      [12, 'Dúvida sobre o vencimento', 'Dá para mudar o vencimento do dia 25 para o dia 5?', 'Encerrado', [['atendimento', 'Claro, Diego! Alteramos o vencimento para o dia 5 a partir da próxima fatura.']], 12],
      [4, 'Wi-Fi não pega no quarto dos fundos', 'O sinal chega fraco no quarto do fundo. Tem como resolver?', 'Aberto', [], 1]
    ];
    ticketData.forEach(([ci, assunto, texto, status, replies, daysAgo]) => {
      const c = customers[ci];
      const when = new Date(iso(daysAgo, 9));
      tickets.push({
        id: uuid(), cliente: c.email, nome: c.nome, data: when.toLocaleDateString('pt-BR'), hora: when.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        assunto, status,
        mensagens: [{ autor: c.nome, tipo: 'cliente', texto, data: when.toLocaleString('pt-BR') },
          ...replies.map(([who, t]) => ({ autor: staffNames[who], tipo: 'funcionario', texto: t, data: new Date(when.getTime() + 3600000).toLocaleString('pt-BR') }))]
      });
    });
    return { clientes: customers, pedidos: orders.reverse(), chamados: tickets };
  };

  const ehDemo = cliente => cliente && cliente.email && cliente.email.endsWith(DOMINIO);

  return { gerar, ehDemo, SENHA, DOMINIO };
});
