import { supa, estado, ehGestao, ehGerente, ehAdmin, msgErro, gerenciarUsuario } from '../supa.js';
import { el, esc, toast, fmtData, barra, vazio, statusTag, opcoes, lerForm, abrirModal, confirmar, comCarregando, iniciais, PAPEL, exportarCSV } from '../ui.js';
import { abrirDiploma } from '../diploma.js';
import { urlLink, numeroWhats, mensagemPendencias, abrirWhats, copiar, pendenciasDe } from '../whats.js';

const nomeLoja = (id) => estado.lojas.find((l) => l.id === id)?.nome?.replace('Vila Árabe ', '') || '—';
const nomeCargo = (id) => estado.cargos.find((c) => c.id === id)?.nome || '—';

export async function paginaFuncionarios({ rota }) {
  const gerente = ehGerente();
  const gestao = ehGestao();
  const w = el(`<div>
    <div class="cab-pagina">
      <div><h1>${gerente ? 'Minha equipe' : 'Cadastro de funcionários'}</h1>
        <p>${gerente ? 'Colaboradores das lojas sob sua gestão.' : 'Cadastre, edite e acompanhe os colaboradores de todas as lojas.'}</p></div>
      <div class="acoes">
        <button class="btn claro" id="exportar">⬇ Exportar planilha</button>
        <button class="btn claro" id="whats-massa">📲 Enviar pendências</button>
        <button class="btn" id="novo">+ Novo funcionário</button>
      </div>
    </div>
    <div class="card">
      <div class="filtros">
        <input class="entrada busca" id="f-busca" placeholder="Buscar por nome, matrícula ou e-mail">
        <select class="entrada" id="f-loja"></select>
        <select class="entrada" id="f-cargo">${opcoes(estado.cargos, '', { vazio: 'Todos os cargos' })}</select>
        ${gestao ? `<select class="entrada" id="f-papel"><option value="">Todos os perfis</option>${Object.entries(PAPEL).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select>` : ''}
        <select class="entrada" id="f-ativo"><option value="1">Ativos</option><option value="0">Inativos</option><option value="">Todos</option></select>
        <span class="contador" id="contador"></span>
      </div>
      <div class="tabela-wrap"><table class="tabela"><thead><tr>
        <th>Funcionário</th><th>Loja</th><th>Cargo</th><th>Perfil</th><th>Admissão</th><th style="min-width:150px">Treinamentos</th><th>Situação</th>
      </tr></thead><tbody id="corpo"><tr><td colspan="7"><div class="vazio"><div class="spinner" style="margin:0 auto"></div></div></td></tr></tbody></table></div>
    </div></div>`);

  let pessoas = [], stats = {};
  const carregar = async () => {
    const [p, a] = await Promise.all([
      supa.from('perfis').select('id,nome,matricula,email,telefone,papel,loja_id,cargo_id,setor_id,ativo,data_admissao,gerente_id').order('nome'),
      supa.from('atribuicoes').select('perfil_id,status,prazo').limit(20000),
    ]);
    if (p.error) throw p.error;
    pessoas = (p.data || []).filter((x) => !gerente || x.id !== estado.perfil.id);
    stats = {};
    (a.data || []).forEach((x) => {
      const s = (stats[x.perfil_id] = stats[x.perfil_id] || { t: 0, f: 0, atraso: 0 });
      s.t++;
      if (['aprovado', 'concluido'].includes(x.status)) s.f++;
      else if (x.prazo && x.prazo < new Date().toISOString().slice(0, 10)) s.atraso++;
    });
    const lojasPessoas = [...new Set(pessoas.map((x) => x.loja_id).filter(Boolean))];
    const lojasFiltro = gerente ? estado.lojas.filter((l) => lojasPessoas.includes(l.id)) : estado.lojas;
    w.querySelector('#f-loja').innerHTML = opcoes(lojasFiltro, w.querySelector('#f-loja').value, { vazio: 'Todas as lojas' });
    desenhar();
  };

  const filtrados = () => {
    const b = w.querySelector('#f-busca').value.trim().toLowerCase();
    const loja = w.querySelector('#f-loja').value, cargo = w.querySelector('#f-cargo').value;
    const papel = w.querySelector('#f-papel')?.value || '', ativo = w.querySelector('#f-ativo').value;
    return pessoas.filter((x) =>
      (!b || [x.nome, x.matricula, x.email].some((v) => (v || '').toLowerCase().includes(b))) &&
      (!loja || x.loja_id === loja) && (!cargo || x.cargo_id === cargo) && (!papel || x.papel === papel) &&
      (ativo === '' || String(Number(x.ativo)) === ativo));
  };

  const desenhar = () => {
    const lista = filtrados();
    w.querySelector('#contador').textContent = `${lista.length} pessoa(s)`;
    const corpo = w.querySelector('#corpo');
    if (!lista.length) { corpo.innerHTML = `<tr><td colspan="7">${vazio('Nenhum funcionário encontrado.')}</td></tr>`; return; }
    corpo.innerHTML = lista.map((x) => {
      const s = stats[x.id] || { t: 0, f: 0, atraso: 0 };
      const perc = s.t ? Math.round((100 * s.f) / s.t) : 0;
      return `<tr class="clicavel" data-id="${x.id}">
        <td><div class="pessoa"><div class="avatar">${esc(iniciais(x.nome))}</div><div><div class="n">${esc(x.nome)}</div><div class="s">${esc(x.matricula || x.email || '')}</div></div></div></td>
        <td>${esc(nomeLoja(x.loja_id))}</td><td>${esc(nomeCargo(x.cargo_id))}</td>
        <td><span class="pequeno">${esc(PAPEL[x.papel])}</span></td>
        <td>${fmtData(x.data_admissao)}</td>
        <td>${s.t ? `<div class="linha pequeno entre"><span>${s.f}/${s.t}</span><span>${perc}%</span></div>${barra(perc)}${s.atraso ? `<div class="pequeno" style="color:var(--vermelho);margin-top:3px">${s.atraso} em atraso</div>` : ''}` : '<span class="muted pequeno">Sem treinamentos</span>'}</td>
        <td>${x.ativo ? '<span class="tag verde">Ativo</span>' : '<span class="tag cinza">Inativo</span>'}</td></tr>`;
    }).join('');
  };

  ['#f-busca', '#f-loja', '#f-cargo', '#f-papel', '#f-ativo'].forEach((s) => w.querySelector(s)?.addEventListener('input', desenhar));
  w.querySelector('#corpo').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) abrirFicha(pessoas.find((x) => x.id === tr.dataset.id), carregar);
  });
  w.querySelector('#novo').onclick = () => formNovo(carregar);
  w.querySelector('#whats-massa').onclick = () => enviarEmMassa(filtrados().filter((x) => x.ativo && ['funcionario', 'gerente'].includes(x.papel)), stats);
  w.querySelector('#exportar').onclick = () => {
    const lista = filtrados();
    exportarCSV('funcionarios-universidade-vila-arabe.csv',
      ['Nome', 'Matrícula', 'E-mail', 'Loja', 'Cargo', 'Perfil', 'Admissão', 'Treinamentos', 'Concluídos', 'Em atraso', 'Situação'],
      lista.map((x) => { const s = stats[x.id] || { t: 0, f: 0, atraso: 0 };
        return [x.nome, x.matricula, x.email?.endsWith('.local') ? '' : x.email, nomeLoja(x.loja_id), nomeCargo(x.cargo_id), PAPEL[x.papel], fmtData(x.data_admissao), s.t, s.f, s.atraso, x.ativo ? 'Ativo' : 'Inativo']; }));
  };
  await carregar();
  return w;
}

