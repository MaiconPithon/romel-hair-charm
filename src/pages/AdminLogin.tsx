import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Scissors } from "lucide-react";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check admin role
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não encontrado");
      
      const { data: hasRole } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });

      if (!hasRole) {
        await supabase.auth.signOut();
        toast.error("Acesso não autorizado.");
        return;
      }

      navigate("/admin");
    } catch (err: any) {
      toast.error(err.message || "Erro ao fazer login.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-card p-8">
        <div className="flex flex-col items-center gap-2">
          <Scissors className="h-10 w-10 text-primary" />
          <h1 className="text-2xl font-bold text-foreground">Painel Admin</h1>
        </div>
        <div className="space-y-4">
          <Input type="email" placeholder="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <Input type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <Button type="submit" className="w-full rounded-full font-bold" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>
    </div>
  );
};

export default AdminLogin;
