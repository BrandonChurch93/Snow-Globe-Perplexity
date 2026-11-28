/**
 * Item 295's probe build, on agent/p6-loss-295 and nowhere else: the parts of the page the address turns off
 * (`?off=flakes,glass`). Every switch only leaves a part out; none changes what a part that stays does. Main has no
 * such file, and a page without `off` in its address is main's page.
 *
 * The switches, by name:
 *   flakes     the particles are not drawn                         (src/scene/stage.ts, drawSample)
 *   veil       the shared veil of the air is cleared every frame   (src/scene/stage.ts, drawSample)
 *   glass      the globe's shell (through, shell, bubble, stamp) is not in the scene (stage.ts, constructor, handHidden)
 *   frost      the season's dressing of the glass is not in the scene         (stage.ts, making)
 *   dressing   the season's dressing of the table is not in the scene         (stage.ts, making)
 *   base       the season's base is not in the scene                          (stage.ts, making)
 *   miniature  the season's miniature is not in the scene                     (stage.ts, making)
 *   arrival    the season's arrival parts are not in the scene                (stage.ts, making)
 *   lamps      the season's lamps (kit.lights) are not in the scene           (stage.ts, making)
 *   pond       the pond's mirror has no sources                    (src/seasons/winter/mini/village.ts)
 *   backdrop   the backdrop is not in the scene                    (stage.ts, constructor)
 *   table      the slab of the table is not in the scene           (stage.ts, constructor)
 *   mirror     the table's mirror pass is not drawn                (stage.ts, drawSample)
 *   shadow     the shadow map is never drawn                       (src/scene/passes.ts; stage.ts, give)
 *   post       the picture is resolved raw: no glow chain, no lens fall  (src/app/painter.ts)
 *   msaa       the page's picture has no samples                   (src/app/painter.ts)
 *   detail     the whole pictures are not loaded after the first picture (src/app/app.ts)
 *   next       the other seasons are not made after the first picture    (src/app/app.ts)
 *   hidden     the hand of what the season on show hides is not begun    (stage.ts, shows, hand)
 *   hands      no hand gives anything to the GPU                   (stage.ts, hand)
 *   interface  the controls are not mounted                        (src/app/app.ts)
 *   sound      the sound engine is not loaded                      (src/app/app.ts)
 */
const asked: readonly string[] =
  typeof location === 'undefined'
    ? []
    : (new URLSearchParams(location.search).get('off') ?? '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)

export const off = (name: string): boolean => asked.includes(name)
