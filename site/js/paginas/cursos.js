// RH · Criar e editar cursos: dados, PDFs e textos, questionário, funções e publicação
import { supa, estado, msgErro } from '../supa.js';
import { el, esc, toast, fmtData, vazio, opcoes, lerForm, abrirModal, confirmar, comCarregando } from '../ui.js';

const ICONE = { pdf: '📄', texto: '📝', video: '▶️', apresentacao: '📊', imagem: '🖼️', link: '🔗' };
const TIPO = { pdf: 'PDF', texto: 'Texto', video: 'Vídeo', apresentacao: 'Apresentação', imagem: 'Imagem', link: 'Link' };
const SIT = { rascunho: '<span class="tag cinza">Rascunho</span>', publicado: '<span class="tag verde">Publicado</span>', arquivado: '<span class="tag laranja">Arquivado</span>' };

export async function paginaCursos({ param }) {
  if (param) return editor(param);
  return lista();
}

// ===================== LISTA =====================
async function lista() {
  const { data, error } = await supa.from('cursos')
    .select('id,titulo,status,updated_at,carga_horaria_min, categorias(nome,icone), modulos(aulas(count)), avaliacoes(ativa, questoes(count)), curso_cargos(cargo_id), atribuicoes(count), trilha_cursos(trilhas(nome,tipo,cargo_id))')
    .order('updated_at', { ascending: false });
  if (error) throw error;
  const cursos = (data || []).map((c) => ({
    ...c,
    nAulas: (c.modulos || []).reduce((s, m) => s + (m.aulas?.[0]?.count || 0), 0),
    nQuestoes: (c.avaliacoes || []).filter((a) => a.ativa).reduce((s, a) => s + (a.questoes?.[0]?.count || 0), 0),
    nAtrib: c.atribuicoes?.[0]?.count || 0,
    paraQuem: resumoPublico(c),
  }));
  const w = el(`<div>
    <div class="cab-pagina">
      <div><h1>Criar e editar cursos</h1><p>Suba os PDFs, monte o questionário, escolha as funções e publique. Quem é da função recebe na hora.</p></div>
      <div class="acoes"><a class="btn" href="#/cursos/novo">+ Novo curso</a></div>
    </div>
    <div class="card">
      <div class="filtros">
        <input class="entrada busca" id="f-busca" placeholder="Buscar curso">
        <select class="entrada" id="f-status"><option value="">Todas as situações</option><option value="rascunho">Rascunho</option><option value="publicado">Publicado</option><option value="arquivado">Arquivado</option></select>
        <span class="contador" id="contador"></span>
      </div>
      <div class="tabela-wrap"><table class="tabela"><thead><tr><th>Curso</th><th>Conteúdo</th><th>Perguntas</th><th>Para quem</th><th>Pessoas</th><th>Situação</th></tr></thead><tbody id="corpo"></tbody></table></div>
    </div></div>`);
  const desenhar = () => {
    const b = w.querySelector('#f-busca').value.trim().toLowerCase(), st = w.querySelector('#f-status').value;
    const l = cursos.filter((c) => (!b || c.titulo.toLowerCase().includes(b)) && (!st || c.status === st));
    w.querySelector('#contador').textContent = `${l.length} curso(s)`;
    w.querySelector('#corpo').innerHTML = l.length ? l.map((c) => `<tr class="clicavel" data-id="${c.id}">
      <td><div class="pessoa"><div class="avatar" style="background:var(--teal-50);font-size:18px">${c.categorias?.icone || '📘'}</div><div><div class="n">${esc(c.titulo)}</div><div class="s">${esc(c.categorias?.nome || 'Sem categoria')} · ${c.carga_horaria_min} min · alterado ${fmtData(c.updated_at)}</div></div></div></td>
      <td>${c.nAulas ? `${c.nAulas} item(ns)` : '<span class="muted">Vazio</span>'}</td>
      <td>${c.nQuestoes ? c.nQuestoes : '<span class="muted">Sem prova</span>'}</td>
      <td class="pequeno">${esc(c.paraQuem)}</td>
      <td class="num">${c.nAtrib}</td>
      <td>${SIT[c.status]}</td></tr>`).join('') : `<tr><td colspan="6">${vazio('Nenhum curso encontrado.')}</td></tr>`;
  };
  w.querySelector('#f-busca').oninput = desenhar;
  w.querySelector('#f-status').oninput = desenhar;
  w.querySelector('#corpo').onclick = (e) => { const tr = e.target.closest('tr[data-id]'); if (tr) location.hash = `#/cursos/${tr.dataset.id}`; };
  desenhar();
  return w;
}

function resumoPublico(c) {
  const tr = (c.trilha_cursos || []).map((x) => x.trilhas).filter(Boolean);
  if (tr.some((t) => t.tipo === 'obrigatorio' && !t.cargo_id)) return 'Todas as funções';
  const nomes = new Set();
  (c.curso_cargos || []).forEach((x) => nomes.add(estado.cargos.find((k) => k.id === x.cargo_id)?.nome));
  tr.filter((t) => t.tipo === 'funcao' && t.cargo_id).forEach((t) => nomes.add(estado.cargos.find((k) => k.id === t.cargo_id)?.nome));
  const l = [...nomes].filter(Boolean);
  const integ = tr.some((t) => t.tipo === 'integracao');
  if (!l.length) return integ ? 'Integração (novos)' : 'Ninguém ainda';
  return (l.length > 3 ? `${l.slice(0, 3).join(', ')} +${l.length - 3}` : l.join(', ')) + (integ ? ' · Integração' : '');
}

