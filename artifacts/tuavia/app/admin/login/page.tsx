'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Bike,
  Lock,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  AlertCircle,
  Loader2,
  CheckCircle2,
  ArrowLeft,
  Server
} from 'lucide-react';
import {
  AUTHORIZED_ADMIN_EMAIL,
  getStoredAdminSession,
  authenticateWithPasscodeAsync,
  setAdminSession,
} from '@/lib/adminAuth';
import { auth } from '@/lib/firebase';
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [passcode, setPasscode] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<any>(null);

  useEffect(() => {
    const session = getStoredAdminSession();
    if (session && session.email && session.token) {
      setCurrentSession(session);
    }
  }, []);

  const handlePasscodeLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Por favor, informe seu e-mail administrativo.');
      return;
    }
    if (!passcode.trim()) {
      setError('Por favor, informe a chave de acesso (ADMIN_PASSCODE).');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await authenticateWithPasscodeAsync(email.trim(), passcode.trim());
      if (res.success) {
        router.push('/admin');
      } else {
        setError(res.error || 'Credenciais inválidas. Verifique as variáveis de ambiente.');
      }
    } catch (err: any) {
      setError(err?.message || 'Falha ao autenticar.');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setGoogleLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (user && user.email) {
        const idToken = await user.getIdToken();
        const res = await fetch('/api/admin/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: user.email,
            idToken,
          }),
        });
        const data = await res.json();
        if (data.success) {
          setAdminSession(user.email, {
            displayName: user.displayName || 'Administrador',
            photoURL: user.photoURL || undefined,
            authMethod: 'google',
            token: data.token,
          });
          router.push('/admin');
          return;
        } else {
          setError(data.error || 'E-mail Google não cadastrado na variável ADMIN_EMAILS.');
        }
      }
    } catch (err: any) {
      if (err.code !== 'auth/popup-closed-by-user') {
        setError('Login Google indisponível ou cancelado. Utilize a chave de acesso.');
      }
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] text-stone-900 flex flex-col justify-between p-4 sm:p-6 lg:p-8">
      {/* Top Header */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pt-2">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs font-mono font-bold text-stone-600 hover:text-stone-950 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar ao TuaVia</span>
        </Link>
        <span className="text-[10px] font-mono uppercase tracking-widest bg-stone-900 text-amber-300 px-2.5 py-1 rounded-full font-bold">
          Ambiente Protegido
        </span>
      </div>

      {/* Main Card */}
      <div className="max-w-md w-full mx-auto my-8">
        <div className="bg-white border-2 border-stone-900 shadow-[6px_6px_0px_0px_rgba(28,25,23,1)] rounded-2xl p-6 sm:p-8 space-y-6">
          
          {/* Logo & Headline */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center w-14 h-14 bg-stone-900 text-amber-400 rounded-2xl shadow-[3px_3px_0px_0px_rgba(245,158,11,1)]">
              <Bike className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-stone-950">
                Tua<span className="text-emerald-600">Via</span> Admin
              </h1>
              <p className="text-xs text-stone-600 mt-1 font-medium">
                Autenticação Restrita via Variáveis de Ambiente
              </p>
            </div>
          </div>

          {/* Current Session Banner if available */}
          {currentSession && (
            <div className="bg-emerald-50 border-2 border-emerald-500 rounded-xl p-3.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <div>
                  <span className="font-bold text-emerald-950 block">Sessão Ativa Detectada</span>
                  <span className="text-[11px] text-emerald-700 font-mono truncate max-w-[180px] block">
                    {currentSession.email}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => router.push('/admin')}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-[11px] flex items-center gap-1 transition-colors cursor-pointer"
              >
                <span>Acessar</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Notice about Environment Variables */}
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-3 flex items-start gap-2.5 text-[11px] text-stone-600">
            <Server className="w-4 h-4 text-stone-500 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              O acesso é validado pelas variáveis <strong className="text-stone-800 font-mono">ADMIN_EMAILS</strong> e <strong className="text-stone-800 font-mono">ADMIN_PASSCODE</strong> configuradas na Hostinger ou arquivo de ambiente.
            </div>
          </div>

          {/* Error notice */}
          {error && (
            <div className="bg-rose-50 border-2 border-rose-500 rounded-xl p-3 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="leading-snug">{error}</div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handlePasscodeLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700 mb-1.5">
                E-mail Administrativo
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ex: admin@tuavia.com.br"
                className="w-full px-3.5 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-stone-900 transition-all font-mono"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-stone-700">
                  Chave de Acesso (Passcode)
                </label>
                <span className="text-[10px] text-stone-500 font-mono">ADMIN_PASSCODE</span>
              </div>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder="Informe sua chave do .env"
                  className="w-full pl-9 pr-3.5 py-2.5 bg-stone-50 border-2 border-stone-900 rounded-xl text-xs font-medium text-stone-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-stone-900 transition-all font-mono"
                />
                <KeyRound className="w-4 h-4 text-stone-500 absolute left-3 top-3 pointer-events-none" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-stone-900 hover:bg-stone-800 text-amber-300 font-black rounded-xl text-xs uppercase tracking-wider border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(245,158,11,1)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-amber-300" />
                  <span>Validando Chave...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>Entrar com Chave de Acesso</span>
                  <ArrowRight className="w-4 h-4 ml-auto" />
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-stone-300" />
            <span className="flex-shrink mx-3 text-[10px] font-mono uppercase tracking-widest text-stone-500 font-bold">
              Ou Autenticação Google
            </span>
            <div className="flex-grow border-t border-stone-300" />
          </div>

          {/* Google Login Action */}
          <div>
            <button
              type="button"
              onClick={handleGoogleLogin}
              disabled={googleLoading || loading}
              className="w-full py-2.5 px-4 bg-white hover:bg-stone-50 text-stone-900 font-bold rounded-xl text-xs border-2 border-stone-900 shadow-[3px_3px_0px_0px_rgba(28,25,23,1)] flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-60"
            >
              {googleLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-stone-700" />
              ) : (
                <svg className="w-4 h-4" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>Entrar com Conta Google Autorizada</span>
            </button>
            <p className="text-[10px] text-stone-500 text-center mt-1.5">
              O e-mail da conta Google precisa estar listado em ADMIN_EMAILS.
            </p>
          </div>

        </div>
      </div>

      {/* Footer Info */}
      <div className="text-center text-xs font-mono text-stone-600 pb-2">
        <p>© 2026 TuaVia AI Platform • Painel Administrativo Protegido</p>
      </div>
    </div>
  );
}
