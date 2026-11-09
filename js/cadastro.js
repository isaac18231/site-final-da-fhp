document.addEventListener('DOMContentLoaded', () => {
  const api = window.FHP;
  const form = document.querySelector('#register-form');
  if (!form) return;

  const feedback = form.querySelector('.login-feedback');
  const btn = form.querySelector('.btn-login');
  const fields = {
    nome: form.elements.nome,
    email: form.elements.email,
    telefone: form.elements.telefone,
    cpf: form.elements.cpf,
    endereco: form.elements.endereco,
    senha: form.elements.senha,
    confirmar: form.elements.confirmar
  };

  const params = new URLSearchParams(location.search);
  if (api.session()) {
    location.replace(params.has('plano') ? `checkout.html?plano=${encodeURIComponent(params.get('plano'))}` : 'painel.html');
    return;
  }

  // ── Utilitários ──
  const hint = (name, msg, ok) => {
    const el = form.querySelector(`.field-hint[data-for="${name}"]`);
    if (!el) return;
    el.textContent = msg;
    el.className = 'field-hint ' + (msg ? (ok ? 'hint-ok' : 'hint-err') : '');
  };

  const shakeForm = () => {
    form.classList.remove('shake');
    void form.offsetWidth;
    form.classList.add('shake');
  };

  const setLoading = on => {
    btn.classList.toggle('loading', on);
    btn.disabled = on;
  };

  // ── Máscaras ──
  const maskCPF = v => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 3) return d;
    if (d.length <= 6) return d.slice(0,3) + '.' + d.slice(3);
    if (d.length <= 9) return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6);
    return d.slice(0,3) + '.' + d.slice(3,6) + '.' + d.slice(6,9) + '-' + d.slice(9);
  };

  const maskTel = v => {
    const d = v.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d.length ? '(' + d : '';
    if (d.length <= 7) return '(' + d.slice(0,2) + ') ' + d.slice(2);
    return '(' + d.slice(0,2) + ') ' + d.slice(2,7) + '-' + d.slice(7);
  };

  fields.cpf.addEventListener('input', e => {
    const pos = e.target.selectionStart;
    const prev = e.target.value.length;
    e.target.value = maskCPF(e.target.value);
    const diff = e.target.value.length - prev;
    e.target.setSelectionRange(pos + diff, pos + diff);
    validateField('cpf');
  });

  fields.telefone.addEventListener('input', e => {
    const pos = e.target.selectionStart;
    const prev = e.target.value.length;
    e.target.value = maskTel(e.target.value);
    const diff = e.target.value.length - prev;
    e.target.setSelectionRange(pos + diff, pos + diff);
    validateField('telefone');
  });

  // Confere os dígitos verificadores do CPF (mesma regra do checkout).
  const validCpf = value => {
    const cpf = value.replace(/\D/g, '');
    if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
    const checkDigit = length => {
      let sum = 0;
      for (let i = 0; i < length; i++) sum += Number(cpf[i]) * (length + 1 - i);
      return ((sum * 10) % 11) % 10;
    };
    return checkDigit(9) === Number(cpf[9]) && checkDigit(10) === Number(cpf[10]);
  };

  // ── Força da senha ──
  const strengthFill = document.querySelector('#strength-fill');

  const calcStrength = pw => {
    if (!pw) return { score: 0, label: '', cls: '' };
    let s = 0;
    if (pw.length >= 8) s++;
    if (pw.length >= 12) s++;
    if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
    if (/\d/.test(pw)) s++;
    if (/[^a-zA-Z0-9]/.test(pw)) s++;
    if (s <= 1) return { score: 20, label: 'Muito fraca', cls: 'str-weak' };
    if (s === 2) return { score: 40, label: 'Fraca', cls: 'str-weak' };
    if (s === 3) return { score: 60, label: 'Razoável', cls: 'str-med' };
    if (s === 4) return { score: 80, label: 'Forte', cls: 'str-strong' };
    return { score: 100, label: 'Muito forte', cls: 'str-strong' };
  };

  const updateStrength = pw => {
    const r = calcStrength(pw);
    if (strengthFill) {
      strengthFill.style.width = r.score + '%';
      strengthFill.className = 'strength-fill ' + (r.cls || '');
    }
    return r;
  };

  // ── Validação em tempo real ──
  const validators = {
    nome: v => v.trim().length >= 2 ? '' : 'Informe seu nome completo',
    email: v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? '' : 'E-mail inválido',
    telefone: v => v.replace(/\D/g, '').length >= 10 ? '' : 'Telefone incompleto',
    cpf: v => v.replace(/\D/g, '').length < 11 ? 'CPF incompleto' : validCpf(v) ? '' : 'CPF inválido. Confira os números.',
    endereco: v => v.trim().length >= 5 ? '' : 'Informe o endereço',
    senha: v => {
      const r = updateStrength(v);
      if (v.length < 8) return 'Mínimo 8 caracteres';
      return '';
    },
    confirmar: v => {
      if (!v) return 'Confirme a senha';
      return v === fields.senha.value ? '' : 'As senhas não coincidem';
    }
  };

  const validateField = name => {
    const val = fields[name].value;
    const err = validators[name](val);
    const okMsg = name === 'senha' ? calcStrength(val).label : '✓';
    hint(name, val ? (err || okMsg) : '', val && !err);
    fields[name].classList.toggle('field-invalid', !!(val && err));
    fields[name].classList.toggle('field-valid', !!(val && !err));
    return !err || !val;
  };

  const validateFieldStrict = name => {
    const val = fields[name].value;
    const err = validators[name](val);
    const okMsg = name === 'senha' ? calcStrength(val).label : '✓';
    hint(name, err || okMsg, !err);
    fields[name].classList.toggle('field-invalid', !!err);
    fields[name].classList.toggle('field-valid', !err && !!val);
    return !err;
  };

  Object.keys(validators).forEach(name => {
    fields[name].addEventListener('blur', () => validateField(name));
    if (name === 'senha' || name === 'confirmar') {
      fields[name].addEventListener('input', () => {
        validateField(name);
        if (name === 'senha' && fields.confirmar.value) validateField('confirmar');
      });
    }
  });

  // ── Submit ──
  form.addEventListener('submit', e => {
    e.preventDefault();
    feedback.textContent = '';

    let allOk = true;
    Object.keys(validators).forEach(name => {
      if (!validateFieldStrict(name)) allOk = false;
    });

    if (!allOk) {
      feedback.textContent = 'Corrija os campos destacados.';
      shakeForm();
      return;
    }

    setLoading(true);

    (async () => {
      try {
        await api.ready;
        await api.signup({
          nome: fields.nome.value.trim(),
          email: fields.email.value.trim(),
          telefone: fields.telefone.value.replace(/\D/g, ''),
          cpf: fields.cpf.value.replace(/\D/g, ''),
          endereco: fields.endereco.value.trim(),
          senha: fields.senha.value,
          confirmar: fields.confirmar.value
        });
        const dest = params.has('plano')
          ? `checkout.html?plano=${encodeURIComponent(params.get('plano'))}`
          : 'painel.html';
        location.href = dest;
      } catch (err) {
        feedback.textContent = err.message;
        shakeForm();
        setLoading(false);
      }
    })();
  });
});
