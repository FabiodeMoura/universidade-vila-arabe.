// Painel do gestor (RH, administrador e gerente): evolução dos treinamentos
import { supa, estado, ehGerente } from '../supa.js';
import { el, esc, fmtData, barra, vazio, opcoes, iniciais, exportarCSV } from '../ui.js';

const COR = { teal: '#0d9488', indigo: '#4f46e5', ambar: '#d97706', cinza: '#94a3b8', vermelho: '#dc2626', grade: '#f3f4f6', texto: '#4b5563' };
const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
const nomeCurto = (n) => (n || '').replace('Vila Árabe ', '');
const graficos = [];

// cor sequencial (um tom, claro → escuro) para os mapas de calor
function corCalor(p) {
  if (p == null) return { bg: '#f3f4f6', fg: '#9ca3af' };
  const a = [240, 253, 250], b = [15, 118, 110], t = Math.max(0, Math.min(1, p / 100));
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
  return { bg: `rgb(${c.join(',')})`, fg: t >= 0.55 ? '#fff' : '#134e4a' };
}

function rotuloPeriodo(iso, grao) {
  const d = new Date(iso);
  if (grao === 'week') return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  return `${MESES[d.getUTCMonth()]}/${String(d.getUTCFullYear()).slice(2)}`;
}