// ---------- campos do formulário (cadastro e edição) ----------
async function camposPessoa(x = {}, novo = false) {
  const gestao = ehGestao();
  const { data: lideres } = await supa.from('perfis').select('id,nome,papel,loja_id').in('papel', ['gerente', 'rh', 'admin']).eq('ativo', true).order('nome');
  const lojas = gestao ? estado.lojas.filter((l) => l.ativo || l.id === x.loja_id)
                       : estado.lojas.filter((l) => l.id === estado.perfil.loja_id || l.gerente_id === estado.perfil.id || l.id === x.loja_id);
  const papeis = Object.entries(PAPEL).filter(([k]) => ehAdmin() || k !== 'admin');
  return `<div class="grade-form">
    <div class="campo inteiro"><label>Nome completo *</label><input class="entrada" name="nome" required value="${esc(x.nome || '')}"></div>
    <div class="campo"><label>Matrícula ${novo ? '*' : ''}</label><input class="entrada" name="matricula" value="${esc(x.matricula || '')}" ${novo ? '' : 'readonly'} placeholder="Usada para entrar no sistema"></div>
    <div class="campo"><label>CPF</label><input class="entrada" name="cpf" value="${esc(x.cpf || '')}" inputmode="numeric" placeholder="000.000.000-00"></div>
    <div class="campo"><label>E-mail ${novo ? '' : '(login)'}</label><input class="entrada" name="email" type="email" value="${esc(x.email?.endsWith('.local') ? '' : (x.email || ''))}" ${novo ? '' : 'readonly'} placeholder="Opcional"></div>
    <div class="campo"><label>Telefone</label><input class="entrada" name="telefone" value="${esc(x.telefone || '')}" inputmode="tel" placeholder="(31) 9 0000-0000"></div>
    <div class="campo"><label>Loja *</label><select class="entrada" name="loja_id" required>${opcoes(lojas, x.loja_id || (lojas.length === 1 ? lojas[0].id : ''), { vazio: 'Selecione' })}</select></div>
    <div class="campo"><label>Cargo *</label><select class="entrada" name="cargo_id" required>${opcoes(estado.cargos.filter((c) => c.ativo || c.id === x.cargo_id), x.cargo_id, { vazio: 'Selecione' })}</select>
      ${novo ? '<span class="ajuda">A trilha de integração e a da função são atribuídas automaticamente.</span>' : ''}</div>
    <div class="campo"><label>Setor</label><select class="entrada" name="setor_id">${opcoes(estado.setores, x.setor_id, { vazio: 'Igual ao do cargo' })}</select></div>
    <div class="campo"><label>Data de admissão</label><input class="entrada" type="date" name="data_admissao" value="${esc(x.data_admissao || (novo ? new Date().toISOString().slice(0, 10) : ''))}"></div>
    <div class="campo"><label>Gerente responsável</label><select class="entrada" name="gerente_id">${opcoes((lideres || []).filter((l) => l.papel === 'gerente'), x.gerente_id || (ehGerente() ? estado.perfil.id : ''), { vazio: 'Gerente da loja' })}</select></div>
    <div class="campo"><label>Responsável pelo acompanhamento</label><select class="entrada" name="responsavel_id">${opcoes(lideres || [], x.responsavel_id, { vazio: 'O mesmo gerente' })}</select></div>
    ${gestao ? `<div class="campo"><label>Perfil de acesso</label><select class="entrada" name="papel">${papeis.map(([k, v]) => `<option value="${k}" ${(x.papel || 'funcionario') === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>` : ''}
    ${novo ? `<div class="campo"><label>Senha inicial</label><input class="entrada" name="senha" placeholder="Deixe vazio para gerar automática"><span class="ajuda">Mínimo de 6 caracteres.</span></div>` : ''}
  </div>`;
}

function prepararForm(form) {
  // gerente responsável padrão = gerente da loja escolhida; setor padrão = do cargo
  const loja = form.querySelector('[name=loja_id]'), ger = form.querySelector('[name=gerente_id]');
  const cargo = form.querySelector('[name=cargo_id]'), setor = form.querySelector('[name=setor_id]');
  loja?.addEventListener('change', () => { const l = estado.lojas.find((x) => x.id === loja.value); if (l?.gerente_id && ger && !ger.dataset.mexido) ger.value = l.gerente_id; });
  ger?.addEventListener('change', () => { ger.dataset.mexido = '1'; });
  cargo?.addEventListener('change', () => { const c = estado.cargos.find((x) => x.id === cargo.value); if (c?.setor_id && setor) setor.value = c.setor_id; });
}

async function formNovo(recarregar) {
  const form = el(`<form novalidate>${await camposPessoa({}, true)}</form>`);
  prepararForm(form);
  const { el: m, fechar } = abrirModal({ titulo: 'Novo funcionário', corpo: form, tamanho: 'largo',
    rodape: `<button class="btn claro" data-c>Cancelar</button><button class="btn" data-s>Cadastrar</button>` });
  m.querySelector('[data-c]').onclick = fechar;
  m.querySelector('[data-s]').onclick = async (ev) => {
    const d = lerForm(form);
    if (!d.nome) return toast('Informe o nome.', 'erro');
    if (!d.matricula) return toast('Informe a matrícula.', 'erro');
    const operacional = !['admin', 'rh'].includes(d.papel || 'funcionario');
    if (operacional && (!d.loja_id || !d.cargo_id)) return toast('Escolha a loja e o cargo.', 'erro');
    if (d.senha && d.senha.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.', 'erro');
    if (!d.setor_id) d.setor_id = estado.cargos.find((c) => c.id === d.cargo_id)?.setor_id || null;
    if (!d.gerente_id) d.gerente_id = estado.lojas.find((l) => l.id === d.loja_id)?.gerente_id || null;
    await comCarregando(ev.currentTarget, async () => {
      try {
        const r = await gerenciarUsuario({ acao: 'criar', dados: d });
        fechar();
        abrirModal({ titulo: 'Funcionário cadastrado ✅', tamanho: 'estreito', corpo: `
          <p style="margin-top:0"><strong>${esc(d.nome)}</strong> já pode entrar na Universidade.</p>
          <div class="caixa-senha"><div class="pequeno muted">Login</div><code>${esc(d.matricula)}</code>
            <div class="pequeno muted" style="margin-top:8px">Senha inicial</div><code>${esc(r.senha)}</code></div>
          <p class="pequeno muted">Anote e entregue ao funcionário. ${r.treinamentos ? `<strong>${r.treinamentos} treinamento(s)</strong> da trilha dele já foram atribuídos automaticamente.` : 'Nenhuma trilha automática encontrada para este cargo.'}</p>` });
        recarregar();
      } catch (e) { toast(msgErro(e), 'erro'); }
    });
  };
}

// ---------- ficha individual ----------
async function abrirFicha(resumo, recarregar) {
  const { data: x, error } = await supa.from('perfis').select('*').eq('id', resumo.id).single();
  if (error) return toast(msgErro(error), 'erro');
  const podeEditar = ehGestao() || (ehGerente() && x.papel === 'funcionario');
  const corpo = el(`<div>
    <div class="ficha-topo"><div class="avatar grande">${esc(iniciais(x.nome))}</div>
      <div><h2>${esc(x.nome)}</h2><div class="s">${esc(nomeCargo(x.cargo_id))} · ${esc(nomeLoja(x.loja_id))} · ${esc(PAPEL[x.papel])}</div>
      <div class="linha" style="margin-top:6px;flex-wrap:wrap">${x.ativo ? '<span class="tag verde">Ativo</span>' : '<span class="tag cinza">Inativo</span>'}<span class="tag azul sem-ponto">⭐ ${x.pontos} pontos</span>
        ${x.ativo && ['funcionario', 'gerente'].includes(x.papel) && (ehGestao() || x.papel === 'funcionario') ? '<button class="btn pequeno" id="b-whats" style="background:#16a34a">📲 Enviar link no WhatsApp</button>' : ''}</div></div></div>
    <div class="abas mt" style="margin-left:-22px;margin-right:-22px">
      <button class="ativa" data-aba="dados">Dados</button><button data-aba="treinos">Treinamentos</button><button data-aba="integ">Integração</button>${podeEditar ? '<button data-aba="acesso">Acesso</button>' : ''}
    </div>
    <div id="aba" style="padding-top:18px"></div></div>`);
  const { el: m, fechar } = abrirModal({ titulo: 'Ficha do funcionário', corpo, tamanho: 'largo' });
  const aba = corpo.querySelector('#aba');
  corpo.querySelector('#b-whats')?.addEventListener('click', () => enviarWhats(x, recarregar));
  const abas = {
    dados: async () => {
      if (!podeEditar) {
        aba.innerHTML = `<dl class="dados">${[['Matrícula', x.matricula], ['E-mail', x.email?.endsWith('.local') ? '—' : x.email], ['Telefone', x.telefone], ['Admissão', fmtData(x.data_admissao)], ['Loja', nomeLoja(x.loja_id)], ['Cargo', nomeCargo(x.cargo_id)]].map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(b || '—')}</dd></div>`).join('')}</dl>`;
        return;
      }
      const form = el(`<form novalidate>${await camposPessoa(x)}<div class="linha" style="justify-content:flex-end"><button class="btn" type="submit">Salvar alterações</button></div></form>`);
      prepararForm(form);
      form.onsubmit = async (ev) => {
        ev.preventDefault();
        const d = lerForm(form);
        delete d.matricula; delete d.email;
        const operacional = !['admin', 'rh'].includes(d.papel || x.papel);
        if (!d.nome || (operacional && (!d.loja_id || !d.cargo_id))) return toast('Nome, loja e cargo são obrigatórios.', 'erro');
        const cargoMudou = d.cargo_id !== x.cargo_id;
        await comCarregando(form.querySelector('button[type=submit]'), async () => {
          const { error: e } = await supa.from('perfis').update(d).eq('id', x.id);
          if (e) return toast(msgErro(e), 'erro');
          if (cargoMudou && ehGestao()) await supa.from('promocoes').insert({ perfil_id: x.id, cargo_anterior: x.cargo_id, cargo_novo: d.cargo_id, observacao: 'Alteração de cargo no cadastro' });
          Object.assign(x, d);
          toast(cargoMudou ? 'Dados salvos. A trilha do novo cargo foi atribuída.' : 'Dados salvos.');
          recarregar();
        });
      };
      aba.innerHTML = ''; aba.append(form);
    },
    treinos: async () => {
      aba.innerHTML = '<div class="vazio"><div class="spinner" style="margin:0 auto"></div></div>';
      const { data } = await supa.from('atribuicoes').select('id,status,progresso,nota,prazo,obrigatorio,origem,concluido_em,curso_id, cursos(titulo,carga_horaria_min,responsavel_nome)').eq('perfil_id', x.id).order('prazo');
      const { data: certs } = await supa.from('certificados').select('id,codigo,curso_id,nota,carga_horaria_min,responsavel_nome,emitido_em').eq('perfil_id', x.id);
      const certDe = (a) => (certs || []).find((c) => c.curso_id === a.curso_id);
      aba.innerHTML = (data || []).length ? `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Treinamento</th><th>Origem</th><th>Prazo</th><th>Progresso</th><th>Nota</th><th>Situação</th><th></th></tr></thead><tbody>
        ${data.map((a) => `<tr><td><strong>${esc(a.cursos?.titulo)}</strong>${a.obrigatorio ? '' : ' <span class="muted pequeno">(opcional)</span>'}</td><td class="pequeno">${esc(a.origem)}</td>
          <td>${fmtData(a.prazo)}</td><td style="min-width:110px">${barra(a.progresso)}</td><td class="num">${a.nota != null ? Math.round(a.nota) : '—'}</td><td>${statusTag(a.status, a.prazo)}</td>
          <td><div class="linha" style="justify-content:flex-end">${certDe(a) ? `<button class="btn claro pequeno" data-diploma="${a.id}" title="Diploma em PDF">🎓 Diploma</button>` : ''}${podeEditar && !['aprovado', 'concluido'].includes(a.status) ? `<button class="btn claro pequeno" data-editar="${a.id}">Editar</button>` : ''}${podeEditar && a.status !== 'nao_iniciado' ? `<button class="btn claro pequeno" data-reabrir="${a.id}">Reabrir</button>` : ''}</div></td></tr>`).join('')}</tbody></table></div>`
        : vazio('Nenhum treinamento atribuído.');
      aba.querySelectorAll('[data-diploma]').forEach((b) => b.onclick = () => {
        const a = data.find((y) => y.id === b.dataset.diploma), c = certDe(a);
        abrirDiploma({ ...c, nome: x.nome, curso: a.cursos?.titulo, carga_horaria_min: c.carga_horaria_min ?? a.cursos?.carga_horaria_min, responsavel_nome: c.responsavel_nome || a.cursos?.responsavel_nome });
      });
      const editar = (id) => editarAtribuicao(data.find((a) => a.id === id), () => abas.treinos());
      aba.querySelectorAll('[data-editar]').forEach((b) => b.onclick = () => editar(b.dataset.editar));
      aba.querySelectorAll('[data-reabrir]').forEach((b) => b.onclick = async () => {
        if (!(await confirmar('Reabrir este treinamento? O progresso e a nota serão zerados e o funcionário fará de novo. Em seguida você poderá ajustar o prazo.', { botao: 'Reabrir' }))) return;
        const { error: e } = await supa.rpc('reabrir_treinamento', { p_atribuicao: b.dataset.reabrir });
        if (e) return toast(msgErro(e), 'erro');
        toast('Treinamento reaberto. Ajuste o prazo se precisar.');
        await abas.treinos();
        const { data: atual } = await supa.from('atribuicoes').select('id,status,prazo,obrigatorio, cursos(titulo)').eq('id', b.dataset.reabrir).single();
        if (atual) editarAtribuicao(atual, () => abas.treinos());
      });
    },
    integ: async () => {
      const { data: i } = await supa.from('integracoes').select('*, trilhas(nome)').eq('perfil_id', x.id).maybeSingle();
      if (!i) { aba.innerHTML = vazio('Este funcionário não tem acompanhamento de integração.'); return; }
      const { data: etapas } = await supa.from('atribuicoes').select('status,prazo,concluido_em, cursos(titulo)').eq('perfil_id', x.id).eq('trilha_id', i.trilha_id);
      const f = (etapas || []).filter((e) => ['aprovado', 'concluido'].includes(e.status)).length;
      aba.innerHTML = `
        <dl class="dados"><div><dt>Trilha</dt><dd>${esc(i.trilhas?.nome || '—')}</dd></div><div><dt>Início</dt><dd>${fmtData(i.data_inicio)}</dd></div>
          <div><dt>Data prevista</dt><dd>${fmtData(i.data_prevista)}</dd></div><div><dt>Conclusão</dt><dd>${fmtData(i.data_conclusao)}</dd></div>
          <div><dt>Etapas</dt><dd>${f} de ${(etapas || []).length}</dd></div><div><dt>Resultado</dt><dd>${{ pendente: 'Pendente', aprovado: 'Aprovado', reprovado: 'Reprovado' }[i.resultado]}</dd></div></dl>
        <div class="card mt"><ul class="lista-simples">${(etapas || []).map((e) => `<li><div class="principal"><strong>${esc(e.cursos?.titulo)}</strong><span>${['aprovado', 'concluido'].includes(e.status) ? 'Concluída em ' + fmtData(e.concluido_em) : 'Prazo ' + fmtData(e.prazo)}</span></div>${statusTag(e.status, e.prazo)}</li>`).join('')}</ul></div>
        ${podeEditar ? `<form class="mt" id="f-integ"><h4 style="margin-bottom:10px">Avaliação do gerente</h4><div class="grade-form">
          <div class="campo"><label>Nota (0 a 10)</label><input class="entrada" type="number" min="0" max="10" name="nota_gerente" value="${i.nota_gerente ?? ''}"></div>
          <div class="campo"><label>Resultado</label><select class="entrada" name="resultado">${['pendente', 'aprovado', 'reprovado'].map((r) => `<option value="${r}" ${i.resultado === r ? 'selected' : ''}>${{ pendente: 'Pendente', aprovado: 'Aprovado', reprovado: 'Reprovado' }[r]}</option>`).join('')}</select></div>
          <div class="campo inteiro"><label>Comentário</label><textarea class="entrada" name="avaliacao_gerente">${esc(i.avaliacao_gerente || '')}</textarea></div></div>
          <div class="linha" style="justify-content:flex-end"><button class="btn" type="submit">Salvar avaliação</button></div></form>` : ''}`;
      aba.querySelector('#f-integ')?.addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const d = lerForm(ev.target);
        d.nota_gerente = d.nota_gerente != null ? Number(d.nota_gerente) : null;
        d.data_conclusao = d.resultado === 'pendente' ? null : (i.data_conclusao || new Date().toISOString().slice(0, 10));
        const { error: e } = await supa.from('integracoes').update(d).eq('id', i.id);
        if (e) return toast(msgErro(e), 'erro');
        toast('Avaliação da integração salva.'); abas.integ();
      });
    },
    acesso: async () => {
      const loginMat = x.matricula;
      aba.innerHTML = `
        <dl class="dados"><div><dt>Entra com</dt><dd>${esc(loginMat ? 'Matrícula ' + loginMat : x.email)}</dd></div>
          ${x.email && !x.email.endsWith('.local') ? `<div><dt>E-mail de login</dt><dd>${esc(x.email)}</dd></div>` : ''}
          <div><dt>Perfil de acesso</dt><dd>${esc(PAPEL[x.papel])}</dd></div></dl>
        <div class="card mt card-corpo"><div class="linha entre" style="flex-wrap:wrap;gap:12px">
          <div><strong>Redefinir senha</strong><div class="muted pequeno">Gera uma nova senha para entregar ao funcionário.</div></div>
          <button class="btn claro" id="b-senha">Redefinir senha</button></div></div>
        ${ehGestao() ? `<div class="card mt card-corpo"><div class="linha entre" style="flex-wrap:wrap;gap:12px">
          <div><strong>E-mail de acesso</strong><div class="muted pequeno">Permite entrar com e-mail e recuperar a senha sozinho.</div></div>
          <div class="linha"><input class="entrada" id="novo-email" type="email" placeholder="nome@vilaarabe.com.br" style="width:220px"><button class="btn claro" id="b-email">Salvar</button></div></div></div>` : ''}
        <div class="card mt card-corpo"><div class="linha entre" style="flex-wrap:wrap;gap:12px">
          <div><strong>${x.ativo ? 'Inativar acesso' : 'Reativar acesso'}</strong><div class="muted pequeno">${x.ativo ? 'O funcionário deixa de entrar. O histórico é mantido.' : 'O funcionário volta a entrar com a senha atual.'}</div></div>
          <button class="btn ${x.ativo ? 'perigo' : ''}" id="b-ativo">${x.ativo ? 'Inativar' : 'Reativar'}</button></div></div>
        <div id="resultado-senha"></div>`;
      aba.querySelector('#b-senha').onclick = async (ev) => {
        if (!(await confirmar(`Gerar uma nova senha para ${x.nome}?`, { botao: 'Gerar senha' }))) return;
        await comCarregando(ev.currentTarget, async () => {
          try {
            const r = await gerenciarUsuario({ acao: 'redefinir_senha', perfil_id: x.id });
            aba.querySelector('#resultado-senha').innerHTML = `<div class="caixa-senha"><div class="pequeno muted">Nova senha de ${esc(x.nome)}</div><code>${esc(r.senha)}</code></div>`;
          } catch (e) { toast(msgErro(e), 'erro'); }
        });
      };
      aba.querySelector('#b-email')?.addEventListener('click', async (ev) => {
        const email = aba.querySelector('#novo-email').value.trim();
        if (!email.includes('@')) return toast('Informe um e-mail válido.', 'erro');
        await comCarregando(ev.currentTarget, async () => {
          try { await gerenciarUsuario({ acao: 'alterar_email', perfil_id: x.id, email }); x.email = email; toast('E-mail de acesso atualizado.'); abas.acesso(); }
          catch (e) { toast(msgErro(e), 'erro'); }
        });
      });
      aba.querySelector('#b-ativo').onclick = async (ev) => {
        const acao = x.ativo ? 'inativar' : 'reativar';
        if (!(await confirmar(x.ativo ? `Inativar o acesso de ${x.nome}?` : `Reativar o acesso de ${x.nome}?`, { botao: x.ativo ? 'Inativar' : 'Reativar', perigo: x.ativo }))) return;
        await comCarregando(ev.currentTarget, async () => {
          try { await gerenciarUsuario({ acao, perfil_id: x.id }); x.ativo = !x.ativo; toast(x.ativo ? 'Acesso reativado.' : 'Acesso inativado.'); recarregar(); fechar(); }
          catch (e) { toast(msgErro(e), 'erro'); }
        });
      };
    },
  };
  corpo.querySelectorAll('[data-aba]').forEach((b) => b.onclick = () => {
    corpo.querySelectorAll('[data-aba]').forEach((o) => o.classList.toggle('ativa', o === b));
    abas[b.dataset.aba]();
  });
  abas.dados();
}

