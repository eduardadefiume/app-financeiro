'use client';

import { useState } from 'react';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Login() {
  const [email, setEmail] = useState('');
  const [estado, setEstado] = useState<'parado' | 'enviando' | 'enviado' | 'erro'>('parado');
  const [erro, setErro] = useState('');

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setEstado('enviando');
    const supabase = supabaseBrowser();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setErro(error.message);
      setEstado('erro');
    } else {
      setEstado('enviado');
    }
  }

  return (
    <main className="login">
      <div className="box">
        <h1>Financeiro</h1>
        <p>Duda &amp; Rayana. Entre com o seu e-mail — cada uma vê os próprios gastos.</p>

        <form onSubmit={entrar}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="seu@email.com"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={estado === 'enviando' || estado === 'enviado'}
          />
          <button type="submit" disabled={estado === 'enviando' || estado === 'enviado'}>
            {estado === 'enviando' ? 'Enviando...' : 'Receber link de acesso'}
          </button>
        </form>

        {estado === 'enviado' && (
          <div className="msg ok">
            Link enviado para <strong>{email}</strong>. Abra o e-mail neste mesmo celular.
          </div>
        )}
        {estado === 'erro' && <div className="msg err">{erro}</div>}
      </div>
    </main>
  );
}
