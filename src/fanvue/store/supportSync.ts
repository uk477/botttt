import { toIsoString } from '../utils/date'
import type { SupportMessage, SupportTicket, SupportTicketCategory } from './types'

export function normalizeSupportMessage(m: SupportMessage & { created_at?: string }): SupportMessage {
  return {
    ...m,
    created: toIsoString(m.created ?? m.created_at),
  }
}

export function mapServerSupportTicket(row: Record<string, unknown>): SupportTicket {
  const cat = String(row.category ?? 'other')
  const valid: SupportTicketCategory[] = ['payment', 'delivery', 'account', 'operator', 'other']
  return {
    id: String(row.id),
    category: (valid.includes(cat as SupportTicketCategory) ? cat : 'other') as SupportTicketCategory,
    status: row.status === 'closed' ? 'closed' : 'open',
    opened: toIsoString(String(row.opened ?? row.created_at ?? '')),
    closed: row.closed ? toIsoString(String(row.closed)) : undefined,
    summary: row.summary != null ? String(row.summary) : undefined,
  }
}

/** Rebuild ticket list from ticket_opened / ticket_closed system messages. */
export function rebuildTicketsFromMessages(messages: SupportMessage[]): SupportTicket[] {
  const byId = new Map<string, SupportTicket>()
  for (const m of messages) {
    if (m.kind !== 'system') continue
    if (m.text.startsWith('ticket_opened:')) {
      const id = m.text.slice('ticket_opened:'.length).split(':')[0]?.trim()
      if (!id) continue
      byId.set(id, {
        id,
        category: 'operator',
        status: 'open',
        opened: m.created,
      })
    }
    if (m.text.startsWith('ticket_closed:')) {
      const id = m.text.slice('ticket_closed:'.length).split(':')[0]?.trim()
      const t = byId.get(id)
      if (t) {
        t.status = 'closed'
        t.closed = m.created
      }
    }
  }
  return [...byId.values()]
}

/** Open ticket only if message history does not show it as closed. */
export function resolveActiveTicket(
  tickets: SupportTicket[],
  messages: SupportMessage[],
): SupportTicket | null {
  for (const tk of tickets) {
    if (tk.status === 'closed') continue
    const closedInChat = messages.some(
      (m) => m.kind === 'system' && m.text.startsWith(`ticket_closed:${tk.id}`),
    )
    if (!closedInChat) return tk
  }
  const rebuilt = rebuildTicketsFromMessages(messages)
  return rebuilt.find((t) => t.status !== 'closed') ?? null
}

export function applySupportSessionPayload(
  payload: { messages?: unknown[]; tickets?: unknown[] } | null,
): { messages: SupportMessage[]; tickets: SupportTicket[] } | null {
  if (!payload || typeof payload !== 'object') return null
  const messages = Array.isArray(payload.messages)
    ? (payload.messages as SupportMessage[]).map((m) =>
        normalizeSupportMessage(m as SupportMessage & { created_at?: string }),
      )
    : []
  let tickets = Array.isArray(payload.tickets)
    ? (payload.tickets as Record<string, unknown>[]).map(mapServerSupportTicket)
    : []
  if (tickets.length === 0 && messages.length > 0) {
    tickets = rebuildTicketsFromMessages(messages)
  } else if (messages.length > 0) {
    const fromMsgs = rebuildTicketsFromMessages(messages)
    const openFromMsgs = fromMsgs.filter((t) => t.status !== 'closed')
    for (const t of openFromMsgs) {
      if (!tickets.some((x) => x.id === t.id)) tickets.push(t)
    }
  }
  return { messages, tickets }
}