// ---------- editar um treinamento atribuído (prazo, obrigatório, remover) ----------
function editarAtribuicao(a, aoSalvar) {
  if (!a) return;
  const form = el(`<form novalidate>
    <p style="margin-top:0"><strong>${esc(a.cursos?.titulo || 'Treinamento')}</strong></p>
    <div class="campo"><label>Prazo para concluir</label><input class="entrada" type="date" name="prazo" value="${esc(a.prazo || '')}"></div>
    <div class="campo"><label class="check"><input type="checkbox" name="obrigatorio" ${a.obrigatorio ? 'checked' : ''}> Treinamento obrigatório</label>
      <span class="ajuda">Os obrigatórios contam na Central de Pendências e nos indicadores da loja.</span></div>
  </form>`);
  const { el: m, fechar } = abrirModal({ titulo: 'Editar treinamento', corpo: form, tamanho: 'estreito',
    rodape: `<button class="btn perigo" data-rem style="margin-right:auto">Remover</button><button class="btn claro" data-c>Cancelar</button><button class="btn" data-s>Salvar</button>` });
  m.querySelector('[data-c]').onclick = fechar;
  m.querySelector('[data-s]').onclick = async (ev) => {
    const d = lerForm(form);
    if (d.prazo && d.prazo < new Date().toISOString().slice(0, 10) &&
        !(await confirmar('O prazo escolhido já passou, e o treinamento vai aparecer como em atraso. Salvar assim mesmo?', { botao: 'Salvar' }))) return;
    await comCarregando(ev.currentTarget, async () => {
      const { error } = await supa.from('atribuicoes').update({ prazo: d.prazo, obrigatorio: !!d.obrigatorio }).eq('id', a.id);
      if (error) return toast(msgErro(error), 'erro');
      toast('Treinamento atualizado.'); fechar(); aoSalvar && aoSalvar();
    });
  };
  m.querySelector('[data-rem]').onclick = async () => {
    if (!(await confirmar('Remover este treinamento do funcionário? O progresso dele neste curso será apagado.', { botao: 'Remover', perigo: true }))) return;
    const { error } = await supa.from('atribuicoes').delete().eq('id', a.id);
    if (error) return toast(msgErro(error), 'erro');
    toast('Treinamento removido.'); fechar(); aoSalvar && aoSalvar();
  };
}


