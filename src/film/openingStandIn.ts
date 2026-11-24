import { config } from '../config'
import { flagStandIn } from '../core/standins'
import { openingPlan } from './opening'

const LEVELS = ['Low', 'Medium', 'High']
const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)
const ramp = (frame: number, from: number, frames: number): number => Math.max(0, Math.min(1, (frame - from) / frames))

export function drawOpening(root: HTMLElement, frame: number): void {
  flagStandIn('opening')
  const plan = openingPlan()
  const i = config.intro
  const fps = plan.fps
  const f = Math.max(0, Math.min(plan.frameCount - 1, Math.round(frame)))
  const page = 'position:absolute;inset:0;background:#101112;color:#e8e8e6;font:400 1.25vw/1.5 ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden'
  const mark = '<svg viewBox="0 0 24 24" style="width:2.2vw;height:2.2vw;display:block"><path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7" fill="none" stroke="#2fb8c6" stroke-width="1.6" stroke-linecap="round"/></svg>'
  if (f < plan.build.first) {
    const typed = plan.keyTaps.filter((k) => k <= f).length
    const caret = f <= plan.typing.last || Math.floor((f * 2) / fps) % 2 === 0
    const open = f >= plan.reasoning.open && f < plan.reasoning.choose
    const chosen = f >= plan.reasoning.choose
    const levels = LEVELS.includes(i.reasoning) ? LEVELS : [...LEVELS, i.reasoning]
    const level = chosen ? i.reasoning : levels[Math.max(0, levels.indexOf(i.reasoning) - 1)]!
    const near = open ? ramp(f, plan.reasoning.open, plan.reasoning.choose - plan.reasoning.open) : 0
    const pressed = f >= plan.send
    const lit = typed > 0
    const menu = open
      ? `<div style="position:absolute;left:0;bottom:3.2vw;min-width:11vw;padding:.4vw;border-radius:.8vw;background:#1c1d1f;border:1px solid #33353a;box-shadow:0 1vw 3vw rgba(0,0,0,.5)">${levels
          .map((l) => `<div style="padding:.45vw .8vw;border-radius:.5vw;${l === i.reasoning && near > 0.55 ? 'background:#2a2c30;color:#fff' : 'color:#b9bab7'}">${esc(l)}</div>`)
          .join('')}</div>`
      : ''
    root.innerHTML = `<div style="${page}"><div style="margin-bottom:2.2vw">${mark}</div><div style="width:46vw;min-height:8.6vw;padding:1.2vw 1.4vw;border-radius:1.2vw;background:#1a1b1d;border:1px solid ${open || chosen ? '#3a3c41' : '#2c2e32'};box-sizing:border-box;display:flex;flex-direction:column;justify-content:space-between"><div style="min-height:3.8vw;font-size:1.3vw">${esc(i.prompt.slice(0, typed))}<span style="display:inline-block;width:.12vw;height:1.5vw;margin-left:.1vw;vertical-align:-.25vw;background:${caret ? '#e8e8e6' : 'transparent'}"></span></div><div style="display:flex;align-items:center;justify-content:space-between;margin-top:1vw"><div style="position:relative"><div style="padding:.35vw .9vw;border-radius:2vw;border:1px solid ${open ? '#2fb8c6' : '#3a3c41'};color:${chosen ? '#e8e8e6' : '#b9bab7'};font-size:1vw">${esc(level)} <span style="opacity:.6">&#9662;</span></div>${menu}</div><div style="width:2.6vw;height:2.6vw;border-radius:50%;background:${pressed ? '#8fe3ec' : lit ? '#2fb8c6' : '#2c2e32'};transform:scale(${pressed ? 0.9 : 1});display:flex;align-items:center;justify-content:center"><svg viewBox="0 0 24 24" style="width:1.3vw;height:1.3vw"><path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" fill="none" stroke="#101112" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></div></div></div></div>`
    return
  }
  const newest = plan.steps.filter((s) => s <= f).length - 1
  const lines = i.steps
    .map((text, n) => {
      const a = ramp(f, plan.steps[n]!, Math.round(fps * 0.2))
      const done = n < newest
      const dot = done
        ? '<svg viewBox="0 0 24 24" style="width:1.1vw;height:1.1vw"><path d="m5 12.5 4.5 4.5L19 7.5" fill="none" stroke="#2fb8c6" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : `<span style="display:block;width:.6vw;height:.6vw;margin:.25vw;border-radius:50%;background:#2fb8c6;opacity:${0.45 + 0.55 * Math.abs(Math.sin((Math.PI * (f - plan.steps[n]!)) / fps))}"></span>`
      return `<div style="display:flex;align-items:center;gap:.9vw;height:2.5vw;opacity:${a};transform:translateY(${(1 - a) * 0.5}vw);color:${done ? '#9a9b98' : '#e8e8e6'}"><span style="width:1.1vw;display:flex;justify-content:center">${dot}</span>${esc(text)}</div>`
    })
    .join('')
  const a = ramp(f, plan.build.first, Math.round(fps * 0.25))
  root.innerHTML = `<div style="${page};justify-content:flex-start;align-items:stretch;padding:5vw 27vw 0;box-sizing:border-box"><div style="opacity:${a}"><div style="align-self:flex-end;margin-left:auto;max-width:34vw;width:fit-content;padding:.9vw 1.2vw;border-radius:1.1vw;background:#1e1f22;color:#d5d6d3;font-size:1.1vw">${esc(i.prompt)}</div><div style="display:flex;align-items:center;gap:.9vw;margin:2.6vw 0 1.2vw">${mark}<div style="font-size:1.6vw;font-weight:500">${esc(i.buildTitle)}</div></div><div style="padding-left:.4vw">${lines}</div></div></div>`
}
