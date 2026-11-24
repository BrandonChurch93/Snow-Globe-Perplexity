import type { ProbeBridge } from '../core/bridge'

export function mountProbe(root: HTMLElement, bridge: ProbeBridge): void {
  root.dataset.probe = String(bridge.levels().length)
}
