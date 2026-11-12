// Meus certificados + validação pública do certificado
import { supa, msgErro } from '../supa.js';
import { el, esc, fmtData, vazio, toast } from '../ui.js';

const horas = (min) => { const h = Math.floor((min || 0) / 60), m = (min || 0) % 60; return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`; };
const urlValidar = (codigo) => `${location.origin}${location.pathname}#/validar/${codigo}`;

export async function paginaCertificados() {
  const { data, error } = await supa.rpc('meus_certificados');
  if (error) throw error;
  const lista = data || [];
  const w = el(`<div>
    <div class="cab-pagina"><div><h1>Meus certificados</h1><p>Emitidos automaticamente quando você é aprovado. Toque em um deles para ver o diploma e imprimir ou salvar em PDF.</p></div></div>
    <div class="card">${lista.length ? `<ul class="lista-simples">${lista.map((c) => `
      <li><div class="posicao">🎓</div><div class="principal"><strong>${esc(c.curso)}</strong><span>${fmtData(c.emitido_em)} · ${horas(c.carga_horaria_min)}${c.nota != null ? ' · nota ' + Math.round(c.nota) : ''} · código ${esc(c.codigo)}</span></div>
        <button class="btn claro pequeno" data-id="${c.id}">Ver diploma</button></li>`).join('')}</ul>`
      : vazio('Você ainda não tem certificados. Conclua um treinamento para ganhar o primeiro.', '🎓')}</div></div>`);
  w.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => imprimir(lista.find((c) => c.id === b.dataset.id))));
  return w;
}

// logo embutida no diploma (assim aparece também ao salvar em PDF)
let logoDados = null;
async function logoEmbutida() {
  if (logoDados) return logoDados;
  try {
    const blob = await (await fetch('img/logo-vila-arabe.png')).blob();
    logoDados = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  } catch (_) { logoDados = `${location.origin}${location.pathname.replace(/[^/]*$/, '')}img/logo-vila-arabe.png`; }
  return logoDados;
}