// ===================== EDITOR =====================
async function editor(id) {
  const novo = id === 'novo';
  const { data: categorias } = await supa.from('categorias').select('id,nome,icone').order('ordem').order('nome');
  let curso = { titulo: '', descricao: '', categoria_id: null, carga_horaria_min: 30, prazo_dias: 15, nota_minima: 70, exige_sequencia: true, responsavel_nome: 'RH Vila Árabe', status: 'rascunho' };
  if (!novo) {
    const { data, error } = await supa.from('cursos').select('*').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!data) return el(`<div class="card">${vazio('Curso não encontrado.')}</div>`);
    curso = data;
  }
  const w = el(`<div class="editor-curso">
    <a class="link-btn pequeno" href="#/cursos">← Todos os cursos</a>
    <div class="cab-pagina mt"><div><h1 id="titulo-ed">${novo ? 'Novo curso' : esc(curso.titulo)}</h1><p>${novo ? 'Comece pelos dados. Depois você sobe os PDFs e monta o questionário.' : 'As alterações valem na hora para quem ainda vai fazer.'}</p></div>
      <div class="acoes">${novo ? '' : `<a class="btn claro" href="#/curso/${id}">👁 Ver como funcionário</a>`}<span id="sit">${SIT[curso.status]}</span></div></div>
    <section class="card etapa"><div class="card-cab"><h3><span class="etapa-n">1</span> Dados do curso</h3></div><div class="card-corpo" id="sec-dados"></div></section>
    <section class="card etapa mt ${novo ? 'bloqueada' : ''}"><div class="card-cab"><h3><span class="etapa-n">2</span> Conteúdo (PDFs, textos e vídeos)</h3></div><div id="sec-conteudo">${novo ? '<div class="card-corpo muted">Salve os dados primeiro.</div>' : ''}</div></section>
    <section class="card etapa mt ${novo ? 'bloqueada' : ''}"><div class="card-cab"><h3><span class="etapa-n">3</span> Questionário</h3></div><div id="sec-quiz">${novo ? '<div class="card-corpo muted">Salve os dados primeiro.</div>' : ''}</div></section>
    <section class="card etapa mt ${novo ? 'bloqueada' : ''}"><div class="card-cab"><h3><span class="etapa-n">4</span> Para quem é este curso</h3></div><div class="card-corpo" id="sec-publico">${novo ? '<span class="muted">Salve os dados primeiro.</span>' : ''}</div></section>
    <section class="card etapa mt ${novo ? 'bloqueada' : ''}"><div class="card-cab"><h3><span class="etapa-n">5</span> Publicar</h3></div><div class="card-corpo" id="sec-publicar">${novo ? '<span class="muted">Salve os dados primeiro.</span>' : ''}</div></section>
  </div>`);

  secaoDados(w.querySelector('#sec-dados'), curso, categorias || [], novo, (c) => {
    curso = c;
    w.querySelector('#titulo-ed').textContent = c.titulo;
  });
  if (!novo) {
    const ctx = { curso, id, w, aulas: [], nQuestoes: 0 };
    await Promise.all([secaoConteudo(w.querySelector('#sec-conteudo'), ctx), secaoQuiz(w.querySelector('#sec-quiz'), ctx), secaoPublico(w.querySelector('#sec-publico'), ctx)]);
    await secaoPublicar(w.querySelector('#sec-publicar'), ctx);
  }
  return w;
}

// ---------- 1. dados ----------
function secaoDados(alvo, curso, categorias, novo, aoSalvar) {
  const f = el(`<form novalidate><div class="grade-form">
    <div class="campo inteiro"><label>Nome do curso *</label><input class="entrada" name="titulo" required value="${esc(curso.titulo)}" placeholder="Ex.: Boas práticas na manipulação de alimentos"></div>
    <div class="campo inteiro"><label>Descrição</label><textarea class="entrada" name="descricao" rows="2" placeholder="O que o funcionário vai aprender">${esc(curso.descricao || '')}</textarea></div>
    <div class="campo"><label>Categoria</label><select class="entrada" name="categoria_id">${opcoes(categorias, curso.categoria_id, { vazio: 'Sem categoria', rotulo: (c) => `${c.icone || ''} ${c.nome}` })}</select></div>
    <div class="campo"><label>Responsável (sai no certificado)</label><input class="entrada" name="responsavel_nome" value="${esc(curso.responsavel_nome || '')}"></div>
    <div class="campo"><label>Carga horária (minutos)</label><input class="entrada" type="number" min="1" name="carga_horaria_min" value="${curso.carga_horaria_min}"></div>
    <div class="campo"><label>Prazo para concluir (dias)</label><input class="entrada" type="number" min="1" name="prazo_dias" value="${curso.prazo_dias}"><span class="ajuda">Contado a partir do dia em que a pessoa recebe o curso.</span></div>
    <div class="campo inteiro"><label class="check"><input type="checkbox" name="exige_sequencia" ${curso.exige_sequencia ? 'checked' : ''}> Ler o conteúdo na ordem e só liberar a prova depois de ler tudo</label></div>
  </div><div class="linha" style="justify-content:flex-end"><button class="btn" type="submit">${novo ? 'Salvar e continuar' : 'Salvar dados'}</button></div></form>`);
  f.onsubmit = async (e) => {
    e.preventDefault();
    const d = lerForm(f);
    if (!d.titulo) return toast('Informe o nome do curso.', 'erro');
    d.carga_horaria_min = Math.max(1, Number(d.carga_horaria_min) || 30);
    d.prazo_dias = Math.max(1, Number(d.prazo_dias) || 15);
    d.exige_sequencia = !!d.exige_sequencia;
    await comCarregando(f.querySelector('button[type=submit]'), async () => {
      if (novo) {
        const { data, error } = await supa.from('cursos').insert({ ...d, status: 'rascunho', created_by: estado.perfil.id }).select('id').single();
        if (error) return toast(msgErro(error), 'erro');
        await supa.from('modulos').insert({ curso_id: data.id, titulo: 'Conteúdo', ordem: 0 });
        toast('Curso criado. Agora suba o conteúdo.');
        location.hash = `#/cursos/${data.id}`;
      } else {
        const { data, error } = await supa.from('cursos').update({ ...d, updated_at: new Date().toISOString() }).eq('id', curso.id).select('*').single();
        if (error) return toast(msgErro(error), 'erro');
        toast('Dados salvos.');
        aoSalvar(data);
      }
    });
  };
  alvo.append(f);
}