// ---------- WhatsApp: link pessoal + pendências ----------
async function enviarWhats(x, recarregar) {
  let token, pend;
  try {
    const [t, p] = await Promise.all([supa.rpc('link_pessoal', { p_perfil: x.id, p_novo: false }), pendenciasDe([x.id])]);
    if (t.error) throw t.error;
    token = t.data; pend = p[x.id] || [];
  } catch (e) { return toast(msgErro(e), 'erro'); }
  const corpo = el(`<div>
    <p class="muted" style="margin-top:0">O link entra direto na Universidade, sem senha. Ele é pessoal: só envie para ${esc(x.nome.split(' ')[0])}.</p>
    <div class="campo"><label>WhatsApp de ${esc(x.nome.split(' ')[0])}</label>
      <input class="entrada" id="w-tel" inputmode="tel" placeholder="(31) 9 0000-0000" value="${esc(x.telefone || '')}">
      <span class="ajuda">Sem número, o WhatsApp abre e você escolhe o contato.</span></div>
    <div class="campo"><label>Mensagem</label><textarea class="entrada" id="w-msg" rows="10"></textarea></div>
    <div class="linha" style="flex-wrap:wrap;gap:8px"><button class="link-btn pequeno" id="w-copiar-link">Copiar só o link</button>
      <button class="link-btn pequeno" id="w-novo" style="color:var(--vermelho)">Gerar link novo (o antigo para de funcionar)</button></div>
  </div>`);
  const msg = corpo.querySelector('#w-msg');
  const montar = () => { msg.value = mensagemPendencias(x.nome, pend, urlLink(token)); };
  montar();
  const { el: m, fechar } = abrirModal({ titulo: 'Enviar pelo WhatsApp', corpo, tamanho: 'estreito',
    rodape: `<button class="btn claro" data-copiar>Copiar mensagem</button><button class="btn" data-abrir style="background:#16a34a">Abrir no WhatsApp</button>` });
  const salvarTel = async () => {
    const tel = corpo.querySelector('#w-tel').value.trim();
    if (tel && tel !== (x.telefone || '')) {
      if (!numeroWhats(tel)) { toast('Confira o número: use DDD + celular.', 'erro'); return false; }
      const { error } = await supa.from('perfis').update({ telefone: tel }).eq('id', x.id);
      if (!error) { x.telefone = tel; recarregar && recarregar(); }
    }
    return true;
  };
  m.querySelector('[data-abrir]').onclick = async () => { if (!(await salvarTel())) return; abrirWhats(x.telefone, msg.value); fechar(); };
  m.querySelector('[data-copiar]').onclick = async () => { await salvarTel(); toast((await copiar(msg.value)) ? 'Mensagem copiada.' : 'Não foi possível copiar.'); };
  corpo.querySelector('#w-copiar-link').onclick = async () => toast((await copiar(urlLink(token))) ? 'Link copiado.' : 'Não foi possível copiar.');
  corpo.querySelector('#w-novo').onclick = async () => {
    if (!(await confirmar('Gerar um link novo? O link enviado antes deixa de funcionar.', { botao: 'Gerar novo' }))) return;
    const { data, error } = await supa.rpc('link_pessoal', { p_perfil: x.id, p_novo: true });
    if (error) return toast(msgErro(error), 'erro');
    token = data; montar(); toast('Link novo gerado.');
  };
}

