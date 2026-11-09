/* Dados da FHP Fibra usados em todo o site, no assistente e no servidor.
   É o ÚNICO lugar para mudar nome, preço ou velocidade de um plano, os dados da
   empresa e os bairros atendidos. O servidor lê este mesmo arquivo (require), por
   isso ele não pode depender de nada do navegador.

   Campos vazios ('' ou []) simplesmente não aparecem no site. */
(function (root, factory) {
  const dados = factory();
  if (typeof module === 'object' && module.exports) module.exports = dados;
  else root.FHP_DADOS = dados;
})(typeof self !== 'undefined' ? self : this, function () {
  const empresa = {
    nome: 'FHP Fibra',
    slogan: 'Internet que conecta você ao que importa.',
    razaoSocial: 'FHP Telecomunicações Ltda.',
    cnpj: '10.749.608/0001-77',
    endereco: 'Av. Almirante Aymara Xavier de Souza, s/n – Centro Empresarial Rodelão, Bangu',
    cidade: 'Rio de Janeiro - RJ',
    cep: '21864-221',
    regiao: 'Zona Oeste do Rio de Janeiro',
    horario: '',              // ex.: 'Segunda a sábado, das 8h às 20h'
    telefone: '(21) 3512-8383',
    email: 'sac@fhpfibra.com.br',
    emailPrivacidade: 'ouvidoria@fhpfibra.com.br',
    instagram: 'https://www.instagram.com/fhpfibra/',
    facebook: 'https://www.facebook.com/fhpfibra',
    site: 'https://isaac18231.github.io/Site-fhp-tcc/' // endereço público (muda com o domínio próprio)
  };

  /* Bairros atendidos. Com a lista preenchida, a consulta de cobertura responde na hora;
     vazia, ela encaminha a pergunta para o WhatsApp. */
  const bairros = [];

  /* Planos. 'valor' em reais (número). Planos sem valor não são vendidos online:
     o botão vira "Pedir proposta" no WhatsApp.
     'upload' só aparece quando preenchido (em Mega). */
  const planos = [
    {
      nome: 'FHP Start', slug: 'start', tipo: 'residencial', velocidade: '300 Mega', download: 300, upload: null, valor: 79.90,
      ideal: 'Para navegar, estudar e assistir em família.',
      destaques: ['Fibra óptica até a sua casa', 'Wi-Fi incluso', 'Instalação inclusa', 'Suporte pelo WhatsApp']
    },
    {
      nome: 'FHP Turbo', slug: 'turbo', tipo: 'residencial', velocidade: '500 Mega', download: 500, upload: null, valor: 99.90, recomendado: true,
      ideal: 'Para home office, streaming em 4K e vários aparelhos ao mesmo tempo.',
      destaques: ['Fibra óptica até a sua casa', 'Wi-Fi incluso', 'Instalação inclusa', 'Suporte pelo WhatsApp']
    },
    {
      nome: 'FHP Ultra', slug: 'ultra', tipo: 'residencial', velocidade: '700 Mega', download: 700, upload: null, valor: 119.90,
      ideal: 'Para casas cheias: câmeras, TVs, consoles e trabalho ao mesmo tempo.',
      destaques: ['Fibra óptica até a sua casa', 'Wi-Fi incluso', 'Instalação inclusa', 'Suporte pelo WhatsApp']
    },
    {
      nome: 'FHP Gamer', slug: 'gamer', tipo: 'residencial', velocidade: '1 Giga', download: 1000, upload: null, valor: 149.90,
      ideal: 'Para jogar online, fazer lives e baixar sem esperar.',
      destaques: ['Fibra óptica até a sua casa', 'Wi-Fi incluso', 'Instalação inclusa', 'Suporte pelo WhatsApp']
    },
    {
      nome: 'FHP Business 500', slug: 'business-500', tipo: 'empresarial', velocidade: '500 Mega', download: 500, upload: null, valor: null,
      ideal: 'Para comércios e escritórios pequenos.',
      destaques: ['Proposta sob medida', 'Fibra óptica', 'Suporte técnico']
    },
    {
      nome: 'FHP Business 700', slug: 'business-700', tipo: 'empresarial', velocidade: '700 Mega', download: 700, upload: null, valor: null,
      ideal: 'Para equipes maiores e sistemas na nuvem.',
      destaques: ['Proposta sob medida', 'Fibra óptica', 'Suporte técnico']
    },
    {
      nome: 'FHP Business 1 Giga', slug: 'business-1-giga', tipo: 'empresarial', velocidade: '1 Giga', download: 1000, upload: null, valor: null,
      ideal: 'Para quem não pode parar: muitos acessos e alto volume de dados.',
      destaques: ['Proposta sob medida', 'Fibra óptica', 'Suporte técnico']
    }
  ];

  /* Perguntas frequentes (página de planos e dados estruturados para o Google). */
  const faq = [
    { p: 'Como faço para contratar?', r: 'Escolha o plano, crie sua conta, informe o endereço de instalação e pague a primeira mensalidade por Pix, cartão ou boleto. Depois disso nossa equipe entra em contato para agendar a instalação.' },
    { p: 'A instalação é cobrada?', r: 'Não. A instalação está inclusa em todos os planos residenciais.' },
    { p: 'O Wi-Fi está incluso?', r: 'Sim. Todos os planos residenciais incluem o roteador Wi-Fi configurado pela nossa equipe.' },
    { p: 'Quais são as formas de pagamento?', r: 'Pix, cartão de crédito e boleto bancário. As mensalidades seguintes ficam disponíveis na sua área do cliente, com a mesma escolha de forma de pagamento.' },
    { p: 'Como sei se a FHP atende o meu endereço?', r: 'Use a consulta de cobertura aqui no site informando seu bairro ou CEP. Se preferir, mande o endereço pelo WhatsApp e respondemos na hora.' },
    { p: 'Posso trocar de plano depois?', r: 'Pode. É só falar com a equipe pelo WhatsApp ou abrir uma solicitação na sua área do cliente.' }
  ];

  const formatarValor = valor => valor == null ? '' : 'R$ ' + Number(valor).toFixed(2).replace('.', ',');

  return { empresa, bairros, planos, faq, formatarValor };
});