// ---------- 2. conteúdo ----------
async function secaoConteudo(alvo, ctx) {
  const carregar = async () => {
    const { data, error } = await supa.from('modulos').select('id,titulo,ordem, aulas(id,titulo,tipo,conteudo,url,arquivo_path,ordem,modulo_id)').eq('curso_id', ctx.id).order('ordem');
    if (error) throw error;
    ctx.modulos = data || [];
    ctx.aulas = ctx.modulos.flatMap((m) => (m.aulas || []).sort((a, b) => a.ordem - b.ordem));
  };
  const moduloAlvo = async () => {
    if (ctx.modulos.length) return ctx.modulos[ctx.modulos.length - 1].id;
    const { data, error } = await supa.from('modulos').insert({ curso_id: ctx.id, titulo: 'Conteúdo', ordem: 0 }).select('id').single();
    if (error) throw error;
    ctx.modulos = [{ id: data.id, aulas: [] }];
    return data.id;
  };
  const proximaOrdem = (mod) => Math.max(-1, ...ctx.aulas.filter((a) => a.modulo_id === mod).map((a) => a.ordem)) + 1;

  const desenhar = () => {
    alvo.innerHTML = '';
    const box = el(`<div>
      ${ctx.aulas.length ? `<ol class="lista-aulas">${ctx.aulas.map((a, i) => `<li data-id="${a.id}">
          <span class="ic">${ICONE[a.tipo] || '📘'}</span>
          <div class="principal"><strong>${i + 1}. ${esc(a.titulo)}</strong><span>${TIPO[a.tipo] || a.tipo}${a.tipo === 'pdf' && a.url ? ` · <a href="${esc(a.url)}" target="_blank" rel="noopener">abrir</a>` : ''}${a.tipo === 'texto' ? ` · ${String(a.conteudo || '').length} caracteres` : ''}</span></div>
          <div class="botoes"><button class="btn claro icone pequeno" data-sobe title="Subir" ${i === 0 ? 'disabled' : ''}>↑</button><button class="btn claro icone pequeno" data-desce title="Descer" ${i === ctx.aulas.length - 1 ? 'disabled' : ''}>↓</button>
            <button class="btn claro icone pequeno" data-editar title="Editar">✎</button><button class="btn perigo icone pequeno" data-apagar title="Apagar">🗑</button></div></li>`).join('')}</ol>`
        : `<div class="vazio" style="padding:26px"><div class="ic">📄</div>Nenhum conteúdo ainda. Comece enviando o PDF do treinamento.</div>`}
      <div class="soltar" id="soltar"><input type="file" id="arq" accept="application/pdf,.pdf" multiple hidden>
        <div><strong>📄 Enviar PDF</strong><span>Toque para escolher ou arraste os arquivos aqui (até 50 MB cada)</span></div></div>
      <div class="linha card-corpo" style="gap:8px;flex-wrap:wrap;padding-top:0"><button class="btn claro" data-novo="texto">📝 Adicionar texto</button><button class="btn claro" data-novo="video">▶️ Adicionar vídeo (YouTube)</button></div>
    </div>`);
    alvo.append(box);
    const arq = box.querySelector('#arq'), soltar = box.querySelector('#soltar');
    soltar.onclick = () => arq.click();
    arq.onchange = () => enviarPdfs([...arq.files]);
    soltar.addEventListener('dragover', (e) => { e.preventDefault(); soltar.classList.add('sobre'); });
    soltar.addEventListener('dragleave', () => soltar.classList.remove('sobre'));
    soltar.addEventListener('drop', (e) => { e.preventDefault(); soltar.classList.remove('sobre'); enviarPdfs([...e.dataTransfer.files]); });
    box.querySelectorAll('[data-novo]').forEach((b) => (b.onclick = () => formAula({ tipo: b.dataset.novo })));
    box.querySelectorAll('.lista-aulas li').forEach((li) => {
      const a = ctx.aulas.find((x) => x.id === li.dataset.id);
      li.querySelector('[data-editar]').onclick = () => formAula(a);
      li.querySelector('[data-apagar]').onclick = () => apagar(a);
      li.querySelector('[data-sobe]').onclick = () => mover(a, -1);
      li.querySelector('[data-desce]').onclick = () => mover(a, 1);
    });
  };

  const recarregar = async () => { await carregar(); desenhar(); ctx.aoMudarConteudo && ctx.aoMudarConteudo(); };

  const subir = async (file) => {
    const path = `cursos/${ctx.id}/${crypto.randomUUID()}.pdf`;
    const { error } = await supa.storage.from('conteudos').upload(path, file, { contentType: 'application/pdf', upsert: false });
    if (error) throw error;
    return { path, url: supa.storage.from('conteudos').getPublicUrl(path).data.publicUrl };
  };

  async function enviarPdfs(files) {
    const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
    if (!pdfs.length) return toast('Escolha arquivos PDF.', 'erro');
    const grandes = pdfs.filter((f) => f.size > 50 * 1024 * 1024);
    if (grandes.length) return toast(`"${grandes[0].name}" passa de 50 MB. Diminua o arquivo e tente de novo.`, 'erro');
    const soltar = alvo.querySelector('#soltar');
    soltar.classList.add('enviando');
    try {
      const mod = await moduloAlvo();
      let ordem = proximaOrdem(mod);
      for (const [i, f] of pdfs.entries()) {
        soltar.querySelector('span').textContent = `Enviando ${i + 1} de ${pdfs.length}: ${f.name}…`;
        const { path, url } = await subir(f);
        const titulo = f.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Material';
        const { error } = await supa.from('aulas').insert({ modulo_id: mod, titulo, tipo: 'pdf', url, arquivo_path: path, exige_assistir_completo: false, ordem: ordem++ });
        if (error) throw error;
      }
      toast(pdfs.length > 1 ? `${pdfs.length} PDFs enviados.` : 'PDF enviado.');
    } catch (e) { toast(msgErro(e), 'erro'); }
    await recarregar();
  }

  function formAula(a) {
    const tipo = a.tipo;
    const f = el(`<form novalidate>
      <div class="campo"><label>Título *</label><input class="entrada" name="titulo" value="${esc(a.titulo || '')}" placeholder="${tipo === 'pdf' ? 'Nome do material' : tipo === 'video' ? 'Ex.: Como lavar as mãos' : 'Ex.: Regras do uniforme'}"></div>
      ${tipo === 'video' ? `<div class="campo"><label>Link do vídeo *</label><input class="entrada" name="url" value="${esc(a.url || '')}" placeholder="https://www.youtube.com/watch?v=…"><span class="ajuda">Pode ser YouTube (público ou não listado) ou link direto de arquivo de vídeo.</span></div>` : ''}
      ${tipo === 'texto' || tipo === 'video' ? `<div class="campo"><label>${tipo === 'video' ? 'Texto de apoio (opcional)' : 'Texto *'}</label><textarea class="entrada" name="conteudo" rows="${tipo === 'texto' ? 12 : 4}" placeholder="Deixe uma linha em branco entre os parágrafos.">${esc(a.conteudo || '')}</textarea></div>` : ''}
      ${tipo === 'pdf' && a.id ? `<div class="campo"><label>Trocar o arquivo</label><input class="entrada" type="file" name="arquivo" accept="application/pdf,.pdf"><span class="ajuda">Opcional. Quem já leu continua com o item concluído.</span></div>` : ''}
    </form>`);
    const { el: m, fechar } = abrirModal({ titulo: a.id ? `Editar ${TIPO[tipo].toLowerCase()}` : `Adicionar ${TIPO[tipo].toLowerCase()}`, corpo: f,
      rodape: `<button class="btn claro" data-c>Cancelar</button><button class="btn" data-s>Salvar</button>` });
    m.querySelector('[data-c]').onclick = fechar;
    m.querySelector('[data-s]').onclick = async (ev) => {
      const d = { titulo: f.titulo.value.trim() };
      if (f.url) d.url = f.url.value.trim() || null;
      if (f.conteudo) d.conteudo = f.conteudo.value.trim() || null;
      if (!d.titulo) return toast('Informe o título.', 'erro');
      if (tipo === 'video' && !d.url) return toast('Cole o link do vídeo.', 'erro');
      if (tipo === 'texto' && !d.conteudo) return toast('Escreva o texto.', 'erro');
      await comCarregando(ev.currentTarget, async () => {
        try {
          const novoArq = f.arquivo?.files?.[0];
          if (novoArq) {
            const { path, url } = await subir(novoArq);
            if (a.arquivo_path) supa.storage.from('conteudos').remove([a.arquivo_path]);
            d.url = url; d.arquivo_path = path;
          }
          if (a.id) {
            const { error } = await supa.from('aulas').update(d).eq('id', a.id);
            if (error) throw error;
          } else {
            const mod = await moduloAlvo();
            const { error } = await supa.from('aulas').insert({ ...d, modulo_id: mod, tipo, ordem: proximaOrdem(mod), exige_assistir_completo: false });
            if (error) throw error;
          }
          toast('Salvo.'); fechar(); await recarregar();
        } catch (e) { toast(msgErro(e), 'erro'); }
      });
    };
  }

  async function apagar(a) {
    if (!(await confirmar(`Apagar "${a.titulo}"? Quem já leu perde o registro deste item.`, { botao: 'Apagar', perigo: true }))) return;
    const { error } = await supa.from('aulas').delete().eq('id', a.id);
    if (error) return toast(msgErro(error), 'erro');
    if (a.arquivo_path) await supa.storage.from('conteudos').remove([a.arquivo_path]);
    toast('Apagado.'); await recarregar();
  }

  async function mover(a, dir) {
    const i = ctx.aulas.indexOf(a), b = ctx.aulas[i + dir];
    if (!b) return;
    // troca a posição (módulo e ordem) dos dois itens
    const pa = { modulo_id: a.modulo_id, ordem: a.ordem }, pb = { modulo_id: b.modulo_id, ordem: b.ordem };
    if (pa.modulo_id === pb.modulo_id && pa.ordem === pb.ordem) pb.ordem = pa.ordem + dir;
    const [r1, r2] = await Promise.all([supa.from('aulas').update(pb).eq('id', a.id), supa.from('aulas').update(pa).eq('id', b.id)]);
    if (r1.error || r2.error) toast(msgErro(r1.error || r2.error), 'erro');
    await recarregar();
  }

  await carregar();
  desenhar();
}

