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
    <div class="cab-pagina"><div><h1>Meus certificados</h1><p>Emitidos automaticamente quando você é aprovado. Toque para imprimir ou salvar em PDF.</p></div></div>
    <div class="card">${lista.length ? `<ul class="lista-simples">${lista.map((c) => `
      <li><div class="posicao">🎓</div><div class="principal"><strong>${esc(c.curso)}</strong><span>${fmtData(c.emitido_em)} · ${horas(c.carga_horaria_min)}${c.nota != null ? ' · nota ' + Math.round(c.nota) : ''} · código ${esc(c.codigo)}</span></div>
        <button class="btn claro pequeno" data-id="${c.id}">Ver / imprimir</button></li>`).join('')}</ul>`
      : vazio('Você ainda não tem certificados. Conclua um treinamento para ganhar o primeiro.', '🎓')}</div></div>`);
  w.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => imprimir(lista.find((c) => c.id === b.dataset.id))));
  return w;
}

function imprimir(c) {
  const j = window.open('', '_blank');
  if (!j) return toast('Libere as janelas (pop-ups) para imprimir o certificado.', 'erro');
  j.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Certificado · ${esc(c.curso)}</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    @page { size: A4 landscape; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; color: #1f2937; background: #e5e7eb; }
    .folha { width: 297mm; height: 210mm; margin: 0 auto; background: #fff; position: relative; padding: 18mm 22mm; display: flex; flex-direction: column; }
    .faixa { position: absolute; inset: 0 0 auto 0; height: 9mm; background: linear-gradient(90deg, #334155, #0d9488 60%, #a3e635); }
    .faixa.b { inset: auto 0 0 0; height: 4mm; }
    .topo { display: flex; align-items: center; gap: 12px; margin-top: 6mm; }
    .topo img { width: 44px; height: 44px; }
    .topo strong { display: block; font-size: 18px; } .topo span { color: #6b7280; font-size: 13px; }
    h1 { font-size: 46px; letter-spacing: -.02em; margin: 14mm 0 2mm; color: #0f766e; }
    .txt { font-size: 18px; line-height: 1.6; max-width: 210mm; }
    .nome { font-size: 34px; font-weight: 800; margin: 4mm 0; color: #111827; }
    .curso { font-weight: 700; }
    .rodape { margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; font-size: 13px; color: #4b5563; }
    .ass { border-top: 1px solid #9ca3af; padding-top: 6px; min-width: 70mm; text-align: center; }
    .cod { text-align: right; } .cod b { font-size: 15px; color: #111827; letter-spacing: .05em; }
    .acoes { text-align: center; padding: 14px; } .acoes button { font: inherit; padding: 10px 18px; border-radius: 9px; border: 0; background: #4f46e5; color: #fff; font-weight: 600; cursor: pointer; }
    @media print { body { background: #fff; } .acoes { display: none; } }
    @media screen and (max-width: 1100px) { .folha { transform-origin: top left; } }
  </style></head><body>
  <div class="acoes"><button onclick="print()">Imprimir ou salvar em PDF</button></div>
  <div class="folha"><div class="faixa"></div>
    <div class="topo"><img src="${location.origin}${location.pathname.replace(/[^/]*$/, '')}img/icone.svg" alt=""><div><strong>Universidade Vila Árabe</strong><span>Escola de talentos</span></div></div>
    <h1>Certificado</h1>
    <div class="txt">Certificamos que</div>
    <div class="nome">${esc(c.nome)}</div>
    <div class="txt">concluiu com aproveitamento o treinamento <span class="curso">${esc(c.curso)}</span>,
      com carga horária de ${horas(c.carga_horaria_min)}${c.nota != null ? ` e nota ${Math.round(c.nota)}` : ''}, em ${fmtData(c.emitido_em)}.</div>
    <div class="rodape">
      <div class="ass">${esc(c.responsavel_nome || 'RH Vila Árabe')}<br><small>Responsável pelo treinamento</small></div>
      <div class="cod">Código de validação <b>${esc(c.codigo)}</b><br><small>${esc(urlValidar(c.codigo))}</small></div>
    </div>
    <div class="faixa b"></div></div>
  </body></html>`);
  j.document.close();
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
