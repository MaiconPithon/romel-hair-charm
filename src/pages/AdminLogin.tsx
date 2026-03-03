import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Home } from "lucide-react";

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

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Digite seu email primeiro.");
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("Email de recuperação enviado!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar email.");
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast.error("Digite seu email primeiro.");
      return;
    }
    try {
      const { error } = await supabase.auth.signInWithOtp({ email });
      if (error) throw error;
      toast.success("Link mágico enviado para seu email!");
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar link.");
    }
  };

  return (
    <div className="dark flex min-h-screen items-center justify-center bg-background px-4">
      <form onSubmit={handleLogin} className="w-full max-w-sm space-y-5 rounded-xl border border-border bg-card p-8">
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-2xl font-bold text-primary italic" style={{ fontFamily: 'Playfair Display, serif' }}>
            Área do Barbeiro
          </h1>
          <Link to="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Home className="h-4 w-4" /> Página Inicial
          </Link>
        </div>

        <Button type="button" variant="outline" className="w-full font-bold text-foreground" disabled>
          Entrar
        </Button>

        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium text-primary mb-1 block">Email</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-background border-border text-white placeholder:text-muted-foreground"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-primary mb-1 block">Senha</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-background border-border text-white placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <Button type="submit" className="w-full rounded-full font-bold bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>

        <div className="flex flex-col items-center gap-1">
          <button type="button" onClick={handleForgotPassword} className="text-sm font-semibold text-primary hover:underline">
            Esqueci minha senha
          </button>
          <button type="button" onClick={handleMagicLink} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Entrar com link mágico (sem senha)
          </button>
        </div>
      </form>
    </div>
  );
};

export default AdminLogin;
