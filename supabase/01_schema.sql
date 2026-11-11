-- =====================================================================
-- UNIVERSIDADE VILA ÁRABE · Estrutura completa do banco de dados
-- =====================================================================
create extension if not exists pgcrypto;

-- ---------- Tipos ----------
create type papel_usuario   as enum ('admin','rh','gerente','funcionario');
create type status_curso    as enum ('rascunho','publicado','arquivado');
create type status_atrib    as enum ('nao_iniciado','em_andamento','concluido','aprovado','reprovado');
create type tipo_aula       as enum ('video','texto','pdf','apresentacao','imagem','link');
create type tipo_questao    as enum ('multipla','vf','escrita');
create type tipo_trilha     as enum ('integracao','obrigatorio','funcao','desenvolvimento','complementar','promocao');

-- ---------- Estrutura organizacional ----------
create table lojas (
  id          uuid primary key default gen_random_uuid(),
  numero      int,
  nome        text not null,
  apelido     text,
  cidade      text default 'Belo Horizonte',
  endereco    text,
  gerente_id  uuid,
  ativo       boolean not null default true,
  created_at  timestamptz not null default now()
);

create table setores (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  created_at timestamptz not null default now()
);

create table cargos (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null unique,
  setor_id   uuid references setores(id) on delete set null,
  descricao  text,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create table perfis (
  id               uuid primary key references auth.users(id) on delete cascade,
  nome             text not null,
  matricula        text unique,
  cpf              text,
  email            text,
  telefone         text,
  papel            papel_usuario not null default 'funcionario',
  loja_id          uuid references lojas(id) on delete set null,
  cargo_id         uuid references cargos(id) on delete set null,
  setor_id         uuid references setores(id) on delete set null,
  gerente_id       uuid references perfis(id) on delete set null,
  responsavel_id   uuid references perfis(id) on delete set null,
  data_admissao    date,
  foto_url         text,
  pontos           int not null default 0,
  ativo            boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
alter table lojas add constraint lojas_gerente_fk foreign key (gerente_id) references perfis(id) on delete set null;

-- lojas que cada gerente pode ver (além da loja dele)
create table gerente_lojas (
  gerente_id uuid references perfis(id) on delete cascade,
  loja_id    uuid references lojas(id) on delete cascade,
  primary key (gerente_id, loja_id)
);

-- ---------- Cursos ----------
create table categorias (
  id     uuid primary key default gen_random_uuid(),
  nome   text not null unique,
  icone  text default '📘',
  cor    text default '#1f4d3a',
  ordem  int not null default 0
);

create table cursos (
  id                 uuid primary key default gen_random_uuid(),
  titulo             text not null,
  descricao          text,
  objetivo           text,
  publico_alvo       text,
  capa_url           text,
  categoria_id       uuid references categorias(id) on delete set null,
  carga_horaria_min  int not null default 60,
  prazo_dias         int not null default 30,
  nota_minima        int not null default 70 check (nota_minima between 0 and 100),
  exige_sequencia    boolean not null default true,
  manual_consulta    text,
  responsavel_nome   text default 'RH Vila Árabe',
  status             status_curso not null default 'rascunho',
  created_by         uuid references perfis(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table curso_cargos (
  curso_id uuid references cursos(id) on delete cascade,
  cargo_id uuid references cargos(id) on delete cascade,
  primary key (curso_id, cargo_id)
);

create table modulos (
  id        uuid primary key default gen_random_uuid(),
  curso_id  uuid not null references cursos(id) on delete cascade,
  titulo    text not null,
  ordem     int not null default 0
);

create table aulas (
  id                       uuid primary key default gen_random_uuid(),
  modulo_id                uuid not null references modulos(id) on delete cascade,
  titulo                   text not null,
  tipo                     tipo_aula not null default 'video',
  conteudo                 text,
  url                      text,
  arquivo_path             text,
  duracao_seg              int default 0,
  exige_assistir_completo  boolean not null default true,
  ordem                    int not null default 0
);

create table materiais (
  id           uuid primary key default gen_random_uuid(),
  curso_id     uuid references cursos(id) on delete cascade,
  titulo       text not null,
  tipo         text not null default 'apostila',   -- apostila, apresentacao, complementar, manual
  url          text,
  arquivo_path text,
  created_at   timestamptz not null default now()
);

-- ---------- Avaliações ----------
create table avaliacoes (
  id                 uuid primary key default gen_random_uuid(),
  curso_id           uuid references cursos(id) on delete cascade,
  titulo             text not null,
  instrucoes         text,
  nota_minima        int not null default 70 check (nota_minima between 0 and 100),
  tentativas_max     int not null default 3,
  tempo_limite_min   int,
  embaralhar         boolean not null default true,
  mostrar_resultado  boolean not null default true,
  ativa              boolean not null default true,
  created_at         timestamptz not null default now()
);

create table questoes (
  id            uuid primary key default gen_random_uuid(),
  avaliacao_id  uuid not null references avaliacoes(id) on delete cascade,
  tipo          tipo_questao not null default 'multipla',
  enunciado     text not null,
  imagem_url    text,
  pontos        numeric(6,2) not null default 10,
  ordem         int not null default 0
);

create table alternativas (
  id          uuid primary key default gen_random_uuid(),
  questao_id  uuid not null references questoes(id) on delete cascade,
  texto       text not null,
  correta     boolean not null default false,
  ordem       int not null default 0
);

create table tentativas (
  id             uuid primary key default gen_random_uuid(),
  avaliacao_id   uuid not null references avaliacoes(id) on delete cascade,
  perfil_id      uuid not null references perfis(id) on delete cascade,
  iniciada_em    timestamptz not null default now(),
  finalizada_em  timestamptz,
  nota           numeric(5,2),
  aprovado       boolean,
  status         text not null default 'em_andamento'  -- em_andamento, finalizada, aguardando_correcao
);

create table respostas (
  id              uuid primary key default gen_random_uuid(),
  tentativa_id    uuid not null references tentativas(id) on delete cascade,
  questao_id      uuid not null references questoes(id) on delete cascade,
  alternativa_id  uuid references alternativas(id) on delete set null,
  texto           text,
  correta         boolean,
  pontos_obtidos  numeric(6,2) default 0,
  unique (tentativa_id, questao_id)
);

create table tentativas_extras (
  id            uuid primary key default gen_random_uuid(),
  avaliacao_id  uuid not null references avaliacoes(id) on delete cascade,
  perfil_id     uuid not null references perfis(id) on delete cascade,
  quantidade    int not null default 1,
  liberado_por  uuid references perfis(id) on delete set null,
  created_at    timestamptz not null default now()
);

-- ---------- Trilhas e atribuições ----------
create table trilhas (
  id         uuid primary key default gen_random_uuid(),
  nome       text not null,
  descricao  text,
  tipo       tipo_trilha not null default 'funcao',
  cargo_id   uuid references cargos(id) on delete cascade,  -- null = vale para todos os cargos
  automatica boolean not null default true,                 -- atribui sozinha ao cadastrar alguém do cargo
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create table trilha_cursos (
  trilha_id  uuid references trilhas(id) on delete cascade,
  curso_id   uuid references cursos(id) on delete cascade,
  ordem      int not null default 0,
  prazo_dias int,
  primary key (trilha_id, curso_id)
);

create table atribuicoes (
  id             uuid primary key default gen_random_uuid(),
  curso_id       uuid not null references cursos(id) on delete cascade,
  perfil_id      uuid not null references perfis(id) on delete cascade,
  trilha_id      uuid references trilhas(id) on delete set null,
  origem         text not null default 'individual', -- individual, cargo, setor, loja, todos, trilha, reciclagem
  obrigatorio    boolean not null default true,
  prazo          date,
  status         status_atrib not null default 'nao_iniciado',
  progresso      int not null default 0,
  nota           numeric(5,2),
  iniciado_em    timestamptz,
  concluido_em   timestamptz,
  atribuido_por  uuid references perfis(id) on delete set null,
  created_at     timestamptz not null default now(),
  unique (curso_id, perfil_id)
);

create table progresso_aulas (
  perfil_id    uuid references perfis(id) on delete cascade,
  aula_id      uuid references aulas(id) on delete cascade,
  percentual   int not null default 0 check (percentual between 0 and 100),
  posicao_seg  int not null default 0,
  concluida    boolean not null default false,
  updated_at   timestamptz not null default now(),
  primary key (perfil_id, aula_id)
);

create table integracoes (
  id                uuid primary key default gen_random_uuid(),
  perfil_id         uuid not null unique references perfis(id) on delete cascade,
  trilha_id         uuid references trilhas(id) on delete set null,
  responsavel_id    uuid references perfis(id) on delete set null,
  data_inicio       date not null default current_date,
  data_prevista     date,
  data_conclusao    date,
  avaliacao_gerente text,
  nota_gerente      int check (nota_gerente between 0 and 10),
  resultado         text not null default 'pendente'  -- pendente, aprovado, reprovado
);

create table certificados (
  id                uuid primary key default gen_random_uuid(),
  codigo            text not null unique default upper(substr(replace(gen_random_uuid()::text,'-',''),1,10)),
  perfil_id         uuid not null references perfis(id) on delete cascade,
  curso_id          uuid not null references cursos(id) on delete cascade,
  nota              numeric(5,2),
  carga_horaria_min int,
  responsavel_nome  text,
  emitido_em        timestamptz not null default now(),
  unique (perfil_id, curso_id)
);

-- ---------- Calendário e checklists ----------
create table eventos (
  id             uuid primary key default gen_random_uuid(),
  titulo         text not null,
  tipo           text not null default 'treinamento', -- treinamento, reciclagem, reuniao, avaliacao, desafio, inspecao, limpeza, presencial, integracao
  descricao      text,
  inicio         timestamptz not null,
  fim            timestamptz,
  prazo          date,
  responsavel_id uuid references perfis(id) on delete set null,
  loja_id        uuid references lojas(id) on delete cascade,      -- null = todas as lojas
  publico        text,
  concluido      boolean not null default false,
  created_by     uuid references perfis(id) on delete set null,
  created_at     timestamptz not null default now()
);

create table checklist_modelos (
  id        uuid primary key default gen_random_uuid(),
  nome      text not null,
  descricao text,
  setor_id  uuid references setores(id) on delete set null,
  ativo     boolean not null default true
);

create table checklist_itens (
  id         uuid primary key default gen_random_uuid(),
  modelo_id  uuid not null references checklist_modelos(id) on delete cascade,
  texto      text not null,
  ordem      int not null default 0
);

create table checklist_execucoes (
  id              uuid primary key default gen_random_uuid(),
  modelo_id       uuid not null references checklist_modelos(id) on delete cascade,
  loja_id         uuid not null references lojas(id) on delete cascade,
  responsavel_id  uuid references perfis(id) on delete set null,
  realizado_em    timestamptz not null default now(),
  observacoes     text,
  nao_conformes   int not null default 0,
  finalizado      boolean not null default false
);

create table checklist_respostas (
  execucao_id  uuid references checklist_execucoes(id) on delete cascade,
  item_id      uuid references checklist_itens(id) on delete cascade,
  status       text not null default 'ok',  -- ok, nao_conforme, na
  observacao   text,
  foto_path    text,
  primary key (execucao_id, item_id)
);

-- ---------- Comunicação ----------
create table comunicados (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  corpo        text not null,
  tipo         text not null default 'geral', -- geral, politica, beneficio, campanha, aniversario, aviso, treinamento, reconhecimento, evento
  imagem_url   text,
  alvo_lojas   uuid[],
  alvo_setores uuid[],
  alvo_cargos  uuid[],
  alvo_perfis  uuid[],
  publicar_em  timestamptz not null default now(),
  autor_id     uuid references perfis(id) on delete set null,
  created_at   timestamptz not null default now()
);

create table comunicado_leituras (
  comunicado_id uuid references comunicados(id) on delete cascade,
  perfil_id     uuid references perfis(id) on delete cascade,
  lido_em       timestamptz not null default now(),
  primary key (comunicado_id, perfil_id)
);

create table notificacoes (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references perfis(id) on delete cascade,
  tipo       text not null,
  titulo     text not null,
  mensagem   text,
  link       text,
  lida       boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Gamificação ----------
create table regras_pontuacao (
  chave     text primary key,
  descricao text not null,
  pontos    int not null
);

create table pontos_lancamentos (
  id          uuid primary key default gen_random_uuid(),
  perfil_id   uuid not null references perfis(id) on delete cascade,
  regra       text not null,
  pontos      int not null,
  referencia  uuid,
  descricao   text,
  created_at  timestamptz not null default now()
);

create table medalhas (
  id        uuid primary key default gen_random_uuid(),
  codigo    text unique,
  nome      text not null,
  descricao text,
  icone     text default '🏅'
);

create table perfil_medalhas (
  perfil_id      uuid references perfis(id) on delete cascade,
  medalha_id     uuid references medalhas(id) on delete cascade,
  conquistada_em timestamptz not null default now(),
  primary key (perfil_id, medalha_id)
);

create table desafios (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  descricao  text,
  mes        date not null default date_trunc('month', now())::date,
  pontos     int not null default 100,
  loja_id    uuid references lojas(id) on delete cascade,
  ativo      boolean not null default true,
  created_at timestamptz not null default now()
);

create table desafio_participacoes (
  desafio_id   uuid references desafios(id) on delete cascade,
  perfil_id    uuid references perfis(id) on delete cascade,
  concluido    boolean not null default false,
  concluido_em timestamptz,
  validado_por uuid references perfis(id) on delete set null,
  primary key (desafio_id, perfil_id)
);

create table metas (
  id         uuid primary key default gen_random_uuid(),
  titulo     text not null,
  tipo       text not null default 'individual', -- individual, coletiva
  perfil_id  uuid references perfis(id) on delete cascade,
  loja_id    uuid references lojas(id) on delete cascade,
  alvo       numeric not null default 100,
  atual      numeric not null default 0,
  prazo      date,
  created_at timestamptz not null default now()
);

-- ---------- Desenvolvimento ----------
create table avaliacoes_desempenho (
  id           uuid primary key default gen_random_uuid(),
  perfil_id    uuid not null references perfis(id) on delete cascade,
  avaliador_id uuid references perfis(id) on delete set null,
  data         date not null default current_date,
  nota         int check (nota between 0 and 10),
  pontos_fortes text,
  melhorias    text,
  feedback     text,
  created_at   timestamptz not null default now()
);

create table promocoes (
  id               uuid primary key default gen_random_uuid(),
  perfil_id        uuid not null references perfis(id) on delete cascade,
  cargo_anterior   uuid references cargos(id) on delete set null,
  cargo_novo       uuid references cargos(id) on delete set null,
  data             date not null default current_date,
  observacao       text
);

create table necessidades_desenvolvimento (
  id         uuid primary key default gen_random_uuid(),
  perfil_id  uuid not null references perfis(id) on delete cascade,
  descricao  text not null,
  registrado_por uuid references perfis(id) on delete set null,
  resolvida  boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------- Pesquisas ----------
create table pesquisas (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descricao   text,
  tipo        text not null default 'clima', -- clima, satisfacao
  anonima     boolean not null default true,
  alvo_lojas  uuid[],
  ativa       boolean not null default true,
  encerra_em  date,
  created_by  uuid references perfis(id) on delete set null,
  created_at  timestamptz not null default now()
);

create table pesquisa_perguntas (
  id          uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references pesquisas(id) on delete cascade,
  texto       text not null,
  tipo        text not null default 'escala', -- escala (1-5), texto, multipla
  opcoes      jsonb,
  ordem       int not null default 0
);

create table pesquisa_participantes (   -- quem já respondeu (sem ligar à resposta quando anônima)
  pesquisa_id uuid references pesquisas(id) on delete cascade,
  perfil_id   uuid references perfis(id) on delete cascade,
  respondido_em timestamptz not null default now(),
  primary key (pesquisa_id, perfil_id)
);

create table pesquisa_respostas (
  id          uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references pesquisas(id) on delete cascade,
  perfil_id   uuid references perfis(id) on delete set null,  -- null quando anônima
  loja_id     uuid references lojas(id) on delete set null,
  respostas   jsonb not null,   -- {pergunta_id: valor}
  created_at  timestamptz not null default now()
);

-- ---------- Configurações, auditoria e acessos ----------
create table configuracoes (
  chave  text primary key,
  valor  jsonb not null
);

create table auditoria (
  id          bigint generated always as identity primary key,
  perfil_id   uuid,
  acao        text not null,
  tabela      text,
  registro_id text,
  dados       jsonb,
  created_at  timestamptz not null default now()
);

create table acessos (
  id         bigint generated always as identity primary key,
  perfil_id  uuid references perfis(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ---------- Índices ----------
create index on perfis(loja_id);
create index on perfis(cargo_id);
create index on perfis(gerente_id);
create index on atribuicoes(perfil_id);
create index on atribuicoes(curso_id);
create index on atribuicoes(status);
create index on modulos(curso_id);
create index on aulas(modulo_id);
create index on questoes(avaliacao_id);
create index on alternativas(questao_id);
create index on tentativas(perfil_id, avaliacao_id);
create index on notificacoes(perfil_id, lida);
create index on pontos_lancamentos(perfil_id, created_at);
create index on checklist_execucoes(loja_id, realizado_em);
create index on eventos(inicio);
create index on comunicados(publicar_em);
