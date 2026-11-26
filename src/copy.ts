import { config } from './config'

const titled = (id: string): string => id.charAt(0).toUpperCase() + id.slice(1)

export const copy = {
  shake: {
    word: 'Shake',
    rest: 'the globe',
  },
  seasons: {
    group: 'Season',
    name: (id: string): string => titled(id),
  },
  sound: {
    name: 'Sound',
  },
  cannot: 'This browser cannot draw the globe. A current Chrome, Safari, Firefox or Edge can.',
  menu: {
    name: 'Owner menu',
    quality: 'Quality',
    season: 'Season',
    state: 'State',
    view: 'View',
    play: 'Play',
    auto: 'auto',
    none: 'none',
    states: Object.keys(config.states).map((k) => k.replace(/Seconds$/, '')),
    views: ['ids', 'standins', 'albedo', 'normals', 'depth', 'texels', 'cover', 'flow', 'lightgrid', 'refraction', 'change'],
    plays: ['live', 'film-b', 'film-a', 'loop'] as const,
  },
  probe: {
    title: 'Frame rate probe',
    waiting: 'Starting',
    measuring: (level: string, phase: 'rest' | 'storm'): string => `Measuring ${level}, ${phase === 'rest' ? 'at rest' : 'in the storm'}`,
    left: (seconds: number): string => `about ${seconds} s left`,
    done: 'Done',
    failed: 'The probe stopped before the end',
    level: 'Level',
    rest: 'At rest',
    storm: 'In the storm',
    median: 'Median',
    slow: 'Slowest 1%',
    unit: 'fps',
    graphics: 'Graphics',
    screen: 'Screen',
    screenAt: (size: string, ratio: number): string => `${size} at ${ratio}x`,
    pick: 'Pick',
    browser: 'Browser',
    glass: 'Glass',
    maths: 'Arithmetic',
    empty: '\u00b7',
    copy: 'Copy',
    copied: 'Copied',
    select: 'Select the text and copy it',
    textName: 'Results as plain text',
    line: (level: string, rest: string, restSlow: string, storm: string, stormSlow: string): string =>
      `${level}: rest ${rest} fps (slowest 1% ${restSlow}), storm ${storm} fps (slowest 1% ${stormSlow})`,
  },
} as const

export const timing = {
  idleSeconds: 8,
  dimTo: 0.36,
  dimOutSeconds: 0.9,
  dimInSeconds: 0.18,
  hintSeconds: 1.9,
  latchSeconds: 0.5,
  pressSeconds: 0.26,
  moveGapSeconds: 0.2,
  fontWaitSeconds: 1.2,
  copiedSeconds: 1.6,
  lineSteps: 240,
} as const