// ---------- 3. questionário ----------
async function secaoQuiz(alvo, ctx) {
  let cfg = { titulo: 'Avaliação', instrucoes: '', nota_minima: ctx.curso.nota_minima ?? 70, tentativas_max: 3, tempo_limite_min: '', embaralhar: true, mostrar_resultado: true };
  let qs = [];
  let temTentativas = false;

  const carregar = async () => {
    const { data: avs } = await supa.from('avaliacoes').select('*').eq('curso_id', ctx.id).eq('ativa', true).order('created_at').limit(1);
    const av = (avs || [])[0];
    qs = [];
    if (!av) { ctx.nQuestoes = 0; return; }
    cfg = { titulo: av.titulo, instrucoes: av.instrucoes || '', nota_minima: av.nota_minima, tentativas_max: av.tentativas_max, tempo_limite_min: av.tempo_limite_min ?? '', embaralhar: av.embaralhar, mostrar_resultado: av.mostrar_resultado };
    const [{ data: qq }, { data: alts }, { count }] = await Promise.all([
      supa.from('questoes').select('id,tipo,enunciado,pontos,ordem').eq('avaliacao_id', av.id).order('ordem'),
      supa.rpc('gabarito_avaliacao', { p_avaliacao: av.id }),
      supa.from('tentativas').select('id', { count: 'exact', head: true }).eq('avaliacao_id', av.id),
    ]);
    temTentativas = (count || 0) > 0;
    qs = (qq || []).filter((q) => q.tipo !== 'escrita').map((q) => ({ id: q.id, tipo: q.tipo, enunciado: q.enunciado,
      alternativas: (alts || []).filter((a) => a.questao_id === q.id).sort((a, b) => a.ordem - b.ordem).map((a) => ({ id: a.id, texto: a.texto, correta: a.correta })) }));
    ctx.nQuestoes = qs.length;
  };

  const novaQuestao = (tipo = 'multipla') => tipo === 'vf'
    ? { tipo, enunciado: '', alternativas: [{ texto: 'Verdadeiro', correta: true }, { texto: 'Falso', correta: false }] }
    : { tipo, enunciado: '', alternativas: [{ texto: '', correta: true }, { texto: '', correta: false }, { texto: '', correta: false }] };

  const desenhar = () => {
    alvo.innerHTML = '';
    const box = el(`<div class="card-corpo">
      <div class="grade-form quiz-cfg">
        <div class="campo"><label>Nota mínima para aprovar</label><input class="entrada" type="number" min="0" max="100" data-cfg="nota_minima" value="${esc(cfg.nota_minima)}"></div>
        <div class="campo"><label>Tentativas</label><input class="entrada" type="number" min="1" max="20" data-cfg="tentativas_max" value="${esc(cfg.tentativas_max)}"></div>
        <div class="campo"><label>Tempo limite (minutos)</label><input class="entrada" type="number" min="1" data-cfg="tempo_limite_min" value="${esc(cfg.tempo_limite_min)}" placeholder="Sem limite"></div>
        <div class="campo"><label>&nbsp;</label><label class="check"><input type="checkbox" data-cfg="embaralhar" ${cfg.embaralhar ? 'checked' : ''}> Embaralhar perguntas</label>
          <label class="check"><input type="checkbox" data-cfg="mostrar_resultado" ${cfg.mostrar_resultado ? 'checked' : ''}> Mostrar respostas certas no fim</label></div>
        <div class="campo inteiro"><label>Instruções (opcional)</label><input class="entrada" data-cfg="instrucoes" value="${esc(cfg.instrucoes)}" placeholder="Ex.: Leia com atenção. Cada pergunta tem uma resposta certa."></div>
      </div>
      ${temTentativas ? '<p class="aviso">⚠️ Já tem gente que fez esta prova. Mudar as perguntas não altera as notas já dadas.</p>' : ''}
      <div id="questoes">${qs.map((q, i) => cartaoQuestao(q, i)).join('') || '<div class="vazio" style="padding:22px"><div class="ic">📝</div>Sem perguntas. Sem questionário, o curso conclui quando a pessoa termina de ler.</div>'}</div>
      <div class="linha" style="gap:8px;flex-wrap:wrap;margin-top:14px">
        <button class="btn claro" data-add="multipla">+ Pergunta de múltipla escolha</button>
        <button class="btn claro" data-add="vf">+ Verdadeiro ou falso</button>
        <button class="btn claro" id="colar">📋 Colar perguntas prontas</button>
        <span class="espaco" style="flex:1"></span>
        <button class="btn" id="salvar-quiz">Salvar questionário</button>
      </div></div>`);
    alvo.append(box);

    box.querySelectorAll('[data-cfg]').forEach((i) => i.addEventListener('input', () => { cfg[i.dataset.cfg] = i.type === 'checkbox' ? i.checked : i.value; }));
    const qsEl = box.querySelector('#questoes');
    qsEl.addEventListener('input', (e) => {
      const t = e.target, card = t.closest('[data-q]'); if (!card) return;
      const q = qs[Number(card.dataset.q)];
      if (t.dataset.campo === 'enunciado') q.enunciado = t.value;
      if (t.dataset.alt != null && t.type === 'text') q.alternativas[Number(t.dataset.alt)].texto = t.value;
      if (t.type === 'radio') { q.alternativas.forEach((a, j) => (a.correta = j === Number(t.dataset.alt))); card.querySelectorAll('.alt-ed').forEach((d, j) => d.classList.toggle('certa', j === Number(t.dataset.alt))); }
    });
    qsEl.addEventListener('change', (e) => {
      const t = e.target, card = t.closest('[data-q]'); if (!card || t.dataset.campo !== 'tipo') return;
      const i = Number(card.dataset.q), antigo = qs[i];
      qs[i] = { ...novaQuestao(t.value), id: antigo.id, enunciado: antigo.enunciado };
      desenhar();
    });
    qsEl.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const card = b.closest('[data-q]'); const i = Number(card.dataset.q); const q = qs[i];
      if (b.dataset.acao === 'mais') q.alternativas.push({ texto: '', correta: false });
      if (b.dataset.acao === 'tira') { const j = Number(b.dataset.alt); const era = q.alternativas[j].correta; q.alternativas.splice(j, 1); if (era && q.alternativas[0]) q.alternativas[0].correta = true; }
      if (b.dataset.acao === 'apaga') qs.splice(i, 1);
      if (b.dataset.acao === 'sobe' && i > 0) [qs[i - 1], qs[i]] = [qs[i], qs[i - 1]];
      if (b.dataset.acao === 'desce' && i < qs.length - 1) [qs[i + 1], qs[i]] = [qs[i], qs[i + 1]];
      desenhar();
    });
    box.querySelectorAll('[data-add]').forEach((b) => (b.onclick = () => {
      qs.push(novaQuestao(b.dataset.add)); desenhar();
      const ult = alvo.querySelector('#questoes [data-q]:last-child textarea'); ult?.focus(); ult?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }));
    box.querySelector('#colar').onclick = colarPerguntas;
    box.querySelector('#salvar-quiz').onclick = (ev) => salvar(ev.currentTarget);
  };

  function cartaoQuestao(q, i) {
    const vf = q.tipo === 'vf';
    return `<div class="questao-ed" data-q="${i}">
      <div class="linha entre" style="gap:8px;flex-wrap:wrap"><strong>Pergunta ${i + 1}</strong>
        <div class="linha" style="gap:6px"><select class="entrada pequeno" data-campo="tipo" style="width:auto"><option value="multipla" ${!vf ? 'selected' : ''}>Múltipla escolha</option><option value="vf" ${vf ? 'selected' : ''}>Verdadeiro ou falso</option></select>
          <button type="button" class="btn claro icone pequeno" data-acao="sobe" title="Subir">↑</button><button type="button" class="btn claro icone pequeno" data-acao="desce" title="Descer">↓</button><button type="button" class="btn perigo icone pequeno" data-acao="apaga" title="Apagar pergunta">🗑</button></div></div>
      <textarea class="entrada mt" rows="2" data-campo="enunciado" placeholder="${vf ? 'Escreva a afirmação. Ex.: Posso usar anel na cozinha.' : 'Escreva a pergunta'}">${esc(q.enunciado)}</textarea>
      <div class="alts">${q.alternativas.map((a, j) => `<div class="alt-ed ${a.correta ? 'certa' : ''}">
          <label title="Resposta certa"><input type="radio" name="certa-${i}" data-alt="${j}" ${a.correta ? 'checked' : ''}><span>certa</span></label>
          <input class="entrada" type="text" data-alt="${j}" value="${esc(a.texto)}" placeholder="Resposta ${String.fromCharCode(65 + j)}" ${vf ? 'readonly' : ''}>
          ${!vf && q.alternativas.length > 2 ? `<button type="button" class="btn claro icone pequeno" data-acao="tira" data-alt="${j}" title="Tirar resposta">×</button>` : ''}</div>`).join('')}
        ${!vf && q.alternativas.length < 6 ? '<button type="button" class="link-btn pequeno" data-acao="mais">+ resposta</button>' : ''}</div>
      <div class="ajuda">Marque a bolinha da resposta certa.</div></div>`;
  }

  function colarPerguntas() {
    const f = el(`<div>
      <p class="muted" style="margin-top:0">Cole as perguntas do jeito abaixo. Marque a resposta certa com <strong>*</strong> no começo.</p>
      <pre class="exemplo">1) Qual a temperatura da geladeira?
a) 15 °C
*b) Até 5 °C
c) 10 °C

2) Posso usar anel na cozinha?
a) Sim
*b) Não</pre>
      <textarea class="entrada" id="texto" rows="12" placeholder="Cole aqui"></textarea>
      <label class="check mt"><input type="checkbox" id="substituir"> Apagar as perguntas atuais e ficar só com estas</label></div>`);
    const { el: m, fechar } = abrirModal({ titulo: 'Colar perguntas prontas', corpo: f, rodape: `<button class="btn claro" data-c>Cancelar</button><button class="btn" data-s>Adicionar</button>` });
    m.querySelector('[data-c]').onclick = fechar;
    m.querySelector('[data-s]').onclick = () => {
      const lidas = lerPerguntasTexto(f.querySelector('#texto').value);
      if (!lidas.length) return toast('Não encontrei perguntas. Confira o formato do exemplo.', 'erro');
      const semCerta = lidas.findIndex((q) => !q.alternativas.some((a) => a.correta));
      if (f.querySelector('#substituir').checked) qs = [];
      qs.push(...lidas);
      fechar(); desenhar();
      toast(`${lidas.length} pergunta(s) adicionada(s).${semCerta >= 0 ? ' Marque a resposta certa nas que ficaram sem *.' : ''}`);
    };
  }

  async function salvar(btn) {
    // valida antes de mandar
    for (const [i, q] of qs.entries()) {
      if (!q.enunciado.trim()) return toast(`A pergunta ${i + 1} está sem texto.`, 'erro');
      const alts = q.alternativas.filter((a) => a.texto.trim());
      if (alts.length < 2) return toast(`A pergunta ${i + 1} precisa de pelo menos 2 respostas.`, 'erro');
      if (alts.filter((a) => a.correta).length !== 1) return toast(`Marque a resposta certa na pergunta ${i + 1}.`, 'erro');
    }
    if (!qs.length && !(await confirmar('Salvar sem perguntas? O curso vai concluir quando a pessoa terminar de ler.', { botao: 'Salvar sem prova' }))) return;
    const nota = Number(cfg.nota_minima);
    if (!(nota >= 0 && nota <= 100)) return toast('A nota mínima vai de 0 a 100.', 'erro');
    await comCarregando(btn, async () => {
      const { error } = await supa.rpc('salvar_questionario', {
        p_curso: ctx.id,
        p_cfg: { ...cfg, nota_minima: nota, tentativas_max: Number(cfg.tentativas_max) || 3, tempo_limite_min: cfg.tempo_limite_min ? Number(cfg.tempo_limite_min) : '' },
        p_questoes: qs.map((q) => ({ id: q.id || null, tipo: q.tipo, enunciado: q.enunciado.trim(), pontos: 10,
          alternativas: q.alternativas.filter((a) => a.texto.trim()).map((a) => ({ id: a.id || null, texto: a.texto.trim(), correta: !!a.correta })) })),
      });
      if (error) return toast(msgErro(error), 'erro');
      toast(qs.length ? `Questionário salvo com ${qs.length} pergunta(s).` : 'Questionário removido.');
      await carregar(); desenhar(); ctx.aoMudarConteudo && ctx.aoMudarConteudo();
    });
  }

  await carregar();
  desenhar();
}

