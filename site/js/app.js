import { supa, estado, carregarApoio, msgErro, ehGestao, ehGerente } from './supa.js';
import { el, esc, toast, iniciais, PAPEL, tempoRelativo, abrirModal, comCarregando } from './ui.js';
import { VERSAO } from './config.js';
import { paginaInicio } from './paginas/inicio.js';
import { paginaTrilha } from './paginas/trilha.js';
import { paginaFuncionarios } from './paginas/funcionarios.js';
import { paginaLojas } from './paginas/lojas.js';
import { paginaCargos } from './paginas/cargos.js';
import { paginaConta } from './paginas/conta.js';
import { paginaCursos } from './paginas/cursos.js';
import { paginaCurso } from './paginas/curso.js';
import { paginaCertificados, telaValidar } from './paginas/certificados.js';

const app = document.getElementById('app');

// ---------------- menu por perfil ----------------
// Cada item só aparece para os perfis listados em "para".
const MENU = [
  { grupo: 'Universidade Vila Árabe' },
  { rota: 'inicio', ic: '🏠', nome: 'Início', para: ['admin', 'rh', 'gerente', 'funcionario'], pagina: paginaInicio },
  { rota: 'trilha', ic: '🧭', nome: 'Minha trilha', para: ['gerente', 'funcionario'], pagina: paginaTrilha },
  { rota: 'certificados', ic: '🎓', nome: 'Meus certificados', para: ['gerente', 'funcionario'], pagina: paginaCertificados },
  { rota: 'conta', ic: '👤', nome: 'Minha conta', para: ['admin', 'rh', 'gerente', 'funcionario'], pagina: paginaConta },
  { grupo: 'Área gerencial', para: ['gerente'] },
  { rota: 'equipe', ic: '👥', nome: 'Minha equipe', para: ['gerente'], pagina: paginaFuncionarios },
  { rota: 'minhas-lojas', ic: '🏪', nome: 'Minha loja', para: ['gerente'], pagina: paginaLojas },
  { grupo: 'Administração RH', para: ['admin', 'rh'] },
  { rota: 'cursos', ic: '📚', nome: 'Criar e editar cursos', para: ['admin', 'rh'], pagina: paginaCursos },
  { rota: 'funcionarios', ic: '🧑‍🍳', nome: 'Cadastro de funcionários', para: ['admin', 'rh'], pagina: paginaFuncionarios },
  { rota: 'lojas', ic: '🏪', nome: 'Gestão de lojas', para: ['admin', 'rh'], pagina: paginaLojas },
  { rota: 'cargos', ic: '🗂️', nome: 'Gestão de cargos e setores', para: ['admin', 'rh'], pagina: paginaCargos },
];
// Telas fora do menu
const OCULTAS = [
  { rota: 'curso', nome: 'Treinamento', menu: 'trilha', para: ['admin', 'rh', 'gerente', 'funcionario'], pagina: paginaCurso },
];
const ROTAS_LIVRES = { 'nova-senha': telaNovaSenha };

