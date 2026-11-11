import { supa, estado, ehGestao, ehGerente } from '../supa.js';
import { el, esc, fmtData, barra, vazio, statusTag, opcoes, iniciais } from '../ui.js';

export async function paginaInicio() {
  if (ehGestao() || ehGerente()) return painelGestao();
  return painelFuncionario();
}

// ===================== RH / ADMIN / GERENTE =====================
async function painelGestao() {
  const p = estado.perfil;
  const gerente = ehGerente();
  const lojasVis = gerente ? estado.lojas.filter((l) => l.id === p.loja_id || l.gerente_id === p.id) : estado.lojas.filter((l) => l.ativo);
  const raiz = el(`<div>
    <div class="cab-pagina">
      <div><h1>Olá, ${esc(p.nome.split(' ')[0])}!</h1>
      <p>${gerente ? 'Acompanhe o desenvolvimento da sua equipe.' : 'Visão geral dos treinamentos de toda a rede.'}</p></div>
      <div class="acoes">
        ${lojasVis.length > 1 ? `<select class="entrada" id="f-loja" style="min-width:220px">${opcoes(lojasVis, '', { vazio: gerente ? 'Minhas lojas' : 'Todas as lojas' })}</select>` : ''}
      </div>
    </div>
    <div id="area"></div></div>`);
  const area = raiz.querySelector('#area');
  const carregar = async () => {
    area.innerHTML = '<div class="vazio"><div class="spinner" style="margin:0 auto"></div></div>';
    const loja = raiz.querySelector('#f-loja')?.value || null;
    const { data: d, error } = await supa.rpc('painel_indicadores', { p_loja: loja });
    if (error) { area.innerHTML = `<div class="card">${vazio(error.message, '⚠️')}</div>`; return; }
    area.innerHTML = '';
    area.append(montarPainel(d, gerente));
    await graficoCargos(area.querySelector('#g-cargos'), loja);
  };
  raiz.querySelector('#f-loja')?.addEventListener('change', carregar);
  await carregar();
  return raiz;
}

function kpi(rot, val, det = '', ic = '📊', destaque = false) {
  return `<div class="card kpi ${destaque ? 'destaque' : ''}"><div class="rot"><span class="ic">${ic}</span>${esc(rot)}</div><div class="val">${val}</div><div class="det">${det}</div></div>`;
}