// "1) Pergunta" / "a) resposta" / "*b) certa" / "V ou F: ..." -> perguntas
export function lerPerguntasTexto(txt) {
  const out = [];
  let q = null;
  String(txt || '').split(/\r?\n/).forEach((linha) => {
    const l = linha.trim();
    if (!l) return;
    const alt = l.match(/^(\*)?\s*\(?([a-hA-H])[).:-]\s*(\*)?\s*(.+?)\s*(\*)?$/);
    const perg = l.match(/^(?:\d+\s*[).:-]|pergunta\s*\d+\s*[:.-]?|q\d+\s*[).:-])\s*(.+)$/i);
    if (alt && q && !perg) {
      q.alternativas.push({ texto: alt[4].replace(/\s*\((certa|correta)\)\s*$/i, ''), correta: !!(alt[1] || alt[3] || alt[5]) || /\((certa|correta)\)\s*$/i.test(alt[4]) });
    } else if (perg || !q || q.alternativas.length) {
      q = { tipo: 'multipla', enunciado: (perg ? perg[1] : l), alternativas: [] };
      out.push(q);
    } else if (q && !q.alternativas.length) {
      q.enunciado += ' ' + l;   // pergunta em mais de uma linha
    }
  });
  return out.filter((x) => x.enunciado && x.alternativas.length >= 2).map((x) => {
    const certas = x.alternativas.filter((a) => a.correta).length;
    if (certas > 1) { let achou = false; x.alternativas.forEach((a) => { if (a.correta && achou) a.correta = false; if (a.correta) achou = true; }); }
    const vf = x.alternativas.length === 2 && x.alternativas.every((a) => /^(verdadeiro|falso|v|f)$/i.test(a.texto));
    if (vf) { x.tipo = 'vf'; x.alternativas = x.alternativas.map((a) => ({ ...a, texto: /^v/i.test(a.texto) ? 'Verdadeiro' : 'Falso' })); }
    return x;
  });
}

