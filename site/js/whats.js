// Envio pelo WhatsApp: link pessoal (entra sem senha) + lista de pendências
import { supa } from './supa.js';
import { fmtData } from './ui.js';

// Endereço do link pessoal: https://site/#/l/<token>
export const urlLink = (token, cursoId) => `${location.origin}${location.pathname}#/l/${token}${cursoId ? '/' + cursoId : ''}`;

// "(31) 9 8888-7777" -> "5531988887777". Vazio se não parecer celular.
export function numeroWhats(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = d.replace(/^0+/, '');
  if (d.length === 10 || d.length === 11) d = '55' + d;
  return d.length >= 12 && d.length <= 13 ? d : '';
}

export function mensagemPendencias(nome, pendencias, link) {
  const primeiro = String(nome || '').split(' ')[0];
  const n = pendencias.length;
  const linhas = pendencias.slice(0, 8).map((p) => `• ${p.titulo}${p.prazo ? ` (até ${fmtData(p.prazo)})` : ''}`);
  if (n > 8) linhas.push(`• e mais ${n - 8}`);
  return n
    ? `Olá, ${primeiro}! 👋\nVocê tem ${n} treinamento${n > 1 ? 's' : ''} para fazer na Universidade Vila Árabe:\n${linhas.join('\n')}\n\nÉ só tocar no seu link pessoal (não precisa de senha):\n${link}\n\nQualquer dúvida, fale com seu gerente.`
    : `Olá, ${primeiro}! 👋\nEste é o seu link pessoal da Universidade Vila Árabe (não precisa de senha):\n${link}\n\nGuarde esta mensagem para entrar quando quiser.`;
}

export function abrirWhats(tel, texto) {
  const num = numeroWhats(tel);
  const url = `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank', 'noopener');
}

export async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; }
  catch (_) {
    const t = document.createElement('textarea');
    t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.append(t); t.select();
    const ok = document.execCommand('copy'); t.remove(); return ok;
  }
}

// Pendências (não concluídas) de uma ou várias pessoas: { perfil_id: [{titulo, prazo, curso_id}] }
export async function pendenciasDe(ids) {
  const mapa = {};
  for (let i = 0; i < ids.length; i += 150) {
    const { data, error } = await supa.from('atribuicoes')
      .select('perfil_id,prazo,status,curso_id, cursos(titulo)')
      .in('perfil_id', ids.slice(i, i + 150))
      .not('status', 'in', '(aprovado,concluido)')
      .order('prazo', { ascending: true, nullsFirst: false });
    if (error) throw error;
    (data || []).forEach((a) => (mapa[a.perfil_id] = mapa[a.perfil_id] || []).push({ titulo: a.cursos?.titulo, prazo: a.prazo, curso_id: a.curso_id }));
  }
  return mapa;
}
