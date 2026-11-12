import { supa, estado } from '../supa.js';
import { el, esc, fmtData, barra, vazio, statusTag } from '../ui.js';

const GRUPOS = [
  ['integracao', 'Integração', '🤝'],
  ['obrigatorio', 'Treinamentos obrigatórios', '📌'],
  ['funcao', 'Treinamentos da minha função', '🧑‍🍳'],
  ['desenvolvimento', 'Desenvolvimento profissional', '📈'],
  ['complementar', 'Treinamentos complementares', '➕'],
  ['promocao', 'Preparação para promoção', '🚀'],
];

export async function paginaTrilha() {
  const { data, error } = await supa.from('atribuicoes')
    .select('id,status,progresso,nota,prazo,obrigatorio,origem,concluido_em, cursos(id,titulo,descricao,carga_horaria_min, categorias(nome,icone)), trilhas(nome,tipo)')
    .eq('perfil_id', estado.perfil.id)
    .order('prazo', { ascending: true, nullsFirst: false });
  if (error) throw error;
  const lista = data || [];
  const feitos = lista.filter((a) => ['aprovado', 'concluido'].includes(a.status)).length;
  const perc = lista.length ? Math.round((100 * feitos) / lista.length) : 0;

  const grupos = {};
  lista.forEach((a) => {
    const g = a.trilhas?.tipo || (a.obrigatorio ? 'obrigatorio' : 'complementar');
    (grupos[g] = grupos[g] || []).push(a);
  });

  const w = el(`<div>
    <div class="cab-pagina"><div><h1>Minha trilha</h1><p>Seus treinamentos organizados por etapa. Toque em um treinamento para ler o material e fazer a avaliação.</p></div></div>
    <div class="card card-corpo">
      <div class="linha entre"><strong>Progresso geral</strong><strong>${perc}%</strong></div>
      <div style="margin:10px 0 6px">${barra(perc, true)}</div>
      <div class="muted pequeno">${feitos} de ${lista.length} treinamentos concluídos</div>
      <div class="legenda-status">${['aprovado', 'em_andamento', 'nao_iniciado', 'reprovado'].map((s) => statusTag(s, '2999-12-31')).join('')}<span class="tag vermelho">Em atraso</span><span class="tag laranja">Prazo próximo</span></div>
    </div>
    <div id="grupos"></div>
  </div>`);
  const area = w.querySelector('#grupos');
  if (!lista.length) { area.innerHTML = `<div class="card mt">${vazio('Nenhum treinamento atribuído a você ainda.')}</div>`; return w; }
  GRUPOS.forEach(([k, nome, ic]) => {
    const itens = grupos[k];
    if (!itens?.length) return;
    const f = itens.filter((a) => ['aprovado', 'concluido'].includes(a.status)).length;
    area.append(el(`<div class="card mt">
      <div class="card-cab"><div><h3>${ic} ${esc(nome)}</h3><div class="sub">${f} de ${itens.length} concluídos${itens[0].trilhas?.nome ? ' · ' + esc(itens[0].trilhas.nome) : ''}</div></div></div>
      ${itens.map((a) => `
        <a class="curso-mini link" href="#/curso/${a.cursos?.id}">
          <div class="capa">${a.cursos?.categorias?.icone || '📘'}</div>
          <div class="info">
            <strong>${esc(a.cursos?.titulo)}</strong>
            <div class="meta"><span>${esc(a.cursos?.categorias?.nome || '')}</span><span>${a.cursos?.carga_horaria_min || 0} min</span>
              <span>${['aprovado', 'concluido'].includes(a.status) ? 'Concluído em ' + fmtData(a.concluido_em) : 'Prazo: ' + fmtData(a.prazo)}</span>
              ${a.nota != null ? `<span>Nota ${Math.round(a.nota)}</span>` : ''}</div>
            ${barra(a.progresso)}
          </div>
          <div>${statusTag(a.status, a.prazo)}</div>
        </a>`).join('')}
    </div>`));
  });
  return w;
}