function kpi(rot, val, det = '', ic = '📊', destaque = false) {
  return `<div class="card kpi ${destaque ? 'destaque' : ''}"><div class="rot"><span class="ic">${ic}</span>${esc(rot)}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
}

function variacao(vals) {
  const v = (vals || []).filter((x) => x != null);
  if (v.length < 2) return '';
  const d = v[v.length - 1] - v[0];
  if (d === 0) return '<span class="delta">=</span>';
  return `<span class="delta ${d > 0 ? 'sobe' : 'desce'}">${d > 0 ? '▲' : '▼'} ${Math.abs(d)} p.p.</span>`;
}

export async function painelGestor() {
  const p = estado.perfil;
  const gerente = ehGerente();
  const lojasVis = gerente ? estado.lojas.filter((l) => l.id === p.loja_id || l.gerente_id === p.id) : estado.lojas.filter((l) => l.ativo);
  const filtro = { loja: '', cargo: '', meses: 6 };

  const raiz = el(`<div>
    <div class="cab-pagina">
      <div><h1>Painel da Universidade</h1>
        <p>${gerente ? 'Como anda o desenvolvimento da sua equipe.' : 'Como anda a Universidade Vila Árabe em toda a rede.'}</p></div>
    </div>
    <div class="card barra-filtros">
      <div class="campo-filtro"><label>Loja</label><select class="entrada" id="f-loja">${opcoes(lojasVis, '', { vazio: gerente && lojasVis.length <= 1 ? 'Minha loja' : 'Todas as lojas', rotulo: (l) => nomeCurto(l.nome) })}</select></div>
      <div class="campo-filtro"><label>Função</label><select class="entrada" id="f-cargo">${opcoes(estado.cargos, '', { vazio: 'Todas as funções' })}</select></div>
      <div class="campo-filtro"><label>Período</label>
        <div class="segmentado" id="f-meses">${[[1, '1 mês'], [3, '3 meses'], [6, '6 meses'], [12, '12 meses']].map(([v, t]) => `<button data-m="${v}" class="${v === 6 ? 'ativo' : ''}">${t}</button>`).join('')}</div></div>
      <button class="btn claro pequeno" id="limpar" style="align-self:flex-end">Limpar filtros</button>
    </div>
    <div id="area" class="mt"></div></div>`);
  const area = raiz.querySelector('#area');

  const carregar = async () => {
    graficos.splice(0).forEach((g) => g.destroy());
    area.innerHTML = '<div class="card"><div class="vazio"><div class="spinner" style="margin:0 auto"></div></div></div>';
    const args = { p_loja: filtro.loja || null, p_cargo: filtro.cargo || null };
    const [ind, evo] = await Promise.all([
      supa.rpc('painel_indicadores', args),
      supa.rpc('painel_evolucao', { ...args, p_meses: filtro.meses }),
    ]);
    if (ind.error || evo.error) { area.innerHTML = `<div class="card">${vazio((ind.error || evo.error).message, '⚠️')}</div>`; return; }
    area.innerHTML = '';
    area.append(montar(ind.data, evo.data, filtro, (loja) => { raiz.querySelector('#f-loja').value = loja; filtro.loja = loja; carregar(); },
                                                 (cargo) => { raiz.querySelector('#f-cargo').value = cargo; filtro.cargo = cargo; carregar(); }));
  };
  raiz.querySelector('#f-loja').onchange = (e) => { filtro.loja = e.target.value; carregar(); };
  raiz.querySelector('#f-cargo').onchange = (e) => { filtro.cargo = e.target.value; carregar(); };
  raiz.querySelectorAll('#f-meses button').forEach((b) => b.onclick = () => {
    raiz.querySelectorAll('#f-meses button').forEach((x) => x.classList.toggle('ativo', x === b));
    filtro.meses = Number(b.dataset.m); carregar();
  });
  raiz.querySelector('#limpar').onclick = () => {
    filtro.loja = ''; filtro.cargo = ''; filtro.meses = 6;
    raiz.querySelector('#f-loja').value = ''; raiz.querySelector('#f-cargo').value = '';
    raiz.querySelectorAll('#f-meses button').forEach((x) => x.classList.toggle('ativo', x.dataset.m === '6'));
    carregar();
  };
  await carregar();
  return raiz;
}

function montar(d, e, filtro, irLoja, irCargo) {
  const st = d.por_status || {};
  const total = Object.values(st).reduce((a, b) => a + b, 0);
  const rot = (e.periodos || []).map((x) => rotuloPeriodo(x, e.grao));
  const serie = e.serie || [];
  const concluidosPeriodo = serie.reduce((a, s) => a + (s.concluidos || 0), 0);
  const percs = serie.map((s) => s.perc);
  const nomePer = e.grao === 'week' ? 'semana' : 'mês';
  const lojaSel = estado.lojas.find((l) => l.id === filtro.loja);
  const cargoSel = estado.cargos.find((c) => c.id === filtro.cargo);
  const recorte = [lojaSel ? nomeCurto(lojaSel.nome) : 'toda a rede', cargoSel ? cargoSel.nome : null].filter(Boolean).join(' · ');

  const w = el(`<div>
    <div class="grade c4">
      ${kpi('Conclusão geral', `${d.perc_conclusao}%`, `${d.concluidos} de ${total} treinamentos ${variacao(percs.map((x) => x == null ? null : Math.round(x)))}`, '🎯', true)}
      ${kpi('Concluídos no período', concluidosPeriodo, `nos últimos ${filtro.meses} ${filtro.meses > 1 ? 'meses' : 'mês'}`, '✅')}
      ${kpi('Média das avaliações', d.media_notas || '—', 'nota de 0 a 100', '📝')}
      ${kpi('Funcionários', d.funcionarios, `${d.lojas} loja(s) · ${d.cursos_publicados} cursos publicados`, '👥')}
    </div>
    <div class="grade c4 mt">
      ${kpi('Com pendências', d.func_pendentes, 'funcionários com obrigatórios em aberto', '⏳')}
      ${kpi('Em andamento', d.em_andamento, `${d.nao_iniciados} ainda não iniciados`, '▶️')}
      ${kpi('Reprovados', d.reprovados, `${d.func_reprovados} funcionário(s)`, '❌')}
      ${kpi('Em atraso', d.atrasados, `${d.vencendo} vencem nos próximos 7 dias`, '🚨')}
    </div>

    <div class="grade c2 mt">
      <div class="card"><div class="card-cab"><div><h3>Evolução da conclusão</h3><div class="sub">% dos treinamentos atribuídos já concluídos · ${esc(recorte)}</div></div></div>
        <div class="card-corpo"><div class="grafico"><canvas id="g-evolucao" aria-label="Evolução do percentual de conclusão"></canvas></div></div></div>
      <div class="card"><div class="card-cab"><div><h3>Treinamentos concluídos por ${nomePer}</h3><div class="sub">Quantidade concluída em cada ${nomePer} · ${esc(recorte)}</div></div></div>
        <div class="card-corpo"><div class="grafico"><canvas id="g-ritmo" aria-label="Treinamentos concluídos por período"></canvas></div></div></div>
    </div>

    <div class="card mt">
      <div class="card-cab"><div><h3>Evolução por loja</h3><div class="sub">% de conclusão acumulado em cada ${nomePer}. Clique numa loja para filtrar o painel.</div></div>
        <button class="btn claro pequeno" id="exp-lojas">⬇ Exportar</button></div>
      ${calor(e.lojas, rot, 'loja', '🏪', 'Nenhuma loja com treinamentos no recorte.')}
      ${legendaCalor()}
    </div>

    <div class="card mt">
      <div class="card-cab"><div><h3>Evolução por função</h3><div class="sub">% de conclusão acumulado de cada cargo. Clique numa função para filtrar o painel.</div></div>
        <button class="btn claro pequeno" id="exp-cargos">⬇ Exportar</button></div>
      ${calor(e.cargos, rot, 'cargo', '🧑‍🍳', 'Nenhuma função com treinamentos no recorte.')}
    </div>

    <div class="card mt">
      <div class="card-cab"><div><h3>Lojas × funções</h3><div class="sub">% de conclusão hoje em cada combinação de loja e cargo. Passe o mouse para ver os números.</div></div></div>
      ${matriz(e.matriz)}
    </div>

    <div class="grade lado mt">
      <div class="card"><div class="card-cab"><div><h3>Situação dos treinamentos por loja</h3><div class="sub">Quantidade de treinamentos em cada situação</div></div></div>
        <div class="card-corpo">
          <div class="legenda-grafico">
            <span><i style="background:${COR.teal}"></i>Concluídos</span><span><i style="background:${COR.ambar}"></i>Em andamento</span>
            <span><i style="background:${COR.cinza}"></i>Não iniciados</span><span><i style="background:${COR.vermelho}"></i>Reprovados</span></div>
          <div class="grafico" style="height:${Math.max(220, (e.situacao_lojas || []).length * 34 + 60)}px"><canvas id="g-situacao" aria-label="Situação dos treinamentos por loja"></canvas></div></div></div>
      <div class="card"><div class="card-cab"><div><h3>Situação geral</h3><div class="sub">${total} treinamentos atribuídos</div></div></div>
        <div class="card-corpo">${situacaoGeral(st, total)}</div></div>
    </div>

    <div class="card mt"><div class="card-cab"><div><h3>Desempenho por treinamento</h3><div class="sub">Conclusão, média das notas, reprovações e atrasos de cada curso</div></div></div>
      ${tabelaCursos(e.cursos)}</div>

    <div class="grade c3 mt">
      <div class="card"><div class="card-cab"><h3>Gerentes com melhor desempenho</h3></div>
        ${(d.gerentes_ranking || []).length ? `<ul class="lista-simples">${d.gerentes_ranking.map((g, i) => `<li><span class="posicao ${i < 3 ? 'p' + (i + 1) : ''}">${i + 1}</span><div class="principal"><strong>${esc(g.nome)}</strong><span>${esc(nomeCurto(g.loja))}</span>${barra(g.perc)}</div><strong>${g.perc ?? 0}%</strong></li>`).join('')}</ul>` : vazio('Nenhum gerente com equipe vinculada.')}
      </div>
      <div class="card"><div class="card-cab"><h3>Vencem nos próximos 7 dias</h3><span class="tag laranja sem-ponto">${d.vencendo}</span></div>
        ${(d.proximos_vencimentos || []).length ? `<ul class="lista-simples">${d.proximos_vencimentos.map((v) => `<li><div class="principal"><strong>${esc(v.nome)}</strong><span>${esc(v.titulo)}</span></div><span class="tag laranja sem-ponto">${fmtData(v.prazo)}</span></li>`).join('')}</ul>` : vazio('Nada vencendo esta semana.', '🎉')}
      </div>
      <div class="card"><div class="card-cab"><h3>Novos em integração</h3><span class="tag amarelo sem-ponto">${d.integracoes_pendentes}</span></div>
        ${(d.novos_integracao || []).length ? `<ul class="lista-simples">${d.novos_integracao.map((n) => `<li><div class="avatar" style="width:30px;height:30px;font-size:11px">${esc(iniciais(n.nome))}</div><div class="principal"><strong>${esc(n.nome)}</strong><span>${esc(nomeCurto(n.loja || ''))} · ${n.feitos}/${n.total} etapas · até ${fmtData(n.data_prevista)}</span>${barra(n.total ? (100 * n.feitos) / n.total : 0)}</div></li>`).join('')}</ul>` : vazio('Nenhum funcionário aguardando integração.')}
      </div>
    </div>
  </div>`);

  // cliques nos mapas de calor filtram o painel
  w.querySelectorAll('[data-filtro-loja]').forEach((tr) => tr.onclick = () => irLoja(tr.dataset.filtroLoja));
  w.querySelectorAll('[data-filtro-cargo]').forEach((tr) => tr.onclick = () => irCargo(tr.dataset.filtroCargo));
  w.querySelector('#exp-lojas').onclick = () => exportarCSV('evolucao-por-loja.csv', ['Loja', ...rot, 'Concluídos', 'Atribuídos'],
    (e.lojas || []).map((l) => [nomeCurto(l.nome), ...l.valores.map((v) => (v == null ? '' : v + '%')), l.feitos, l.total]));
  w.querySelector('#exp-cargos').onclick = () => exportarCSV('evolucao-por-funcao.csv', ['Função', ...rot, 'Concluídos', 'Atribuídos'],
    (e.cargos || []).map((c) => [c.nome, ...c.valores.map((v) => (v == null ? '' : v + '%')), c.feitos, c.total]));

  requestAnimationFrame(() => desenharGraficos(w, serie, rot, e, nomePer));
  return w;
}

function calor(linhas, rot, tipo, ic, msgVazio) {
  if (!(linhas || []).length) return vazio(msgVazio);
  const nomeLinha = (l) => (tipo === 'loja' ? nomeCurto(l.nome) : l.nome);
  return `<div class="tabela-wrap"><table class="tabela calor">
    <thead><tr><th>${tipo === 'loja' ? 'Loja' : 'Função'}</th>${rot.map((r) => `<th class="c">${esc(r)}</th>`).join('')}<th class="num">Variação</th><th class="num">Hoje</th></tr></thead>
    <tbody>${linhas.map((l) => {
      const atual = l.total ? Math.round((100 * l.feitos) / l.total) : null;
      const attr = tipo === 'loja' ? `data-filtro-loja="${l.id}"` : (l.id ? `data-filtro-cargo="${l.id}"` : '');
      return `<tr class="${attr ? 'clicavel' : ''}" ${attr}><td><strong>${esc(nomeLinha(l))}</strong><div class="muted pequeno">${l.feitos} de ${l.total} concluídos</div></td>
        ${l.valores.map((v, i) => { const c = corCalor(v); return `<td class="c"><span class="celula" style="background:${c.bg};color:${c.fg}" title="${esc(nomeLinha(l))} · ${esc(rot[i])}: ${v == null ? 'sem treinamentos' : v + '% concluído'}">${v == null ? '—' : v + '%'}</span></td>`; }).join('')}
        <td class="num">${variacao(l.valores)}</td><td class="num"><strong>${atual == null ? '—' : atual + '%'}</strong></td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function legendaCalor() {
  return `<div class="legenda-calor"><span>0%</span><i></i><span>100%</span><span class="muted">· — sem treinamentos no período</span></div>`;
}

function matriz(m) {
  if (!(m || []).length) return vazio('Sem dados para o recorte escolhido.');
  const lojas = [...new Set(m.map((x) => x.loja_id))].map((id) => estado.lojas.find((l) => l.id === id)).filter(Boolean).sort((a, b) => (a.numero ?? 999) - (b.numero ?? 999));
  const cargos = [...new Set(m.map((x) => x.cargo_id))].map((id) => estado.cargos.find((c) => c.id === id) || { id, nome: 'Sem cargo' }).sort((a, b) => a.nome.localeCompare(b.nome));
  const idx = {}; m.forEach((x) => { idx[x.loja_id + '|' + x.cargo_id] = x; });
  return `<div class="tabela-wrap"><table class="tabela calor matriz">
    <thead><tr><th>Loja</th>${cargos.map((c) => `<th class="c vertical"><span>${esc(c.nome)}</span></th>`).join('')}</tr></thead>
    <tbody>${lojas.map((l) => `<tr><td><strong>${esc(nomeCurto(l.nome))}</strong></td>${cargos.map((c) => {
      const x = idx[l.id + '|' + c.id];
      if (!x) return '<td class="c"><span class="celula vazia" title="Nenhum funcionário deste cargo na loja">·</span></td>';
      const p = Math.round((100 * x.feitos) / x.total), cor = corCalor(p);
      return `<td class="c"><span class="celula" style="background:${cor.bg};color:${cor.fg}" title="${esc(nomeCurto(l.nome))} · ${esc(c.nome)}: ${x.feitos} de ${x.total} concluídos (${p}%)">${p}%</span></td>`;
    }).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function situacaoGeral(st, total) {
  const itens = [
    ['Concluídos', (st.aprovado || 0) + (st.concluido || 0), COR.teal],
    ['Em andamento', st.em_andamento || 0, COR.ambar],
    ['Não iniciados', st.nao_iniciado || 0, COR.cinza],
    ['Reprovados', st.reprovado || 0, COR.vermelho],
  ];
  return `<div class="pilha" role="img" aria-label="Situação geral dos treinamentos">${itens.map(([n, v, c]) => v ? `<i style="flex:${v};background:${c}" title="${n}: ${v}"></i>` : '').join('')}</div>
    <ul class="lista-situacao">${itens.map(([n, v, c]) => `<li><i style="background:${c}"></i><span>${n}</span><strong>${v}</strong><span class="muted">${total ? Math.round((100 * v) / total) : 0}%</span></li>`).join('')}</ul>`;
}

function tabelaCursos(cursos) {
  if (!(cursos || []).length) return vazio('Nenhum treinamento atribuído no recorte.');
  return `<div class="tabela-wrap"><table class="tabela"><thead><tr><th>Treinamento</th><th class="num">Atribuídos</th><th style="min-width:200px">Conclusão</th><th class="num">Média</th><th class="num">Reprovados</th><th class="num">Em atraso</th></tr></thead>
    <tbody>${cursos.map((c) => `<tr><td><strong>${esc(c.titulo)}</strong></td><td class="num">${c.total}</td>
      <td><div class="linha entre pequeno"><span>${c.feitos} concluídos</span><strong>${c.perc ?? 0}%</strong></div>${barra(c.perc)}</td>
      <td class="num">${c.media ?? '—'}</td><td class="num">${c.reprovados ? `<span style="color:var(--vermelho);font-weight:700">${c.reprovados}</span>` : 0}</td>
      <td class="num">${c.atrasados ? `<span style="color:var(--vermelho);font-weight:700">${c.atrasados}</span>` : 0}</td></tr>`).join('')}</tbody></table></div>`;
}

function desenharGraficos(w, serie, rot, e, nomePer) {
  const C = window.Chart;
  if (!C) return;
  C.defaults.font.family = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  C.defaults.color = COR.texto;
  const tooltip = { backgroundColor: '#1e293b', padding: 10, cornerRadius: 8, displayColors: false };

  graficos.push(new C(w.querySelector('#g-evolucao'), {
    type: 'line',
    data: { labels: rot, datasets: [{ label: '% concluído', data: serie.map((s) => s.perc), borderColor: COR.teal, backgroundColor: 'rgba(13,148,136,.10)',
      borderWidth: 2, fill: true, tension: 0.3, pointRadius: 4, pointHoverRadius: 6, pointBackgroundColor: COR.teal, pointBorderColor: '#fff', pointBorderWidth: 2, spanGaps: true }] },
    options: { maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => { const s = serie[c.dataIndex]; return `${c.raw ?? 0}% concluído (${s.feitos} de ${s.total})`; } } } },
      scales: { y: { min: 0, max: 100, ticks: { callback: (v) => v + '%', stepSize: 25 }, grid: { color: COR.grade }, border: { display: false } }, x: { grid: { display: false } } } },
  }));

  graficos.push(new C(w.querySelector('#g-ritmo'), {
    type: 'bar',
    data: { labels: rot, datasets: [{ label: 'Concluídos', data: serie.map((s) => s.concluidos), backgroundColor: COR.indigo, borderRadius: 4, maxBarThickness: 36 }] },
    options: { maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...tooltip, callbacks: { label: (c) => { const s = serie[c.dataIndex]; return [`${c.raw} concluído(s) neste ${nomePer}`, `${s.atribuidos} novo(s) atribuído(s)`]; } } } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: COR.grade }, border: { display: false } }, x: { grid: { display: false } } } },
  }));

  const sl = e.situacao_lojas || [];
  const ds = (label, chave, cor) => ({ label, data: sl.map((l) => l[chave]), backgroundColor: cor, borderColor: '#fff', borderWidth: 2, borderRadius: 4, borderSkipped: false, maxBarThickness: 22 });
  graficos.push(new C(w.querySelector('#g-situacao'), {
    type: 'bar',
    data: { labels: sl.map((l) => nomeCurto(l.nome)), datasets: [ds('Concluídos', 'aprovados', COR.teal), ds('Em andamento', 'andamento', COR.ambar), ds('Não iniciados', 'nao_iniciados', COR.cinza), ds('Reprovados', 'reprovados', COR.vermelho)] },
    options: { indexAxis: 'y', maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { ...tooltip, displayColors: true, mode: 'index', intersect: false,
        callbacks: { footer: (items) => { const l = sl[items[0].dataIndex]; return l.atrasados ? `${l.atrasados} em atraso` : ''; } } } },
      scales: { x: { stacked: true, ticks: { precision: 0 }, grid: { color: COR.grade }, border: { display: false } }, y: { stacked: true, grid: { display: false } } } },
  }));
}
