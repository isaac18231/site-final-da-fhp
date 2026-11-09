/* Fale Conosco.
   - Cliente logado: abre um chamado na conta (acompanha no painel).
   - Visitante: a mensagem vai para o WhatsApp da FHP já preenchida (ou para o e-mail
     da empresa, se o WhatsApp estiver desligado). Até o site ter servidor, é o único
     caminho em que a mensagem realmente chega na equipe. */
document.addEventListener('DOMContentLoaded', () => {
  const form = document.querySelector('#contact-form');
  if (!form) return;
  const A = window.FHP, D = window.FHP_DADOS || { empresa: {} }, W = window.FHPWhats;
  const s = A.session();
  const assunto = new URLSearchParams(location.search).get('assunto');

  if (s?.nivel === 'cliente') {
    form.innerHTML = `<h2>Nova solicitação</h2><label>Assunto<input name="assunto" required value="${A.esc(assunto || '')}" placeholder="Ex.: Internet lenta"></label><label>Mensagem<textarea name="mensagem" required rows="5"></textarea></label><p class="form-feedback" role="alert"></p><button class="btn btn-primary">Enviar mensagem</button><p><a href="painel.html?secao=mensagens">Acompanhar minhas mensagens →</a></p>`;
    form.onsubmit = e => {
      e.preventDefault();
      try {
        A.send(form.assunto.value, form.mensagem.value);
        form.reset();
        form.querySelector('.form-feedback').textContent = 'Solicitação enviada! Acompanhe a conversa na sua conta.';
      } catch (err) { form.querySelector('.form-feedback').textContent = err.message; }
    };
    return;
  }

  if (assunto) document.querySelector('#assunto').value = assunto;
  const button = form.querySelector('button[type=submit]');
  if (!W?.ativo) button.textContent = D.empresa.email ? 'Enviar por e-mail' : 'Enviar mensagem';

  form.addEventListener('submit', event => {
    event.preventDefault();
    const feedback = form.querySelector('.form-feedback'), fields = [...form.querySelectorAll('[required]')];
    let valid = true;
    fields.forEach(field => {
      const bad = !field.value.trim() || (field.type === 'email' && !/^\S+@\S+\.\S+$/.test(field.value));
      field.classList.toggle('invalid', bad);
      valid &&= !bad;
    });
    if (!valid) { feedback.classList.remove('success'); feedback.textContent = 'Revise os campos destacados antes de enviar.'; return; }
    const d = Object.fromEntries(new FormData(form));

    // Registra o contato: no servidor (vira chamado no painel de atendimento) ou neste navegador.
    Promise.resolve(A.sendVisitor({ nome: d.nome, email: d.email, telefone: d.telefone, assunto: d.assunto, mensagem: d.mensagem })).catch(() => {});

    const texto = `Olá! Vim pelo site da FHP Fibra.\n\n*Assunto:* ${d.assunto}\n*Nome:* ${d.nome}\n*E-mail:* ${d.email}\n*Telefone:* ${d.telefone}\n\n${d.mensagem}`;
    window.FHPTrack?.('contato_enviado', { assunto: d.assunto });
    if (W?.ativo) {
      window.open(W.link(texto), '_blank', 'noopener');
      feedback.classList.add('success');
      feedback.innerHTML = `Sua mensagem foi aberta no WhatsApp. Se a janela não apareceu, <a href="${W.link(texto)}" target="_blank" rel="noopener">clique aqui para enviar</a>.`;
    } else if (D.empresa.email) {
      location.href = `mailto:${D.empresa.email}?subject=${encodeURIComponent('[Site] ' + d.assunto)}&body=${encodeURIComponent(texto)}`;
      feedback.classList.add('success');
      feedback.textContent = 'Abrimos seu aplicativo de e-mail com a mensagem pronta.';
    } else {
      feedback.classList.add('success');
      feedback.textContent = 'Mensagem registrada! Nossa equipe vai responder em breve.';
    }
    form.reset();
  });
});
