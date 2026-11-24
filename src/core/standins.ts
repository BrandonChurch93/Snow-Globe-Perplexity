const flagged = new Set<string>()

export function flagStandIn(part: string): void {
  flagged.add(part)
}

export function flaggedStandIns(): string[] {
  return [...flagged].sort()
}

export function clearStandIn(part: string): void {
  flagged.delete(part)
}
