import { z } from 'zod'

const MoneySchema = z.object({
  amount: z.number().finite().positive(),
  currency: z.string().min(1).max(8).default('GHS'),
})

function normalizeIdempotencyKey(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return null
  // keep it small-ish so indexes stay sane
  return s.slice(0, 128)
}

export function getIdempotencyKeyFromReq(req) {
  return normalizeIdempotencyKey(req.get?.('idempotency-key') ?? req.headers?.['idempotency-key'])
}

export async function getOrCreateWalletForUpdate(client, { userId, currency }) {
  await client.query(
    `insert into wallets (user_id, balance, currency)
     values ($1, 0, $2)
     on conflict (user_id) do nothing`,
    [userId, currency ?? 'GHS'],
  )
  const r = await client.query(`select * from wallets where user_id = $1 for update`, [userId])
  return r.rows[0]
}

async function insertLedgerEntry(client, row) {
  const r = await client.query(
    `insert into wallet_ledger_entries
      (wallet_id, user_id, direction, amount, currency, kind, ref_type, ref_id, idempotency_key, meta)
     values
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     on conflict do nothing
     returning *`,
    [
      row.wallet_id,
      row.user_id,
      row.direction,
      row.amount,
      row.currency,
      row.kind,
      row.ref_type ?? null,
      row.ref_id ?? null,
      row.idempotency_key ?? null,
      row.meta ?? null,
    ],
  )
  return r.rows[0] ?? null
}

async function getLedgerEntryByIdempotency(client, { userId, idempotencyKey }) {
  if (!idempotencyKey) return null
  const r = await client.query(
    `select *
     from wallet_ledger_entries
     where user_id = $1 and idempotency_key = $2
     order by created_at desc
     limit 1`,
    [userId, idempotencyKey],
  )
  return r.rows[0] ?? null
}

export async function creditWalletTx(
  client,
  { userId, amount, currency, kind, refType, refId, idempotencyKey, meta },
) {
  const parsed = MoneySchema.safeParse({ amount, currency: currency ?? 'GHS' })
  if (!parsed.success) throw new Error('Invalid credit amount/currency')

  const key = normalizeIdempotencyKey(idempotencyKey)
  const wallet = await getOrCreateWalletForUpdate(client, { userId, currency: parsed.data.currency })
  if (!wallet) throw new Error('Wallet not found')
  if (String(wallet.currency ?? 'GHS') !== String(parsed.data.currency ?? 'GHS')) {
    throw new Error('Wallet currency mismatch')
  }

  const inserted = await insertLedgerEntry(client, {
    wallet_id: wallet.id,
    user_id: userId,
    direction: 'credit',
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    kind,
    ref_type: refType ?? null,
    ref_id: refId ?? null,
    idempotency_key: key,
    meta: meta ?? null,
  })

  if (inserted) {
    await client.query(`update wallets set balance = balance + $2, updated_at = now() where id = $1`, [
      wallet.id,
      parsed.data.amount,
    ])
    return { applied: true, ledger: inserted }
  }

  const existing = await getLedgerEntryByIdempotency(client, { userId, idempotencyKey: key })
  return { applied: false, ledger: existing }
}

export async function debitWalletTx(
  client,
  { userId, amount, currency, kind, refType, refId, idempotencyKey, meta },
) {
  const parsed = MoneySchema.safeParse({ amount, currency: currency ?? 'GHS' })
  if (!parsed.success) throw new Error('Invalid debit amount/currency')

  const key = normalizeIdempotencyKey(idempotencyKey)
  const wallet = await getOrCreateWalletForUpdate(client, { userId, currency: parsed.data.currency })
  if (!wallet) throw new Error('Wallet not found')
  if (String(wallet.currency ?? 'GHS') !== String(parsed.data.currency ?? 'GHS')) {
    throw new Error('Wallet currency mismatch')
  }

  // If we already applied this debit, don't apply again.
  if (key) {
    const existing = await getLedgerEntryByIdempotency(client, { userId, idempotencyKey: key })
    if (existing) return { applied: false, ledger: existing }
  }

  const bal = Number(wallet.balance ?? 0)
  if (parsed.data.amount > bal) {
    return { applied: false, insufficient: true, ledger: null }
  }

  const inserted = await insertLedgerEntry(client, {
    wallet_id: wallet.id,
    user_id: userId,
    direction: 'debit',
    amount: parsed.data.amount,
    currency: parsed.data.currency,
    kind,
    ref_type: refType ?? null,
    ref_id: refId ?? null,
    idempotency_key: key,
    meta: meta ?? null,
  })

  // If insert failed due to idempotency conflict, treat as already-applied.
  if (!inserted) {
    const existing = await getLedgerEntryByIdempotency(client, { userId, idempotencyKey: key })
    return { applied: false, ledger: existing }
  }

  const upd = await client.query(
    `update wallets
     set balance = balance - $2, updated_at = now()
     where id = $1 and balance >= $2
     returning *`,
    [wallet.id, parsed.data.amount],
  )
  if (upd.rowCount === 0) {
    // Should be rare (race), but keep DB consistent.
    await client.query('delete from wallet_ledger_entries where id = $1', [inserted.id])
    return { applied: false, insufficient: true, ledger: null }
  }

  return { applied: true, ledger: inserted }
}

