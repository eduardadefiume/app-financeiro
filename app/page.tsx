import { supabaseServer } from '@/lib/supabase/server';
import Sair from './sair';

export const dynamic = 'force-dynamic';

const brl = (n: number) => n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const brl0 = (n: number) =>
  n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const num = (v: unknown) => Number(v ?? 0);

const mes = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
const mesLongo = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
const diaMes = (iso: string) =>
  new Date(iso + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });

export default async function Painel() {
  const sb = await supabaseServer();
  const hoje = new Date();
  const ciclo = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-01`;

  const [
    { data: user },
    pessoa, salario, faturas, parcelas, liberacao, devedores, seguro, recorr, ultimos,
  ] = await Promise.all([
    sb.auth.getUser().then((r) => ({ data: r.data.user })),
    sb.from('pessoas').select('nome').maybeSingle().then((r) => r.data),
    sb.from('v_salario_ciclo').select('*').order('ciclo', { ascending: false }).limit(1).maybeSingle().then((r) => r.data),
    sb.from('v_ciclo_cartao').select('*').order('vence_em').then((r) => r.data ?? []),
    sb.from('v_parcelas_abertas').select('*').gt('faltam', 0).order('ultimo_ciclo').then((r) => r.data ?? []),
    sb.from('v_liberacao_mensal').select('*').gte('mes', ciclo).order('mes').then((r) => r.data ?? []),
    sb.from('v_saldo_devedor').select('*').then((r) => r.data ?? []),
    sb.from('v_parcela_segura').select('*').maybeSingle().then((r) => r.data),
    sb.from('v_recorrencia').select('*').eq('situacao', 'ativo').order('valor_medio', { ascending: false }).limit(5).then((r) => r.data ?? []),
    sb.from('transacoes').select('data,descricao,valor,categorias(nome,bucket)').lt('valor', 0)
      .order('data', { ascending: false }).limit(12).then((r) => r.data ?? []),
  ]);

  const emAberto = faturas.filter((f) => f.situacao === 'em formacao');
  const atual = faturas.find((f) => f.situacao === 'fechada, vence agora') ?? emAberto[0];
  const formando = emAberto[0];
  const dias = num(formando?.dias_ate_fechar);

  const salarioTotal = num(salario?.salario);
  const compromissoMes = parcelas.reduce((s, p) => s + num(p.parcela), 0);
  const aReceber = devedores.filter((d) => num(d.saldo_atual) > 0);
  const totalAReceber = aReceber.reduce((s, d) => s + num(d.saldo_atual), 0);
  const parcelaSegura = num(seguro?.parcela_segura);
  const folga = num(seguro?.folga_hoje);
  const parcelaJan27 = num(seguro?.parcela_segura_jan27);

  return (
    <main className="wrap">
      <header className="topo">
        <div>
          <h1>{pessoa?.nome ?? 'Painel'}</h1>
          <span className="ciclo">{mesLongo(ciclo)}</span>
        </div>
        <Sair />
      </header>

      {/* ============ FATURA EM FORMAÇÃO ============ */}
      {formando && (
        <section className={`fatura ${formando.alerta === 'ESTOUROU' ? 'ruim' : formando.alerta === 'perto do teto' ? 'atencao' : ''}`}>
          <div className="fhead">
            <span className="rot">{formando.cartao} · vence {diaMes(String(formando.vence_em))}</span>
            <span className={`chip ${formando.alerta === 'ESTOUROU' ? 'perigo' : formando.alerta === 'perto do teto' ? 'alerta' : 'ok'}`}>
              {dias === 0 ? 'fecha hoje' : dias === 1 ? 'fecha amanhã' : `fecha em ${dias} dias`}
            </span>
          </div>
          <div className="fvalor">{brl(num(formando.total))}</div>
          <div className="fteto">de {brl0(num(formando.teto))} · <strong>{brl(num(formando.ainda_cabe))} ainda cabem</strong></div>

          <div className="fbarra">
            <i style={{ width: `${Math.min(num(formando.pct_do_teto), 100)}%` }} />
            <span className="marca" style={{ left: '75%' }} />
          </div>

          <div className="fsplit">
            <div><span className="k">Sua parte</span><span className="v">{brl(num(formando.parte_duda))}</span></div>
            <div><span className="k">Rayana</span><span className="v">{brl(num(formando.parte_rayana))}</span></div>
            <div><span className="k">Terceiros</span><span className="v">{brl(num(formando.parte_terceiros))}</span></div>
          </div>
          <p className="nota">
            {dias <= 1
              ? <>O que passar hoje ainda entra nesta fatura. A partir de amanhã, vai para a seguinte.</>
              : <>{formando.itens} itens lançados · à vista {brl(num(formando.a_vista))} · parcelas {brl(num(formando.em_parcelas))}</>}
          </p>
        </section>
      )}

      {/* ============ NÚMEROS DO MÊS ============ */}
      <div className="kpis">
        <div className="kpi">
          <span className="k">Salário do ciclo</span>
          <span className="v">{brl0(salarioTotal)}</span>
          <span className="s">
            {salario?.adiantamento ? <>vale {brl0(num(salario.adiantamento))} + {brl0(num(salario.restante))}</> : 'aguardando 2ª parte'}
          </span>
        </div>
        <div className="kpi">
          <span className="k">Parcelas por mês</span>
          <span className="v alerta">{brl0(compromissoMes)}</span>
          <span className="s">{parcelas.length} compromissos abertos</span>
        </div>
        <div className="kpi">
          <span className="k">Tenho a receber</span>
          <span className="v ok">{brl0(totalAReceber)}</span>
          <span className="s">{aReceber.map((d) => d.devedor).join(' · ') || 'nada pendente'}</span>
        </div>
        <div className="kpi">
          <span className="k">Parcela que cabe</span>
          <span className={`v ${parcelaSegura > 0 ? 'ok' : 'perigo'}`}>{brl0(parcelaSegura)}</span>
          <span className="s">
            {parcelaSegura > 0 ? (
              <>por mês, em quantas vezes for</>
            ) : (
              <>
                o mês fecha {brl0(Math.abs(folga))} no vermelho
                {parcelaJan27 > 0 && <> · em jan/27 cabem {brl0(parcelaJan27)}</>}
              </>
            )}
          </span>
        </div>
      </div>

      {/* ============ A CONTA ENTRE VOCÊS ============ */}
      {devedores.length > 0 && (
        <>
          <h2>A conta entre vocês</h2>
          <div className="cartao">
            {devedores.map((d, i) => {
              const saldo = num(d.saldo_atual);
              return (
                <div className="linha" key={i}>
                  <i className="pt" style={{ background: saldo > 0 ? 'var(--alerta)' : 'var(--ok)' }} />
                  <span className="nome">
                    {d.devedor}
                    <small>coube {brl(num(d.total_devido))} · repassou {brl(num(d.total_repassado))}</small>
                  </span>
                  <span className="val" style={{ color: saldo > 0 ? 'var(--alerta)' : 'var(--ok)' }}>
                    {saldo > 0 ? brl(saldo) : `${brl(Math.abs(saldo))} adiantado`}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="nota">Você paga o valor cheio e recebe a parte de cada uma. Positivo é o que falta entrar.</p>
        </>
      )}

      {/* ============ PARCELAS ============ */}
      {parcelas.length > 0 && (
        <>
          <h2>Parcelas em aberto</h2>
          <div className="cartao">
            {parcelas.map((p, i) => (
              <div className="linha" key={i}>
                <span className="nome">
                  {p.descricao}
                  <small>
                    {p.ultima_paga}/{p.parcela_total} pagas · faltam {p.faltam} · última em {mes(String(p.ultimo_ciclo))}
                    {p.de_quem !== 'Duda' && <> · {p.de_quem}</>}
                  </small>
                </span>
                <span className="val">
                  {brl(num(p.parcela))}
                  <small>{brl(num(p.falta_pagar))} total</small>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ============ QUANDO LIBERA ============ */}
      {liberacao.length > 0 && (
        <>
          <h2>Quando o dinheiro volta</h2>
          <div className="cartao">
            {liberacao.map((l, i) => (
              <div className="linha" key={i}>
                <span className="mesbox">{mes(String(l.mes))}</span>
                <span className="nome">
                  + {brl(num(l.libera))} por mês
                  <small>{String(l.o_que_acaba).slice(0, 52)}</small>
                </span>
                <span className="val ok">{brl(num(l.acumulado))}</span>
              </div>
            ))}
          </div>
          <p className="nota">A coluna da direita é o acumulado: quanto some da sua conta a partir daquele mês.</p>
        </>
      )}

      {/* ============ PRÓXIMAS FATURAS ============ */}
      {emAberto.length > 1 && (
        <>
          <h2>Próximas faturas</h2>
          <div className="cartao">
            {emAberto.slice(1).map((f, i) => (
              <div className="linha" key={i}>
                <span className="mesbox">{mes(String(f.vence_em))}</span>
                <span className="nome">
                  {f.cartao}
                  <small>{f.itens} itens · sua parte {brl(num(f.parte_duda))}</small>
                </span>
                <span className="val">{brl(num(f.total))}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ============ VIROU CONTA FIXA ============ */}
      {recorr.length > 0 && (
        <>
          <h2>Virou conta fixa</h2>
          <div className="cartao">
            {recorr.map((r, i) => (
              <div className="linha" key={i}>
                <i className="pt" style={{ background: 'var(--alerta)' }} />
                <span className="nome">
                  {String(r.destinatario).slice(0, 28)}
                  <small>{r.meses_seguidos} meses seguidos · variação {r.variacao_pct}%</small>
                </span>
                <span className="val">{brl(num(r.valor_medio))}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ============ LINHA DO TEMPO ============ */}
      {ultimos.length > 0 && (
        <>
          <h2>Últimos lançamentos</h2>
          <div className="cartao">
            {ultimos.map((t, i) => {
              const c = Array.isArray(t.categorias) ? t.categorias[0] : t.categorias;
              return (
                <div className="linha" key={i}>
                  <span className="nome">
                    {String(t.descricao).slice(0, 34)}
                    <small>{diaMes(String(t.data))} · {c?.nome ?? '—'}</small>
                  </span>
                  <span className="val">{brl(Math.abs(num(t.valor)))}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <p className="rodape">{user?.email} · dados via Open Finance, atualizados a cada sincronização</p>
    </main>
  );
}
