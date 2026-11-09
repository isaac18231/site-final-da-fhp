document.addEventListener('DOMContentLoaded', () => {
  const api = window.FHP;
  const form = document.querySelector('#login-form');
  const params = new URLSearchParams(location.search);

  // Views
  const loginView = document.querySelector('#login-view');
  const resetView = document.querySelector('#reset-view');
  const stepEmail = document.querySelector('#step-email');
  const stepCode = document.querySelector('#step-code');
  const stepSuccess = document.querySelector('#step-success');

  // Quem chega pelo checkout (?plano= ou ?pedido=) volta para ele depois de entrar.
  const destination = user => {
    if (user.nivel !== 'cliente') return 'painel.html';
    if (params.has('pedido')) return `checkout.html?pedido=${encodeURIComponent(params.get('pedido'))}`;
    if (params.has('plano')) return `checkout.html?plano=${encodeURIComponent(params.get('plano'))}`;
    if (params.has('fatura')) return `checkout.html?fatura=${encodeURIComponent(params.get('fatura'))}`;
    return 'painel.html';
  };

  if (api.session()) {
    location.replace(destination(api.session()));
    return;
  }

  if (params.has('plano')) {
    document.querySelector('#create-account-link').href = `cadastro.html?plano=${encodeURIComponent(params.get('plano'))}`;
  }

  // ── Mostrar/esconder senha ──
  document.querySelectorAll('.show-password').forEach(btn => {
    btn.addEventListener('click', () => {
      const wrap = btn.closest('.password-wrap');
      const input = wrap.querySelector('input');
      const open = btn.querySelector('.eye-open');
      const closed = btn.querySelector('.eye-closed');
      if (input.type === 'password') {
        input.type = 'text';
        open.style.display = 'none';
        closed.style.display = '';
      } else {
        input.type = 'password';
        open.style.display = '';
        closed.style.display = 'none';
      }
    });
  });

  // ── Shake visual em erro ──
  const shakeForm = el => {
    el.classList.remove('shake');
    void el.offsetWidth; // force reflow
    el.classList.add('shake');
  };

  // ── Loading state no botão ──
  const setLoading = (btn, loading) => {
    btn.classList.toggle('loading', loading);
    btn.disabled = loading;
  };

  // ── Login ──
  form.addEventListener('submit', event => {
    event.preventDefault();
    const feedback = form.querySelector('.login-feedback');
    const btn = form.querySelector('.btn-login');

    setLoading(btn, true);

    (async () => {
      try {
        await api.ready;
        const user = await api.login(form.elements.usuario.value, form.elements.senha.value, form.elements.lembrar.checked);
        if (!user) throw Error('E-mail ou senha inválidos.');
        location.href = destination(user);
      } catch (error) {
        feedback.textContent = error.message || 'E-mail ou senha inválidos.';
        feedback.classList.remove('success');
        shakeForm(form);
        setLoading(btn, false);
      }
    })();
  });

  // ── Navegação: Login ↔ Recuperação ──
  const showView = view => {
    loginView.hidden = view !== 'login';
    resetView.hidden = view !== 'reset';
    if (view === 'reset') {
      stepEmail.hidden = false;
      stepCode.hidden = true;
      stepSuccess.hidden = true;
    }
  };

  document.querySelector('#forgot-link').addEventListener('click', () => showView('reset'));
  document.querySelector('#back-to-login').addEventListener('click', () => showView('login'));
  document.querySelector('#back-to-login-2').addEventListener('click', () => showView('login'));
  document.querySelector('#go-to-login').addEventListener('click', () => {
    showView('login');
    form.querySelector('.login-feedback').textContent = '';
  });

  // ── Recuperação: Etapa 1 — enviar e-mail ──
  let resetEmail = '';
  document.querySelector('#reset-email-form').addEventListener('submit', event => {
    event.preventDefault();
    const emailForm = event.target;
    const feedback = emailForm.querySelector('.login-feedback');
    const emailInput = emailForm.querySelector('input[name=email]');
    resetEmail = emailInput.value.trim();

    (async () => {
      try {
        const result = await api.requestPasswordReset(resetEmail);
        const box = document.querySelector('.demo-email');
        if (result.code) {
          document.querySelector('#demo-code').textContent = result.code;
          box.hidden = false;
        } else {
          box.hidden = true;
          feedback.classList.add('success');
        }
        stepEmail.hidden = true;
        stepCode.hidden = false;
        feedback.textContent = '';
        const codeFeedback = document.querySelector('#reset-code-form .login-feedback');
        codeFeedback.classList.toggle('success', !result.code);
        codeFeedback.textContent = result.code ? '' : `Enviamos um código de 6 dígitos para ${resetEmail}.`;
      } catch (err) {
        feedback.textContent = err.message;
        feedback.classList.remove('success');
        shakeForm(emailForm);
      }
    })();
  });

  // ── Força da senha (reset) ──
  const resetStrFill = document.querySelector('#reset-strength-fill');
  const newPassInput = document.querySelector('#new-password');
  if (newPassInput && resetStrFill) {
    newPassInput.addEventListener('input', () => {
      const pw = newPassInput.value;
      let s = 0;
      if (pw.length >= 8) s++;
      if (pw.length >= 12) s++;
      if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
      if (/\d/.test(pw)) s++;
      if (/[^a-zA-Z0-9]/.test(pw)) s++;
      const map = [[20,'str-weak'],[20,'str-weak'],[40,'str-weak'],[60,'str-med'],[80,'str-strong'],[100,'str-strong']];
      const [w, c] = map[Math.min(s, 5)];
      resetStrFill.style.width = (pw ? w : 0) + '%';
      resetStrFill.className = 'strength-fill ' + (pw ? c : '');
    });
  }

  // ── Recuperação: Etapa 2 — código + nova senha ──
  document.querySelector('#reset-code-form').addEventListener('submit', event => {
    event.preventDefault();
    const codeForm = event.target;
    const feedback = codeForm.querySelector('.login-feedback');
    const code = codeForm.elements.code.value;
    const newPass = codeForm.elements.nova_senha.value;
    const confirm = codeForm.elements.confirmar.value;

    (async () => {
      try {
        await api.resetPassword(resetEmail, code, newPass, confirm);
        stepCode.hidden = true;
        stepSuccess.hidden = false;
      } catch (err) {
        feedback.textContent = err.message;
        feedback.classList.remove('success');
        shakeForm(codeForm);
      }
    })();
  });
});
