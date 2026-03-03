import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setReady(true);
    }
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada com sucesso!");
      navigate("/admin/login");
    } catch (err: any) {
      toast.error(err.message || "Erro ao redefinir senha.");
    } finally {
      setLoading(false);
    }
  };

  if (!ready) {
    return (
      <div className="dark flex min-h-screen items-center justify-center bg-background text-foreground">
        <p className="text-muted-foreground">Link de recuperação inválido.</p>
      </div>
    );
  }

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={handleReset} className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8">
        <h1 className="text-center text-2xl font-bold text-foreground">Redefinir Senha</h1>
        <Input type="password" placeholder="Nova senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <Button type="submit" className="w-full rounded-full font-bold" disabled={loading}>
          {loading ? "Salvando..." : "Salvar Nova Senha"}
        </Button>
      </form>
    </div>
  );
};

export default ResetPassword;
