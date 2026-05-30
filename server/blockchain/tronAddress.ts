/** Tron base58 address (mainnet), e.g. TJmmqjb1DK9TTZbQXzRQ2AuA94z4gKAPFh */
const TRON_BASE58_RE = /^T[1-9A-HJ-NP-Za-km-z]{33}$/;

export function isValidTronBase58Address(addr: string): boolean {
  return TRON_BASE58_RE.test(addr.trim());
}

export function normalizeTronAddress(addr: string): string {
  return addr.trim();
}
