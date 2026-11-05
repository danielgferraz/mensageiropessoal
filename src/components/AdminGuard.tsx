import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, ShieldAlert, Lock, ArrowLeft, Loader2, KeyRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AdminGuardProps {
  children: React.ReactNode;
}

export const AdminGuard: React.FC<AdminGuardProps> = ({ children }) => {
  const { user, loading, isAdmin, error, login, logout } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setLocalError('Preencha o e-mail e a senha.');
      return;
    }

    setSubmitting(true);
    setLocalError(null);
    const success = await login(email, password);
    setSubmitting(false);

    if (!success) {
      setLocalError(error || 'Não foi possível autenticar como Administrador.');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#111b21] text-gray-200">
        <div className="relative mb-4">
          <div className="w-16 h-16 rounded-full border-4 border-emerald-500/20 border-t-emerald-500 animate-spin flex items-center justify-center" />
          <ShieldCheck className="w-7 h-7 text-emerald-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
        </div>
        <h2 className="text-lg font-medium text-white mb-1">TechAgenda Mensageiro</h2>
        <p className="text-sm text-gray-400">Validando credenciais e políticas de Administrador...</p>
      </div>
    );
  }

  // Se já está logado e é Admin, libera o app
  if (isAdmin && user) {
    return <>{children}</>;
  }

  // Se logado mas NÃO é Admin (acesso negado)
  if (user && !isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c1317] p-4 text-gray-200">
        <div className="w-full max-w-md bg-[#111b21] border border-red-500/30 rounded-2xl p-8 shadow-2xl text-center">
          <div className="w-16 h-16 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-center mx-auto mb-6 text-red-400">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Acesso Restrito</h2>
          <p className="text-gray-400 text-sm mb-6 leading-relaxed">
            A sua conta <strong className="text-white">{user.email}</strong> não possui privilégios de Administrador.
            O Mensageiro Pessoal e suas integrações (WhatsApp / Antigravity) são exclusivos para a administração do TechAgenda.
          </p>

          <div className="bg-[#202c33] p-4 rounded-xl text-xs text-gray-300 text-left mb-6 border border-gray-700/50">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-gray-400">Perfil detectado:</span>
              <span className="px-2 py-0.5 rounded bg-gray-700 text-amber-300 uppercase font-mono text-[10px] tracking-wide">
                {user.role}
              </span>
            </div>
            <div>
              <span className="font-semibold text-gray-400">Usuário:</span> {user.fullName || user.email}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={logout}
              className="w-full border-gray-700 hover:bg-[#202c33] text-gray-200"
            >
              <KeyRound className="w-4 h-4 mr-2 text-emerald-400" />
              Entrar com outra conta
            </Button>

            <Button
              variant="ghost"
              onClick={() => (window.location.href = '/')}
              className="w-full text-gray-400 hover:text-white"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Voltar ao TechAgenda
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Formulário de Login para Administrador
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#0c1317] p-4 text-gray-200">
      <div className="w-full max-w-md bg-[#111b21] border border-emerald-500/20 rounded-2xl p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-center mx-auto mb-4 text-emerald-400">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Área do Administrador</h1>
          <p className="text-sm text-gray-400 mt-1">
            Autentique-se com sua conta de administrador TechAgenda para acessar o Mensageiro.
          </p>
        </div>

        {(localError || error) && (
          <div className="mb-6 p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm flex items-start gap-2">
            <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{localError || error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5 text-left">
            <Label htmlFor="admin-email" className="text-xs text-gray-300 font-medium">
              E-mail de Administrador
            </Label>
            <Input
              id="admin-email"
              type="email"
              placeholder="admin@techagenda.app.br"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-[#202c33] border-gray-700 text-white placeholder:text-gray-500 focus:border-emerald-500"
            />
          </div>

          <div className="space-y-1.5 text-left">
            <Label htmlFor="admin-password" className="text-xs text-gray-300 font-medium">
              Senha
            </Label>
            <Input
              id="admin-password"
              type="password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="bg-[#202c33] border-gray-700 text-white placeholder:text-gray-500 focus:border-emerald-500"
            />
          </div>

          <Button
            type="submit"
            disabled={submitting}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium py-2 rounded-xl transition duration-150 flex items-center justify-center gap-2 mt-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Validando Acesso...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                Entrar no Mensageiro
              </>
            )}
          </Button>
        </form>

        <div className="mt-6 pt-4 border-t border-gray-800 text-center">
          <button
            type="button"
            onClick={() => (window.location.href = '/')}
            className="text-xs text-gray-400 hover:text-gray-200 transition inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Voltar para a página inicial do TechAgenda
          </button>
        </div>
      </div>
    </div>
  );
};
