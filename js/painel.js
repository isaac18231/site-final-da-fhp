/* Painéis FHP: cliente, atendimento/técnico e administração. */
(()=>{
const A=window.FHP,session=A.session();
if(!session){location.replace('login.html');
return}
const admin=session.nivel==='admin',client=session.nivel==='cliente',tech=session.nivel==='tecnico';
const pages=client?['inicio','meu-plano','faturas','meus-dados','mensagens','configuracoes']:
admin?['dashboard','clientes','planos','mensagens','funcionarios','configuracoes']:
tech?['dashboard','mensagens']:['dashboard','clientes','planos','mensagens'];
const labels={inicio:'Início','meu-plano':'Meu plano',faturas:'Faturas','meus-dados':'Meus dados',mensagens:'Mensagens',configuracoes:'Configurações',dashboard:'Dashboard',clientes:'Clientes',planos:'Planos',funcionarios:'Funcionários'};
const nav=document.querySelector('#panel-nav'),content=document.querySelector('#panel-content');
const clients=()=>A.read(A.K.clients),tickets=()=>A.read(A.K.tickets),staff=()=>A.read(A.K.staff),safe=A.esc;
document.querySelector('#user-name').textContent=session.nome;
document.querySelector('#user-level').textContent=({admin:'Administrador',atendimento:'Atendimento',tecnico:'Técnico',cliente:'Cliente'})[session.nivel]||'Usuário';
document.querySelector('#avatar').textContent=session.nome.split(' ').map(x=>x[0]).slice(0,2).join('');
pages.forEach((page,index)=>{const button=document.createElement('button');
button.type='button';
button.textContent=labels[page];
button.dataset.page=page;
button.className=index===0?'active':'';
button.addEventListener('click',()=>render(page));
nav.append(button)});
document.querySelector('#logout').addEventListener('click',A.logout);
document.querySelector('#sidebar-toggle').addEventListener('click',()=>document.querySelector('.sidebar').classList.toggle('open'));
const table=(heads,rows)=>`<div class="table-wrap"><table class="data-table"><thead><tr>${heads.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
const maskCpf=cpf=>{const d=String(cpf||'').replace(/\D/g,'');return d.length===11?`${d.slice(0,3)}.***.***-${d.slice(9)}`:safe(cpf)};
const fmtCpf=cpf=>{const d=String(cpf||'').replace(/\D/g,'');return d.length===11?`${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`:safe(cpf)};
const fmtTel=tel=>{const d=String(tel||'').replace(/\D/g,'');return d.length>=10?`(${d.slice(0,2)}) ${d.slice(2,-4)}-${d.slice(-4)}`:safe(tel)};
const CLIENT_HEADS=['Nome','E-mail','Telefone','CPF','Endereço','Plano','Velocidade','Valor','Vencimento','Status do plano','Pagamento'];
const clientFilter={q:'',pagamento:''};
const filteredClients=()=>clients().filter(c=>{const q=clientFilter.q;const hit=!q||[c.nome,c.email,c.cpf,c.telefone,c.endereco,c.plano?.nome].join(' ').toLocaleLowerCase('pt-BR').includes(q);
const pay=clientFilter.pagamento;const pagamento=c.plano?c.plano.pagamento:'Sem plano';return hit&&(!pay||pagamento===pay)});
const clientRows=()=>filteredClients().map(c=>`<tr><td>${safe(c.nome)}</td><td>${safe(c.email)}</td><td>${fmtTel(c.telefone)}</td><td>${admin?fmtCpf(c.cpf):maskCpf(c.cpf)}</td><td>${safe(c.endereco)}</td><td>${safe(c.plano?.nome||'Sem plano')}</td><td>${safe(c.plano?.velocidade||'—')}</td><td>${safe(c.plano?.valor||'—')}</td><td>${c.plano?.vencimento?'Dia '+safe(c.plano.vencimento):'—'}</td><td>${safe(c.plano?.status||'—')}</td><td>${c.plano?.pagamento?`<span class="pill ${c.plano.pagamento==='Pendente'?'warn':''}">${safe(c.plano.pagamento)}</span>`:'—'}</td></tr>`);
const csv=()=>{const esc=v=>`"${String(v??'').replace(/"/g,'""')}"`;const lines=[CLIENT_HEADS.map(esc).join(';')];
filteredClients().forEach(c=>lines.push([c.nome,c.email,c.telefone,admin?c.cpf:maskCpf(c.cpf),c.endereco,c.plano?.nome||'',c.plano?.velocidade||'',c.plano?.valor||'',c.plano?.vencimento||'',c.plano?.status||'',c.plano?.pagamento||''].map(esc).join(';')));
const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`clientes-fhp-${new Date().toISOString().slice(0,10)}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
const visibleTickets=()=>tickets().filter(ticket=>client?ticket.cliente===session.email:!tech||/técnic|tecnic|internet|conexão|conexao|lent|wifi|wi-fi|roteador/i.test(ticket.assunto));
const invoicesLink=plan=>A.priceToNumber(plan.valor)&&plan.pagamento!=='Pendente'?'<p><button class="btn btn-ghost-panel" type="button" data-go="faturas">Ver faturas</button></p>':'';
const payLink=plan=>plan.pagamento==='Pendente'&&(plan.pedido||A.priceToNumber(plan.valor))?`<p><a class="btn btn-primary" href="checkout.html?${plan.pedido?'pedido='+encodeURIComponent(plan.pedido):'plano='+encodeURIComponent(plan.nome)}">Concluir pagamento</a></p>`:'';
const stat=(title,value)=>`<article class="stat-card"><span>${title}</span><strong>${value}</strong></article>`;
function dashboard(){
const allClients=clients(),allTickets=visibleTickets(),plansActive=allClients.filter(c=>c.plano?.status==='Ativo').length;
const count=(status)=>allTickets.filter(t=>t.status===status).length;
const withPlan=allClients.filter(c=>!!c.plano);
const mrr=withPlan.filter(c=>c.plano.status==='Ativo').reduce((sum,c)=>sum+A.priceToNumber(c.plano.valor),0);
const month=A.monthOf(new Date());
const paidThisMonth=A.orders().filter(o=>o.status==='Pago'&&o.competencia===month).reduce((sum,o)=>sum+o.valor,0);
const metrics=admin?[
['Clientes',allClients.length],['Planos ativos',plansActive],['Receita mensal prevista',A.money(mrr)],['Recebido este mês',A.money(paidThisMonth)],
['Pagamentos pendentes',allClients.filter(c=>c.plano?.pagamento==='Pendente').length],['Chamados abertos',count('Aberto')]
]:[['Total de clientes',allClients.length],['Clientes com plano',withPlan.length],['Chamados abertos',count('Aberto')],['Em atendimento',count('Em atendimento')],['Encerrados',count('Encerrado')]];
// Gráficos simples em HTML/CSS (sem biblioteca): clientes por plano e chamados por status.
const byPlan=A.plans.filter(p=>A.priceToNumber(p.valor)).map(p=>[p.nome.replace(/^FHP\s+/,''),withPlan.filter(c=>c.plano.nome===p.nome).length]);
const byStatus=[['Abertos',count('Aberto'),'open'],['Em atendimento',count('Em atendimento'),'progress'],['Encerrados',count('Encerrado'),'done']];
const bars=(rows,cls)=>{const max=Math.max(1,...rows.map(r=>r[1]));return `<div class="bars ${cls}">${rows.map(([label,value,tone])=>`<div class="bar-row"><span class="bar-label">${safe(label)}</span><span class="bar-track"><i class="${tone||''}" style="width:${Math.round(value/max*100)}%"></i></span><b>${value}</b></div>`).join('')}</div>`};
const recent=allClients.slice().sort((a,b)=>String(b.criadoEm||'').localeCompare(String(a.criadoEm||''))).slice(0,5);
const openTickets=allTickets.filter(t=>t.status!=='Encerrado').slice(0,5);
const empty=!allClients.length&&!allTickets.length;
return `<div class="content"><h1>${client?'Olá, '+safe(session.nome)+'!':'Visão geral'}</h1><p class="subtitle">${client?'Acompanhe seu plano e fale com nossa equipe.':`Resumo de clientes, planos e atendimento · ${new Date().toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'})}`}</p>${client?clientHome():empty?`<div class="panel-card"><h2>Nenhum movimento ainda</h2><p>Os clientes que criarem conta pelo site e as mensagens enviadas pelo Fale Conosco aparecem aqui. Para testar, crie uma conta de cliente em <a class="text-link" href="cadastro.html">Criar conta</a> e assine um plano${admin?', ou carregue os <button class="text-link link-button" type="button" data-go="configuracoes">dados de demonstração</button>':''}.</p></div>`:`<div class="stat-grid">${metrics.map(x=>stat(...x)).join('')}</div>
<div class="layout-two dash-charts">
${admin?`<article class="panel-card"><h2>Clientes por plano</h2>${bars(byPlan,'plans')}</article>`:''}
<article class="panel-card"><h2>Chamados por situação</h2>${bars(byStatus,'tickets')}<p class="legend">${allTickets.length} chamado(s) no total</p></article>
</div>
<div class="layout-two">
<article class="panel-card"><h2>Chamados em andamento</h2>${openTickets.length?`<ul class="mini-list">${openTickets.map(t=>`<li><span class="pill ${t.status==='Aberto'?'warn':''}">${safe(t.status)}</span><div><b>${safe(t.assunto)}</b><small>${safe(t.nome)} · ${safe(t.data)}</small></div></li>`).join('')}</ul><p><button class="btn btn-ghost-panel" type="button" data-go="mensagens">Ver todos</button></p>`:'<p class="empty">Nenhum chamado em aberto. 🎉</p>'}</article>
${admin||!tech?`<article class="panel-card"><h2>Últimos cadastros</h2>${recent.length?`<ul class="mini-list">${recent.map(c=>`<li><span class="avatar small">${safe(c.nome.split(' ').map(x=>x[0]).slice(0,2).join(''))}</span><div><b>${safe(c.nome)}</b><small>${safe(c.plano?.nome||'Sem plano')}${c.plano?` · ${safe(c.plano.pagamento)}`:''}</small></div></li>`).join('')}</ul><p><button class="btn btn-ghost-panel" type="button" data-go="clientes">Ver clientes</button></p>`:'<p class="empty">Nenhum cliente ainda.</p>'}</article>`:''}
</div>`}</div>`;
}
function clientHome(){const c=clients().find(x=>x.email===session.email);
return `<div class="layout-two"><article class="panel-card"><h2>Meu plano</h2>${c?.plano?`<h3>${safe(c.plano.nome)} · ${safe(c.plano.velocidade)}</h3><p>${safe(c.plano.valor)}/mês · vencimento dia ${safe(c.plano.vencimento)}</p><p class="pill">${safe(c.plano.status)} · Pagamento ${safe(c.plano.pagamento)}</p>${payLink(c.plano)}`:'<p>Você ainda não possui um plano contratado.</p><a class="btn btn-primary" href="planos.html">Conhecer planos</a>'}</article><article class="panel-card"><h2>Precisa de ajuda?</h2><p>Abra uma solicitação e acompanhe as respostas da equipe.</p><button class="btn btn-primary" type="button" data-go="mensagens">Minhas mensagens</button></article></div>`}
function ticketCard(ticket){return `<article class="panel-card ticket"><header><div><strong>${safe(ticket.assunto)}</strong><small> · ${safe(ticket.nome)} · ${safe(ticket.data)} ${safe(ticket.hora)}</small></div><span class="pill">${safe(ticket.status)}</span></header><div class="conversation">${ticket.mensagens.map(message=>`<p><b>${safe(message.autor)}:</b> ${safe(message.texto)}<small>${safe(message.data)}</small></p>`).join('')}</div>${ticket.status==='Encerrado'?'<p class="subtitle">Este chamado foi encerrado.</p>':`${client?'':`<button class="logout" type="button" data-close="${safe(ticket.id)}">Encerrar chamado</button>`}<form data-reply="${safe(ticket.id)}"><label>Responder<textarea name="texto" required rows="3" placeholder="Escreva uma resposta…"></textarea></label><div class="ticket-actions"><button class="btn btn-primary" type="submit">Enviar resposta</button>${client?'':`<label>Status<select name="status"><option ${ticket.status==='Aberto'?'selected':''}>Aberto</option><option ${ticket.status==='Em atendimento'?'selected':''}>Em atendimento</option><option>Encerrado</option></select></label>`}</div></form>`}</article>`}

/* Faturas do cliente: no modo simulado a situação vem dos pedidos deste navegador;
   com o Mercado Pago ligado, vem do servidor (servidor/pagamentos.js). */
const invoiceLabels={pago:['Paga',''],processando:['Em processamento','warn'],vencida:['Vencida','danger'],aberta:['Em aberto','muted']};
function invoicesHtml(){
const c=clients().find(x=>x.email===session.email);
if(!c?.plano)return '<article class="panel-card"><p>Você ainda não possui um plano contratado.</p><a class="btn btn-primary" href="planos.html">Conhecer planos</a></article>';
if(!A.priceToNumber(c.plano.valor))return '<article class="panel-card"><p>As faturas do seu plano são enviadas pela nossa equipe.</p></article>';
return `<p class="subtitle">${safe(c.plano.nome)} · ${safe(c.plano.valor)}/mês · vencimento todo dia ${safe(c.plano.vencimento)}</p><div id="invoice-list"><p class="empty">Carregando faturas…</p></div><p class="legend" id="invoice-note"></p>`}
// Confirma neste navegador um pagamento que o Mercado Pago já aprovou (ex.: Pix pago depois).
function syncPaid(ref,info){
const order=A.orders().find(o=>o.ref===ref&&o.cliente===session.email&&o.status!=='Pago');
if(!order||info?.status!=='pago')return false;
try{A.updateOrder(order.id,{metodo:info.metodo});A.confirmPayment(order.id,{mpId:info.id,bandeira:info.bandeira,final:info.final},info.pagoEm);return true}catch{return false}}
async function loadInvoices(){
const box=content.querySelector('#invoice-list');
if(!box)return;
const list=A.invoices(session.email),c=clients().find(x=>x.email===session.email);
const mode=await A.paymentMode();
let statuses={},warning='';
if(mode.modo==='mercadopago'){
try{statuses=await A.remoteStatus(list.map(i=>i.ref));
Object.entries(statuses).forEach(([ref,info])=>syncPaid(ref,info))}
catch(error){warning=error.message;list.forEach(i=>{statuses[i.ref]=A.localInvoiceStatus(i.ref)})}}
else{if(mode.modo==='indisponivel')warning=mode.erro;list.forEach(i=>{statuses[i.ref]=A.localInvoiceStatus(i.ref)})}
if(!content.querySelector('#invoice-list'))return;
const today=new Date();today.setHours(0,0,0,0);
const rows=list.map(item=>{
const info=statuses[item.ref];
const local=A.orders().find(o=>o.ref===item.ref&&o.cliente===session.email&&(o.status==='Pago'||info?.status==='processando'));
const key=info?.status==='pago'?'pago':info?.status==='processando'?'processando':item.vencimento<today?'vencida':'aberta';
const [label,tone]=invoiceLabels[key];
const firstPending=item.primeira&&c.plano.pagamento==='Pendente'&&c.plano.pedido;
let action;
if(key==='pago')action=local?`<a class="text-link" href="checkout.html?pedido=${encodeURIComponent(local.id)}">Comprovante</a>`:'<span class="muted-text">Pago no Mercado Pago</span>';
else if(key==='processando')action=local?`<a class="text-link" href="checkout.html?pedido=${encodeURIComponent(local.id)}">Ver pagamento</a>`:'<span class="muted-text">Aguardando confirmação</span>';
else if(firstPending)action=`<a class="btn btn-primary btn-small" href="checkout.html?pedido=${encodeURIComponent(c.plano.pedido)}">Concluir pagamento</a>`;
else action=`<a class="btn btn-primary btn-small" href="checkout.html?fatura=${encodeURIComponent(item.competencia)}">Pagar</a>`;
const paidOn=key==='pago'&&info.pagoEm?` <small>em ${safe(new Date(info.pagoEm).toLocaleDateString('pt-BR'))}</small>`:'';
return `<tr><td>${safe(item.nome.charAt(0).toUpperCase()+item.nome.slice(1))}${item.primeira?' <small>(1ª mensalidade)</small>':''}</td><td>${safe(item.vencimento.toLocaleDateString('pt-BR'))}</td><td>${safe(A.money(item.valor))}</td><td><span class="pill ${tone}">${label}</span>${paidOn}</td><td>${action}</td></tr>`});
box.innerHTML=list.length?table(['Mês','Vencimento','Valor','Situação',''],rows):'<p class="empty">Nenhuma fatura por enquanto.</p>';
const note=content.querySelector('#invoice-note');
note.textContent=warning||(mode.modo==='mercadopago'?(mode.ambiente==='producao'?'Pagamentos processados pelo Mercado Pago.':'Modo de teste do Mercado Pago: nenhum valor real é cobrado.'):'Pagamentos online em breve. Por enquanto, confirme sua fatura com a equipe pelo WhatsApp.');
note.classList.toggle('warn-text',!!warning)}
// Se a 1ª mensalidade estava pendente (Pix ou boleto pagos depois), confere no Mercado Pago ao abrir o painel.
async function syncPendingPlan(){
const c=clients().find(x=>x.email===session.email);
const order=c?.plano?.pagamento==='Pendente'&&A.orders().find(o=>o.id===c.plano.pedido);
if(!order?.ref)return;
const mode=await A.paymentMode();
if(mode.modo!=='mercadopago')return;
try{const info=(await A.remoteStatus([order.ref]))[order.ref];
if(syncPaid(order.ref,info)){const current=nav.querySelector('button.active')?.dataset.page;if(current)render(current)}}catch{}}
function render(page){
if(!pages.includes(page)){content.innerHTML='<div class="content"><h1>Acesso negado. Você não possui permissão para acessar esta área.</h1></div>';
return}
nav.querySelectorAll('button').forEach(button=>button.classList.toggle('active',button.dataset.page===page));
document.querySelector('.sidebar').classList.remove('open');
let html=`<div class="content"><h1>${labels[page]}</h1>`;
if(page==='dashboard'||page==='inicio')html=dashboard();
else if(page==='planos')html+=table(['Plano','Velocidade','Valor mensal'],A.plans.map(plan=>`<tr><td>${safe(plan.nome)}</td><td>${safe(plan.velocidade)}</td><td>${safe(plan.valor||'Consulte')}</td></tr>`));
else if(page==='clientes'){clientFilter.q='';clientFilter.pagamento='';
html+=`<div class="toolbar"><label class="search-label">Pesquisar clientes<input id="search-client" type="search" placeholder="Nome, e-mail, CPF, telefone ou endereço"></label><label class="search-label">Pagamento<select id="filter-pay"><option value="">Todos</option><option>Pago</option><option>Pendente</option><option>Sem plano</option></select></label><button id="export-csv" class="btn btn-ghost-panel" type="button">Exportar CSV</button></div><p class="subtitle" id="client-count"></p><div id="client-table">${table(CLIENT_HEADS,clientRows())}</div>${admin?'':'<p class="legend">O CPF aparece mascarado para o atendimento. Só o administrador vê o número completo.</p>'}`}
else if(page==='faturas')html+=invoicesHtml();
else if(page==='meu-plano'){
const c=clients().find(x=>x.email===session.email);
html+=c?.plano?`<article class="panel-card"><h2>${safe(c.plano.nome)}</h2><p>${safe(c.plano.velocidade)} · ${safe(c.plano.valor)}/mês</p><p>Vencimento dia ${safe(c.plano.vencimento)} · ${safe(c.plano.status)} · Pagamento ${safe(c.plano.pagamento)}</p>${payLink(c.plano)}${invoicesLink(c.plano)}</article>`:`<article class="panel-card"><p>Você ainda não possui um plano contratado.</p><a class="btn btn-primary" href="planos.html">Conhecer planos</a></article>`;
}else if(page==='meus-dados'){
const c=clients().find(x=>x.email===session.email);
html+=`<form id="profile-form"><div class="form-row"><label>Nome completo<input name="nome" required value="${safe(c?.nome)}"></label><label>E-mail<input name="email" type="email" required value="${safe(c?.email)}"></label></div><div class="form-row"><label>Telefone<input name="telefone" required value="${safe(c?.telefone)}"></label><label>CPF<input value="${safe(c?.cpf)}" disabled></label></div><label>Endereço<input name="endereco" required value="${safe(c?.endereco)}"></label><button class="btn btn-primary">Salvar dados</button><p class="form-feedback" aria-live="polite"></p></form>`;
}else if(page==='mensagens'){
const visible=visibleTickets();
if(client)html+=`<form id="ticket-form"><h2>Nova solicitação</h2><label>Assunto<input name="assunto" required placeholder="Ex.: Internet lenta"></label><label>Mensagem<textarea name="mensagem" required rows="4" placeholder="Como podemos ajudar?"></textarea></label><button class="btn btn-primary">Enviar solicitação</button><p class="form-feedback" aria-live="polite"></p></form>`;
html+=visible.length?visible.map(ticketCard).join(''):'<p class="empty">Nenhum chamado encontrado.</p>';
}else if(page==='funcionarios'){
html+=table(['Nome','E-mail','Cargo','Nível de acesso','Status'],staff().map(user=>`<tr><td>${safe(user.nome)}</td><td>${safe(user.email)}</td><td>${safe(user.cargo)}</td><td>${user.nivel==='admin'?'Administrador':`<select data-role="${safe(user.email)}"><option value="atendimento" ${user.nivel==='atendimento'?'selected':''}>Atendimento</option><option value="tecnico" ${user.nivel==='tecnico'?'selected':''}>Técnico</option></select>`}</td><td>${safe(user.status)}</td></tr>`));
}else if(page==='configuracoes'){
if(client){const c=clients().find(x=>x.email===session.email);
html+=`<form id="settings-form"><h2>Dados de contato</h2><label>E-mail<input name="email" type="email" value="${safe(c?.email)}" required></label><label>Telefone<input name="telefone" value="${safe(c?.telefone)}" required></label><label>Endereço<input name="endereco" value="${safe(c?.endereco)}" required></label><label class="check-label"><input type="checkbox" name="preferencias" ${c?.preferencias?'checked':''}> Receber comunicações da FHP</label><h2>Alterar senha</h2><label>Senha atual<input name="atual" type="password" autocomplete="current-password"></label><label>Nova senha<input name="nova" type="password" minlength="8" autocomplete="new-password"></label><label>Confirmar nova senha<input name="confirmar" type="password" autocomplete="new-password"></label><button class="btn btn-primary">Salvar configurações</button><p class="form-feedback" aria-live="polite"></p></form><button id="delete-account" class="logout" type="button">Excluir minha conta</button>`}
else html+=`<article class="panel-card"><h2>Níveis de acesso</h2><p>Somente o administrador altera níveis de acesso da equipe, na página Funcionários.</p></article>${admin?`<article class="panel-card"><h2>Dados de demonstração</h2><p>Clientes, faturas e chamados fictícios para apresentar o painel. Nenhum dado é real; os clientes têm e-mail <code>@demo.exemplo.com</code> e senha <code>cliente123</code>.</p><div class="ticket-actions"><button id="seed-demo" class="btn btn-primary" type="button">Carregar dados de demonstração</button><button id="clear-demo" class="logout" type="button">Apagar dados de demonstração</button></div><p class="form-feedback" id="demo-feedback" aria-live="polite"></p></article>`:''}`;
html+=`<article class="panel-card privacy-card"><h2>Seus dados</h2><p>Veja como tratamos seus dados na <a class="text-link" href="privacidade.html">política de privacidade</a>. Para pedir uma cópia ou a exclusão dos seus dados, use o botão Excluir minha conta ou fale com a equipe.</p></article>`;
}
content.innerHTML=html+'</div>';
bind(page);
if(page==='faturas')loadInvoices();
}
function bind(page){
content.querySelectorAll('[data-go]').forEach(button=>button.addEventListener('click',()=>render(button.dataset.go)));
const search=content.querySelector('#search-client');
const refreshClients=()=>{const rows=clientRows();content.querySelector('#client-table').innerHTML=rows.length?table(CLIENT_HEADS,rows):'<p class="empty">Nenhum cliente encontrado com esse filtro.</p>';
const count=content.querySelector('#client-count');if(count)count.textContent=`${rows.length} de ${clients().length} cliente(s)`};
if(search){refreshClients();search.addEventListener('input',()=>{clientFilter.q=search.value.toLocaleLowerCase('pt-BR');refreshClients()});
content.querySelector('#filter-pay').addEventListener('change',e=>{clientFilter.pagamento=e.target.value;refreshClients()});
content.querySelector('#export-csv').addEventListener('click',csv)}
const ticketForm=content.querySelector('#ticket-form');
if(ticketForm)ticketForm.addEventListener('submit',event=>{event.preventDefault();
const feedback=ticketForm.querySelector('.form-feedback');
try{A.send(ticketForm.elements.assunto.value,ticketForm.elements.mensagem.value);
render('mensagens')}catch(error){feedback.textContent=error.message}});
content.querySelectorAll('[data-reply]').forEach(form=>form.addEventListener('submit',event=>{event.preventDefault();
try{if(client)A.replyAsClient(form.dataset.reply,form.elements.texto.value);else A.responderMensagem(form.dataset.reply,form.elements.texto.value,form.elements.status?.value);
render('mensagens')}catch(error){alert(error.message)}}));
content.querySelectorAll('[data-close]').forEach(button=>button.addEventListener('click',()=>{try{A.encerrarChamado(button.dataset.close);
render('mensagens')}catch(error){alert(error.message)}}));
const profile=content.querySelector('#profile-form');
if(profile)profile.addEventListener('submit',async event=>{event.preventDefault();
try{await A.updateClient(Object.fromEntries(new FormData(profile)));
profile.querySelector('.form-feedback').textContent='Dados atualizados.';
setTimeout(()=>location.reload(),350)}catch(error){profile.querySelector('.form-feedback').textContent=error.message}});
const settings=content.querySelector('#settings-form');
if(settings)settings.addEventListener('submit',async event=>{event.preventDefault();
const current=clients().find(x=>x.email===session.email),feedback=settings.querySelector('.form-feedback');
try{if(settings.elements.nova.value){if(A.modo==='local'&&settings.elements.atual.value!==current.senha)throw Error('A senha atual não confere.');
if(settings.elements.nova.value.length<8||settings.elements.nova.value!==settings.elements.confirmar.value)throw Error('Verifique a nova senha (mínimo 8 caracteres) e a confirmação.')}await A.updateClient({email:settings.elements.email.value,telefone:settings.elements.telefone.value,endereco:settings.elements.endereco.value,preferencias:settings.elements.preferencias.checked,...(settings.elements.nova.value?{senha:settings.elements.nova.value,senhaAtual:settings.elements.atual.value}:{})});
feedback.textContent='Configurações salvas.';
setTimeout(()=>location.reload(),350)}catch(error){feedback.textContent=error.message}});
const remove=content.querySelector('#delete-account');
if(remove)remove.addEventListener('click',async()=>{if(confirm('Excluir sua conta e seus chamados? Esta ação não pode ser desfeita.')){try{await A.deleteAccount()}catch(error){alert(error.message)}}});
const seedBtn=content.querySelector('#seed-demo');
if(seedBtn)seedBtn.addEventListener('click',async()=>{seedBtn.disabled=true;try{const r=await A.seedDemo();content.querySelector('#demo-feedback').textContent=`${r.clientes} clientes, ${r.pedidos} pedidos e ${r.chamados} chamados carregados.`}catch(error){content.querySelector('#demo-feedback').textContent=error.message}seedBtn.disabled=false});
const clearBtn=content.querySelector('#clear-demo');
if(clearBtn)clearBtn.addEventListener('click',async()=>{if(confirm('Apagar todos os clientes, pedidos e chamados de demonstração?')){try{await A.clearDemo();content.querySelector('#demo-feedback').textContent='Dados de demonstração apagados.'}catch(error){content.querySelector('#demo-feedback').textContent=error.message}}});
content.querySelectorAll('[data-role]').forEach(select=>select.addEventListener('change',()=>{try{A.alterarNivelFuncionario(select.dataset.role,select.value)}catch(error){alert(error.message);
render('funcionarios')}}));
}
document.addEventListener('DOMContentLoaded',async()=>{content.innerHTML='<div class="content"><p class="subtitle">Carregando…</p></div>';
await A.ready;
if(!A.session()){location.replace('login.html');return}
const initial=client?'inicio':'dashboard';
if(client)syncPendingPlan();
render(initial);
const params=new URLSearchParams(location.search),requested=params.get('secao');
if(requested){if(pages.includes(requested))render(requested);
else content.innerHTML='<div class="content"><h1>Acesso negado. Você não possui permissão para acessar esta área.</h1></div>'}const plan=params.get('contratar');
if(plan){if(client)location.replace('checkout.html?plano='+encodeURIComponent(plan));
else content.innerHTML='<div class="content"><h1>Acesso negado. Você não possui permissão para contratar planos nesta conta.</h1></div>'}});
})();

