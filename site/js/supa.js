import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';
import { SUPABASE_URL, SUPABASE_CHAVE } from './config.js';

export const supa = createClient(SUPABASE_URL, SUPABASE_CHAVE, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'uva-sessao' },
});

// Estado global do usuário logado
export const estado = { usuario: null, perfil: null, lojas: [], cargos: [], setores: [] };

export const ehGestao = () => ['admin', 'rh'].includes(estado.perfil?.papel);
export const ehGerente = () => estado.perfil?.papel === 'gerente';
export const ehAdmin = () => estado.perfil?.papel === 'admin';

// Traduz mensagens de erro do banco para algo legível
export function msgErro(e) {
  const m = (e && (e.message || e.erro || e.error_description || e.msg)) || String(e || 'Erro inesperado');
  if (/Invalid login credentials/i.test(m)) return 'Matrícula, e-mail ou senha incorretos.';
  if (/Email not confirmed/i.test(m)) return 'E-mail ainda não confirmado.';
  if (/banned|User is banned/i.test(m)) return 'Este acesso está inativo. Fale com o RH.';
  if (/row-level security|permission denied/i.test(m)) return 'Você não tem permissão para esta ação.';
  if (/duplicate key/i.test(m)) return 'Já existe um registro com esses dados.';
  if (/Failed to fetch|NetworkError/i.test(m)) return 'Sem conexão com o servidor. Verifique a internet.';
  if (/Password should be at least/i.test(m)) return 'A senha precisa ter pelo menos 6 caracteres.';
  return m;
}

// Carrega tabelas de apoio usadas em várias telas
export async function carregarApoio() {
  const [l, c, s] = await Promise.all([
    supa.from('lojas').select('id,numero,nome,apelido,cidade,endereco,gerente_id,ativo').order('numero').order('nome'),
    supa.from('cargos').select('id,nome,setor_id,descricao,ativo').order('nome'),
    supa.from('setores').select('id,nome').order('nome'),
  ]);
  estado.lojas = l.data || [];
  estado.cargos = c.data || [];
  estado.setores = s.data || [];
}

// Chama a função do servidor que cria/gerencia logins
export async function gerenciarUsuario(corpo) {
  const { data, error } = await supa.functions.invoke('gerenciar-usuario', { body: corpo });
  if (error) {
    let det = null;
    try { det = await error.context.json(); } catch (_) { /* sem corpo */ }
    throw new Error(det?.erro || error.message);
  }
  if (data?.erro) throw new Error(data.erro);
  return data;
}
