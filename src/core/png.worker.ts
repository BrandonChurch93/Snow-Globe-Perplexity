import { pngPixels, type Pixels } from './png'

interface Scope {
  onmessage: ((event: { data: ArrayBuffer }) => void) | null
  postMessage(message: Pixels | null, transfer: ArrayBuffer[]): void
}

const scope = self as unknown as Scope

scope.onmessage = (event) => {
  pngPixels(event.data).then(
    (p) => scope.postMessage(p, p ? [p.data.buffer as ArrayBuffer] : []),
    () => scope.postMessage(null, []),
  )
}