function montarPainel(d, gerente) {
  const st = d.por_status || {};
  const total = Object.values(st).reduce((a, b) => a + b, 0);
  const lojas = d.lojas_ranking || [];
  const melhores = lojas.slice(0, 5);
  const piores = [...lojas].sort((a, b) => (a.perc ?? 0) - (b.perc ?? 0)).slice(0, 5);
  const w = el(`<div>
    <div class="grade c4">
      ${kpi('Conclusão geral', `${d.perc_conclusao}%`, `${d.concluidos} de ${total} treinamentos`, '🎯', true)}
      ${kpi('Funcionários', d.funcionarios, `${d.lojas} loja(s)`, '👥')}
      ${kpi('Média das avaliações', d.media_notas || '—', 'nota de 0 a 100', '📝')}
      ${kpi('Treinamentos publicados', d.cursos_publicados, `${d.em_andamento} em andamento`, '📚')}
    </div>
    <div class="grade c4 mt">
      ${kpi('Funcionários pendentes', d.func_pendentes, 'com obrigatórios em aberto', '⏳')}
      ${kpi('Aprovados', d.func_aprovados, 'funcionários com aprovação', '✅')}
      ${kpi('Reprovados', d.func_reprovados, `${d.reprovados} avaliação(ões)`, '❌')}
      ${kpi('Em atraso', d.atrasados, `${d.vencendo} vencem em 7 dias`, '🚨')}
    </div>

    <div class="grade lado mt">
      <div class="card">
        <div class="card-cab"><div><h3>Conclusão por loja</h3><div class="sub">Percentual de treinamentos concluídos</div></div></div>
        <div class="card-corpo"><div class="grafico" ${lojas.length > 8 ? `style="height:${lojas.length * 32 + 40}px"` : ''}><canvas id="g-lojas"></canvas></div></div>
      </div>
      <div class="card">
        <div class="card-cab"><div><h3>Situação dos treinamentos</h3><div class="sub">${total} atribuições</div></div></div>
        <div class="card-corpo"><div class="grafico baixo"><canvas id="g-status"></canvas></div></div>
      </div>
    </div>

    <div class="grade c2 mt">
      <div class="card"><div class="card-cab"><h3>🏆 Lojas com melhor desempenho</h3></div>
        ${melhores.length ? `<ul class="lista-simples">${melhores.map((l, i) => `<li><span class="posicao p${i + 1}">${i + 1}</span><div class="principal"><strong>${esc(l.nome)}</strong><span>${l.feitos} de ${l.total} concluídos · média ${l.media ?? '—'}</span>${barra(l.perc)}</div><strong>${l.perc ?? 0}%</strong></li>`).join('')}</ul>` : vazio('Sem dados ainda.')}
      </div>
      <div class="card"><div class="card-cab"><h3>⚠️ Lojas com menor conclusão</h3></div>
        ${piores.length ? `<ul class="lista-simples">${piores.map((l) => `<li><div class="principal"><strong>${esc(l.nome)}</strong><span>${l.total - l.feitos} treinamento(s) em aberto</span>${barra(l.perc, true)}</div><strong>${l.perc ?? 0}%</strong></li>`).join('')}</ul>` : vazio('Sem dados ainda.')}
      </div>
    </div>

    <div class="grade c3 mt">
      <div class="card"><div class="card-cab"><h3>Gerentes com melhor desempenho</h3></div>
        ${(d.gerentes_ranking || []).length ? `<ul class="lista-simples">${d.gerentes_ranking.map((g, i) => `<li><span class="posicao ${i < 3 ? 'p' + (i + 1) : ''}">${i + 1}</span><div class="principal"><strong>${esc(g.nome)}</strong><span>${esc(g.loja)}</span></div><strong>${g.perc ?? 0}%</strong></li>`).join('')}</ul>` : vazio('Nenhum gerente com equipe vinculada.')}
      </div>
      <div class="card"><div class="card-cab"><h3>Vencem nos próximos 7 dias</h3></div>
        ${(d.proximos_vencimentos || []).length ? `<ul class="lista-simples">${d.proximos_vencimentos.map((v) => `<li><div class="principal"><strong>${esc(v.nome)}</strong><span>${esc(v.titulo)}</span></div><span class="tag laranja sem-ponto">${fmtData(v.prazo)}</span></li>`).join('')}</ul>` : vazio('Nada vencendo esta semana.', '🎉')}
      </div>
      <div class="card"><div class="card-cab"><h3>Novos em integração</h3><span class="tag amarelo sem-ponto">${d.integracoes_pendentes}</span></div>
        ${(d.novos_integracao || []).length ? `<ul class="lista-simples">${d.novos_integracao.map((n) => `<li><div class="avatar" style="width:30px;height:30px;font-size:11px">${esc(iniciais(n.nome))}</div><div class="principal"><strong>${esc(n.nome)}</strong><span>${esc(n.loja || '')} · ${n.feitos}/${n.total} etapas · até ${fmtData(n.data_prevista)}</span>${barra(n.total ? (100 * n.feitos) / n.total : 0)}</div></li>`).join('')}</ul>` : vazio('Nenhum funcionário aguardando integração.')}
      </div>
    </div>

    <div class="card mt"><div class="card-cab"><div><h3>Conclusão por cargo</h3><div class="sub">Comparativo entre funções</div></div></div>
      <div class="card-corpo"><div class="grafico"><canvas id="g-cargos"></canvas></div></div></div>
  </div>`);

  requestAnimationFrame(() => {
    if (!window.Chart) return;
    const C = window.Chart;
    C.defaults.font.family = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
    C.defaults.color = '#4b5563';
    new C(w.querySelector('#g-lojas'), {
      type: 'bar',
      data: { labels: lojas.map((l) => l.nome.replace('Vila Árabe ', '')), datasets: [{ data: lojas.map((l) => l.perc ?? 0), backgroundColor: '#0d9488', borderRadius: 6, maxBarThickness: 22 }] },
      options: { indexAxis: 'y', maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.raw}% concluído` } } },
                 scales: { x: { max: 100, ticks: { callback: (v) => v + '%' }, grid: { color: '#f3f4f6' } }, y: { grid: { display: false } } } },
    });
    const rot = { aprovado: 'Aprovados', concluido: 'Concluídos', em_andamento: 'Em andamento', nao_iniciado: 'Não iniciados', reprovado: 'Reprovados' };
    const cor = { aprovado: '#0d9488', concluido: '#14b8a6', em_andamento: '#f59e0b', nao_iniciado: '#d1d5db', reprovado: '#dc2626' };
    const chaves = Object.keys(st);
    new C(w.querySelector('#g-status'), {
      type: 'doughnut',
      data: { labels: chaves.map((k) => rot[k] || k), datasets: [{ data: chaves.map((k) => st[k]), backgroundColor: chaves.map((k) => cor[k] || '#999'), borderWidth: 2, borderColor: '#fff' }] },
      options: { maintainAspectRatio: false, cutout: '62%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, usePointStyle: true } } } },
    });
  });
  return w;
}

async function graficoCargos(canvas, loja) {
  if (!canvas || !window.Chart) return;
  let q = supa.from('atribuicoes').select('status, p:perfis!atribuicoes_perfil_id_fkey!inner(cargo_id, loja_id, ativo)').eq('p.ativo', true);
  if (loja) q = q.eq('p.loja_id', loja);
  const { data } = await q.limit(5000);
  const por = {};
  (data || []).forEach((a) => {
    const c = estado.cargos.find((x) => x.id === a.p.cargo_id)?.nome || 'Sem cargo';
    por[c] = por[c] || { t: 0, f: 0 };
    por[c].t++; if (['aprovado', 'concluido'].includes(a.status)) por[c].f++;
  });
  const linhas = Object.entries(por).sort((a, b) => b[1].f / b[1].t - a[1].f / a[1].t);
  new window.Chart(canvas, {
    type: 'bar',
    data: { labels: linhas.map((l) => l[0]), datasets: [{ data: linhas.map((l) => Math.round((100 * l[1].f) / l[1].t)), backgroundColor: '#4f46e5', borderRadius: 6, maxBarThickness: 34 }] },
    options: { maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => ` ${c.raw}% concluído` } } },
               scales: { y: { max: 100, ticks: { callback: (v) => v + '%' }, grid: { color: '#f3f4f6' } }, x: { grid: { display: false } } } },
  });
}

// ===================== FUNCIONÁRIO =====================
async function painelFuncionario() {
  const [{ data: d }, { data: coms }] = await Promise.all([
    supa.rpc('meu_painel'),
    supa.from('comunicados').select('id,titulo,corpo,tipo,publicar_em').order('publicar_em', { ascending: false }).limit(3),
  ]);
  const nome = (d?.nome || estado.perfil.nome).split(' ')[0];
  const w = el(`<div>
    <div class="boas-vindas">
      <div style="position:relative;z-index:1">
        <h1>Olá, ${esc(nome)}!</h1>
        <p>${d.pendentes ? `Você tem ${d.pendentes} treinamento(s) para concluir${d.atrasados ? `, ${d.atrasados} em atraso` : ''}.` : 'Você está em dia com seus treinamentos. 👏'}</p>
        <div class="acoes" style="margin-top:16px"><a class="btn ouro" href="#/trilha">Ver minha trilha</a></div>
      </div>
      <div class="anel" style="--p:${d.perc}"><div><strong>${d.perc}%</strong><span>concluído</span></div></div>
    </div>
    <div class="grade c4 mt">
      ${kpi('Minha pontuação', d.pontos, d.posicao_ranking ? `${d.posicao_ranking}º lugar no ranking` : '', '⭐')}
      ${kpi('Em andamento', d.em_andamento, `${d.obrigatorios} obrigatórios no total`, '▶️')}
      ${kpi('Concluídos', d.concluidos, `de ${d.total} atribuídos`, '✅')}
      ${kpi('Certificados', d.certificados, 'emitidos', '🎓')}
    </div>
    <div class="grade lado mt">
      <div class="card"><div class="card-cab"><h3>Próximos treinamentos</h3><a class="link-btn pequeno" href="#/trilha">Ver todos</a></div>
        ${(d.proximos || []).length ? d.proximos.map((c) => `
          <div class="curso-mini"><div class="capa">📘</div><div class="info"><strong>${esc(c.titulo)}</strong>
            <div class="meta"><span>Prazo: ${fmtData(c.prazo)}</span>${statusTag(c.status, c.prazo)}</div>${barra(c.progresso)}</div></div>`).join('')
          : vazio('Nenhum treinamento pendente.', '🎉')}
      </div>
      <div>
        <div class="card"><div class="card-cab"><h3>Minhas conquistas</h3></div><div class="card-corpo">
          ${(d.medalhas || []).length ? `<div class="medalhas">${d.medalhas.map((m) => `<div class="medalha"><span class="ic">${m.icone}</span>${esc(m.nome)}</div>`).join('')}</div>` : '<p class="muted" style="margin:0">Conclua seu primeiro treinamento para ganhar a primeira medalha.</p>'}
        </div></div>
        <div class="card mt"><div class="card-cab"><h3>Comunicados recentes</h3></div>
          ${(coms || []).length ? `<ul class="lista-simples">${coms.map((c) => `<li><div class="principal"><strong>${esc(c.titulo)}</strong><span>${esc(c.corpo.slice(0, 110))}${c.corpo.length > 110 ? '…' : ''}</span></div></li>`).join('')}</ul>` : vazio('Nenhum comunicado.')}
        </div>
      </div>
    </div></div>`);
  return w;
}