// ---------- 4. para quem ----------
async function secaoPublico(alvo, ctx) {
  const [{ data: cc }, { data: tc }] = await Promise.all([
    supa.from('curso_cargos').select('cargo_id').eq('curso_id', ctx.id),
    supa.from('trilha_cursos').select('trilhas(id,nome,tipo,cargo_id)').eq('curso_id', ctx.id),
  ]);
  const trilhas = (tc || []).map((x) => x.trilhas).filter(Boolean);
  let todos = trilhas.some((t) => t.tipo === 'obrigatorio' && !t.cargo_id && t.nome === 'Obrigatórios Vila Árabe');
  const marcados = new Set([...(cc || []).map((x) => x.cargo_id), ...trilhas.filter((t) => t.tipo === 'funcao' && t.cargo_id).map((t) => t.cargo_id)]);
  const outras = trilhas.filter((t) => t.tipo !== 'funcao' && !(t.tipo === 'obrigatorio' && t.nome === 'Obrigatórios Vila Árabe'));
  const cargos = estado.cargos.filter((c) => c.ativo || marcados.has(c.id));
  ctx.temPublico = () => todos || marcados.size > 0 || outras.length > 0;

  const desenhar = () => {
    alvo.innerHTML = '';
    const box = el(`<div>
      <div class="segmentado" style="margin-bottom:14px"><button type="button" data-m="1" class="${todos ? 'ativo' : ''}">Todas as funções</button><button type="button" data-m="0" class="${todos ? '' : 'ativo'}">Escolher funções</button></div>
      <div id="cargos" class="${todos ? 'oculto' : ''}">
        <div class="linha" style="gap:12px;margin-bottom:8px"><button type="button" class="link-btn pequeno" data-tudo>Marcar todas</button><button type="button" class="link-btn pequeno" data-nada>Desmarcar</button></div>
        <div class="grade-checks">${cargos.map((c) => `<label class="check"><input type="checkbox" value="${c.id}" ${marcados.has(c.id) ? 'checked' : ''}> ${esc(c.nome)}</label>`).join('')}</div>
      </div>
      ${outras.length ? `<p class="muted pequeno">Também faz parte de: ${outras.map((t) => esc(t.nome)).join(', ')}.</p>` : ''}
      <p class="muted pequeno">${ctx.curso.status === 'publicado' ? 'Ao salvar, quem é das funções escolhidas recebe o curso na hora. Quem foi tirado e ainda não começou deixa de ter o curso.' : 'As pessoas recebem o curso quando você publicar.'} Funcionários novos dessas funções recebem sozinhos.</p>
      <div class="linha" style="justify-content:flex-end"><button class="btn" id="salvar-publico">Salvar funções</button></div></div>`);
    alvo.append(box);
    box.querySelectorAll('[data-m]').forEach((b) => (b.onclick = () => { todos = b.dataset.m === '1'; desenhar(); }));
    box.querySelector('[data-tudo]').onclick = () => box.querySelectorAll('#cargos input').forEach((i) => (i.checked = true));
    box.querySelector('[data-nada]').onclick = () => box.querySelectorAll('#cargos input').forEach((i) => (i.checked = false));
    box.querySelector('#cargos').addEventListener('change', (e) => { if (e.target.checked) marcados.add(e.target.value); else marcados.delete(e.target.value); });
    box.querySelector('#salvar-publico').onclick = async (ev) => {
      const ids = [...marcados];
      if (!todos && !ids.length) return toast('Escolha pelo menos uma função, ou "Todas as funções".', 'erro');
      await comCarregando(ev.currentTarget, async () => {
        const { data, error } = await supa.rpc('salvar_curso_cargos', { p_curso: ctx.id, p_cargos: todos ? [] : ids, p_todos: todos });
        if (error) return toast(msgErro(error), 'erro');
        if (todos) marcados.clear();
        toast(data ? `Funções salvas. ${data} pessoa(s) receberam o curso agora.` : 'Funções salvas.');
        ctx.aoMudarConteudo && ctx.aoMudarConteudo();
      });
    };
  };
  desenhar();
}

