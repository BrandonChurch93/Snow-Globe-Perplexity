import { copy } from '../copy'
import './face.css'
import s from './cannot.module.css'

export function showCannot(root: HTMLElement): HTMLElement {
  const line = document.createElement('p')
  const words = document.createElement('span')
  line.className = s.cannot!
  line.setAttribute('role', 'status')
  copy.cannot.split(/(?<=\.) /).forEach((sentence, i) => {
    const part = document.createElement('span')
    part.textContent = sentence
    words.append(i ? ' ' : '', part)
  })
  line.append(words)
  root.replaceChildren(line)
  document.documentElement.dataset.cannot = '1'
  return line
}