// "#/cursos/abc" -> ['cursos', 'abc']
const partesRota = () => location.hash.replace(/^#\/?/, '').split('?')[0].split('/').filter(Boolean);
let entrandoPorLink = false;

// ---------------- autenticação ----------------
async function iniciar() {
  const hash = location.hash || '';
  if (hash.includes('type=recovery')) { location.hash = '#/nova-senha'; }
  const [r0, r1, r2] = partesRota();
  if (r0 === 'l' && r1) return entrarPorLink(r1, r2);
  const { data: { session } } = await supa.auth.getSession();
  if (!session && r0 === 'validar') return telaValidarPublica(r1);
  if (!session) return telaLogin();
  await entrar(session.user);
}

supa.auth.onAuthStateChange((evento) => {
  if (evento === 'PASSWORD_RECOVERY') location.hash = '#/nova-senha';
  if (evento === 'SIGNED_OUT' && !entrandoPorLink) { estado.usuario = null; estado.perfil = null; telaLogin(); }
});

async function entrar(user) {
  estado.usuario = user;
  const { data: perfil, error } = await supa.from('perfis')
    .select('id,nome,matricula,email,papel,loja_id,cargo_id,setor_id,pontos,ativo,data_admissao,telefone')
    .eq('id', user.id).single();
  if (error || !perfil || !perfil.ativo) {
    await supa.auth.signOut();
    return telaLogin('Seu acesso não está ativo na Universidade. Fale com o RH.');
  }
  estado.perfil = perfil;
  await carregarApoio();
  supa.from('acessos').insert({ perfil_id: perfil.id }).then(() => {});
  montarCasca();
  rotear();
}

// Entrada pelo link pessoal enviado no WhatsApp (sem senha)
async function entrarPorLink(token, cursoId) {
  entrandoPorLink = true;
  app.innerHTML = `<div class="carregando-tela"><div style="text-align:center"><div class="spinner" style="margin:0 auto"></div><p class="muted">Entrando na Universidade Vila Árabe…</p></div></div>`;
  try {
    const { data, error } = await supa.functions.invoke('entrar-link', { body: { token } });
    if (error) {
      let det = null;
      try { det = await error.context.json(); } catch (_) { /* sem corpo */ }
      throw new Error(det?.erro || 'Não foi possível entrar pelo link. Tente de novo.');
    }
    if (data?.erro) throw new Error(data.erro);
    const { data: atual } = await supa.auth.getSession();
    if (atual.session) await supa.auth.signOut({ scope: 'local' });
    let r = await supa.auth.verifyOtp({ token_hash: data.token_hash, type: data.tipo === 'signup' ? 'signup' : 'magiclink' });
    if (r.error) r = await supa.auth.verifyOtp({ token_hash: data.token_hash, type: 'email' });
    if (r.error) throw r.error;
    history.replaceState(null, '', location.pathname + (cursoId ? `#/curso/${cursoId}` : '#/trilha'));
    entrandoPorLink = false;
    await entrar(r.data.user);
  } catch (e) {
    entrandoPorLink = false;
    history.replaceState(null, '', location.pathname);
    telaLogin(msgErro(e));
  }
}

function telaValidarPublica(codigo) {
  app.innerHTML = '';
  telaValidar(codigo).then((t) => app.append(t));
}

function telaLogin(aviso = '') {
  app.innerHTML = '';
  const t = el(`<div class="login">
    <section class="login-arte">
      <div class="marca"><img src="img/icone.svg" alt=""><div><strong>Universidade Vila Árabe</strong><span>Escola de talentos</span></div></div>
      <div>
        <h1>Aprender aqui é crescer junto.</h1>
        <p>Treinamentos, trilhas por função, avaliações e certificados de toda a rede Vila Árabe em um só lugar.</p>
        <div class="login-pontos"><div>Sua trilha de integração e da sua função</div><div>Certificado automático ao ser aprovado</div><div>Pontos, medalhas e ranking das lojas</div></div>
      </div>
      <small style="color:rgba(255,255,255,.5)">Padarias · Lanchonetes · Empórios</small>
    </section>
    <section class="login-form-lado">
      <form class="login-form" novalidate>
        <h2>Entrar</h2>
        <p class="sub">Use sua matrícula ou e-mail e a senha recebida do RH.</p>
        ${aviso ? `<div class="tag vermelho sem-ponto" style="margin-bottom:14px;white-space:normal">${esc(aviso)}</div>` : ''}
        <div class="campo"><label for="ident">Matrícula ou e-mail</label><input class="entrada" id="ident" autocomplete="username" required placeholder="Ex.: FUN001 ou nome@vilaarabe.com.br"></div>
        <div class="campo"><label for="senha">Senha</label><input class="entrada" id="senha" type="password" autocomplete="current-password" required></div>
        <button class="btn bloco" type="submit">Entrar</button>
        <div style="text-align:center;margin-top:14px"><button type="button" class="link-btn" id="esqueci">Esqueci minha senha</button></div>
        <div class="login-rodape">Problemas para entrar? Procure o gerente da sua loja ou o RH.</div>
      </form>
    </section></div>`);
  app.append(t);
  const form = t.querySelector('form');
  form.onsubmit = async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type=submit]');
    const ident = form.ident.value.trim();
    const senha = form.senha.value;
    if (!ident || !senha) return toast('Preencha matrícula/e-mail e senha.', 'erro');
    await comCarregando(btn, async () => {
      try {
        const { data: email, error: e1 } = await supa.rpc('email_para_login', { p_ident: ident });
        if (e1) throw e1;
        if (!email) throw new Error('Matrícula não encontrada.');
        const { data, error } = await supa.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        await entrar(data.user);
      } catch (err) { toast(msgErro(err), 'erro'); }
    });
  };
  t.querySelector('#esqueci').onclick = () => {
    const { el: m, fechar } = abrirModal({
      titulo: 'Recuperar senha', tamanho: 'estreito',
      corpo: `<p class="muted" style="margin-top:0">Se você entra com <strong>e-mail</strong>, enviamos um link para criar uma nova senha. Se entra com <strong>matrícula</strong>, peça ao gerente ou ao RH para redefinir sua senha.</p>
              <div class="campo"><label>Seu e-mail</label><input class="entrada" id="rec-email" type="email" placeholder="nome@vilaarabe.com.br"></div>`,
      rodape: `<button class="btn claro" data-c>Cancelar</button><button class="btn" data-e>Enviar link</button>`,
    });
    m.querySelector('[data-c]').onclick = fechar;
    m.querySelector('[data-e]').onclick = async (ev) => {
      const email = m.querySelector('#rec-email').value.trim();
      if (!email.includes('@')) return toast('Informe um e-mail válido.', 'erro');
      await comCarregando(ev.currentTarget, async () => {
        const { error } = await supa.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
        if (error) return toast(msgErro(error), 'erro');
        toast('Se o e-mail estiver cadastrado, o link chega em alguns minutos.');
        fechar();
      });
    };
  };
}

