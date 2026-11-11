# Universidade Vila Árabe

Universidade corporativa da rede Vila Árabe: trilhas por cargo, cursos, avaliações, certificados, pontos e indicadores por loja.

## Como está montado

- **site/** – o site (HTML, CSS e JavaScript puro, sem etapa de build). É publicado no Render como *Static Site* com a pasta de publicação `site`.
- **Banco de dados** – projeto Supabase `universidade-vila-arabe` (região São Paulo). Todas as tabelas, regras de acesso por perfil e regras de negócio já estão aplicadas lá.
- **supabase/** – cópia de referência da estrutura do banco e da função `gerenciar-usuario` (cadastro de logins). Não precisa rodar nada: já está no ar.

## Perfis de acesso

| Perfil | O que vê |
|---|---|
| Administrador geral | Tudo |
| RH / Treinamentos | Tudo, menos criar outro administrador |
| Gerente de loja | Só a(s) loja(s) dele e a equipe |
| Funcionário | Só os próprios dados, trilha e resultados |

## Regras que já funcionam no banco

- Ao cadastrar um funcionário, a trilha de integração e a trilha do cargo são atribuídas sozinhas, com prazo.
- Ao trocar o cargo, a trilha do novo cargo é atribuída.
- Progresso das aulas salvo automaticamente; avaliação corrigida no servidor (o gabarito nunca vai para o navegador).
- Aprovação gera certificado com código de validação, pontos (curso 100, quiz 50, nota ≥ 90 +30, no prazo +20), medalhas e notificações.
- Alertas diários às 07:00: prazo em 3 dias, treinamentos atrasados (para o funcionário e o gerente) e comunicados agendados.
- Registro de alterações administrativas (auditoria) e de acessos.

## Etapas

1. **Base (esta entrega):** banco completo, login com os 4 perfis, painel por perfil, notificações, lojas, cargos/setores, cadastro de funcionários com ficha, integração e gestão de acesso.
2. Treinamentos: criar cursos, aulas, apostilas, quizzes, assistir aulas, fazer avaliação e baixar certificado.
3. Acompanhamento: trilhas, atribuição em massa, Central de Pendências, relatórios em Excel/PDF.
4. Rotina: checklists, calendário, comunicados, pesquisas, ranking, desafios e desempenho gerencial.
