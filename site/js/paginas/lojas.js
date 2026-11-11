import { supa, estado, ehGestao, msgErro, carregarApoio } from '../supa.js';
import { el, esc, toast, barra, vazio, opcoes, lerForm, abrirModal, comCarregando, iniciais } from '../ui.js';

export async function paginaLojas() {
  const gestao = ehGestao();
  const w = el(`<div>
    <div class="cab-pagina">
      <div><h1>${gestao ? 'Gestão de lojas' : 'Minha loja'}</h1><p>${gestao ? 'Unidades da rede, gerentes e indicadores de cada loja.' : 'Indicadores de desenvolvimento da sua unidade.'}</p></div>
      ${gestao ? '<div class="acoes"><button class="btn" id="nova">+ Nova loja</button></div>' : ''}
    </div>
    <div class="card">
      ${gestao ? `<div class="filtros"><input class="entrada busca" id="busca" placeholder="Buscar loja"><select class="entrada" id="f-ativo"><option value="1">Ativas</option><option value="0">Inativas</option><option value="">Todas</option></select><span class="contador" id="contador"></span></div>` : ''}
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Nº</th><th>Loja</th><th>Gerente</th><th class="num">Funcionários</th><th style="min-width:170px">Conclusão dos treinamentos</th><th class="num">Média</th><th class="num">Em atraso</th><th>Situação</th></tr></thead>
      <tbody id="corpo"><tr><td colspan="8"><div class="vazio"><div class="spinner" style="margin:0 auto"></div></div></td></tr></tbody></table></div>
    </div></div>`);

  let gerentes = [], ind = {};
  const carregar = async () => {
    await carregarApoio();
    const [g, a] = await Promise.all([
      supa.from('perfis').select('id,nome,loja_id').eq('papel', 'gerente').eq('ativo', true).order('nome'),
      supa.from('atribuicoes').select('status,nota,prazo, p:perfis!atribuicoes_perfil_id_fkey!inner(loja_id,ativo)').eq('p.ativo', true).limit(20000),
    ]);
    gerentes = g.data || [];
    const { data: pf } = await supa.from('perfis').select('loja_id').eq('ativo', true).in('papel', ['funcionario', 'gerente']);
    ind = {};
    (pf || []).forEach((p) => { if (p.loja_id) (ind[p.loja_id] = ind[p.loja_id] || { func: 0, t: 0, f: 0, n: [], at: 0 }).func++; });
    const hoje = new Date().toISOString().slice(0, 10);
    (a.data || []).forEach((x) => {
      const i = (ind[x.p.loja_id] = ind[x.p.loja_id] || { func: 0, t: 0, f: 0, n: [], at: 0 });
      i.t++;
      if (['aprovado', 'concluido'].includes(x.status)) i.f++; else if (x.prazo && x.prazo < hoje) i.at++;
      if (x.nota != null) i.n.push(Number(x.nota));
    });
    desenhar();
  };

  const desenhar = () => {
    const b = w.querySelector('#busca')?.value.trim().toLowerCase() || '';
    const at = w.querySelector('#f-ativo')?.value ?? '1';
    let lojas = estado.lojas;
    if (!gestao) lojas = lojas.filter((l) => ind[l.id] || l.gerente_id === estado.perfil.id || l.id === estado.perfil.loja_id);
    lojas = lojas.filter((l) => (!b || `${l.nome} ${l.apelido} ${l.numero}`.toLowerCase().includes(b)) && (at === '' || String(Number(l.ativo)) === at));
    const c = w.querySelector('#contador'); if (c) c.textContent = `${lojas.length} loja(s)`;
    const corpo = w.querySelector('#corpo');
    if (!lojas.length) { corpo.innerHTML = `<tr><td colspan="8">${vazio('Nenhuma loja encontrada.')}</td></tr>`; return; }
    corpo.innerHTML = lojas.map((l) => {
      const i = ind[l.id] || { func: 0, t: 0, f: 0, n: [], at: 0 };
      const perc = i.t ? Math.round((100 * i.f) / i.t) : 0;
      const media = i.n.length ? Math.round(i.n.reduce((s, v) => s + v, 0) / i.n.length) : '—';
      const g = gerentes.find((x) => x.id === l.gerente_id);
      return `<tr class="${gestao ? 'clicavel' : ''}" data-id="${l.id}">
        <td><span class="posicao">${l.numero ?? '—'}</span></td>
        <td><strong>${esc(l.nome)}</strong><div class="muted pequeno">${esc(l.apelido || '')}${l.cidade ? ' · ' + esc(l.cidade) : ''}</div></td>
        <td>${g ? `<div class="pessoa"><div class="avatar" style="width:28px;height:28px;font-size:11px">${esc(iniciais(g.nome))}</div>${esc(g.nome)}</div>` : '<span class="muted pequeno">Sem gerente</span>'}</td>
        <td class="num">${i.func}</td>
        <td>${i.t ? `<div class="linha entre pequeno"><span>${i.f}/${i.t}</span><strong>${perc}%</strong></div>${barra(perc)}` : '<span class="muted pequeno">Sem treinamentos</span>'}</td>
        <td class="num">${media}</td><td class="num">${i.at ? `<span style="color:var(--vermelho);font-weight:700">${i.at}</span>` : '0'}</td>
        <td>${l.ativo ? '<span class="tag verde">Ativa</span>' : '<span class="tag cinza">Inativa</span>'}</td></tr>`;
    }).join('');
  };

  if (gestao) {
    w.querySelector('#busca').addEventListener('input', desenhar);
    w.querySelector('#f-ativo').addEventListener('input', desenhar);
    w.querySelector('#nova').onclick = () => formLoja(null, gerentes, carregar);
    w.querySelector('#corpo').addEventListener('click', (e) => {
      const tr = e.target.closest('tr[data-id]');
      if (tr) formLoja(estado.lojas.find((l) => l.id === tr.dataset.id), gerentes, carregar);
    });
  }
  await carregar();
  return w;
}

