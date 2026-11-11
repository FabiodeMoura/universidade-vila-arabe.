import { supa, estado, msgErro, carregarApoio } from '../supa.js';
import { el, esc, toast, vazio, opcoes, lerForm, abrirModal, comCarregando, confirmar } from '../ui.js';

export async function paginaCargos() {
  const w = el(`<div>
    <div class="cab-pagina"><div><h1>Cargos e setores</h1><p>As funções da rede. Cada cargo pode ter uma trilha de treinamentos atribuída automaticamente.</p></div>
      <div class="acoes"><button class="btn claro" id="novo-setor">+ Novo setor</button><button class="btn" id="novo-cargo">+ Novo cargo</button></div></div>
    <div class="grade lado">
      <div class="card"><div class="card-cab"><h3>Cargos</h3><span class="muted pequeno" id="qtd"></span></div>
        <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Cargo</th><th>Setor</th><th class="num">Pessoas</th><th>Trilha automática</th><th>Situação</th></tr></thead><tbody id="cargos"></tbody></table></div></div>
      <div class="card"><div class="card-cab"><h3>Setores</h3></div><ul class="lista-simples" id="setores"></ul></div>
    </div></div>`);

  let qtdPorCargo = {}, trilhasPorCargo = {};
  const carregar = async () => {
    await carregarApoio();
    const [p, t] = await Promise.all([
      supa.from('perfis').select('cargo_id').eq('ativo', true),
      supa.from('trilhas').select('id,nome,cargo_id,ativo,trilha_cursos(curso_id)').eq('ativo', true),
    ]);
    qtdPorCargo = {}; (p.data || []).forEach((x) => { if (x.cargo_id) qtdPorCargo[x.cargo_id] = (qtdPorCargo[x.cargo_id] || 0) + 1; });
    trilhasPorCargo = {}; (t.data || []).forEach((x) => { if (x.cargo_id) (trilhasPorCargo[x.cargo_id] = trilhasPorCargo[x.cargo_id] || []).push(x); });
    desenhar();
  };
  const desenhar = () => {
    const setorNome = (id) => estado.setores.find((s) => s.id === id)?.nome || '—';
    w.querySelector('#qtd').textContent = `${estado.cargos.length} cargo(s)`;
    w.querySelector('#cargos').innerHTML = estado.cargos.length ? estado.cargos.map((c) => `
      <tr class="clicavel" data-id="${c.id}"><td><strong>${esc(c.nome)}</strong>${c.descricao ? `<div class="muted pequeno">${esc(c.descricao)}</div>` : ''}</td>
      <td>${esc(setorNome(c.setor_id))}</td><td class="num">${qtdPorCargo[c.id] || 0}</td>
      <td class="pequeno">${(trilhasPorCargo[c.id] || []).map((t) => `${esc(t.nome)} <span class="muted">(${t.trilha_cursos.length} cursos)</span>`).join('<br>') || '<span class="muted">Só a integração</span>'}</td>
      <td>${c.ativo ? '<span class="tag verde">Ativo</span>' : '<span class="tag cinza">Inativo</span>'}</td></tr>`).join('')
      : `<tr><td colspan="5">${vazio('Nenhum cargo cadastrado.')}</td></tr>`;
    w.querySelector('#setores').innerHTML = estado.setores.map((s) => {
      const n = estado.cargos.filter((c) => c.setor_id === s.id).length;
      return `<li><div class="principal"><strong>${esc(s.nome)}</strong><span>${n} cargo(s)</span></div>
        <button class="btn claro pequeno" data-ed-setor="${s.id}">Editar</button>${n ? '' : `<button class="btn perigo pequeno" data-del-setor="${s.id}">Excluir</button>`}</li>`;
    }).join('') || `<li>${vazio('Nenhum setor.')}</li>`;
  };

  const formSetor = (s) => {
    const form = el(`<form><div class="campo"><label>Nome do setor *</label><input class="entrada" name="nome" value="${esc(s?.nome || '')}" required></div></form>`);
    const { el: m, fechar } = abrirModal({ titulo: s ? 'Editar setor' : 'Novo setor', corpo: form, tamanho: 'estreito',
      rodape: `<button class="btn claro" data-c>Cancelar</button><button class="btn" data-s>Salvar</button>` });
    m.querySelector('[data-c]').onclick = fechar;
    const salvar = async (ev) => {
      ev?.preventDefault();
      const d = lerForm(form);
      if (!d.nome) return toast('Informe o nome.', 'erro');
      await comCarregando(m.querySelector('[data-s]'), async () => {
        const { error } = s ? await supa.from('setores').update(d).eq('id', s.id) : await supa.from('setores').insert(d);
        if (error) return toast(msgErro(error), 'erro');
        toast('Setor salvo.'); fechar(); carregar();
      });
    };
    m.querySelector('[data-s]').onclick = salvar; form.onsubmit = salvar;
  };

  const formCargo = (c) => {
    const form = el(`<form novalidate><div class="grade-form">
      <div class="campo inteiro"><label>Nome do cargo *</label><input class="entrada" name="nome" value="${esc(c?.nome || '')}" required></div>
      <div class="campo"><label>Setor</label><select class="entrada" name="setor_id">${opcoes(estado.setores, c?.setor_id, { vazio: 'Sem setor' })}</select></div>
      <div class="campo" style="align-self:end"><label class="check"><input type="checkbox" name="ativo" ${c?.ativo !== false ? 'checked' : ''}> Cargo ativo</label></div>
      <div class="campo inteiro"><label>Descrição</label><textarea class="entrada" name="descricao" placeholder="Principais atividades da função">${esc(c?.descricao || '')}</textarea></div>
    </div></form>`);
    const { el: m, fechar } = abrirModal({ titulo: c ? 'Editar cargo' : 'Novo cargo', corpo: form,
      rodape: `${c && !qtdPorCargo[c.id] ? '<button class="btn perigo" data-del style="margin-right:auto">Excluir</button>' : ''}<button class="btn claro" data-c>Cancelar</button><button class="btn" data-s>Salvar</button>` });
    m.querySelector('[data-c]').onclick = fechar;
    m.querySelector('[data-del]')?.addEventListener('click', async () => {
      if (!(await confirmar(`Excluir o cargo "${c.nome}"? As trilhas ligadas a ele também serão excluídas.`, { botao: 'Excluir', perigo: true }))) return;
      const { error } = await supa.from('cargos').delete().eq('id', c.id);
      if (error) return toast(msgErro(error), 'erro');
      toast('Cargo excluído.'); fechar(); carregar();
    });
    m.querySelector('[data-s]').onclick = async (ev) => {
      const d = lerForm(form);
      if (!d.nome) return toast('Informe o nome do cargo.', 'erro');
      await comCarregando(ev.currentTarget, async () => {
        const { error } = c ? await supa.from('cargos').update(d).eq('id', c.id) : await supa.from('cargos').insert(d);
        if (error) return toast(msgErro(error), 'erro');
        toast('Cargo salvo.'); fechar(); carregar();
      });
    };
  };

  w.querySelector('#novo-setor').onclick = () => formSetor(null);
  w.querySelector('#novo-cargo').onclick = () => formCargo(null);
  w.addEventListener('click', async (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (tr) return formCargo(estado.cargos.find((c) => c.id === tr.dataset.id));
    const ed = e.target.closest('[data-ed-setor]');
    if (ed) return formSetor(estado.setores.find((s) => s.id === ed.dataset.edSetor));
    const del = e.target.closest('[data-del-setor]');
    if (del) {
      const s = estado.setores.find((x) => x.id === del.dataset.delSetor);
      if (!(await confirmar(`Excluir o setor "${s.nome}"?`, { botao: 'Excluir', perigo: true }))) return;
      const { error } = await supa.from('setores').delete().eq('id', s.id);
      if (error) return toast(msgErro(error), 'erro');
      toast('Setor excluído.'); carregar();
    }
  });
  await carregar();
  return w;
}
