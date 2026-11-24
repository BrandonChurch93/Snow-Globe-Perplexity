import { EngineHost, type FromEngine, type ToEngine } from './host'

interface Scope {
  onmessage: ((event: { data: ToEngine }) => void) | null
  postMessage(message: FromEngine, transfer: ArrayBuffer[]): void
}

const scope = self as unknown as Scope
const host = new EngineHost()

scope.onmessage = (event) => {
  const reply = host.handle(event.data)
  if (reply) scope.postMessage(reply.message, reply.transfer)
}