async function enviarEmMassa(pessoas, stats) {
  const comPend = pessoas.filter((p) => { const s = stats[p.id]; return s && s.t > s.f; });
  if (!comPend.length) return toast('Ninguém com treinamento pendente neste filtro.');
  const corpo = el(`<div><div class="vazio"><div class="spinner" style="margin:0 auto"></div></div></div>`);
  const { el: m } = abrirModal({ titulo: `Enviar pendências · ${comPend.length} pessoa(s)`, corpo, tamanho: 'largo' });
  let links = {}, pend = {};
  try {
    const ids = comPend.map((p) => p.id);
    const [l, p] = await Promise.all([supa.rpc('links_pessoais', { p_ids: ids }), pendenciasDe(ids)]);
    if (l.error) throw l.error;
    (l.data || []).forEach((r) => (links[r.perfil_id] = r.token));
    pend = p;
  } catch (e) { corpo.innerHTML = vazio(msgErro(e), '⚠️'); return; }
  const lista = comPend.filter((p) => links[p.id] && (pend[p.id] || []).length);
  corpo.innerHTML = `<p class="muted" style="margin-top:0">Toque em <strong>Enviar</strong> em cada pessoa: o WhatsApp abre com a mensagem pronta e o link pessoal (sem senha). Quem não tem celular cadastrado: o WhatsApp abre para você escolher o contato.</p>
    <ul class="lista-simples" style="margin:0 -16px">${lista.map((p) => `<li data-id="${p.id}">
      <div class="principal"><strong>${esc(p.nome)}</strong><span>${esc(nomeLoja(p.loja_id))} · ${(pend[p.id] || []).length} pendente(s)${p.telefone ? ' · ' + esc(p.telefone) : ' · sem celular'}</span></div>
      <button class="btn pequeno claro" data-copiar title="Copiar mensagem">Copiar</button>
      <button class="btn pequeno" data-enviar style="background:#16a34a">Enviar</button></li>`).join('')}</ul>`;
  const msgDe = (p) => mensagemPendencias(p.nome, pend[p.id] || [], urlLink(links[p.id]));
  corpo.querySelectorAll('li[data-id]').forEach((li) => {
    const p = lista.find((x) => x.id === li.dataset.id);
    li.querySelector('[data-enviar]').onclick = (ev) => {
      abrirWhats(p.telefone, msgDe(p));
      ev.currentTarget.textContent = 'Enviado ✓'; ev.currentTarget.classList.add('claro'); ev.currentTarget.style.background = '';
    };
    li.querySelector('[data-copiar]').onclick = async () => toast((await copiar(msgDe(p))) ? 'Mensagem copiada.' : 'Não foi possível copiar.');
  });
}