async function imprimir(c) {
  const j = window.open('', '_blank');
  if (!j) return toast('Libere as janelas (pop-ups) para imprimir o certificado.', 'erro');
  j.document.write('<p style="font-family:sans-serif;text-align:center;margin-top:40px">Preparando o diploma…</p>');
  const logo = await logoEmbutida();
  const data = new Date(c.emitido_em);
  const dataExtenso = data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  j.document.open();
  j.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Diploma · ${esc(c.curso)} · ${esc(c.nome)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    body { margin: 0; background: #d6d3d1; font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif; color: #3b1d14; }
    .acoes { text-align: center; padding: 14px; font-family: system-ui, sans-serif; }
    .acoes button { font: inherit; font-weight: 600; padding: 10px 20px; border-radius: 9px; border: 0; background: #8f1b14; color: #fff; cursor: pointer; }
    .acoes p { margin: 8px 0 0; font-size: 13px; color: #57534e; }
    .folha { width: 297mm; height: 210mm; margin: 0 auto 20px; background: #fffaf0; position: relative; overflow: hidden;
             background-image: radial-gradient(circle at 50% 45%, #fffdf7 0%, #fbf1dc 70%, #f3e2bf 100%); }
    .moldura { position: absolute; inset: 8mm; border: 3px solid #8f1b14; }
    .moldura::before { content: ''; position: absolute; inset: 3mm; border: 1.5px solid #e8681a; }
    .moldura::after { content: ''; position: absolute; inset: 5mm; border: 0.6px solid #c9a35b; }
    .canto { position: absolute; width: 22mm; height: 22mm; border: 3px solid #e8681a; }
    .canto.a { top: 5mm; left: 5mm; border-right: 0; border-bottom: 0; } .canto.b { top: 5mm; right: 5mm; border-left: 0; border-bottom: 0; }
    .canto.c { bottom: 5mm; left: 5mm; border-right: 0; border-top: 0; } .canto.d { bottom: 5mm; right: 5mm; border-left: 0; border-top: 0; }
    .marca-dagua { position: absolute; left: 50%; top: 54%; width: 150mm; transform: translate(-50%, -50%); opacity: .06; }
    .conteudo { position: absolute; inset: 17mm 26mm 19mm; display: flex; flex-direction: column; align-items: center; text-align: center; }
    .logo { height: 27mm; }
    .escola { font-family: 'Cinzel', serif; letter-spacing: .32em; font-size: 12pt; color: #8f1b14; margin-top: 2mm; }
    h1 { font-family: 'Cinzel', serif; font-weight: 700; font-size: 38pt; letter-spacing: .14em; color: #8f1b14; margin: 2mm 0 0; line-height: 1; }
    .sub { font-family: 'Cinzel', serif; font-size: 11pt; letter-spacing: .25em; color: #b45309; margin-top: 2mm; }
    .linha-orn { display: flex; align-items: center; gap: 4mm; color: #e8681a; margin: 4mm 0 2mm; font-size: 12pt; }
    .linha-orn::before, .linha-orn::after { content: ''; width: 45mm; height: 1px; background: linear-gradient(90deg, transparent, #c9a35b, transparent); }
    .txt { font-size: 15pt; line-height: 1.45; max-width: 215mm; }
    .nome { font-family: 'Great Vibes', 'Brush Script MT', cursive; font-size: 46pt; color: #3b1d14; line-height: 1.15; margin: 1mm 0 0; padding: 0 10mm 1mm; border-bottom: 1px solid #c9a35b; }
    .curso { font-family: 'Cinzel', serif; font-weight: 700; font-size: 17pt; color: #8f1b14; letter-spacing: .03em; display: block; margin: 2mm 0; }
    .rodape { margin-top: auto; width: 100%; display: grid; grid-template-columns: 1fr auto 1fr; align-items: end; gap: 10mm; }
    .ass { text-align: center; font-size: 12pt; }
    .ass .traco { border-top: 1px solid #3b1d14; margin: 0 6mm 1.5mm; }
    .ass small { display: block; font-size: 10pt; color: #78350f; }
    .selo { width: 32mm; height: 32mm; border-radius: 50%; background: radial-gradient(circle, #e8681a 0 55%, #8f1b14 56% 100%); display: grid; place-items: center;
            box-shadow: 0 0 0 2px #fffaf0, 0 0 0 3.5px #c9a35b; color: #fff; font-family: 'Cinzel', serif; font-size: 7.5pt; letter-spacing: .08em; line-height: 1.25; text-align: center; }
    .selo b { display: block; font-size: 13pt; letter-spacing: .02em; }
    .codigo { text-align: center; font-family: system-ui, sans-serif; font-size: 8pt; color: #78350f; margin-top: 4mm; }
    .codigo b { letter-spacing: .1em; }
    @media print { body { background: none; } .acoes { display: none; } .folha { margin: 0; } }
  </style></head><body>
  <div class="acoes"><button onclick="print()">🖨 Imprimir ou salvar em PDF</button><p>Na impressão escolha "Paisagem" e marque "Gráficos de fundo".</p></div>
  <div class="folha">
    <img class="marca-dagua" src="${logo}" alt="">
    <div class="moldura"></div><div class="canto a"></div><div class="canto b"></div><div class="canto c"></div><div class="canto d"></div>
    <div class="conteudo">
      <img class="logo" src="${logo}" alt="Vila Árabe">
      <div class="escola">Universidade Vila Árabe</div>
      <h1>Diploma</h1>
      <div class="sub">de conclusão de treinamento</div>
      <div class="linha-orn">✦</div>
      <div class="txt">A Universidade Vila Árabe confere a</div>
      <div class="nome">${esc(c.nome)}</div>
      <div class="txt" style="margin-top:4mm">o presente diploma por ter concluído com aproveitamento o treinamento
        <span class="curso">${esc(c.curso)}</span>
        com carga horária de ${horas(c.carga_horaria_min)}${c.nota != null ? ` e nota final ${Math.round(c.nota)}` : ''}.</div>
      <div class="txt" style="font-style:italic;font-size:13pt;margin-top:2mm">Belo Horizonte, ${esc(dataExtenso)}.</div>
      <div class="rodape">
        <div class="ass"><div class="traco"></div>${esc(c.responsavel_nome || 'RH Vila Árabe')}<small>Responsável pelo treinamento</small></div>
        <div class="selo"><div>Vila Árabe<b>${data.getFullYear()}</b>Aprovado</div></div>
        <div class="ass"><div class="traco"></div>Recursos Humanos<small>Vila Árabe</small></div>
      </div>
      <div class="codigo">Código de validação <b>${esc(c.codigo)}</b> · confira em ${esc(urlValidar(c.codigo))}</div>
    </div>
  </div>
  </body></html>`);
  j.document.close();
  // no celular a folha encolhe para caber na tela; na impressão volta ao tamanho A4
  const f = j.document.querySelector('.folha'), larg = 297 * 3.7795;
  const ajusta = () => { f.style.zoom = j.innerWidth < larg + 24 ? ((j.innerWidth - 16) / larg).toFixed(3) : 1; };
  ajusta(); j.addEventListener('resize', ajusta);
  j.addEventListener('beforeprint', () => { f.style.zoom = 1; }); j.addEventListener('afterprint', ajusta);
}

// Página pública: qualquer pessoa confere se o certificado é verdadeiro
export async function telaValidar(codigo) {
  const w = el(`<div class="validar"><div class="card card-corpo" style="max-width:520px;margin:40px auto">
    <div class="marca-validar"><img src="img/icone.svg" alt=""><div><strong>Universidade Vila Árabe</strong><span>Validação de certificado</span></div></div>
    <form id="f" class="linha mt" style="gap:8px"><input class="entrada" name="c" placeholder="Código do certificado" value="${esc(codigo || '')}" style="flex:1"><button class="btn">Validar</button></form>
    <div id="res" class="mt"></div></div></div>`);
  const res = w.querySelector('#res');
  const validar = async (cod) => {
    if (!cod) return;
    res.innerHTML = '<div class="spinner" style="margin:0 auto"></div>';
    const { data, error } = await supa.rpc('validar_certificado', { p_codigo: cod });
    if (error) { res.innerHTML = `<div class="resultado erro"><strong>Erro</strong><span>${esc(msgErro(error))}</span></div>`; return; }
    res.innerHTML = data
      ? `<div class="resultado ok"><strong>Certificado válido ✓</strong><span><b>${esc(data.funcionario)}</b> concluiu <b>${esc(data.curso)}</b> em ${fmtData(data.emitido_em)}${data.nota != null ? `, nota ${Math.round(data.nota)}` : ''}. Carga horária ${horas(data.carga_horaria_min)}.</span></div>`
      : `<div class="resultado erro"><strong>Certificado não encontrado</strong><span>Confira o código digitado.</span></div>`;
  };
  w.querySelector('#f').onsubmit = (e) => { e.preventDefault(); validar(e.target.c.value.trim()); };
  validar(codigo);
  return w;
}
