// Utilidades de interface
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export function toast(msg, tipo = 'ok') {
  const t = el(`<div class="toast ${tipo === 'erro' ? 'erro' : ''}">${esc(msg)}</div>`);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), tipo === 'erro' ? 6000 : 3500);
}

export function iniciais(nome = '') {
  const p = nome.replace(/\(.*?\)/g, '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase() || '?';
}

export function fmtData(d, comHora = false) {
  if (!d) return '—';
  const dt = typeof d === 'string' && d.length === 10 ? new Date(d + 'T12:00:00') : new Date(d);
  if (isNaN(dt)) return '—';
  return comHora ? dt.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                 : dt.toLocaleDateString('pt-BR');
}

export function tempoRelativo(d) {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  if (s < 86400 * 7) return `há ${Math.floor(s / 86400)} d`;
  return fmtData(d);
}

export const hoje = () => new Date().toISOString().slice(0, 10);

const ROTULO = { nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', concluido: 'Concluído', aprovado: 'Aprovado', reprovado: 'Reprovado' };
// Status visual: verde aprovado, amarelo em andamento, laranja prazo próximo, vermelho atrasado/reprovado, cinza não iniciado
export function statusTag(status, prazo) {
  const feito = status === 'aprovado' || status === 'concluido';
  if (!feito && prazo && prazo < hoje()) return `<span class="tag vermelho">Em atraso</span>`;
  if (status === 'reprovado') return `<span class="tag vermelho">Reprovado</span>`;
  if (feito) return `<span class="tag verde">${ROTULO[status]}</span>`;
  const dias = prazo ? (new Date(prazo + 'T12:00:00') - new Date()) / 86400000 : 99;
  if (dias <= 3) return `<span class="tag laranja">${status === 'em_andamento' ? 'Em andamento' : 'Pendente'} · prazo próximo</span>`;
  if (status === 'em_andamento') return `<span class="tag amarelo">Em andamento</span>`;
  return `<span class="tag cinza">Não iniciado</span>`;
}

export const PAPEL = { admin: 'Administrador geral', rh: 'RH / Treinamentos', gerente: 'Gerente de loja', funcionario: 'Funcionário' };

export function barra(p, ouro = false) {
  const v = Math.max(0, Math.min(100, Math.round(p || 0)));
  return `<div class="barra ${ouro ? 'ouro' : ''}" role="progressbar" aria-valuenow="${v}" aria-valuemin="0" aria-valuemax="100"><i style="width:${v}%"></i></div>`;
}

export function vazio(msg, ic = '📭') {
  return `<div class="vazio"><div class="ic">${ic}</div>${esc(msg)}</div>`;
}

export const carregando = () => `<div class="vazio"><div class="spinner" style="margin:0 auto"></div></div>`;

// Modal genérico. Retorna { el, fechar }.
export function abrirModal({ titulo, corpo, rodape = '', tamanho = '' , aoFechar }) {
  const m = el(`<div class="modal-fundo" role="dialog" aria-modal="true">
    <div class="modal ${tamanho}">
      <div class="modal-cab"><h3>${esc(titulo)}</h3><button class="fechar" aria-label="Fechar">×</button></div>
      <div class="modal-corpo"></div>
      ${rodape ? `<div class="modal-rodape">${rodape}</div>` : ''}
    </div></div>`);
  const corpoEl = m.querySelector('.modal-corpo');
  if (typeof corpo === 'string') corpoEl.innerHTML = corpo; else if (corpo) corpoEl.append(corpo);
  const fechar = () => { m.remove(); document.removeEventListener('keydown', esc_); aoFechar && aoFechar(); };
  const esc_ = (e) => { if (e.key === 'Escape') fechar(); };
  m.querySelector('.fechar').onclick = fechar;
  m.addEventListener('mousedown', (e) => { if (e.target === m) fechar(); });
  document.addEventListener('keydown', esc_);
  document.body.append(m);
  setTimeout(() => m.querySelector('input,select,textarea')?.focus(), 30);
  return { el: m, fechar };
}

export function confirmar(texto, { titulo = 'Confirmar', botao = 'Confirmar', perigo = false } = {}) {
  return new Promise((ok) => {
    const { el: m, fechar } = abrirModal({
      titulo, tamanho: 'estreito', corpo: `<p style="margin:0">${esc(texto)}</p>`,
      rodape: `<button class="btn claro" data-n>Cancelar</button><button class="btn ${perigo ? 'perigo' : ''}" data-s>${esc(botao)}</button>`,
      aoFechar: () => ok(false),
    });
    m.querySelector('[data-n]').onclick = () => fechar();
    m.querySelector('[data-s]').onclick = () => { ok(true); m.remove(); };
  });
}

export function opcoes(lista, selecionado, { vazio: v = null, rotulo = (x) => x.nome, valor = (x) => x.id } = {}) {
  return (v !== null ? `<option value="">${esc(v)}</option>` : '') +
    lista.map((x) => `<option value="${esc(valor(x))}" ${String(valor(x)) === String(selecionado ?? '') ? 'selected' : ''}>${esc(rotulo(x))}</option>`).join('');
}

// Lê os campos [name] de um formulário
export function lerForm(form) {
  const d = {};
  form.querySelectorAll('[name]').forEach((i) => {
    d[i.name] = i.type === 'checkbox' ? i.checked : (i.value.trim() === '' ? null : i.value.trim());
  });
  return d;
}

// Botão com estado de carregamento
export async function comCarregando(btn, fn) {
  const txt = btn.innerHTML;
  btn.disabled = true; btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px"></span>';
  try { return await fn(); } finally { btn.disabled = false; btn.innerHTML = txt; }
}

export function exportarCSV(nome, cabecalho, linhas) {
  const sep = ';';
  const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = '﻿' + [cabecalho.map(q).join(sep), ...linhas.map((l) => l.map(q).join(sep))].join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
