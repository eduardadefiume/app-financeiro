# app-financeiro

Painel financeiro da Duda e da Rayana. Next.js + Supabase, hospedado na Vercel.

## Por que existe

A planilha só continha o que a gente lembrava de lançar. Entre junho e agosto de 2026,
entraram R$ 15.400 e a planilha explicava R$ 12.759 — R$ 713 por mês sem registro.
Este app existe para acabar com esse buraco: o extrato entra sozinho via Open Finance,
e só o que nenhum banco enxerga (o cartão do pai) é digitado.

## Rodando local

```bash
npm install
cp .env.local.example .env.local   # ja vem preenchido, so a URL e a chave publicavel
npm run dev
```

## Conceitos do banco

- **quem pagou ≠ quem deve** — `transacoes.conta_id` diz qual cartao passou;
  `rateios` diz de quem e a responsabilidade. E assim que gasto da Rayana no
  cartao do pai da Duda para de se perder.
- **ciclo** — o mes que o gasto compromete, nem sempre o mes em que foi pago.
- **buckets** — `essencial` / `estilo_vida` / `divida` / `investimento`.
  Terapia e academia sao saude, FIES e divida, CPFL e conta de casa.
  A planilha antiga jogava tudo isso em "Lazer", e por isso o 50/30/20 nunca fechava.

## Seguranca

- Nenhuma senha de banco passa por aqui. A conexao e por Open Finance (Pluggy),
  autorizada dentro do app do proprio banco e revogavel a qualquer momento.
- O app usa apenas a chave publicavel do Supabase. Toda a protecao esta na RLS,
  no banco. A serviceRole nao existe neste repositorio.
- `.env.local` esta no `.gitignore`.
