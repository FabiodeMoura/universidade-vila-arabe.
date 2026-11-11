-- =====================================================================
-- 02 · Funções auxiliares de permissão + RLS em todas as tabelas
-- =====================================================================

create or replace function meu_papel() returns papel_usuario
language sql stable security definer set search_path = public as $$
  select papel from perfis where id = auth.uid() and ativo
$$;

create or replace function e_gestao() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel in ('admin','rh') from perfis where id = auth.uid() and ativo), false)
$$;

create or replace function e_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select papel = 'admin' from perfis where id = auth.uid() and ativo), false)
$$;

-- lojas que o usuário logado enxerga
create or replace function lojas_visiveis() returns setof uuid
language sql stable security definer set search_path = public as $$
  select id from lojas where e_gestao()
  union select loja_id from perfis where id = auth.uid() and loja_id is not null
  union select loja_id from gerente_lojas where gerente_id = auth.uid()
  union select id from lojas where gerente_id = auth.uid()
$$;

create or replace function pode_ver_perfil(p uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select p = auth.uid()
      or e_gestao()
      or (meu_papel() = 'gerente' and exists (
            select 1 from perfis x where x.id = p
              and (x.loja_id in (select lojas_visiveis()) or x.gerente_id = auth.uid())))
$$;

create or replace function gerencio(p uuid) returns boolean   -- gestão ou gerente da pessoa
language sql stable security definer set search_path = public as $$
  select e_gestao() or (meu_papel() = 'gerente' and p <> auth.uid() and pode_ver_perfil(p))
$$;

-- ---------- Ativar RLS ----------
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname = 'public' loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- ---------- Tabelas de referência: todos leem, gestão escreve ----------
do $$ declare t text; begin
  foreach t in array array['lojas','setores','cargos','categorias','regras_pontuacao','medalhas','trilhas','trilha_cursos','checklist_modelos','checklist_itens','desafios','configuracoes'] loop
    execute format('create policy "%1$s_ler" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "%1$s_gestao" on public.%1$I for all to authenticated using (e_gestao()) with check (e_gestao())', t);
  end loop;
end $$;

-- ---------- Perfis ----------
create policy perfis_ler on perfis for select to authenticated using (pode_ver_perfil(id));
create policy perfis_gestao on perfis for all to authenticated using (e_gestao()) with check (e_gestao());
create policy perfis_gerente_upd on perfis for update to authenticated using (gerencio(id)) with check (gerencio(id));

create policy gl_ler on gerente_lojas for select to authenticated using (gerente_id = auth.uid() or e_gestao());
create policy gl_gestao on gerente_lojas for all to authenticated using (e_gestao()) with check (e_gestao());

-- ---------- Cursos e conteúdo ----------
create or replace function curso_visivel(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select e_gestao()
      or exists (select 1 from cursos where id = c and status = 'publicado')
      or exists (select 1 from atribuicoes where curso_id = c and perfil_id = auth.uid())
$$;

create policy cursos_ler on cursos for select to authenticated using (curso_visivel(id));
create policy cursos_gestao on cursos for all to authenticated using (e_gestao()) with check (e_gestao());
create policy cc_ler on curso_cargos for select to authenticated using (true);
create policy cc_gestao on curso_cargos for all to authenticated using (e_gestao()) with check (e_gestao());
create policy modulos_ler on modulos for select to authenticated using (curso_visivel(curso_id));
create policy modulos_gestao on modulos for all to authenticated using (e_gestao()) with check (e_gestao());
create policy aulas_ler on aulas for select to authenticated using (exists (select 1 from modulos m where m.id = modulo_id and curso_visivel(m.curso_id)));
create policy aulas_gestao on aulas for all to authenticated using (e_gestao()) with check (e_gestao());
create policy materiais_ler on materiais for select to authenticated using (curso_id is null or curso_visivel(curso_id));
create policy materiais_gestao on materiais for all to authenticated using (e_gestao()) with check (e_gestao());

-- ---------- Avaliações (gabarito escondido do funcionário) ----------
create policy av_ler on avaliacoes for select to authenticated using (curso_id is null or curso_visivel(curso_id));
create policy av_gestao on avaliacoes for all to authenticated using (e_gestao()) with check (e_gestao());
create policy q_ler on questoes for select to authenticated using (true);
create policy q_gestao on questoes for all to authenticated using (e_gestao()) with check (e_gestao());
create policy alt_ler on alternativas for select to authenticated using (true);
create policy alt_gestao on alternativas for all to authenticated using (e_gestao()) with check (e_gestao());
revoke select on alternativas from authenticated, anon;
grant select (id, questao_id, texto, ordem) on alternativas to authenticated;

create policy tent_ler on tentativas for select to authenticated using (pode_ver_perfil(perfil_id));
create policy resp_ler on respostas for select to authenticated using (exists (select 1 from tentativas t where t.id = tentativa_id and pode_ver_perfil(t.perfil_id)));
create policy resp_corrigir on respostas for update to authenticated using (e_gestao()) with check (e_gestao());
create policy tx_ler on tentativas_extras for select to authenticated using (pode_ver_perfil(perfil_id));
create policy tx_gestao on tentativas_extras for all to authenticated using (e_gestao()) with check (e_gestao());

-- ---------- Atribuições, progresso, integração, certificados ----------
create policy atr_ler on atribuicoes for select to authenticated using (pode_ver_perfil(perfil_id));
create policy atr_gestao on atribuicoes for all to authenticated using (gerencio(perfil_id)) with check (gerencio(perfil_id));
create policy pa_ler on progresso_aulas for select to authenticated using (pode_ver_perfil(perfil_id));
create policy int_ler on integracoes for select to authenticated using (pode_ver_perfil(perfil_id));
create policy int_gestao on integracoes for all to authenticated using (gerencio(perfil_id)) with check (gerencio(perfil_id));
create policy cert_ler on certificados for select to authenticated using (pode_ver_perfil(perfil_id));

-- ---------- Calendário ----------
create policy ev_ler on eventos for select to authenticated using (loja_id is null or loja_id in (select lojas_visiveis()));
create policy ev_gestao on eventos for all to authenticated using (e_gestao() or (meu_papel() = 'gerente' and loja_id in (select lojas_visiveis())))
  with check (e_gestao() or (meu_papel() = 'gerente' and loja_id in (select lojas_visiveis())));

-- ---------- Checklists ----------
create policy ce_ler on checklist_execucoes for select to authenticated using (loja_id in (select lojas_visiveis()) or responsavel_id = auth.uid());
create policy ce_inserir on checklist_execucoes for insert to authenticated with check (loja_id in (select lojas_visiveis()) and responsavel_id = auth.uid());
create policy ce_editar on checklist_execucoes for update to authenticated using (responsavel_id = auth.uid() or e_gestao() or (meu_papel() = 'gerente' and loja_id in (select lojas_visiveis())));
create policy cr_ler on checklist_respostas for select to authenticated using (exists (select 1 from checklist_execucoes e where e.id = execucao_id and (e.loja_id in (select lojas_visiveis()) or e.responsavel_id = auth.uid())));
create policy cr_escrever on checklist_respostas for all to authenticated
  using (exists (select 1 from checklist_execucoes e where e.id = execucao_id and (e.responsavel_id = auth.uid() or e_gestao())))
  with check (exists (select 1 from checklist_execucoes e where e.id = execucao_id and (e.responsavel_id = auth.uid() or e_gestao())));

-- ---------- Comunicação ----------
create or replace function comunicado_para_mim(c comunicados) returns boolean
language sql stable security definer set search_path = public as $$
  select e_gestao() or (c.publicar_em <= now() and exists (
    select 1 from perfis p where p.id = auth.uid()
      and (c.alvo_lojas   is null or cardinality(c.alvo_lojas)   = 0 or p.loja_id  = any(c.alvo_lojas))
      and (c.alvo_setores is null or cardinality(c.alvo_setores) = 0 or p.setor_id = any(c.alvo_setores))
      and (c.alvo_cargos  is null or cardinality(c.alvo_cargos)  = 0 or p.cargo_id = any(c.alvo_cargos))
      and (c.alvo_perfis  is null or cardinality(c.alvo_perfis)  = 0 or p.id       = any(c.alvo_perfis))))
$$;
create policy com_ler on comunicados for select to authenticated using (comunicado_para_mim(comunicados));
create policy com_gestao on comunicados for all to authenticated using (e_gestao()) with check (e_gestao());
create policy cl_ler on comunicado_leituras for select to authenticated using (perfil_id = auth.uid() or e_gestao() or gerencio(perfil_id));
create policy cl_inserir on comunicado_leituras for insert to authenticated with check (perfil_id = auth.uid());
create policy not_ler on notificacoes for select to authenticated using (perfil_id = auth.uid());
create policy not_marcar on notificacoes for update to authenticated using (perfil_id = auth.uid()) with check (perfil_id = auth.uid());
create policy not_apagar on notificacoes for delete to authenticated using (perfil_id = auth.uid());
create policy not_gestao on notificacoes for insert to authenticated with check (e_gestao() or meu_papel() = 'gerente');

-- ---------- Gamificação ----------
create policy pl_ler on pontos_lancamentos for select to authenticated using (pode_ver_perfil(perfil_id));
create policy pl_gestao on pontos_lancamentos for insert to authenticated with check (e_gestao());
create policy pm_ler on perfil_medalhas for select to authenticated using (true);
create policy pm_gestao on perfil_medalhas for all to authenticated using (e_gestao()) with check (e_gestao());
create policy dp_ler on desafio_participacoes for select to authenticated using (pode_ver_perfil(perfil_id));
create policy dp_entrar on desafio_participacoes for insert to authenticated with check (perfil_id = auth.uid() and concluido = false);
create policy dp_validar on desafio_participacoes for update to authenticated using (gerencio(perfil_id)) with check (gerencio(perfil_id));
create policy metas_ler on metas for select to authenticated using ((perfil_id is not null and pode_ver_perfil(perfil_id)) or (perfil_id is null and (loja_id is null or loja_id in (select lojas_visiveis()))));
create policy metas_gestao on metas for all to authenticated
  using (e_gestao() or (meu_papel() = 'gerente' and (loja_id in (select lojas_visiveis()) or gerencio(perfil_id))))
  with check (e_gestao() or (meu_papel() = 'gerente' and (loja_id in (select lojas_visiveis()) or gerencio(perfil_id))));

-- ---------- Desenvolvimento ----------
create policy ad_ler on avaliacoes_desempenho for select to authenticated using (pode_ver_perfil(perfil_id));
create policy ad_escrever on avaliacoes_desempenho for all to authenticated using (gerencio(perfil_id)) with check (gerencio(perfil_id));
create policy pr_ler on promocoes for select to authenticated using (pode_ver_perfil(perfil_id));
create policy pr_gestao on promocoes for all to authenticated using (e_gestao()) with check (e_gestao());
create policy nd_ler on necessidades_desenvolvimento for select to authenticated using (pode_ver_perfil(perfil_id));
create policy nd_escrever on necessidades_desenvolvimento for all to authenticated using (gerencio(perfil_id)) with check (gerencio(perfil_id));

-- ---------- Pesquisas ----------
create policy pq_ler on pesquisas for select to authenticated using (e_gestao() or (ativa and (alvo_lojas is null or cardinality(alvo_lojas) = 0 or exists (select 1 from perfis p where p.id = auth.uid() and p.loja_id = any(alvo_lojas)))));
create policy pq_gestao on pesquisas for all to authenticated using (e_gestao()) with check (e_gestao());
create policy pp_ler on pesquisa_perguntas for select to authenticated using (true);
create policy pp_gestao on pesquisa_perguntas for all to authenticated using (e_gestao()) with check (e_gestao());
create policy ppart_ler on pesquisa_participantes for select to authenticated using (perfil_id = auth.uid() or e_gestao());
create policy presp_ler on pesquisa_respostas for select to authenticated using (e_gestao());

-- ---------- Auditoria e acessos ----------
create policy aud_ler on auditoria for select to authenticated using (e_admin());
create policy acc_inserir on acessos for insert to authenticated with check (perfil_id = auth.uid());
create policy acc_ler on acessos for select to authenticated using (e_gestao() or perfil_id = auth.uid());
