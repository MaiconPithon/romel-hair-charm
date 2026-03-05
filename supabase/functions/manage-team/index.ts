import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Não autorizado");
    
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !caller) throw new Error("Não autorizado");

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: caller.id, _role: "admin" });
    if (!isAdmin) throw new Error("Acesso negado");

    const { action, email, password, user_id } = await req.json();

    if (action === "create") {
      if (!email || !password) throw new Error("Email e senha obrigatórios");
      
      const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createError) throw createError;

      const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
        user_id: userData.user.id,
        role: "admin",
      });
      if (roleError) throw roleError;

      return new Response(JSON.stringify({ success: true, user: { id: userData.user.id, email } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { data: roles, error: rolesError } = await supabaseAdmin
        .from("user_roles")
        .select("user_id, role, id")
        .eq("role", "admin");
      if (rolesError) throw rolesError;

      const users = [];
      for (const role of roles || []) {
        const { data: { user }, error } = await supabaseAdmin.auth.admin.getUserById(role.user_id);
        if (!error && user) {
          users.push({
            id: user.id,
            email: user.email,
            created_at: user.created_at,
            role_id: role.id,
          });
        }
      }

      return new Response(JSON.stringify({ success: true, users }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!user_id) throw new Error("user_id obrigatório");
      if (user_id === caller.id) throw new Error("Você não pode remover a si mesmo");

      await supabaseAdmin.from("user_roles").delete().eq("user_id", user_id).eq("role", "admin");
      await supabaseAdmin.auth.admin.deleteUser(user_id);

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update-password") {
      if (!user_id || !password) throw new Error("user_id e password obrigatórios");
      
      const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password });
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Ação inválida");
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