// ---------- 5. publicar ----------
async function secaoPublicar(alvo, ctx) {
  const desenhar = async () => {
    const { count } = await supa.from('atribuicoes').select('id', { count: 'exact', head: true }).eq('curso_id', ctx.id);
    const { count: feitos } = await supa.from('atribuicoes').select('id', { count: 'exact', head: true }).eq('curso_id', ctx.id).in('status', ['aprovado', 'concluido']);
    const st = ctx.curso.status;
    const falta = [];
    if (!ctx.aulas.length) falta.push('conteúdo (PDF, texto ou vídeo)');
    if (!ctx.temPublico || !ctx.temPublico()) falta.push('as funções que vão fazer');
    alvo.innerHTML = '';
    const box = el(`<div>
      <div class="lista-situacao-curso">
        <div><span class="muted pequeno">Situação</span><div>${SIT[st]}</div></div>
        <div><span class="muted pequeno">Conteúdo</span><div><strong>${ctx.aulas.length}</strong> item(ns)</div></div>
        <div><span class="muted pequeno">Perguntas</span><div><strong>${ctx.nQuestoes || 0}</strong></div></div>
        <div><span class="muted pequeno">Pessoas com o curso</span><div><strong>${count || 0}</strong>${count ? ` · ${feitos || 0} concluíram` : ''}</div></div>
      </div>
      ${st !== 'publicado' && falta.length ? `<p class="aviso">Falta: ${falta.join(' e ')}.</p>` : ''}
      ${st === 'publicado' ? '<p class="muted pequeno">O curso está no ar. Use o botão 📲 na tela de funcionários para avisar a equipe pelo WhatsApp.</p>' : ''}
      <div class="linha" style="gap:8px;flex-wrap:wrap;justify-content:flex-end">
        ${st === 'rascunho' && !count ? '<button class="btn perigo" data-acao="excluir" style="margin-right:auto">Excluir curso</button>' : ''}
        ${st === 'publicado' ? '<button class="btn claro" data-acao="rascunho">Tirar do ar (rascunho)</button><button class="btn claro" data-acao="arquivado">Arquivar</button>' : ''}
        ${st !== 'publicado' ? '<button class="btn" data-acao="publicado">🚀 Publicar curso</button>' : ''}
      </div></div>`);
    alvo.append(box);
    box.querySelectorAll('[data-acao]').forEach((b) => (b.onclick = () => acao(b.dataset.acao, b)));
  };
  const acao = async (a, btn) => {
    if (a === 'excluir') {
      if (!(await confirmar('Excluir este curso e todos os arquivos dele? Não dá para desfazer.', { botao: 'Excluir', perigo: true }))) return;
      const paths = ctx.aulas.map((x) => x.arquivo_path).filter(Boolean);
      const { error } = await supa.from('cursos').delete().eq('id', ctx.id);
      if (error) return toast(msgErro(error), 'erro');
      if (paths.length) await supa.storage.from('conteudos').remove(paths);
      toast('Curso excluído.'); location.hash = '#/cursos'; return;
    }
    if (a === 'publicado') {
      if (!ctx.aulas.length) return toast('Adicione o conteúdo antes de publicar.', 'erro');
      if (!ctx.temPublico() && !(await confirmar('Nenhuma função foi escolhida, então ninguém recebe o curso automaticamente. Publicar assim mesmo?', { botao: 'Publicar' }))) return;
      if (!ctx.nQuestoes && !(await confirmar('O curso não tem questionário. Ele vai concluir quando a pessoa terminar de ler. Publicar?', { botao: 'Publicar' }))) return;
    }
    if (a === 'rascunho' && !(await confirmar('Tirar o curso do ar? Quem já tem o curso continua vendo, mas ninguém novo recebe.', { botao: 'Tirar do ar' }))) return;
    if (a === 'arquivado' && !(await confirmar('Arquivar o curso? Ele sai das listas, mas o histórico e os certificados ficam guardados.', { botao: 'Arquivar' }))) return;
    await comCarregando(btn, async () => {
      const { count: antes } = await supa.from('atribuicoes').select('id', { count: 'exact', head: true }).eq('curso_id', ctx.id);
      const { error } = await supa.from('cursos').update({ status: a, updated_at: new Date().toISOString() }).eq('id', ctx.id);
      if (error) return toast(msgErro(error), 'erro');
      ctx.curso.status = a;
      ctx.w.querySelector('#sit').innerHTML = SIT[a];
      if (a === 'publicado') {
        const { count: depois } = await supa.from('atribuicoes').select('id', { count: 'exact', head: true }).eq('curso_id', ctx.id);
        toast(`Curso publicado! ${(depois || 0) - (antes || 0)} pessoa(s) receberam.`);
      } else toast(a === 'arquivado' ? 'Curso arquivado.' : 'Curso voltou para rascunho.');
      await desenhar();
    });
  };
  ctx.aoMudarConteudo = () => desenhar();
  await desenhar();
}
