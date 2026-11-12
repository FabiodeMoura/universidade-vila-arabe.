// Diploma em PDF (A4 deitado, 297 × 210 mm), gerado no próprio aparelho.
// A arte é montada em HTML, fotografada em alta resolução e colocada inteira na página do PDF,
// por isso não depende das configurações de impressão e nada é cortado.
import { esc, abrirModal, toast } from './ui.js';

const LIB = 'https://cdn.jsdelivr.net/npm/html-to-image@1.11.13/dist/html-to-image.js';
const FONTES = 'https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700&family=Great+Vibes&family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&display=swap';
const LARG = 1123, ALT = 794;          // A4 deitado a 96 dpi
const ESCALA = 3;                       // 3369 × 2382 px ≈ 290 dpi

export const horas = (min) => { const h = Math.floor((min || 0) / 60), m = (min || 0) % 60; return h ? `${h}h${m ? String(m).padStart(2, '0') : ''}` : `${m} min`; };
const urlValidar = (codigo) => `${location.origin}${location.pathname}#/validar/${codigo}`;

let libPromessa = null;
function carregarLib() {
  if (window.htmlToImage) return Promise.resolve(window.htmlToImage);
  if (!libPromessa) {
    libPromessa = new Promise((ok, erro) => {
      const s = document.createElement('script');
      s.src = LIB; s.onload = () => ok(window.htmlToImage); s.onerror = () => { libPromessa = null; erro(new Error('Não foi possível carregar o gerador de PDF. Confira a internet.')); };
      document.head.append(s);
    });
  }
  return libPromessa;
}