async function formLoja(l, gerentes, recarregar) {
  const nova = !l;
  l = l || { ativo: true, cidade: 'Belo Horizonte' };
  let extras = [];
  if (!nova) {
    const { data } = await supa.from('gerente_lojas').select('gerente_id').eq('loja_id', l.id);
    extras = (data || []).map((x) => x.gerente_id);
  }
  const form = el(`<form novalidate><div class="grade-form">
    <div class="campo"><label>Número</label><input class="entrada" name="numero" type="number" value="${esc(l.numero ?? '')}"></div>
    <div class="campo"><label>Como a equipe chama (apelido)</label><input class="entrada" name="apelido" value="${esc(l.apelido || '')}" placeholder="Ex.: Loja 1"></div>
    <div class="campo inteiro"><label>Nome da loja *</label><input class="entrada" name="nome" required value="${esc(l.nome || '')}" placeholder="Vila Árabe ..."></div>
    <div class="campo"><label>Cidade</label><input class="entrada" name="cidade" value="${esc(l.cidade || '')}"></div>
    <div class="campo"><label>Endereço</label><input class="entrada" name="endereco" value="${esc(l.endereco || '')}"></div>
    <div class="campo"><label>Gerente da loja</label><select class="entrada" name="gerente_id">${opcoes(gerentes, l.gerente_id, { vazio: 'Sem gerente' })}</select></div>
    <div class="campo" style="align-self:end"><label class="check"><input type="checkbox" name="ativo" ${l.ativo ? 'checked' : ''}> Loja ativa</label></div>
    <div class="campo inteiro"><label>Outros gerentes/supervisores que acompanham esta loja</label>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;max-height:160px;overflow:auto;border:1px solid var(--borda);border-radius:9px;padding:10px">
        ${gerentes.map((g) => `<label class="check"><input type="checkbox" data-extra="${g.id}" ${extras.includes(g.id) ? 'checked' : ''}> ${esc(g.nome)}</label>`).join('') || '<span class="muted pequeno">Cadastre gerentes em Funcionários.</span>'}
      </div><span class="ajuda">Eles passam a ver a equipe e os indicadores desta loja.</span></div>
  </div></form>`);
  const { el: m, fechar } = abrirModal({ titulo: nova ? 'Nova loja' : 'Editar loja', corpo: form,
    rodape: `<button class="btn claro" data-c>Cancelar</button><button class="btn" data-s>Salvar</button>` });
  m.querySelector('[data-c]').onclick = fechar;
  m.querySelector('[data-s]').onclick = async (ev) => {
    const d = lerForm(form);
    delete d.extra;
    if (!d.nome) return toast('Informe o nome da loja.', 'erro');
    d.numero = d.numero ? Number(d.numero) : null;
    await comCarregando(ev.currentTarget, async () => {
      const q = nova ? supa.from('lojas').insert(d).select('id').single() : supa.from('lojas').update(d).eq('id', l.id).select('id').single();
      const { data: salvo, error } = await q;
      if (error) return toast(msgErro(error), 'erro');
      const marcados = [...form.querySelectorAll('[data-extra]:checked')].map((c) => c.dataset.extra);
      await supa.from('gerente_lojas').delete().eq('loja_id', salvo.id);
      if (marcados.length) await supa.from('gerente_lojas').insert(marcados.map((g) => ({ gerente_id: g, loja_id: salvo.id })));
      if (d.gerente_id) await supa.from('perfis').update({ gerente_id: d.gerente_id }).eq('loja_id', salvo.id).eq('papel', 'funcionario').is('gerente_id', null);
      toast('Loja salva.'); fechar(); recarregar();
    });
  };
}
