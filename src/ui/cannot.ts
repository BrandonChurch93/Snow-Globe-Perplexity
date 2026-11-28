import { copy } from '../copy'
import './face.css'
import s from './cannot.module.css'

/** The notice, in the words of a browser that has no WebGL2 (`cannot`) or of a page whose globe stopped drawing (`lost`). */
export function showCannot(root: HTMLElement, which: 'cannot' | 'lost' = 'cannot'): HTMLElement {
  const line = document.createElement('p')
  const words = document.createElement('span')
  line.className = s.cannot!
  line.setAttribute('role', 'status')
  copy[which].split(/(?<=\.) /).forEach((sentence, i) => {
    const part = document.createElement('span')
    part.textContent = sentence
    words.append(i ? ' ' : '', part)
  })
  line.append(words)
  root.replaceChildren(line)
  document.documentElement.dataset.cannot = '1'
  return line
}
