import { supabaseServer } from '@/lib/supabase/server';
import Sair from './sair';

export const dynamic = 'force-dynamic';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const cicloAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const mesExtenso = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const diaMes = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

const ROTULO: Record<string, string> = {
  essencial: 'Essencial', estilo_vida: 'Estilo de vida',
  divida: 'Dívida', investimento: 'Reserva', interno: 'Entre contas',
};
const COR: Record<string, string> = {
  essencial: 'var(--duda)', estilo_vida: 'var(--alerta)',
  divida: 'var(--perigo)', investimento: 'var(--ok)', interno: 'var(--txt-3)',
};

export default async function Painel() {
  const supabase = await supabaseServer();
  const ciclo = cicloAtual();
  const { data: { user } } = await supabase.auth.getUser();

  const [pessoa, resumo, buckets, cats, escada, seguro, recorr, ultimos] = await Promise.all([
    supabase.from('pessoas').select('nome').maybeSingle().then((r) => r.data),
    supabase.from('v_ciclo_resumo').select('*').eq('ciclo', ciclo).maybeSingle().then((r) => r.data),
    supabase.from('v_buckets').select('*').eq('ciclo', ciclo).order('valor', { ascending: false }).then((r) => r.data ?? []),
    supabase.from('v_categoria_ciclo').select('*').eq('ciclo', ciclo).order('valor', { ascending: false }).limit(7).then((r) => r.data ?? []),
    supabase.from('v_escada_parcelas').select('*').order('ultimo_ciclo').then((r) => r.data ?? []),
    supabase.from('v_parcela_segura').select('*').maybeSingle().then((r) => r.data),
    supabase.from('v_recorrencia').select('*').gte('meses_seguidos', 2).order('valor_medio', { ascending: false }).limit(6).then((r) => r.data ?? []),
    supabase.from('transacoes').select('data,descricao,valor,categorias(nome,bucket)').lt('valor', 0)
      .order('data', { ascending: false }).limit(14).then((r) => r.data ?? []),
  ]);

  const renda = Number(resumo?.renda ?? 0);
  const gasto = Number(resumo?.gasto ?? 0);
  const sobra = renda - gasto;
  const pct = renda > 0 ? Math.min((gasto / renda) * 100, 100) : 0;
  const parcelaSegura = Number(seguro?.parcela_segura ?? 0);
  const parcelaJan = Number(seguro?.parcela_segura_jan27 ?? 0);
  const comprometido = escada.reduce((s, e) => s + Number(e.parcela_mensal ?? 0), 0);
  const pctComprometido = renda > 0 ? (comprometido / renda) * 100 : 0;

  const estado = sobra < 0 ? 'estourado' : pct >= 90 ? 'no limite' : pct >= 70 ? 'atenção' : 'folgado';
  const classe = sobra < 0 ? 'perigo' : pct >= 70 ? 'alerta' : 'ok';

  return (
    <main className="wrap">
      <header className="topo">
        <div>
          <h1>Olá, {pessoa?.nome ?? 'você'}</h1>
          <span className="ciclo">{mesExtenso(ciclo)}</span>
        </div>
        <Sair />
      </header>

      {/* ---------- quanto ainda cabe ---------- */}
      <section className="hero">
        <span className="rot">{sobra >= 0 ? 'Ainda cabe neste ciclo' : 'Passou do que entrou'}</span>
        <div className="grande" style={{ color: sobra < 0 ? 'var(--perigo)' : 'var(--txt)' }}>
          {brl(Math.abs(sobra))}
        </div>
        <div className="de">{gasto > 0 ? <>gastou {brl(gasto)} de {brl(renda)}</> : 'nada lançado ainda'}</div>
        <div className="barra">
          {buckets.filter((b) => b.bucket !== 'interno').map((b) => (
            <i key={b.bucket} style={{ width: `${renda > 0 ? (Number(b.valor) / renda) * 100 : 0}%`, background: COR[b.bucket] }} />
          ))}
        </div>
        <div className="legenda">
          <span>{pct.toFixed(0)}% da renda</span>
          <span className={`chip ${classe}`}>{estado}</span>
        </div>
      </section>

      {/* ---------- PARCELA SEGURA ---------- */}
      <section className="hero" style={{ borderColor: 'var(--ok)' }}>
        <span className="rot">Se você quiser parcelar alguma coisa</span>
        <div className="grande" style={{ color: parcelaSegura > 0 ? 'var(--ok)' : 'var(--perigo)' }}>
          {parcelaSegura > 0 ? <>{brl0(parcelaSegura)}<small style={{ fontSize: 17, fontWeight: 400 }}> /mês</small></> : 'R$ 0'}
        </div>
        <div className="de">
          {parcelaSegura > 0
            ? <>é o maior valor de parcela que cabe — <strong>em quantas vezes for</strong></>
            : <>hoje não cabe parcela nenhuma: você já gasta mais do que entra</>}
        </div>
        <p className="nota">
          {parcelaSegura > 0 ? (
            <>Uma compra de R$ 1.980 em 18x de R$ 110 cabe. A mesma compra em 6x de R$ 330 não cabe.
            <strong> O que aperta o mês é o valor da parcela, não o número de vezes.</strong></>
          ) : (
            <>Antes de parcelar qualquer coisa, o mês precisa fechar no positivo.
            Hoje falta {brl(Math.abs(Number(seguro?.folga_hoje ?? 0)))} para isso.</>
          )}
        </p>
        {parcelaJan > parcelaSegura && (
          <p className="nota" style={{ color: 'var(--ok)' }}>
            A partir de <strong>janeiro/2027</strong>, com FASTSHO, Ludy e Day Clinic quitados,
            esse limite sobe para <strong>{brl0(parcelaJan)}/mês</strong>.
          </p>
        )}
      </section>

      {/* ---------- comprometimento ---------- */}
      {comprometido > 0 && (
        <>
          <h2>Quanto do salário já tem dono</h2>
          <div className="cartao">
            <div className="linha">
              <span className="nome">Parcelas já assumidas<small>{escada.length} compromissos ativos</small></span>
              <span className="val">{brl(comprometido)}</span>
            </div>
            <div className="linha">
              <span className="nome">Sobra livre<small>depois das parcelas</small></span>
              <span className="val" style={{ color: renda - comprometido > 0 ? 'var(--ok)' : 'var(--perigo)' }}>
                {brl(renda - comprometido)}
              </span>
            </div>
          </div>
          <div className="barra" style={{ marginTop: 10 }}>
            <i style={{ width: `${Math.min(pctComprometido, 100)}%`, background: 'var(--perigo)' }} />
          </div>
          <p className="nota">{pctComprometido.toFixed(0)}% da sua renda já está vendida antes do mês começar.</p>
        </>
      )}

      {/* ---------- alertas de recorrência ---------- */}
      {recorr.length > 0 && (
        <>
          <h2>Virou conta fixa sem ninguém decidir</h2>
          <div className="cartao">
            {recorr.map((r, i) => (
              <div className="linha" key={i}>
                <i className="pt" style={{ background: 'var(--alerta)' }} />
                <span className="nome">
                  {String(r.destinatario).slice(0, 30)}
                  <small>{r.meses_seguidos} meses seguidos · variação {r.variacao_pct}%</small>
                </span>
                <span className="val">{brl(Number(r.valor_medio))}</span>
              </div>
            ))}
          </div>
          <p className="nota">
            Mesmo destinatário, mesmo valor, meses consecutivos. Não veio de contrato nenhum —
            o sistema percebeu sozinho olhando o extrato.
          </p>
        </>
      )}

      {/* ---------- principais gastos ---------- */}
      {cats.length > 0 && (
        <>
          <h2>Principais gastos do mês</h2>
          <div className="cartao">
            {cats.map((c, i) => (
              <div className="linha" key={i}>
                <i className="pt" style={{ background: COR[c.bucket] }} />
                <span className="nome">{c.categoria}<small>{c.lancamentos} lançamentos · {ROTULO[c.bucket]}</small></span>
                <span className="val">{brl(Number(c.valor))}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ---------- parcelas que faltam ---------- */}
      {escada.length > 0 && (
        <>
          <h2>Parcelas que faltam</h2>
          <div className="cartao">
            {escada.map((e, i) => (
              <div className="linha" key={i}>
                <span className="nome">
                  {e.descricao}
                  <small>faltam {e.parcelas_restantes}x · última em {mesExtenso(String(e.ultimo_ciclo))}</small>
                </span>
                <span className="val">{brl(Number(e.parcela_mensal))}</span>
              </div>
            ))}
          </div>
          <p className="nota">Cada uma que termina vira dinheiro livre — se não for gasta antes de chegar.</p>
        </>
      )}

      {/* ---------- linha do tempo ---------- */}
      {ultimos.length > 0 && (
        <>
          <h2>Linha do tempo</h2>
          <div className="cartao">
            {ultimos.map((t, i) => {
              const cat = Array.isArray(t.categorias) ? t.categorias[0] : t.categorias;
              return (
                <div className="linha" key={i}>
                  <i className="pt" style={{ background: COR[cat?.bucket ?? 'interno'] }} />
                  <span className="nome">
                    {String(t.descricao).slice(0, 34)}
                    <small>{diaMes(String(t.data))} · {cat?.nome ?? 'sem categoria'}</small>
                  </span>
                  <span className="val">{brl(Math.abs(Number(t.valor)))}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="nota" style={{ marginTop: 28 }}>
        Conectado como {user?.email}. Você vê os seus lançamentos e os que divide com a outra.
      </p>
    </main>
  );
}
