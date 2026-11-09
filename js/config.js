/* Configuração dos pagamentos.
   apiUrl vazio  → checkout em modo simulado (nenhum valor é cobrado).
   apiUrl com o endereço do servidor (ex.: 'https://fhp-fibra.onrender.com')
                 → cobrança de verdade pelo Mercado Pago. Veja PAGAMENTOS.md. */
window.FHP_CONFIG = {
  apiUrl: '',
  // WhatsApp de atendimento com DDI e DDD, só números. Vazio esconde os botões de WhatsApp.
  whatsapp: '552135128383', // mesmo número do site oficial fhpfibra.com.br (wa.me/552135128383)
  // true = checkout rotulado como "Pagamento demonstrativo" (apresentação do TCC).
  // false = rótulo "modo de teste" enquanto o Mercado Pago não estiver ligado. Com apiUrl
  // preenchido e Mercado Pago ativo, este campo é ignorado.
  apresentacao: true,
  // Analytics (opcional): { ga4: 'G-XXXXXXX' } para Google Analytics 4 ou { plausible: 'fhpfibra.com.br' }.
  analytics: {}
};
