import sys, re
p = sys.argv[1] + '/src/scene/steps.ts'
s = open(p).read()
a = "  do small = steps.shift()?.()\n  while (small && now() < until)\n"
assert a in s
s = s.replace(a, "  do {\n    const t0 = performance.now()\n    small = steps.shift()?.()\n    ;(globalThis as { __steps?: unknown[][] }).__steps?.push([probeSeason, performance.now() - t0, steps.length, small ? 1 : 0, Math.round(t0)])\n  } while (small && now() < until)\n")
b = "  const awaited = wish.awaits(season)\n"
assert b in s
s = s.replace(b, b + "  probeSeason = season\n")
s = s.replace("export function runFor(", "let probeSeason = ''\nexport function runFor(")
open(p, 'w').write(s)
print('probe in', p)