async function carregarFontes() {
  if (!document.querySelector('link[data-fontes-diploma]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = FONTES; l.dataset.fontesDiploma = '1'; l.crossOrigin = 'anonymous';
    document.head.append(l);
    await new Promise((ok) => { l.onload = ok; l.onerror = ok; setTimeout(ok, 4000); });
  }
  try {
    await Promise.race([
      Promise.all(['700 40px Cinzel', '500 16px Cinzel', '48px "Great Vibes"', '500 18px "Cormorant Garamond"', 'italic 500 18px "Cormorant Garamond"', '600 18px "Cormorant Garamond"'].map((f) => document.fonts.load(f))),
      new Promise((ok) => setTimeout(ok, 4000)),
    ]);
  } catch (_) { /* segue com as fontes do aparelho */ }
}

let logoDados = null;
async function logoEmbutida() {
  if (logoDados) return logoDados;
  const blob = await (await fetch('img/logo-vila-arabe.png')).blob();
  logoDados = await new Promise((ok) => { const r = new FileReader(); r.onload = () => ok(r.result); r.readAsDataURL(blob); });
  return logoDados;
}

const CSS = `
.dip { width: ${LARG}px; height: ${ALT}px; position: relative; overflow: hidden; box-sizing: border-box; color: #3b1d14;
  font-family: 'Cormorant Garamond', Georgia, 'Times New Roman', serif;
  background: #fffaf0 radial-gradient(circle at 50% 45%, #fffdf7 0%, #fbf1dc 70%, #f3e2bf 100%); }
.dip * { box-sizing: border-box; }
.dip .moldura { position: absolute; inset: 30px; border: 3px solid #8f1b14; }
.dip .moldura i { position: absolute; inset: 9px; border: 1.5px solid #e8681a; }
.dip .moldura b { position: absolute; inset: 16px; border: 1px solid #c9a35b; }
.dip .canto { position: absolute; width: 84px; height: 84px; border: 3px solid #e8681a; }
.dip .canto.a { top: 18px; left: 18px; border-right: 0; border-bottom: 0; } .dip .canto.b { top: 18px; right: 18px; border-left: 0; border-bottom: 0; }
.dip .canto.c { bottom: 18px; left: 18px; border-right: 0; border-top: 0; } .dip .canto.d { bottom: 18px; right: 18px; border-left: 0; border-top: 0; }
.dip .marca-dagua { position: absolute; left: 50%; top: 54%; width: 560px; transform: translate(-50%, -50%); opacity: .06; }
.dip .conteudo { position: absolute; top: 64px; left: 98px; right: 98px; bottom: 70px; display: flex; flex-direction: column; align-items: center; text-align: center; }
.dip .logo { height: 100px; }
.dip .escola { font-family: 'Cinzel', serif; letter-spacing: .32em; font-size: 16px; color: #8f1b14; margin-top: 8px; }
.dip h1 { font-family: 'Cinzel', serif; font-weight: 700; font-size: 50px; letter-spacing: .14em; color: #8f1b14; margin: 6px 0 0; line-height: 1; }
.dip .sub { font-family: 'Cinzel', serif; font-size: 14px; letter-spacing: .25em; color: #b45309; margin-top: 8px; }
.dip .orn { display: flex; align-items: center; gap: 14px; color: #e8681a; margin: 14px 0 6px; font-size: 16px; }
.dip .orn span { width: 170px; height: 1px; background: linear-gradient(90deg, transparent, #c9a35b, transparent); }
.dip .txt { font-size: 20px; line-height: 1.45; max-width: 820px; }
.dip .nome { font-family: 'Great Vibes', 'Brush Script MT', cursive; font-size: 60px; color: #3b1d14; line-height: 1.15; margin-top: 2px; padding: 0 40px 2px; border-bottom: 1px solid #c9a35b; max-width: 900px; }
.dip .nome.longo { font-size: 48px; }
.dip .curso { font-family: 'Cinzel', serif; font-weight: 700; font-size: 23px; color: #8f1b14; letter-spacing: .03em; display: block; margin: 6px 0; }
.dip .data { font-style: italic; font-size: 17px; margin-top: 6px; }
.dip .rodape { margin-top: auto; width: 100%; display: grid; grid-template-columns: 1fr 124px 1fr; align-items: end; gap: 36px; }
.dip .ass { text-align: center; font-size: 16px; }
.dip .ass .traco { border-top: 1px solid #3b1d14; margin: 0 22px 6px; }
.dip .ass small { display: block; font-size: 13px; color: #78350f; }
.dip .selo { width: 120px; height: 120px; border-radius: 50%; background: radial-gradient(circle, #e8681a 0 55%, #8f1b14 56% 100%);
  display: flex; align-items: center; justify-content: center; box-shadow: 0 0 0 2px #fffaf0, 0 0 0 4px #c9a35b;
  color: #fff; font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: .08em; line-height: 1.3; text-align: center; margin: 0 auto; }
.dip .selo b { display: block; font-size: 17px; letter-spacing: .02em; }
.dip .codigo { text-align: center; font-family: Arial, Helvetica, sans-serif; font-size: 11px; color: #78350f; margin-top: 14px; }
.dip .codigo b { letter-spacing: .1em; }`;

function montar(c, logo) {
  const data = new Date(c.emitido_em || Date.now());
  const dataExtenso = data.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Sao_Paulo' });
  const ano = data.toLocaleDateString('pt-BR', { year: 'numeric', timeZone: 'America/Sao_Paulo' });
  const div = document.createElement('div');
  div.className = 'dip';
  div.innerHTML = `<style>${CSS}</style>
    <img class="marca-dagua" src="${logo}" alt="">
    <div class="moldura"><i></i><b></b></div><div class="canto a"></div><div class="canto b"></div><div class="canto c"></div><div class="canto d"></div>
    <div class="conteudo">
      <img class="logo" src="${logo}" alt="Vila Árabe">
      <div class="escola">Universidade Vila Árabe</div>
      <h1>Diploma</h1>
      <div class="sub">de conclusão de treinamento</div>
      <div class="orn"><span></span>✦<span></span></div>
      <div class="txt">A Universidade Vila Árabe confere a</div>
      <div class="nome ${String(c.nome || '').length > 30 ? 'longo' : ''}">${esc(c.nome)}</div>
      <div class="txt" style="margin-top:14px">o presente diploma por ter concluído com aproveitamento o treinamento
        <span class="curso">${esc(c.curso)}</span>
        com carga horária de ${horas(c.carga_horaria_min)}${c.nota != null ? ` e nota final ${Math.round(c.nota)}` : ''}.</div>
      <div class="data">Belo Horizonte, ${esc(dataExtenso)}.</div>
      <div class="rodape">
        <div class="ass"><div class="traco"></div>${esc(c.responsavel_nome || 'RH Vila Árabe')}<small>Responsável pelo treinamento</small></div>
        <div class="selo"><div>Vila Árabe<b>${ano}</b>Aprovado</div></div>
        <div class="ass"><div class="traco"></div>Recursos Humanos<small>Vila Árabe</small></div>
      </div>
      <div class="codigo">Código de validação <b>${esc(c.codigo)}</b> · confira em ${esc(urlValidar(c.codigo))}</div>
    </div>`;
  return div;
}

// Gera { pdf: Blob, imagem: dataURL JPEG }
export async function gerarDiploma(c) {
  const [lib, logo] = await Promise.all([carregarLib(), logoEmbutida(), carregarFontes()]);
  const palco = document.createElement('div');
  palco.style.cssText = `position:fixed;left:-${LARG * 3}px;top:0;width:${LARG}px;height:${ALT}px;pointer-events:none;z-index:-1`;
  const dip = montar(c, logo);
  palco.append(dip);
  document.body.append(palco);
  try {
    await Promise.all([...dip.querySelectorAll('img')].map((i) => (i.complete ? null : new Promise((ok) => { i.onload = ok; i.onerror = ok; }))));
    const op = { width: LARG, height: ALT, pixelRatio: ESCALA, backgroundColor: '#fffaf0', cacheBust: false };
    let canvas;
    try {
      await lib.toCanvas(dip, { ...op, pixelRatio: 1 });           // 1ª passada: o Safari às vezes ignora imagens na primeira
      canvas = await lib.toCanvas(dip, op);
    } catch (_) {
      canvas = await lib.toCanvas(dip, { ...op, skipFonts: true });   // sem acesso às fontes, usa as do aparelho
    }
    const imagem = canvas.toDataURL('image/jpeg', 0.92);
    return { pdf: pdfDeJpeg(imagem, canvas.width, canvas.height), imagem };
  } finally {
    palco.remove();
  }
}

// PDF de uma página A4 deitada com a imagem ocupando a folha inteira
function pdfDeJpeg(dataUrl, w, h) {
  const bin = atob(dataUrl.split(',')[1]);
  const jpg = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) jpg[i] = bin.charCodeAt(i);
  const enc = new TextEncoder();
  const partes = []; const offs = []; let pos = 0;
  const add = (x) => { const b = typeof x === 'string' ? enc.encode(x) : x; partes.push(b); pos += b.length; };
  const PW = 841.89, PH = 595.28;
  const cont = `q ${PW} 0 0 ${PH} 0 0 cm /Im0 Do Q`;
  add('%PDF-1.4\n%âãÏÓ\n');
  offs[1] = pos; add('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  offs[2] = pos; add('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  offs[3] = pos; add(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PW} ${PH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
  offs[4] = pos; add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${w} /Height ${h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpg.length} >>\nstream\n`);
  add(jpg); add('\nendstream\nendobj\n');
  offs[5] = pos; add(`5 0 obj\n<< /Length ${cont.length} >>\nstream\n${cont}\nendstream\nendobj\n`);
  const xref = pos;
  add(`xref\n0 6\n0000000000 65535 f \n${offs.slice(1).map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`);
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  return new Blob(partes, { type: 'application/pdf' });
}

const nomeArquivo = (c) => `Diploma - ${c.curso} - ${c.nome}`.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) + '.pdf';

// Abre a prévia e o botão de baixar o PDF
export async function abrirDiploma(c) {
  const corpo = document.createElement('div');
  corpo.innerHTML = `<div class="vazio"><div class="spinner" style="margin:0 auto"></div><div class="pequeno" style="margin-top:10px">Gerando o diploma em PDF…</div></div>`;
  const { el: m } = abrirModal({ titulo: `Diploma · ${c.curso}`, corpo, tamanho: 'largo' });
  try {
    const { pdf, imagem } = await gerarDiploma(c);
    const url = URL.createObjectURL(pdf);
    corpo.innerHTML = `<img src="${imagem}" alt="Diploma" style="width:100%;display:block;border-radius:6px;box-shadow:0 2px 10px rgba(15,23,42,.18)">
      <p class="muted pequeno" style="text-align:center;margin:10px 0 0">PDF em folha A4 deitada, pronto para imprimir sem cortes.</p>`;
    const rod = document.createElement('div');
    rod.className = 'modal-rodape';
    rod.innerHTML = `<a class="btn claro" href="${url}" target="_blank" rel="noopener">Abrir PDF</a><a class="btn" href="${url}" download="${esc(nomeArquivo(c))}">⬇ Baixar PDF</a>`;
    m.querySelector('.modal').append(rod);
  } catch (e) {
    console.error(e);
    corpo.innerHTML = `<div class="vazio"><div class="ic">⚠️</div>${esc(e.message || 'Não foi possível gerar o PDF.')}</div>`;
    toast('Não foi possível gerar o diploma. Tente de novo.', 'erro');
  }
}
