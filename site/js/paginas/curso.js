// Tela do curso para o funcionário: conteúdo (PDF, texto, vídeo), avaliação e resultado
import { supa, estado, msgErro, ehGestao } from '../supa.js';
import { el, esc, toast, fmtData, barra, vazio, statusTag, confirmar, comCarregando } from '../ui.js';

const ICONE = { pdf: '📄', texto: '📝', video: '▶️', apresentacao: '📊', imagem: '🖼️', link: '🔗' };
const PDFJS = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.min.mjs';
const PDFJS_WORKER = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/build/pdf.worker.min.mjs';

export async function paginaCurso({ param }) {
  const id = param;
  if (!id) { location.hash = '#/trilha'; return null; }
  const me = estado.perfil.id;
  const previa = ehGestao();   // RH/admin só visualizam
  const [c, mods, av, at] = await Promise.all([
    supa.from('cursos').select('id,titulo,descricao,objetivo,carga_horaria_min,nota_minima,exige_sequencia,status,responsavel_nome, categorias(nome,icone)').eq('id', id).maybeSingle(),
    supa.from('modulos').select('id,titulo,ordem, aulas(id,titulo,tipo,conteudo,url,arquivo_path,ordem,exige_assistir_completo)').eq('curso_id', id).order('ordem'),
    supa.from('avaliacoes').select('id,titulo,instrucoes,nota_minima,tentativas_max,tempo_limite_min,mostrar_resultado').eq('curso_id', id).eq('ativa', true).order('created_at').limit(1),
    supa.from('atribuicoes').select('id,status,progresso,nota,prazo,concluido_em').eq('curso_id', id).eq('perfil_id', me).maybeSingle(),
  ]);
  if (c.error) throw c.error;
  if (!c.data) return el(`<div class="card">${vazio('Treinamento não encontrado ou ainda não publicado.', '🔎')}</div>`);
  const curso = c.data;
  const aulas = (mods.data || []).flatMap((m) => (m.aulas || []).sort((a, b) => a.ordem - b.ordem).map((a) => ({ ...a, modulo: m.titulo })));
  const avaliacao = (av.data || [])[0] || null;
  let atrib = at.data;

  const { data: prog } = aulas.length
    ? await supa.from('progresso_aulas').select('aula_id,concluida,percentual').eq('perfil_id', me).in('aula_id', aulas.map((a) => a.id))
    : { data: [] };
  const feita = new Set((prog || []).filter((p) => p.concluida).map((p) => p.aula_id));

  let tentativas = [];
  if (avaliacao) {
    const { data } = await supa.from('tentativas').select('id,nota,aprovado,status,iniciada_em,finalizada_em').eq('avaliacao_id', avaliacao.id).eq('perfil_id', me).order('iniciada_em', { ascending: false });
    tentativas = data || [];
  }

  const w = el(`<div class="curso-pagina">
    ${previa ? `<div class="aviso linha entre" style="flex-wrap:wrap;gap:8px"><span>👁 Pré-visualização: é assim que o funcionário vê este curso.</span><a class="btn claro pequeno" href="#/cursos/${id}">Voltar ao editor</a></div>` : '<a class="link-btn pequeno" href="#/trilha">← Minha trilha</a>'}
    <div class="curso-cab mt">
      <div class="capa">${curso.categorias?.icone || '📘'}</div>
      <div style="flex:1;min-width:0">
        <h1>${esc(curso.titulo)}</h1>
        <div class="meta"><span>${esc(curso.categorias?.nome || 'Treinamento')}</span><span>⏱ ${curso.carga_horaria_min} min</span>
          ${atrib?.prazo ? `<span>Prazo ${fmtData(atrib.prazo)}</span>` : ''}${avaliacao ? `<span>Nota mínima ${avaliacao.nota_minima}</span>` : ''}</div>
        ${curso.descricao ? `<p>${esc(curso.descricao)}</p>` : ''}
      </div>
      <div class="curso-status"></div>
    </div>
    <div class="curso-grade mt">
      <div class="card curso-passos"><div class="card-cab"><h3>Conteúdo</h3><span class="muted pequeno" id="contagem"></span></div><ol id="passos"></ol></div>
      <div id="palco"></div>
    </div>
  </div>`);

  const palco = w.querySelector('#palco');
  const passos = w.querySelector('#passos');
  const liberada = (i) => previa || !curso.exige_sequencia || aulas.slice(0, i).every((a) => feita.has(a.id));
  const tudoLido = () => aulas.every((a) => feita.has(a.id));
  let atual = null;

  const desenharStatus = () => {
    const perc = atrib?.progresso ?? 0;
    w.querySelector('.curso-status').innerHTML = `${statusTag(atrib?.status || 'nao_iniciado', atrib?.prazo)}<div style="margin-top:10px;min-width:160px">${barra(perc, true)}</div><div class="pequeno muted" style="margin-top:4px">${perc}% concluído</div>`;
    w.querySelector('#contagem').textContent = `${aulas.filter((a) => feita.has(a.id)).length} de ${aulas.length} lidos`;
    passos.innerHTML = aulas.map((a, i) => {
      const ok = feita.has(a.id), livre = liberada(i);
      return `<li class="passo ${ok ? 'feito' : ''} ${livre ? '' : 'travado'} ${atual === i ? 'atual' : ''}" data-i="${i}">
        <span class="bola">${ok ? '✓' : livre ? i + 1 : '🔒'}</span>
        <span class="txt"><strong>${esc(a.titulo)}</strong><small>${ICONE[a.tipo] || '📘'} ${({ pdf: 'PDF', texto: 'Leitura', video: 'Vídeo', link: 'Link', imagem: 'Imagem', apresentacao: 'Apresentação' })[a.tipo] || ''}</small></span></li>`;
    }).join('') + (avaliacao ? `<li class="passo prova ${['aprovado'].includes(atrib?.status) ? 'feito' : ''} ${atual === 'prova' ? 'atual' : ''} ${previa || tudoLido() || !curso.exige_sequencia ? '' : 'travado'}" data-i="prova">
        <span class="bola">${atrib?.status === 'aprovado' ? '✓' : tudoLido() || !curso.exige_sequencia ? '?' : '🔒'}</span>
        <span class="txt"><strong>${esc(avaliacao.titulo || 'Avaliação')}</strong><small>📝 Questionário</small></span></li>` : '');
  };

  passos.addEventListener('click', (e) => {
    const li = e.target.closest('.passo'); if (!li) return;
    if (li.classList.contains('travado')) return toast(li.dataset.i === 'prova' ? 'Leia todo o conteúdo antes de fazer a avaliação.' : 'Conclua o conteúdo anterior primeiro.', 'erro');
    abrir(li.dataset.i === 'prova' ? 'prova' : Number(li.dataset.i));
  });

  const concluirAula = async (a, btn) => {
    await comCarregando(btn, async () => {
      const { data, error } = await supa.rpc('registrar_progresso', { p_aula: a.id, p_percentual: 100, p_posicao: 0 });
      if (error) return toast(msgErro(error), 'erro');
      if (data?.concluida) feita.add(a.id);
      const { data: novo } = await supa.from('atribuicoes').select('id,status,progresso,nota,prazo,concluido_em').eq('curso_id', id).eq('perfil_id', me).maybeSingle();
      atrib = novo;
      const i = aulas.indexOf(a);
      if (i < aulas.length - 1) { toast('Pronto! Vamos para o próximo.'); abrir(i + 1); }
      else if (avaliacao) { toast('Conteúdo concluído. Agora é a avaliação.'); abrir('prova'); }
      else { toast('Treinamento concluído! 🎉'); abrir(i); }
    });
  };

  async function abrir(i) {
    atual = i;
    desenharStatus();
    palco.innerHTML = '';
    if (i === 'prova') { palco.append(await telaProva()); palco.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const a = aulas[i];
    const ok = feita.has(a.id);
    const card = el(`<div class="card aula">
      <div class="card-cab"><div><div class="muted pequeno">${i + 1} de ${aulas.length}</div><h3>${esc(a.titulo)}</h3></div>
        ${a.url && a.tipo === 'pdf' ? `<a class="btn claro pequeno" href="${esc(a.url)}" target="_blank" rel="noopener">Abrir PDF ↗</a>` : ''}</div>
      <div class="aula-corpo"></div>
      <div class="aula-rodape"><span class="muted pequeno" id="dica"></span><button class="btn" id="concluir">${ok ? 'Já concluído ✓' : a.tipo === 'video' ? 'Assisti ao vídeo' : 'Terminei de ler'}</button></div>
    </div>`);
    const corpo = card.querySelector('.aula-corpo');
    const btn = card.querySelector('#concluir');
    const dica = card.querySelector('#dica');
    btn.disabled = ok;
    btn.onclick = () => concluirAula(a, btn);
    if (previa) { btn.classList.add('oculto'); dica.textContent = 'Na pré-visualização o progresso não é registrado.'; }
    if (a.tipo === 'pdf') {
      if (!ok && !previa) { btn.disabled = true; dica.textContent = 'Role até a última página para concluir.'; }
      mostrarPdf(corpo, a.url, () => { if (!feita.has(a.id)) { btn.disabled = false; dica.textContent = 'Chegou ao fim. Pode concluir.'; } });
    } else if (a.tipo === 'texto') {
      corpo.innerHTML = `<div class="texto-aula">${textoParaHtml(a.conteudo)}</div>`;
    } else if (a.tipo === 'video') {
      const yt = idYoutube(a.url);
      corpo.innerHTML = yt
        ? `<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/${esc(yt)}" allow="accelerometer; encrypted-media; picture-in-picture" allowfullscreen title="${esc(a.titulo)}"></iframe></div>`
        : a.url ? `<div class="video"><video src="${esc(a.url)}" controls playsinline></video></div>` : vazio('Vídeo sem endereço.');
      if (a.conteudo) corpo.append(el(`<div class="texto-aula">${textoParaHtml(a.conteudo)}</div>`));
    } else if (a.tipo === 'imagem') {
      corpo.innerHTML = `<img src="${esc(a.url)}" alt="${esc(a.titulo)}" style="max-width:100%;border-radius:10px">`;
    } else {
      corpo.innerHTML = `${a.conteudo ? `<div class="texto-aula">${textoParaHtml(a.conteudo)}</div>` : ''}${a.url ? `<p><a class="btn claro" href="${esc(a.url)}" target="_blank" rel="noopener">Abrir material ↗</a></p>` : ''}`;
    }
    palco.append(card);
    if (window.innerWidth < 980) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ---------------- avaliação ----------------
  async function telaProva() {
    if (previa) {
      const { count } = await supa.from('questoes').select('id', { count: 'exact', head: true }).eq('avaliacao_id', avaliacao.id);
      return el(`<div class="card aula"><div class="card-cab"><div><div class="muted pequeno">Avaliação</div><h3>${esc(avaliacao.titulo || 'Avaliação')}</h3></div></div>
        <div class="card-corpo"><p style="margin-top:0">${count || 0} pergunta(s) · nota mínima ${avaliacao.nota_minima} · ${avaliacao.tentativas_max} tentativa(s)${avaliacao.tempo_limite_min ? ` · ${avaliacao.tempo_limite_min} min` : ''}.</p>
        <p class="muted">Na pré-visualização a prova não é aplicada. As perguntas são editadas no editor do curso.</p></div></div>`);
    }
    const finalizadas = tentativas.filter((t) => t.status !== 'em_andamento');
    const ultima = finalizadas[0];
    const aprovado = atrib?.status === 'aprovado';
    // se a contagem falhar, mostra o botão mesmo assim: o servidor confere as tentativas ao começar
    const rt = await supa.rpc('minhas_tentativas', { p_avaliacao: avaliacao.id });
    const restantes = rt.error || rt.data == null ? Math.max(1, avaliacao.tentativas_max - finalizadas.length) : rt.data;
    const emAndamento = tentativas.find((t) => t.status === 'em_andamento');
    const card = el(`<div class="card aula"><div class="card-cab"><div><div class="muted pequeno">Avaliação</div><h3>${esc(avaliacao.titulo || 'Avaliação')}</h3></div></div>
      <div class="card-corpo">
        ${avaliacao.instrucoes ? `<p style="margin-top:0">${esc(avaliacao.instrucoes)}</p>` : ''}
        <dl class="dados"><div><dt>Nota mínima</dt><dd>${avaliacao.nota_minima}</dd></div>
          <div><dt>Tentativas</dt><dd>${restantes ?? '—'} de ${avaliacao.tentativas_max} restantes</dd></div>
          <div><dt>Tempo</dt><dd>${avaliacao.tempo_limite_min ? avaliacao.tempo_limite_min + ' min' : 'Sem limite'}</dd></div>
          ${ultima ? `<div><dt>Última nota</dt><dd>${ultima.nota != null ? Math.round(ultima.nota) : '—'}</dd></div>` : ''}</dl>
        <div class="mt">${aprovado
          ? `<div class="resultado ok"><strong>Você foi aprovado! 🎉</strong><span>Nota ${Math.round(atrib.nota ?? ultima?.nota ?? 0)}. O certificado já está em Meus certificados.</span><a class="btn" href="#/certificados">Ver certificado</a></div>`
          : (restantes > 0 || emAndamento)
            ? `<button class="btn bloco" id="comecar">${emAndamento ? 'Continuar a avaliação' : finalizadas.length ? 'Fazer de novo' : 'Começar a avaliação'}</button>`
            : `<div class="resultado erro"><strong>Suas tentativas acabaram.</strong><span>Peça ao gerente ou ao RH para liberar uma nova tentativa.</span></div>`}</div>
      </div></div>`);
    card.querySelector('#comecar')?.addEventListener('click', async (ev) => {
      await comCarregando(ev.currentTarget, async () => {
        const { data, error } = await supa.rpc('iniciar_avaliacao', { p_avaliacao: avaliacao.id });
        if (error) return toast(msgErro(error), 'erro');
        palco.innerHTML = '';
        palco.append(formularioProva(data));
        palco.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
    return card;
  }

  function formularioProva(p) {
    const qs = p.questoes || [];
    const f = el(`<form class="card aula prova" novalidate>
      <div class="card-cab"><div><div class="muted pequeno">${qs.length} pergunta(s) · nota mínima ${p.nota_minima}</div><h3>${esc(p.titulo || 'Avaliação')}</h3></div><div class="relogio oculto" id="relogio"></div></div>
      <div class="card-corpo">${qs.map((q, i) => `
        <fieldset class="questao" data-q="${q.id}"><legend><span class="num">${i + 1}</span>${esc(q.enunciado)}</legend>
          ${q.tipo === 'escrita'
            ? `<textarea class="entrada" name="q-${q.id}" rows="3" placeholder="Sua resposta"></textarea>`
            : (q.alternativas || []).map((a) => `<label class="alternativa"><input type="radio" name="q-${q.id}" value="${a.id}"><span>${esc(a.texto)}</span></label>`).join('')}
        </fieldset>`).join('')}
      </div>
      <div class="aula-rodape"><span class="muted pequeno" id="respondidas">0 de ${qs.length} respondidas</span><button class="btn" type="submit">Enviar respostas</button></div>
    </form>`);
    const contar = () => qs.filter((q) => f.querySelector(`[name="q-${q.id}"]:checked`) || (f.querySelector(`textarea[name="q-${q.id}"]`)?.value.trim())).length;
    f.addEventListener('input', () => { f.querySelector('#respondidas').textContent = `${contar()} de ${qs.length} respondidas`; });
    let enviado = false, timer = null;
    const enviar = async (forcado = false) => {
      if (enviado) return;
      const n = contar();
      if (!forcado && n < qs.length && !(await confirmar(`Você respondeu ${n} de ${qs.length}. As perguntas em branco contam como erradas. Enviar assim mesmo?`, { botao: 'Enviar' }))) return;
      enviado = true; clearInterval(timer);
      const respostas = qs.map((q) => q.tipo === 'escrita'
        ? { questao_id: q.id, texto: f.querySelector(`textarea[name="q-${q.id}"]`)?.value || '' }
        : { questao_id: q.id, alternativa_id: f.querySelector(`[name="q-${q.id}"]:checked`)?.value || null });
      const btn = f.querySelector('button[type=submit]');
      await comCarregando(btn, async () => {
        const { data, error } = await supa.rpc('finalizar_avaliacao', { p_tentativa: p.tentativa_id, p_respostas: respostas });
        if (error) { enviado = false; return toast(msgErro(error), 'erro'); }
        const { data: novo } = await supa.from('atribuicoes').select('id,status,progresso,nota,prazo,concluido_em').eq('curso_id', id).eq('perfil_id', me).maybeSingle();
        atrib = novo;
        const { data: ts } = await supa.from('tentativas').select('id,nota,aprovado,status,iniciada_em,finalizada_em').eq('avaliacao_id', avaliacao.id).eq('perfil_id', me).order('iniciada_em', { ascending: false });
        tentativas = ts || [];
        desenharStatus();
        mostrarResultado(f, qs, data);
      });
    };
    f.onsubmit = (e) => { e.preventDefault(); enviar(false); };
    if (p.tempo_limite_min) {
      const fim = new Date(p.iniciada_em).getTime() + p.tempo_limite_min * 60000;
      const rel = f.querySelector('#relogio'); rel.classList.remove('oculto');
      const tique = () => {
        const s = Math.max(0, Math.round((fim - Date.now()) / 1000));
        rel.textContent = `⏱ ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
        rel.classList.toggle('acabando', s < 60);
        if (s <= 0) { toast('O tempo acabou. Suas respostas foram enviadas.'); enviar(true); }
      };
      tique(); timer = setInterval(tique, 1000);
    }
    return f;
  }

  function mostrarResultado(f, qs, r) {
    f.querySelectorAll('input,textarea').forEach((i) => (i.disabled = true));
    f.querySelector('#relogio')?.classList.add('oculto');
    const gab = {};
    (r.gabarito || []).forEach((g) => (gab[g.questao_id] = g));
    qs.forEach((q) => {
      const g = gab[q.id]; if (!g) return;
      const fs = f.querySelector(`[data-q="${q.id}"]`);
      fs.classList.add(g.correta ? 'certa' : 'errada');
      fs.querySelectorAll('.alternativa').forEach((lab) => {
        const v = lab.querySelector('input').value;
        if (v === g.alternativa_correta) lab.classList.add('gabarito');
        else if (lab.querySelector('input').checked) lab.classList.add('marcada-errada');
      });
    });
    const nota = Math.round(r.nota ?? 0);
    const rod = f.querySelector('.aula-rodape');
    if (r.status === 'aguardando_correcao') {
      rod.innerHTML = `<div class="resultado"><strong>Respostas enviadas.</strong><span>Algumas perguntas serão corrigidas pelo RH. Você recebe o resultado nas notificações.</span></div>`;
    } else if (r.aprovado) {
      rod.innerHTML = `<div class="resultado ok"><strong>Aprovado com nota ${nota}! 🎉</strong><span>Seu certificado foi emitido e você ganhou pontos.</span><a class="btn" href="#/certificados">Ver certificado</a></div>`;
    } else {
      rod.innerHTML = `<div class="resultado erro"><strong>Nota ${nota}. Faltou pouco!</strong><span>A nota mínima é ${r.nota_minima}. ${r.tentativas_restantes > 0 ? `Você ainda tem ${r.tentativas_restantes} tentativa(s). Revise o conteúdo e tente de novo.` : 'Suas tentativas acabaram: peça ao gerente ou ao RH para liberar outra.'}</span>
        ${r.tentativas_restantes > 0 ? '<button class="btn" type="button" id="denovo">Tentar de novo</button>' : ''}</div>`;
      rod.querySelector('#denovo')?.addEventListener('click', () => abrir('prova'));
    }
    rod.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  desenharStatus();
  if (!aulas.length && !avaliacao) palco.innerHTML = `<div class="card">${vazio('Este treinamento ainda não tem conteúdo.', '🛠️')}</div>`;
  else {
    const prox = aulas.findIndex((a, i) => !feita.has(a.id) && liberada(i));
    abrir(prox >= 0 ? prox : avaliacao && atrib?.status !== 'aprovado' ? 'prova' : 0);
    window.scrollTo(0, 0);
  }
  return w;
}

// ---------------- auxiliares ----------------
export function textoParaHtml(t) {
  return String(t || '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
}

function idYoutube(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  return m ? m[1] : null;
}

let pdfjs = null;
async function carregarPdfJs() {
  if (!pdfjs) {
    pdfjs = await import(PDFJS);
    pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  }
  return pdfjs;
}

// Mostra o PDF página por página (desenha conforme rola). aoFim é chamado quando a última página aparece.
async function mostrarPdf(alvo, url, aoFim) {
  alvo.innerHTML = `<div class="pdf-paginas"><div class="vazio"><div class="spinner" style="margin:0 auto"></div><div class="pequeno" style="margin-top:8px">Abrindo o PDF…</div></div></div>`;
  const caixa = alvo.querySelector('.pdf-paginas');
  try {
    const lib = await carregarPdfJs();
    const doc = await lib.getDocument({ url }).promise;
    caixa.innerHTML = '';
    const largura = () => Math.min(caixa.clientWidth || 800, 900);
    const desenhar = async (n, div) => {
      if (div.dataset.ok) return;
      div.dataset.ok = '1';
      const pg = await doc.getPage(n);
      const base = pg.getViewport({ scale: 1 });
      const esc_ = largura() / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = pg.getViewport({ scale: esc_ * dpr });
      const cv = document.createElement('canvas');
      cv.width = vp.width; cv.height = vp.height;
      cv.style.width = '100%'; cv.style.aspectRatio = `${vp.width} / ${vp.height}`;
      div.innerHTML = ''; div.append(cv);
      await pg.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    };
    const obs = new IntersectionObserver((ents) => ents.forEach((e) => {
      if (!e.isIntersecting) return;
      const n = Number(e.target.dataset.n);
      desenhar(n, e.target);
      if (n === doc.numPages) aoFim && aoFim();
    }), { rootMargin: '300px 0px' });
    const prim = await doc.getPage(1);
    const vp1 = prim.getViewport({ scale: 1 });
    for (let n = 1; n <= doc.numPages; n++) {
      const div = el(`<div class="pdf-pagina" data-n="${n}" style="aspect-ratio:${vp1.width} / ${vp1.height}"><span class="muted pequeno">Página ${n}</span></div>`);
      caixa.append(div);
      obs.observe(div);
    }
    caixa.append(el(`<div class="muted pequeno" style="text-align:center;padding:8px">${doc.numPages} página(s)</div>`));
  } catch (e) {
    console.error(e);
    caixa.innerHTML = `<div class="vazio"><div class="ic">📄</div>Não foi possível mostrar o PDF aqui.<div class="mt"><a class="btn" href="${esc(url)}" target="_blank" rel="noopener">Abrir o PDF</a></div></div>`;
    caixa.querySelector('a').addEventListener('click', () => aoFim && aoFim());
  }
}
