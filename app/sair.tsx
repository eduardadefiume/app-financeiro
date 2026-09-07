'use client';

import { useRouter } from 'next/navigation';
import { supabaseBrowser } from '@/lib/supabase/client';

export default function Sair() {
  const router = useRouter();
  return (
    <button
      className="sair"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      Sair
    </button>
  );
}