function telaNovaSenha() {
  const t = el(`<div class="card" style="max-width:440px;margin:40px auto"><div class="card-corpo">
    <h2 class="titulo-serif" style="font-size:24px;margin-bottom:6px">Criar nova senha</h2>
    <p class="muted">Digite a nova senha duas vezes.</p>
    <div class="campo"><label>Nova senha</label><input class="entrada" type="password" id="s1" autocomplete="new-password"></div>
    <div class="campo"><label>Repita a senha</label><input class="entrada" type="password" id="s2" autocomplete="new-password"></div>
    <button class="btn bloco" id="salvar">Salvar senha</button></div></div>`);
  t.querySelector('#salvar').onclick = async (ev) => {
    const a = t.querySelector('#s1').value, b = t.querySelector('#s2').value;
    if (a.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.', 'erro');
    if (a !== b) return toast('As senhas não conferem.', 'erro');
    await comCarregando(ev.currentTarget, async () => {
      const { error } = await supa.auth.updateUser({ password: a });
      if (error) return toast(msgErro(error), 'erro');
      toast('Senha alterada.');
      location.hash = '#/inicio';
    });
  };
  return t;
}

// ---------------- casca (menu + topo) ----------------
let casca, areaPagina, tituloTopo;
function montarCasca() {
  const p = estado.perfil;
  const itens = MENU.filter((m) => !m.para || m.para.includes(p.papel));
  const menuHtml = itens.map((m) => m.grupo
    ? `<div class="menu-grupo">${esc(m.grupo)}</div>`
    : `<a href="#/${m.rota}" data-rota="${m.rota}"><span class="ic">${m.ic}</span>${esc(m.nome)}</a>`).join('');
  app.innerHTML = '';
  casca = el(`<div class="casca">
    <aside class="lateral">
      <div class="marca"><img src="img/icone.svg" alt=""><div><strong>Universidade Vila Árabe</strong><span>Escola de talentos</span></div></div>
      <nav class="menu">${menuHtml}</nav>
      <div class="lateral-rodape">${esc(VERSAO)}</div>
    </aside>
    <div class="conteudo">
      <header class="topo">
        <button class="btn claro icone abre-menu" aria-label="Abrir menu">☰</button>
        <div class="titulo-pagina"></div>
        <div class="espaco"></div>
        <div class="sino"><button class="btn claro icone" id="btn-sino" aria-label="Notificações">🔔</button></div>
        <div class="usuario-chip" id="chip" title="Minha conta">
          <div class="avatar">${esc(iniciais(p.nome))}</div>
          <div class="texto"><div class="nome">${esc(p.nome)}</div><div class="papel">${esc(PAPEL[p.papel])}</div></div>
        </div>
        <button class="btn claro pequeno" id="sair">Sair</button>
      </header>
      <main class="pagina" id="pagina"></main>
    </div></div>`);
  app.append(casca);
  areaPagina = casca.querySelector('#pagina');
  tituloTopo = casca.querySelector('.titulo-pagina');
  casca.querySelector('.abre-menu').onclick = () => casca.classList.toggle('menu-aberto');
  casca.addEventListener('click', (e) => { if (e.target === casca) casca.classList.remove('menu-aberto'); });
  casca.querySelector('.menu').addEventListener('click', () => casca.classList.remove('menu-aberto'));
  casca.querySelector('#sair').onclick = async () => { await supa.auth.signOut(); location.hash = ''; };
  casca.querySelector('#chip').onclick = () => { location.hash = '#/conta'; };
  casca.querySelector('#btn-sino').onclick = alternarNotificacoes;
  atualizarSino();
  setInterval(atualizarSino, 60000);
}

// ---------------- roteador ----------------
async function rotear() {
  if (!estado.perfil) return;
  const [rota = 'inicio', param] = partesRota();
  if (rota === 'l' && param) return entrarPorLink(param, partesRota()[2]);
  casca.classList.remove('menu-aberto');
  const oculta = OCULTAS.find((m) => m.rota === rota);
  casca.querySelectorAll('.menu a').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === (oculta?.menu || rota)));
  if (rota === 'validar') {
    tituloTopo.textContent = 'Validar certificado';
    areaPagina.innerHTML = ''; areaPagina.append(await telaValidar(param));
    return;
  }
  if (ROTAS_LIVRES[rota]) {
    tituloTopo.textContent = 'Nova senha';
    areaPagina.innerHTML = ''; areaPagina.append(ROTAS_LIVRES[rota]());
    return;
  }
  const item = [...MENU, ...OCULTAS].find((m) => m.rota === rota && (!m.para || m.para.includes(estado.perfil.papel)));
  if (!item) { location.hash = '#/inicio'; return; }
  tituloTopo.textContent = item.nome;
  document.title = `${item.nome} · Universidade Vila Árabe`;
  areaPagina.innerHTML = '<div class="carregando-tela" style="min-height:40vh"><div class="spinner"></div></div>';
  try {
    const conteudo = await item.pagina({ rota, param });
    areaPagina.innerHTML = '';
    if (conteudo) areaPagina.append(conteudo);
    window.scrollTo(0, 0);
  } catch (err) {
    console.error(err);
    areaPagina.innerHTML = `<div class="card"><div class="vazio"><div class="ic">⚠️</div>${esc(msgErro(err))}</div></div>`;
  }
}
window.addEventListener('hashchange', rotear);

