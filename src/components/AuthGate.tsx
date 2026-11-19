import { useState } from 'react';
import { signInWithPopup, signOut, type User } from 'firebase/auth';
import { Building2, CheckCircle2, Lock, LogIn, LogOut, ShieldCheck } from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase';
import type { UserInvite } from '../types/condo';
import { roleLabel } from '../utils/formatters';

interface AuthGateProps {
  firebaseUser: User | null;
  authLoading: boolean;
  pendingInvite: UserInvite | null;
  accessDeniedReason: 'not_invited' | 'inactive' | 'unverified_email' | null;
  onAcceptInvite: (invite: UserInvite) => Promise<void>;
}

export function AuthGate({
  firebaseUser,
  authLoading,
  pendingInvite,
  accessDeniedReason,
  onAcceptInvite,
}: AuthGateProps) {
  const [signingIn, setSigningIn] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setErrorMsg(null);
    setSigningIn(true);
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao autenticar.';
      if (!message.includes('popup-closed-by-user')) {
        setErrorMsg('Não foi possível concluir o login com o Google. Tente novamente.');
      }
    } finally {
      setSigningIn(false);
    }
  };

  const handleAccept = async () => {
    if (!pendingInvite) return;
    setErrorMsg(null);
    setAccepting(true);
    try {
      await onAcceptInvite(pendingInvite);
    } catch {
      setErrorMsg('Erro ao ativar seu convite. Peça ao síndico para verificar o e-mail convidado.');
    } finally {
      setAccepting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white border border-stone-200 rounded-xl p-8">
          <div className="h-5 w-40 bg-stone-200 rounded animate-pulse mb-4" />
          <div className="h-4 w-64 bg-stone-100 rounded animate-pulse mb-2" />
          <div className="h-4 w-52 bg-stone-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-50 flex flex-col justify-center items-center p-6">
      <div className="w-full max-w-4xl grid grid-cols-1 lg:grid-cols-12 bg-white border border-stone-200 rounded-xl overflow-hidden">
        {/* Painel Institucional */}
        <div className="lg:col-span-5 bg-stone-900 text-stone-100 p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2.5 text-amber-400 mb-6">
              <Building2 className="w-6 h-6 shrink-0" />
              <span className="text-sm font-medium tracking-tight">Condomínio Fácil</span>
            </div>
            <h1 className="text-2xl font-semibold text-white tracking-tight text-balance mb-3">
              Condomínio José Cupertino Bicalho
            </h1>
            <p className="text-sm text-stone-300 leading-relaxed">
              Portal financeiro e prestação de contas transparente para as 6 unidades residenciais.
            </p>
          </div>

          <div className="mt-10 pt-6 border-t border-stone-800 space-y-3 text-xs text-stone-300">
            <div className="flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Acesso exclusivo mediante convite autorizado pelo síndico.</span>
            </div>
            <div className="flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <span>Moradores visualizam apenas relatórios publicados e o extrato da própria unidade.</span>
            </div>
          </div>
        </div>

        {/* Painel de Autenticação / Convite */}
        <div className="lg:col-span-7 p-8 lg:p-10 flex flex-col justify-center">
          {!firebaseUser ? (
            <div>
              <h2 className="text-xl font-semibold text-stone-900 mb-2">
                Entrar no sistema
              </h2>
              <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                Utilize sua conta Google autorizada pelo síndico para acessar o painel financeiro,
                prestações de contas e comprovantes.
              </p>

              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {errorMsg}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={signingIn}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
              >
                <LogIn className="w-4 h-4" />
                {signingIn ? 'Autenticando...' : 'Entrar com Google'}
              </button>

              <p className="mt-6 text-xs text-stone-500 leading-relaxed">
                Não há cadastro público automático. Se você é morador ou conselheiro e ainda não
                possui acesso, solicite ao síndico o envio do convite para o seu e-mail.
              </p>
            </div>
          ) : pendingInvite ? (
            <div>
              <div className="flex items-center gap-2 text-amber-700 mb-3">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span className="text-sm font-semibold">Convite localizado</span>
              </div>
              <h2 className="text-xl font-semibold text-stone-900 mb-2">
                Bem-vindo(a), {pendingInvite.displayName}
              </h2>
              <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                O síndico autorizou seu acesso ao sistema com o perfil abaixo. Confirme para ativar
                sua conta.
              </p>

              <div className="border border-stone-200 rounded-lg p-4 mb-6 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-stone-500">E-mail</span>
                  <span className="font-medium text-stone-900">{firebaseUser.email}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-stone-500">Perfil de acesso</span>
                  <span className="font-medium text-stone-900">{roleLabel(pendingInvite.role)}</span>
                </div>
                {pendingInvite.unitId && (
                  <div className="flex justify-between gap-4">
                    <span className="text-stone-500">Unidade vinculada</span>
                    <span className="font-medium text-stone-900">
                      {pendingInvite.unitId.replace('apto_', 'Apartamento ')}
                    </span>
                  </div>
                )}
              </div>

              {errorMsg && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  {errorMsg}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={accepting}
                  className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-amber-700 hover:bg-amber-800 disabled:opacity-60 rounded-lg transition-colors whitespace-nowrap"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {accepting ? 'Ativando acesso...' : 'Aceitar convite e acessar'}
                </button>
                <button
                  type="button"
                  onClick={() => void signOut(auth)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-stone-700 hover:text-stone-900 border border-stone-300 rounded-lg transition-colors whitespace-nowrap"
                >
                  <LogOut className="w-4 h-4" />
                  Sair
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-amber-700 mb-3">
                <Lock className="w-5 h-5 shrink-0" />
                <span className="text-sm font-semibold">Acesso restrito por convite</span>
              </div>
              <h2 className="text-xl font-semibold text-stone-900 mb-2">
                {accessDeniedReason === 'inactive'
                  ? 'Conta desativada pelo síndico'
                  : accessDeniedReason === 'unverified_email'
                    ? 'E-mail não verificado'
                    : 'Seu e-mail ainda não foi autorizado'}
              </h2>
              <p className="text-sm text-stone-600 mb-4 leading-relaxed">
                Você entrou com o e-mail{' '}
                <strong className="text-stone-900">{firebaseUser.email}</strong>, mas{' '}
                {accessDeniedReason === 'inactive'
                  ? 'este perfil foi desativado na administração.'
                  : 'não há um convite ativo vinculado a este endereço.'}
              </p>
              <p className="text-sm text-stone-600 mb-6 leading-relaxed">
                Por segurança das informações financeiras do Condomínio José Cupertino Bicalho, o
                síndico precisa cadastrar seu e-mail na aba de Administração antes do primeiro
                acesso.
              </p>

              <button
                type="button"
                onClick={() => void signOut(auth)}
                className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium text-stone-700 hover:text-stone-900 border border-stone-300 rounded-lg transition-colors whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                Trocar de conta Google
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
