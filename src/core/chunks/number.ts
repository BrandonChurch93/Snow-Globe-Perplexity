/**
 * The build's one test for a broken number, read from the bits and not asked of the card. A compiler that takes every
 * number for a clean one may leave isnan() and isinf() out (Microsoft's does under Direct3D, warning X3577), and then
 * one sample that is not a number can spoil a pixel, and a blur can spread it over a block of the picture. The bits of a
 * float hold the answer whatever the compiler takes for granted: with the sign masked off, an infinity reads
 * 0x7f800000, what is not a number reads above it, and every number reads below it.
 *
 * Every shader made by `stageShader` and every `Pass` carries this text; no shader of the build asks isnan() or
 * isinf() itself (tests/glsl-number.test.ts), but the probe in maths.ts, which asks the card on purpose.
 */
export const NUMBER_GLSL = `#ifndef NUMBER_TESTS
#define NUMBER_TESTS
bool numberBroken(highp float x) { return (floatBitsToUint(x) & 0x7fffffffu) >= 0x7f800000u; }
bool numberBroken(highp vec3 v) { return any(greaterThanEqual(floatBitsToUint(v) & 0x7fffffffu, uvec3(0x7f800000u))); }
bool numberBroken(highp vec4 v) { return any(greaterThanEqual(floatBitsToUint(v) & 0x7fffffffu, uvec4(0x7f800000u))); }
bool numberNan(highp float x) { return (floatBitsToUint(x) & 0x7fffffffu) > 0x7f800000u; }
bool numberInf(highp float x) { return (floatBitsToUint(x) & 0x7fffffffu) == 0x7f800000u; }
#endif
`
