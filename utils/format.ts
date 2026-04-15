export function formatNumber(num: number, decimals = 2): string {
  return num.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatWC(num: number): string {
  return `${formatNumber(num)} WC`;
}

export function truncateAddress(addr: string): string {
  if (addr.length <= 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function getSupplyColor(remaining: number, max: number): string {
  const pct = (remaining / max) * 100;
  if (pct > 50) return "hsl(142 70% 45%)";
  if (pct > 25) return "hsl(45 100% 50%)";
  return "hsl(0 84% 60%)";
}

export function getSupplyColorClass(remaining: number, max: number): string {
  const pct = (remaining / max) * 100;
  if (pct > 50) return "bg-green";
  if (pct > 25) return "bg-primary";
  return "bg-red";
}