// ---------------- notificações ----------------
async function atualizarSino() {
  if (!estado.perfil) return;
  const { count } = await supa.from('notificacoes').select('id', { count: 'exact', head: true }).eq('lida', false);
  const sino = casca?.querySelector('.sino');
  if (!sino) return;
  sino.querySelector('.bolinha')?.remove();
  if (count) sino.append(el(`<span class="bolinha">${count > 99 ? '99+' : count}</span>`));
}

async function alternarNotificacoes(e) {
  e.stopPropagation();
  const sino = casca.querySelector('.sino');
  const aberto = sino.querySelector('.painel-notif');
  if (aberto) return aberto.remove();
  const painel = el(`<div class="painel-notif"><div class="cab">Notificações <button class="link-btn pequeno" id="marcar">Marcar todas como lidas</button></div><div class="itens"><div class="vazio"><div class="spinner" style="margin:0 auto"></div></div></div></div>`);
  sino.append(painel);
  const fechar = (ev) => { if (!painel.contains(ev.target)) { painel.remove(); document.removeEventListener('click', fechar); } };
  setTimeout(() => document.addEventListener('click', fechar), 0);
  const { data } = await supa.from('notificacoes').select('*').order('created_at', { ascending: false }).limit(30);
  const itens = painel.querySelector('.itens');
  itens.innerHTML = (data || []).length ? data.map((n) => `
    <a class="notif ${n.lida ? '' : 'nova'}" href="${esc(n.link || '#/inicio')}" data-id="${n.id}">
      <strong>${esc(n.titulo)}</strong>${n.mensagem ? `<span>${esc(n.mensagem)}</span>` : ''}<time>${tempoRelativo(n.created_at)}</time>
    </a>`).join('') : '<div class="vazio">Nenhuma notificação.</div>';
  itens.querySelectorAll('.notif').forEach((a) => a.addEventListener('click', async () => {
    await supa.from('notificacoes').update({ lida: true }).eq('id', a.dataset.id);
    painel.remove(); atualizarSino();
  }));
  painel.querySelector('#marcar').onclick = async () => {
    await supa.from('notificacoes').update({ lida: true }).eq('lida', false);
    painel.remove(); atualizarSino(); toast('Notificações marcadas como lidas.');
  };
}

export { atualizarSino };
iniciar().catch((e) => { console.error(e); telaLogin(msgErro(e)); });
