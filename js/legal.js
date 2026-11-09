/* Preenche nome, CNPJ, e-mail e horário nas páginas de Termos e Privacidade a partir de js/dados.js.
   Trechos cujo dado está vazio são removidos da frase. */
document.addEventListener('DOMContentLoaded', () => {
  const e = (window.FHP_DADOS || {}).empresa || {};
  document.querySelectorAll('[data-empresa]').forEach(el => {
    const value = e[el.dataset.empresa];
    if (value) el.textContent = value;
  });
  const optional = { 'data-empresa-cnpj': 'cnpj', 'data-empresa-horario': 'horario', 'data-empresa-email': 'email', 'data-empresa-privacidade': 'emailPrivacidade' };
  Object.entries(optional).forEach(([attr, key]) => document.querySelectorAll(`[${attr}]`).forEach(el => { if (!e[key]) el.remove(); }));
  document.querySelectorAll('[data-empresa-mail]').forEach(a => { if (e.email) a.href = 'mailto:' + e.email; });
  document.querySelectorAll('[data-empresa-mail-privacidade]').forEach(a => { if (e.emailPrivacidade) a.href = 'mailto:' + e.emailPrivacidade; });
  const analytics = (window.FHP_CONFIG || {}).analytics || {};
  if (!analytics.ga4 && !analytics.plausible) document.querySelectorAll('[data-analytics-note]').forEach(el => el.remove());
});
