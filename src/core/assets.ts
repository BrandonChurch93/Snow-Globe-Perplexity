export interface AssetFile {
  path: string
  bytes: number
  sha: string
}
export interface AssetIndex {
  version: number
  sets: Record<string, Record<string, AssetFile[]>>
  seasonHashes: Record<string, string>
}

const EMPTY: AssetIndex = { version: 1, sets: {}, seasonHashes: {} }

export class Assets {
  index: AssetIndex = EMPTY
  set = 'web'
  private readonly loaded = new Map<string, Promise<ArrayBuffer>>()

  async init(set: string): Promise<void> {
    this.set = set
    const r = await fetch(new URL('assets/index.json', document.baseURI))
    if (!r.ok) throw new Error(`asset index did not load: ${r.status}`)
    this.index = (await r.json()) as AssetIndex
  }

  root(): string {
    return this.set === 'full' ? 'assets-full/' : 'assets/'
  }

  files(group: string): AssetFile[] {
    return this.index.sets[this.set]?.[group] ?? []
  }

  fetchFile(file: string): Promise<ArrayBuffer> {
    let p = this.loaded.get(file)
    if (!p) {
      p = fetch(new URL(this.root() + file, document.baseURI)).then((r) => {
        if (!r.ok) throw new Error(`asset did not load: ${file}`)
        return r.arrayBuffer()
      })
      this.loaded.set(file, p)
    }
    return p
  }

  async loadGroup(group: string): Promise<void> {
    await Promise.all(this.files(group).map((f) => this.fetchFile(f.path)))
  }

  release(file: string): void {
    this.loaded.delete(file)
  }
}
