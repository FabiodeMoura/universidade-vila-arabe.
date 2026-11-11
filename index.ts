// Universidade Vila Árabe · cadastro de logins (RH, admin e gerente)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

function senhaAleatoria() {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  let s = "";
  for (const b of crypto.getRandomValues(new Uint8Array(8))) s += c[b % c.length];
  return "Va@" + s;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(url, service, { auth: { persistSession: false } });

    // quem está chamando
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u, error: ue } = await admin.auth.getUser(token);
    if (ue || !u?.user) return json({ erro: "Sessão inválida. Entre novamente." }, 401);
    const { data: eu } = await admin.from("perfis").select("id,papel,loja_id,ativo").eq("id", u.user.id).single();
    if (!eu || !eu.ativo) return json({ erro: "Usuário sem acesso." }, 403);
    const gestao = eu.papel === "admin" || eu.papel === "rh";
    if (!gestao && eu.papel !== "gerente") return json({ erro: "Sem permissão." }, 403);

    const body = await req.json();
    const acao = body.acao || "criar";

    // lojas que o gerente pode administrar
    let lojasGerente: string[] = [];
    if (!gestao) {
      const { data: gl } = await admin.from("gerente_lojas").select("loja_id").eq("gerente_id", eu.id);
      const { data: lg } = await admin.from("lojas").select("id").eq("gerente_id", eu.id);
      lojasGerente = [eu.loja_id, ...(gl || []).map((x) => x.loja_id), ...(lg || []).map((x) => x.id)].filter(Boolean);
    }
    const podeMexer = async (perfilId: string) => {
      const { data: alvo } = await admin.from("perfis").select("id,papel,loja_id").eq("id", perfilId).single();
      if (!alvo) return null;
      if (eu.papel === "admin") return alvo;
      if (eu.papel === "rh") return alvo.papel === "admin" ? null : alvo;
      return alvo.papel === "funcionario" && lojasGerente.includes(alvo.loja_id) ? alvo : null;
    };

    if (acao === "criar") {
      const d = body.dados || {};
      const nome = String(d.nome || "").trim();
      const matricula = String(d.matricula || "").trim();
      if (!nome) return json({ erro: "Informe o nome." }, 400);
      if (!matricula && !d.email) return json({ erro: "Informe a matrícula ou o e-mail." }, 400);
      let papel = d.papel || "funcionario";
      if (!gestao) papel = "funcionario";
      if (eu.papel === "rh" && papel === "admin") return json({ erro: "Somente o administrador cria outro administrador." }, 403);
      if (!gestao && !lojasGerente.includes(d.loja_id)) return json({ erro: "Você só pode cadastrar na sua loja." }, 403);
      if (matricula) {
        const { data: ja } = await admin.from("perfis").select("id").eq("matricula", matricula).maybeSingle();
        if (ja) return json({ erro: `A matrícula ${matricula} já está cadastrada.` }, 409);
      }
      const email = String(d.email || "").trim().toLowerCase() ||
        `${matricula.replace(/[^a-zA-Z0-9]/g, "")}@matricula.vilaarabe.local`;
      const senha = String(d.senha || "").length >= 6 ? String(d.senha) : senhaAleatoria();

      const { data: novo, error: ce } = await admin.auth.admin.createUser({
        email, password: senha, email_confirm: true, user_metadata: { nome },
      });
      if (ce) {
        const msg = /already|registered|exists/i.test(ce.message) ? "Este e-mail já tem login." : ce.message;
        return json({ erro: msg }, 400);
      }
      const reg = {
        id: novo.user.id, nome, matricula: matricula || null, email, papel,
        cpf: d.cpf || null, telefone: d.telefone || null,
        loja_id: d.loja_id || null, cargo_id: d.cargo_id || null, setor_id: d.setor_id || null,
        gerente_id: d.gerente_id || (!gestao ? eu.id : null), responsavel_id: d.responsavel_id || null,
        data_admissao: d.data_admissao || null,
      };
      const { error: pe } = await admin.from("perfis").insert(reg);
      if (pe) {
        await admin.auth.admin.deleteUser(novo.user.id);
        return json({ erro: "Não foi possível salvar: " + pe.message }, 400);
      }
      await admin.from("auditoria").insert({ perfil_id: eu.id, acao: "criar_usuario", tabela: "perfis", registro_id: novo.user.id, dados: { ...reg, cpf: undefined } });
      const { count } = await admin.from("atribuicoes").select("id", { count: "exact", head: true }).eq("perfil_id", novo.user.id);
      return json({ ok: true, id: novo.user.id, email, senha, treinamentos: count || 0 });
    }

    if (acao === "redefinir_senha") {
      const alvo = await podeMexer(body.perfil_id);
      if (!alvo) return json({ erro: "Sem permissão para este usuário." }, 403);
      const senha = String(body.senha || "").length >= 6 ? String(body.senha) : senhaAleatoria();
      const { error } = await admin.auth.admin.updateUserById(alvo.id, { password: senha });
      if (error) return json({ erro: error.message }, 400);
      await admin.from("auditoria").insert({ perfil_id: eu.id, acao: "redefinir_senha", tabela: "perfis", registro_id: alvo.id });
      return json({ ok: true, senha });
    }

    if (acao === "inativar" || acao === "reativar") {
      const alvo = await podeMexer(body.perfil_id);
      if (!alvo) return json({ erro: "Sem permissão para este usuário." }, 403);
      if (alvo.id === eu.id) return json({ erro: "Você não pode inativar a si mesmo." }, 400);
      const ativo = acao === "reativar";
      await admin.auth.admin.updateUserById(alvo.id, { ban_duration: ativo ? "none" : "876000h" });
      await admin.from("perfis").update({ ativo }).eq("id", alvo.id);
      await admin.from("auditoria").insert({ perfil_id: eu.id, acao, tabela: "perfis", registro_id: alvo.id });
      return json({ ok: true });
    }

    if (acao === "alterar_email") {
      const alvo = await podeMexer(body.perfil_id);
      if (!alvo) return json({ erro: "Sem permissão para este usuário." }, 403);
      const email = String(body.email || "").trim().toLowerCase();
      if (!email.includes("@")) return json({ erro: "E-mail inválido." }, 400);
      const { error } = await admin.auth.admin.updateUserById(alvo.id, { email, email_confirm: true });
      if (error) return json({ erro: error.message }, 400);
      await admin.from("perfis").update({ email }).eq("id", alvo.id);
      return json({ ok: true });
    }

    return json({ erro: "Ação desconhecida." }, 400);
  } catch (e) {
    return json({ erro: String(e?.message || e) }, 500);
  }
});
