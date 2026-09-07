import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

type CookieParaGravar = { name: string; value: string; options: CookieOptions };

/**
 * Cliente Supabase para Server Components e Route Handlers.
 * Usa a chave publicável — toda a proteção vem da RLS do banco,
 * que é onde ela deve estar. A service role nunca entra neste app.
 */
export async function supabaseServer() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list: CookieParaGravar[]) => {
          try {
            list.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component não pode escrever cookie: o middleware cuida disso.
          }
        },
      },
    },
  );
}
