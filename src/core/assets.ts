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

/**
 * One thing the code asks for by name, and the files of a set that hold it.
 *
 * The code names a picture as the full set does (`winter/base-carve.lin.w2048.png`). The web set may hold it under another coding
 * (`.webp`) and may hold what the first picture needs of it apart (`.first.webp`, the same picture at half the size); the rules
 * are in tools/lib/webset.mjs. Any other file is asked for by its own path.
 */
export interface AssetEntry {
  name: string
  picture: boolean
  /** The whole thing. */
  file: AssetFile
  /** What the first picture needs of it, where the set holds that apart. */
  first: AssetFile | null
}

const EMPTY: AssetIndex = { version: 1, sets: {}, seasonHashes: {} }
const PICTURE = /^(.*?)(\.first)?\.(png|webp|jpe?g)$/i

export function entriesOf(files: readonly AssetFile[]): AssetEntry[] {
  const found = new Map<string, { picture: boolean; file: AssetFile | null; first: AssetFile | null }>()
  const slot = (name: string, picture: boolean) => {
    let e = found.get(name)
    if (!e) found.set(name, (e = { picture, file: null, first: null }))
    return e
  }
  for (const f of files) {
    const m = PICTURE.exec(f.path)
    if (!m) slot(f.path, false).file = f
    else if (m[2]) slot(`${m[1]}.png`, true).first = f
    else slot(`${m[1]}.png`, true).file = f
  }
  const out: AssetEntry[] = []
  for (const [name, e] of found) {
    const file = e.file ?? e.first
    if (file) out.push({ name, picture: e.picture, file, first: e.file ? e.first : null })
  }
  return out
}

/**
 * The address of a file of a set, under the root of that set. It carries the hash the index holds for the file, so the address
 * changes whenever the file does: the host may then keep every file of `assets/` for as long as it likes (`vercel.json` says a
 * year), and a visitor who comes back after a new build still gets the new picture and never an old one under the same name.
 */
export const fileAddress = (root: string, file: string, sha = ''): string => `${root}${file}${sha ? `?v=${sha}` : ''}`

export class Assets {
  index: AssetIndex = EMPTY
  set = 'web'
  /**
   * True on the app's pages: a group is ready as soon as what the first picture needs is there, and the rest is fetched when
   * `src/core/textures.ts` is told to (`loadDetail`). False in capture, where every frame waits for the whole set.
   */
  firstOnly = false
  private readonly loaded = new Map<string, Promise<ArrayBuffer>>()
  private readonly listed = new Map<string, AssetEntry[]>()
  private readonly shas = new Map<string, string>()

  async init(set: string): Promise<void> {
    // The index has one name for ever, so it is the one file that is always asked of the host again (a short answer when nothing changed).
    const r = await fetch(new URL('assets/index.json', document.baseURI), { cache: 'no-cache' })
    if (!r.ok) throw new Error(`asset index did not load: ${r.status}`)
    this.use((await r.json()) as AssetIndex, set)
  }

  /** Takes an index and the set to read from it. */
  use(index: AssetIndex, set: string): void {
    this.set = set
    this.index = index
    this.listed.clear()
    this.shas.clear()
    for (const files of Object.values(index.sets[set] ?? {})) for (const f of files) this.shas.set(f.path, f.sha)
  }

  /** Where a file of the current set is fetched from, relative to the page. */
  address(file: string): string {
    return fileAddress(this.root(), file, this.shas.get(file))
  }

  root(): string {
    return this.set === 'full' ? 'assets-full/' : 'assets/'
  }

  files(group: string): AssetFile[] {
    return this.index.sets[this.set]?.[group] ?? []
  }

  entries(group: string): AssetEntry[] {
    const key = `${this.set}/${group}`
    let e = this.listed.get(key)
    if (!e) this.listed.set(key, (e = entriesOf(this.files(group))))
    return e
  }

  /** The file a group needs of an entry before it can be drawn. */
  early(e: AssetEntry): AssetFile {
    return this.firstOnly && e.first ? e.first : e.file
  }

  fetchFile(file: string, low = false): Promise<ArrayBuffer> {
    let p = this.loaded.get(file)
    if (!p) {
      const init = (low ? { priority: 'low' } : {}) as RequestInit
      p = fetch(new URL(this.address(file), document.baseURI), init).then((r) => {
        if (!r.ok) throw new Error(`asset did not load: ${file}`)
        return r.arrayBuffer()
      })
      this.loaded.set(file, p)
      p.catch(() => this.loaded.get(file) === p && this.loaded.delete(file))
    }
    return p
  }

  /** Fetches what the group needs before it can be drawn. */
  async loadGroup(group: string): Promise<void> {
    await Promise.all(this.entries(group).map((e) => this.fetchFile(this.early(e).path)))
  }

  release(file: string): void {
    this.loaded.delete(file)
  }
}
