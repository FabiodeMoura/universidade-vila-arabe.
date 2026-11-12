// Meus certificados + validação pública do certificado
import { supa, msgErro } from '../supa.js';
import { el, esc, fmtData, vazio } from '../ui.js';
import { abrirDiploma, horas } from '../diploma.js';


export async function paginaCertificados() {
  const { data, error } = await supa.rpc('meus_certificados');
  if (error) throw error;
  const lista = data || [];
  const w = el(`<div>
    <div class="cab-pagina"><div><h1>Meus certificados</h1><p>Emitidos automaticamente quando você é aprovado. Baixe o diploma em PDF (A4 deitado) para imprimir ou guardar.</p></div></div>
    <div class="card">${lista.length ? `<ul class="lista-simples">${lista.map((c) => `
      <li><div class="posicao">🎓</div><div class="principal"><strong>${esc(c.curso)}</strong><span>${fmtData(c.emitido_em)} · ${horas(c.carga_horaria_min)}${c.nota != null ? ' · nota ' + Math.round(c.nota) : ''} · código ${esc(c.codigo)}</span></div>
        <button class="btn pequeno" data-id="${c.id}">📄 Diploma em PDF</button></li>`).join('')}</ul>`
      : vazio('Você ainda não tem certificados. Conclua um treinamento para ganhar o primeiro.', '🎓')}</div></div>`);
  w.querySelectorAll('[data-id]').forEach((b) => (b.onclick = () => abrirDiploma(lista.find((c) => c.id === b.dataset.id))));
  return w;
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
