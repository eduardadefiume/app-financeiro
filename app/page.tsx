import { supabaseServer } from '@/lib/supabase/server';
import Sair from './sair';

export const dynamic = 'force-dynamic';

const brl = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const cicloAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};

const mesPorExtenso = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', {
    month: 'long',
    year: 'numeric',
  });

const ROTULO_BUCKET: Record<string, string> = {
  essencial: 'Essencial',
  estilo_vida: 'Estilo de vida',
  divida: 'Dívida',
  investimento: 'Reserva',
};
const COR_BUCKET: Record<string, string> = {
  essencial: 'var(--duda)',
  estilo_vida: 'var(--alerta)',
  divida: 'var(--perigo)',
  investimento: 'var(--ok)',
};

export default async function Painel() {
  const supabase = await supabaseServer();
  const ciclo = cicloAtual();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: pessoa }, { data: resumo }, { data: buckets }, { data: dividas }, { data: escada }, { data: cats }] =
    await Promise.all([
      supabase.from('pessoas').select('nome').maybeSingle(),
      supabase.from('v_ciclo_resumo').select('*').eq('ciclo', ciclo).maybeSingle(),
      supabase.from('v_buckets').select('*').eq('ciclo', ciclo).order('valor', { ascending: false }),
      supabase.from('v_divida_terceiros').select('*').order('valor', { ascending: false }),
      supabase.from('v_escada_parcelas').select('*').order('ultimo_ciclo'),
      supabase.from('v_categoria_ciclo').select('*').eq('ciclo', ciclo).order('valor', { ascending: false }).limit(8),
    ]);

  const renda = Number(resumo?.renda ?? 0);
  const gasto = Number(resumo?.gasto ?? 0);
  const saldo = renda - gasto;
  const pct = renda > 0 ? Math.min((gasto / renda) * 100, 100) : 0;

  const estado =
    renda === 0 ? 'sem dados' : saldo < 0 ? 'estourado' : pct >= 90 ? 'no limite' : pct >= 70 ? 'atenção' : 'folgado';
  const classe = saldo < 0 ? 'perigo' : pct >= 70 ? 'alerta' : 'ok';

  const totalBuckets = (buckets ?? []).reduce((s, b) => s + Number(b.valor), 0);

  return (
    <main className="wrap">
      <header className="topo">
        <div>
          <h1>Olá, {pessoa?.nome ?? 'você'}</h1>
          <span className="ciclo">{mesPorExtenso(ciclo)}</span>
        </div>
        <Sair />
      </header>

      {/* ---------- quanto ainda dá para gastar ---------- */}
      <section className="hero">
        <span className="rot">
          {saldo >= 0 ? 'Ainda cabe neste ciclo' : 'Passou do que entrou'}
        </span>
        <div className="grande" style={{ color: saldo < 0 ? 'var(--perigo)' : 'var(--txt)' }}>
          {brl(Math.abs(saldo))}
        </div>
        <div className="de">
          {gasto > 0 ? <>gastou {brl(gasto)} de {brl(renda)}</> : 'nenhum gasto lançado ainda'}
        </div>

        <div className="barra" role="img" aria-label={`${pct.toFixed(0)}% da renda comprometida`}>
          {(buckets ?? []).map((b) => (
            <i
              key={b.bucket}
              style={{
                width: `${totalBuckets > 0 ? (Number(b.valor) / renda) * 100 : 0}%`,
                background: COR_BUCKET[b.bucket] ?? 'var(--txt-3)',
              }}
            />
          ))}
        </div>
        <div className="legenda">
          <span>{pct.toFixed(0)}% da renda</span>
          <span className={`chip ${classe}`}>{estado}</span>
        </div>

        {Number(resumo?.falta_pagar ?? 0) > 0 && (
          <p className="nota">
            Ainda não pago neste ciclo: <strong className="num">{brl(Number(resumo!.falta_pagar))}</strong>
          </p>
        )}
      </section>

      {/* ---------- 50/30/20 ---------- */}
      {(buckets?.length ?? 0) > 0 && (
        <>
          <h2>Onde está indo</h2>
          <div className="cartao">
            {buckets!.map((b) => (
              <div className="linha" key={b.bucket}>
                <i className="pt" style={{ background: COR_BUCKET[b.bucket] }} />
                <span className="nome">
                  {ROTULO_BUCKET[b.bucket] ?? b.bucket}
                  <small>{Number(b.pct ?? 0).toFixed(0)}% do que saiu</small>
                </span>
                <span className="val">{brl(Number(b.valor))}</span>
              </div>
            ))}
          </div>
          <p className="nota">
            A meta é 50% essencial · 30% estilo de vida · 20% reserva. Terapia e academia contam como
            saúde, FIES como dívida — não como lazer.
          </p>
        </>
      )}

      {/* ---------- cartoes de terceiros ---------- */}
      {(dividas?.length ?? 0) > 0 && (
        <>
          <h2>O que devemos nos cartões dos outros</h2>
          <div className="cartao">
            {dividas!.map((d, i) => (
              <div className="linha" key={i}>
                <i
                  className="pt"
                  style={{ background: d.devedor === 'Duda' ? 'var(--duda)' : 'var(--rayana)' }}
                />
                <span className="nome">
                  {d.devedor}
                  <small>
                    {d.cartao} · titular {d.titular}
                  </small>
                </span>
                <span className="val">{brl(Number(d.valor))}</span>
              </div>
            ))}
          </div>
          <p className="nota">
            Passivo com a família. Não aparece em fatura nenhuma, não tem contrato e não cobra juros —
            mas é dívida.
          </p>
        </>
      )}

      {/* ---------- escada de parcelas ---------- */}
      {(escada?.length ?? 0) > 0 && (
        <>
          <h2>Quando isso acaba</h2>
          <div className="cartao">
            {escada!.map((e, i) => (
              <div className="linha" key={i}>
                <span className="nome">
                  {e.descricao}
                  <small>
                    {e.parcelas_restantes}x de {brl(Number(e.parcela_mensal))} · última em{' '}
                    {mesPorExtenso(String(e.ultimo_ciclo))}
                  </small>
                </span>
                <span className="val">{brl(Number(e.falta_pagar))}</span>
              </div>
            ))}
          </div>
          <p className="nota">
            Cada linha que termina vira dinheiro livre. Se nada novo for parcelado, esse valor volta
            para vocês.
          </p>
        </>
      )}

      {/* ---------- categorias ---------- */}
      {(cats?.length ?? 0) > 0 && (
        <>
          <h2>Maiores categorias do mês</h2>
          <div className="cartao">
            {cats!.map((c, i) => (
              <div className="linha" key={i}>
                <i className="pt" style={{ background: COR_BUCKET[c.bucket] }} />
                <span className="nome">
                  {c.categoria}
                  <small>{c.lancamentos} lançamentos</small>
                </span>
                <span className="val">{brl(Number(c.valor))}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {renda === 0 && gasto === 0 && (
        <div className="cartao">
          <p className="vazio">
            Nada lançado neste ciclo ainda.
            <br />
            Quando o Open Finance estiver ligado, aparece sozinho aqui.
          </p>
        </div>
      )}

      <p className="nota" style={{ marginTop: 28 }}>
        Conectado como {user?.email}. Você vê os seus lançamentos e os que dividem com você.
      </p>
    </main>
  );
}
