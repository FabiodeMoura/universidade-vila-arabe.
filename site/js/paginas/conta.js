import { supa, estado, msgErro } from '../supa.js';
import { el, esc, toast, fmtData, iniciais, PAPEL, comCarregando } from '../ui.js';

export async function paginaConta() {
  const p = estado.perfil;
  const loja = estado.lojas.find((l) => l.id === p.loja_id)?.nome || '—';
  const cargo = estado.cargos.find((c) => c.id === p.cargo_id)?.nome || '—';
  const w = el(`<div>
    <div class="cab-pagina"><div><h1>Minha conta</h1><p>Seus dados de cadastro e sua senha de acesso.</p></div></div>
    <div class="grade c2">
      <div class="card card-corpo">
        <div class="ficha-topo"><div class="avatar grande">${esc(iniciais(p.nome))}</div>
          <div><h2>${esc(p.nome)}</h2><div class="s">${esc(PAPEL[p.papel])}</div></div></div>
        <dl class="dados mt2">
          <div><dt>Matrícula</dt><dd>${esc(p.matricula || '—')}</dd></div>
          <div><dt>E-mail</dt><dd>${esc(p.email?.endsWith('.local') ? '—' : p.email || '—')}</dd></div>
          <div><dt>Loja</dt><dd>${esc(loja)}</dd></div>
          <div><dt>Cargo</dt><dd>${esc(cargo)}</dd></div>
          <div><dt>Admissão</dt><dd>${fmtData(p.data_admissao)}</dd></div>
          <div><dt>Pontos</dt><dd>⭐ ${p.pontos}</dd></div>
        </dl>
        <p class="muted pequeno" style="margin-bottom:0">Algum dado errado? Peça a correção ao RH. Seus dados pessoais são usados só para a gestão dos treinamentos (LGPD).</p>
      </div>
      <form class="card card-corpo" id="f-senha" novalidate>
        <h3 style="margin-bottom:14px">Trocar senha</h3>
        <div class="campo"><label>Nova senha</label><input class="entrada" type="password" name="s1" autocomplete="new-password"></div>
        <div class="campo"><label>Repita a nova senha</label><input class="entrada" type="password" name="s2" autocomplete="new-password"></div>
        <button class="btn" type="submit">Salvar nova senha</button>
      </form>
    </div></div>`);
  const f = w.querySelector('#f-senha');
  f.onsubmit = async (e) => {
    e.preventDefault();
    const a = f.s1.value, b = f.s2.value;
    if (a.length < 6) return toast('A senha precisa ter pelo menos 6 caracteres.', 'erro');
    if (a !== b) return toast('As senhas não conferem.', 'erro');
    await comCarregando(f.querySelector('button'), async () => {
      const { error } = await supa.auth.updateUser({ password: a });
      if (error) return toast(msgErro(error), 'erro');
      f.reset(); toast('Senha alterada com sucesso.');
    });
  };
  return w;
}
