# WebGL2 extension portability notes

Collected 2026-11-24 (UTC). Question: which extensions are available in a WebGL2 context on 95 percent or more of devices in all of: Chrome desktop and Edge, Firefox desktop, Safari macOS, Safari iPhone and iPad. Chrome on Android is recorded but does not decide.

Marks: **stated** = a source says it and is quoted or cited; **measured** = survey numbers; **unknown** = no source settles it.

## Sources and their dates

- Survey (measured): https://web3dsurvey.com/webgl2 and one page per extension. Fetched 2026-11-24; the data embedded in the page carries the server time 2026-11-24T02:10:59Z. The pages show no collection date or sample size; the home page only says "Browser support based on recent survey results." (stated). The collection window is unknown.
- The survey gives one row per platform (Windows, Mac OS, Linux, Android, iOS, Chromium OS) and one row per browser (Chrome/Chromium, Edge, Firefox, Safari, Samsung Internet, Opera, Other). It does not cross platform with browser for WebGL2 (measured rows only). So "Firefox" mixes desktop and Android and all installed versions, "Safari" mixes macOS, iPhone and iPad, and "Chrome/Chromium" mixes desktop and Android.
- Whether iPads that send a desktop user agent are counted under "Mac OS" instead of "iOS": unknown (the survey does not say). The Mac OS row sits near 89 percent for every extension where iOS sits near 56 percent, which is consistent with that, but it is not stated anywhere.
- MDN browser-compat-data (stated): https://github.com/mdn/browser-compat-data, main branch, last commit 2026-11-23 (2f696a2). MDN does not separate WebGL1 from WebGL2 and does not record device dependence. "mirror" entries were read as the upstream browser value.
- Khronos registry (stated): https://registry.khronos.org/webgl/extensions/ . The registry site refused direct downloads here (HTTP 403), so the `extension.xml` source of each registry page was read from https://github.com/KhronosGroup/WebGL/tree/main/extensions on 2026-11-24. `api version` is the lowest WebGL version the extension is written against. The registry index states: "Extensions which are marked as promoted to core or removed in a certain version of the WebGL API must not be supported in an implementation of that or newer version of the WebGL API." None of the 32 extensions carries such a mark (checked in the XML).
- Firefox source (stated): https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLContextExtensions.cpp (file last changed 2026-10-09) and https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLExtensions.cpp . The extension list in that file is the full set Firefox can expose. It does not contain: NV_shader_noperspective_interpolation, EXT_conservative_depth, OES_sample_variables, OES_shader_multisample_interpolation, WEBGL_clip_cull_distance, WEBGL_multi_draw, WEBGL_polygon_mode, WEBGL_stencil_texturing, KHR_parallel_shader_compile, EXT_disjoint_timer_query_webgl2.
- WebKit source (stated): https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/mtl_format_table_autogen.mm (file last changed 2026-06-22) and https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/DisplayMtl.mm .
- Current releases seen in sources: Safari 27.2 released 2026-10-26 (https://developer.apple.com/documentation/safari-release-notes, stated); iOS 27 runs on iPhone 11 and newer plus iPhone SE 2nd and 3rd generation (https://support.apple.com/guide/iphone/iphone-models-compatible-with-ios-27-iphe3fa5df43/ios, stated); iPadOS 27 runs on iPad 9th generation and later, iPad mini 6th generation and later, iPad Air 4th generation and later, iPad Pro 4th generation and later (https://www.apple.com/os/ipados/, stated); MDN data on 2026-11-23 refers to Firefox 161 (stated). The task says Chrome 147 produced the extension list. The current Chrome and Firefox stable version numbers were not looked up: unknown.

## Decision rule

portable = true only when all eight survey rows Windows, Mac OS, Linux, iOS, Chrome/Chromium, Edge, Firefox, Safari are at 95 percent or more, and no other source says a deciding browser lacks it. Every one of the 32 extensions was settled by the survey rows; none is marked unknown. Limits of this rule:

- The Firefox, Linux and Chrome rows include old browser versions and Android, so a "false" for an extension that Firefox added recently (EXT_clip_control 159, EXT_texture_norm16 159, EXT_polygon_offset_clamp 158, EXT_texture_mirror_clamp_to_edge 160, EXT_depth_clamp 130) means "under the 95 line in the survey today". Whether current Firefox desktop alone would reach 95 percent for these is unknown.
- For extensions Firefox does not implement, the Firefox row still shows 2.4 to 2.8 percent. Why is unknown. (The Khronos wiki states that all browsers on iOS use WebKit, https://wikis.khronos.org/webgl/Implementations/SafariiOS, which would explain it if the survey labels Firefox on iOS as Firefox, but the survey does not say.)

## Result

Portable (6): EXT_color_buffer_float, EXT_texture_filter_anisotropic, OES_draw_buffers_indexed, WEBGL_debug_renderer_info, WEBGL_debug_shaders, WEBGL_lose_context

Not portable (26): EXT_clip_control, EXT_color_buffer_half_float, EXT_conservative_depth, EXT_depth_clamp, EXT_disjoint_timer_query_webgl2, EXT_float_blend, EXT_polygon_offset_clamp, EXT_texture_compression_bptc, EXT_texture_compression_rgtc, EXT_texture_mirror_clamp_to_edge, NV_shader_noperspective_interpolation, OES_sample_variables, OES_shader_multisample_interpolation, OES_texture_float_linear, OVR_multiview2, WEBGL_clip_cull_distance, WEBGL_compressed_texture_astc, WEBGL_compressed_texture_etc, WEBGL_compressed_texture_etc1, WEBGL_compressed_texture_s3tc, WEBGL_compressed_texture_s3tc_srgb, WEBGL_multi_draw, WEBGL_polygon_mode, WEBGL_stencil_texturing, EXT_texture_norm16, KHR_parallel_shader_compile

Could not settle: none. One open point is recorded under EXT_color_buffer_float.

## Survey table (measured, percent of reports that support the extension in WebGL2, fetched 2026-11-24)

| Extension | Windows | Mac OS | Linux | iOS | Android | Chrome | Edge | Firefox | Safari | portable |
|--|--|--|--|--|--|--|--|--|--|--|
| EXT_clip_control | 98.79 | 95.95 | 78.66 | 99.3 | 70.91 | 94.9 | 99.62 | 74.77 | 98.87 | no |
| EXT_color_buffer_float | 99.98 | 99.99 | 99.48 | 99.99 | 99.88 | 99.92 | 100 | 99.98 | 100 | yes |
| EXT_color_buffer_half_float | 92 | 92.85 | 60.53 | 99.99 | 82.35 | 99.22 | 99.95 | 2.8 | 99.99 | no |
| EXT_conservative_depth | 91.61 | 91.41 | 51.88 | 99.25 | 10.16 | 83.85 | 98.52 | 2.72 | 98.6 | no |
| EXT_depth_clamp | 99.06 | 99.45 | 92.19 | 99.3 | 24.24 | 88.73 | 99.12 | 86.55 | 99.09 | no |
| EXT_disjoint_timer_query_webgl2 | 86.06 | 61.06 | 43.82 | 0.2 | 0.53 | 80.13 | 94.44 | 0.07 | 0.21 | no |
| EXT_float_blend | 99.99 | 88.98 | 99.5 | 56 | 99.77 | 98.3 | 99.74 | 98.74 | 61.56 | no |
| EXT_polygon_offset_clamp | 98.88 | 95.94 | 80.93 | 99.3 | 51.32 | 93.61 | 99.33 | 75.72 | 98.87 | no |
| EXT_texture_compression_bptc | 99.69 | 85.24 | 93.37 | 55.99 | 23.72 | 86.41 | 98.91 | 81.65 | 61.25 | no |
| EXT_texture_compression_rgtc | 99.95 | 88.96 | 94.07 | 55.99 | 27.2 | 87.29 | 99.06 | 89.79 | 61.55 | no |
| EXT_texture_filter_anisotropic | 99.99 | 100 | 99.15 | 99.99 | 95.26 | 99.27 | 99.98 | 99.76 | 100 | yes |
| EXT_texture_mirror_clamp_to_edge | 98.4 | 95.85 | 74.64 | 98.06 | 24.73 | 88.03 | 98.97 | 67.48 | 97.1 | no |
| NV_shader_noperspective_interpolation | 91.82 | 92.19 | 54.9 | 99.25 | 34.89 | 90.72 | 99.31 | 2.73 | 98.81 | no |
| OES_draw_buffers_indexed | 99.94 | 99.98 | 97.18 | 99.97 | 83.52 | 98.44 | 99.91 | 99.93 | 99.99 | yes |
| OES_sample_variables | 91.08 | 90.79 | 56.86 | 97.97 | 72.1 | 97.38 | 99.07 | 2.72 | 97.03 | no |
| OES_shader_multisample_interpolation | 91.08 | 90.75 | 56.58 | 97.94 | 72.1 | 97.34 | 99.06 | 2.72 | 97.01 | no |
| OES_texture_float_linear | 99.99 | 88.99 | 97.51 | 56.08 | 77.01 | 94.03 | 99.58 | 96.63 | 61.61 | no |
| OVR_multiview2 | 99.59 | 0.7 | 36.85 | 1.09 | 12.62 | 57.69 | 94.27 | 60.66 | 0.72 | no |
| WEBGL_clip_cull_distance | 91.88 | 92.43 | 53.54 | 99.35 | 31.31 | 84.66 | 99.33 | 2.73 | 99.29 | no |
| WEBGL_compressed_texture_astc | 1.88 | 92.21 | 82.19 | 99.93 | 99.82 | 48.81 | 6.19 | 44.4 | 98.08 | no |
| WEBGL_compressed_texture_etc | 1.88 | 88.07 | 91.09 | 99.93 | 99.91 | 49.04 | 6.19 | 38.64 | 98.08 | no |
| WEBGL_compressed_texture_etc1 | 1.86 | 88.07 | 53.53 | 99.93 | 99.89 | 49.04 | 6.19 | 15.3 | 98.08 | no |
| WEBGL_compressed_texture_s3tc | 99.95 | 88.97 | 94.62 | 55.99 | 31.07 | 87.76 | 99.07 | 89.97 | 61.55 | no |
| WEBGL_compressed_texture_s3tc_srgb | 99.95 | 88.97 | 94.45 | 55.99 | 31.06 | 87.75 | 99.07 | 89.9 | 61.55 | no |
| WEBGL_debug_renderer_info | 99.99 | 100 | 99.89 | 100 | 100 | 100 | 100 | 99.9 | 100 | yes |
| WEBGL_debug_shaders | 99.66 | 99.9 | 98.22 | 99.99 | 99.53 | 99.67 | 99.95 | 99.09 | 100 | yes |
| WEBGL_lose_context | 100 | 99.99 | 99.51 | 100 | 100 | 99.96 | 100 | 99.97 | 100 | yes |
| WEBGL_multi_draw | 92.01 | 92.85 | 60.84 | 100 | 89.27 | 99.94 | 99.98 | 2.75 | 100 | no |
| WEBGL_polygon_mode | 91.86 | 92.32 | 31.8 | 99.3 | 7.44 | 81.66 | 98.42 | 2.73 | 99.05 | no |
| WEBGL_stencil_texturing | 91.44 | 90.8 | 57.05 | 98.06 | 72.16 | 97.58 | 99.58 | 2.72 | 97.09 | no |
| EXT_texture_norm16 | 98.09 | 98.37 | 68.47 | 99.15 | 56.9 | 90.74 | 99.4 | 76.93 | 99.46 | no |
| KHR_parallel_shader_compile | 90.16 | 91.38 | 41.67 | 98.95 | 0.32 | 78 | 98.09 | 2.44 | 99.1 | no |

## Per extension

### EXT_clip_control

- Verdict: portable = false. Windows 98.8, macOS 96.0, iOS 99.3 percent, but Linux 78.7 and Firefox 74.8 percent (Firefox added it in 159) are under the 95 line; Android 70.9 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_clip_control, fetched 2026-11-24): all 93.44; platforms: Windows 98.79, Mac OS 95.95, Linux 78.66, Android 70.91, iOS 99.3, Chromium OS 84.49; browsers: Chrome/Chromium 94.9, Safari 98.87, Firefox 74.77, Edge 99.62, Samsung Internet 1.6, Opera 98.25, Other 83.28.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_clip_control.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_clip_control): Chrome 122; Edge same as chrome (122); Firefox 159; Safari 17.4; Safari on iOS same as safari (17.4); Chrome Android same as chrome (122); Firefox Android same as firefox (159). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_clip_control/, extension number 51, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).

### EXT_color_buffer_float

- Verdict: portable = true. Windows 99.98, macOS 99.99, Linux 99.5, iOS 99.99, Android 99.9 percent; RGBA16F and RGBA32F render on iOS, but 32F blending and filtering are missing on about 44 percent of iOS.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_color_buffer_float, fetched 2026-11-24): all 99.95; platforms: Windows 99.98, Mac OS 99.99, Linux 99.48, Android 99.88, iOS 99.99, Chromium OS 100; browsers: Chrome/Chromium 99.92, Safari 100, Firefox 99.98, Edge 100, Samsung Internet 100, Opera 100, Other 100.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_color_buffer_float.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_float): Chrome 56; Edge same as chrome (56); Firefox 51; Safari 15; Safari on iOS same as safari (15); Chrome Android same as chrome (56); Firefox Android same as firefox (51). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_color_buffer_float/, extension number 31, XML read 2026-11-24): community approved; depends on `api version="2.0"` (WebGL 2.0 contexts only).
- Khronos (stated): "The following floating-point internal formats become color-renderable: R16F, RG16F, RGBA16F, R32F, RG32F, RGBA32F and R11F_G11F_B10F." WebGL 2.0 only.
- MDN page (stated, modified 2026-10-31): "This extension is available to WebGL 2 contexts only."
- WebKit source (stated, https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/mtl_format_table_autogen.mm): MTLPixelFormatRGBA16Float has `.colorRenderable = true`, `.blendable = true`, `.filterable = true` with no device condition. MTLPixelFormatR32Float, RG32Float and RGBA32Float have `.colorRenderable = true` with no device condition. RGBA32Float has `.blendable` and `.filterable` set to `display->supportsMacGPUFamily(1) || (display->supportsAppleGPUFamily(7) && display->supports32BitFloatFiltering())`.
- WebKit bug 247240 (stated, Kimmo Kinnunen, 2023-05-11, https://bugs.webkit.org/show_bug.cgi?id=247240): "The extension should be supported on majority of iOS devices, including the M1 iPad Pro." and "Currently at least iOS 16.4 and iOS beta 16.5 do report the EXT_color_buffer_float." and "Current iOS devices do not implement EXT_float_blend. For linear texture filtering and float blending, EXT_color_buffer_half_float should be used."
- Same bug (stated, Dan Glastonbury, 2022-11-06): "Apple family GPUs don't support blending for 128-bit RGBA32F render targets".
- Disagreeing statement (stated, Apple forum, kkinnunen-apple, June 2024, https://developer.apple.com/forums/thread/727443): "Rendering to 32-bit float texture is currently not supported on any iOS device. Texture filtering of 32-bit float textures is currently not supported on any iOS device." This conflicts with the survey (iOS 99.99 percent report the extension), with the bug comment above by the same engineer, and with the current WebKit format table. Also (stated, public_webgl list, 2021-10-21, https://www.khronos.org/webgl/public-mailing-list/public_webgl/2110/msg00000.php): full float rendering "does not appear to work for our techniques on non-M1 iOS devices with iOS>=15" while half float worked.
- WebKit commit 314388@main (stated, 2026-06-02, commit message in the history of https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/mtl_format_table_autogen.mm): color bytes per render pass on iOS are limited to "32 (Apple2, 3), 64 bytes (Apple4, 5, 6), 128 bytes (Apple7+)" and "framebuffers that do not fit into 32 or 64 bytes on respective iOS GPUs are not complete". RGBA32F is 16 bytes per pixel and RGBA16F is 8, so on A13 and older iPhones a framebuffer can hold at most 4 RGBA32F or 8 RGBA16F color attachments (arithmetic from the stated limits).
- Answer to "can a WebGL2 app render to RGBA16F and RGBA32F on iPhone and iPad Safari": the extension is reported on 99.99 percent of iOS (measured) and current WebKit marks both formats color renderable on every Apple GPU (stated). RGBA16F also blends and filters everywhere (stated). RGBA32F cannot be blended or linearly filtered on about 44 percent of iOS (measured, see EXT_float_blend and OES_texture_float_linear). Whether RGBA32F rendering gives correct results on every older iPhone GPU was not tested on a device: unknown, given the two disagreeing statements above. RGBA16F is the format every source agrees on.

### EXT_color_buffer_half_float

- Verdict: portable = false. In WebGL2 Chrome 99.2, Edge 99.95, Safari 99.99 and iOS 99.99 percent expose it, but Firefox returns false in WebGL2 (survey 2.8 percent), so Windows 92.0 and Linux 60.5 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_color_buffer_half_float, fetched 2026-11-24): all 90.67; platforms: Windows 92, Mac OS 92.85, Linux 60.53, Android 82.35, iOS 99.99, Chromium OS 99.98; browsers: Chrome/Chromium 99.22, Safari 99.99, Firefox 2.8, Edge 99.95, Samsung Internet 71.26, Opera 99.71, Other 94.79.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_color_buffer_half_float.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_color_buffer_half_float): Chrome 63; Edge 17; Firefox 47 / 36 removed 47 partial note: Not supported on Windows.; Safari 14; Safari on iOS same as safari (14); Chrome Android same as chrome (63); Firefox Android 36. WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_color_buffer_half_float/, extension number 14, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- Khronos (stated): "In WebGL 2.0 contexts, the 16-bit floating-point types RGBA16F, RG16F, and R16F become available as color-renderable formats." Revision history: "Expose to WebGL 2.0 contexts to support devices which can render only to 16-bit floating point targets, and therefore can not support EXT_color_buffer_float."
- MDN page (stated, modified 2026-10-30): "This extension is available to both, WebGL1 and WebGL2 contexts. On WebGL 2, it's an alternative to using the EXT_color_buffer_float extension on platforms that support 16-bit floating point render targets but not 32-bit floating point render targets."
- Firefox source (stated, https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLExtensions.cpp): `bool WebGLExtensionColorBufferHalfFloat::IsSupported(const WebGLContext* webgl) { if (webgl->IsWebGL2()) return false; ...`. Firefox never exposes it in WebGL2. This is where MDN (Firefox 47, no WebGL version given) and the survey (Firefox 2.8 percent in WebGL2) disagree, and the Firefox source settles it.
- Where it is exposed in WebGL2: Chrome 99.22, Edge 99.95, Safari 99.99, iOS 99.99, Samsung Internet 71.26, Android 82.35 percent (measured). Not in Firefox (stated).

### EXT_conservative_depth

- Verdict: portable = false. Chrome desktop, Edge 98.5 and Safari 98.6 percent have it (iOS 99.3), but Firefox does not implement it (survey 2.7 percent, MDN false); Android 10.2 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_conservative_depth, fetched 2026-11-24): all 79.74; platforms: Windows 91.61, Mac OS 91.41, Linux 51.88, Android 10.16, iOS 99.25, Chromium OS 54.67; browsers: Chrome/Chromium 83.85, Safari 98.6, Firefox 2.72, Edge 98.52, Samsung Internet 0.8, Opera 94.47, Other 80.43.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_conservative_depth.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_conservative_depth): Chrome 122; Edge same as chrome (122); Firefox not supported; Safari 17.5; Safari on iOS same as safari (17.5); Chrome Android not supported; Firefox Android same as firefox (False). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_conservative_depth/, extension number 54, XML read 2026-11-24): community approved; depends on `api version="2.0"` (WebGL 2.0 contexts only).
- Firefox source (stated, https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLContextExtensions.cpp): not in the Firefox extension list.

### EXT_depth_clamp

- Verdict: portable = false. Windows 99.1, macOS 99.5, iOS 99.3 percent, but Linux 92.2 and Firefox 86.6 percent are under the 95 line; Android 24.2 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_depth_clamp, fetched 2026-11-24): all 90.42; platforms: Windows 99.06, Mac OS 99.45, Linux 92.19, Android 24.24, iOS 99.3, Chromium OS 83.51; browsers: Chrome/Chromium 88.73, Safari 99.09, Firefox 86.55, Edge 99.12, Samsung Internet 0.8, Opera 95.84, Other 81.26.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_depth_clamp.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_depth_clamp): Chrome 121; Edge same as chrome (121); Firefox 130; Safari 17.4; Safari on iOS same as safari (17.4); Chrome Android not supported; Firefox Android not supported. WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_depth_clamp/, extension number 52, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).

### EXT_disjoint_timer_query_webgl2

- Verdict: portable = false. Chromium only: Windows 86.1, macOS 61.1, Linux 43.8 percent, but iOS 0.2, Safari 0.2 and Firefox 0.1 percent; MDN lists Firefox and Safari as unsupported.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_disjoint_timer_query_webgl2, fetched 2026-11-24): all 63.1; platforms: Windows 86.06, Mac OS 61.06, Linux 43.82, Android 0.53, iOS 0.2, Chromium OS 99.25; browsers: Chrome/Chromium 80.13, Safari 0.21, Firefox 0.07, Edge 94.44, Samsung Internet 1.47, Opera 88.1, Other 26.66.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_disjoint_timer_query_webgl2.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_disjoint_timer_query_webgl2): Chrome 70 / 56 removed 62; Edge 80; Firefox not supported; Safari not supported; Safari on iOS same as safari (False); Chrome Android not supported; Firefox Android same as firefox (False). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_disjoint_timer_query_webgl2/, extension number 33, XML read 2026-11-24): community approved; depends on `api version="2.0"` (WebGL 2.0 contexts only).
- Firefox source (stated, https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLContextExtensions.cpp): not in the Firefox extension list.

### EXT_float_blend

- Verdict: portable = false. Windows 99.99, Linux 99.5, Firefox 98.7 percent, but iOS only 56.0 and Safari 61.6 percent: WebKit blends RGBA32F only on Apple GPU family 7 or newer; macOS 89.0, Android 99.8 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_float_blend, fetched 2026-11-24): all 93.53; platforms: Windows 99.99, Mac OS 88.98, Linux 99.5, Android 99.77, iOS 56, Chromium OS 97; browsers: Chrome/Chromium 98.3, Safari 61.56, Firefox 98.74, Edge 99.74, Samsung Internet 100, Opera 99.33, Other 80.84.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_float_blend.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_float_blend): Chrome 75; Edge same as chrome (75); Firefox 67; Safari 14.1; Safari on iOS 15 removed 16; Chrome Android 75 note: Until Chrome 77, this extension was unavailable on several Android devices powered by GLES 3.2. See [bug 41459397](https://crbug.com/41459397).; Firefox Android same as firefox (67). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_float_blend/, extension number 35, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- Khronos (stated): "This extension applies to both WebGL 1.0 and 2.0 contexts."
- MDN data (stated): Safari 14.1; Safari on iOS added 15, removed 16. The survey disagrees (iOS 56 percent today), so the WebKit source was read.
- WebKit source (stated): RGBA32Float `.blendable = display->supportsMacGPUFamily(1) || (display->supportsAppleGPUFamily(7) && display->supports32BitFloatFiltering())`; R32Float and RG32Float have `.blendable = true`.
- WebKit bug 247240 (stated, 2022-11-06): "Apple family GPUs don't support blending for 128-bit RGBA32F render targets ... The way the EXT_float_blend extension is written is that it enables blending for all the formats listed in EXT_color_buffer_float, including RGBA32F that these hardware families can't support."
- Firefox source (stated): supported when EXT_color_buffer_float is and the driver is desktop GL 3.0 or newer, GLES 3.2 or newer, or has GL_EXT_float_blend.

### EXT_polygon_offset_clamp

- Verdict: portable = false. Windows 98.9, macOS 95.9, iOS 99.3 percent, but Linux 80.9 and Firefox 75.7 percent (Firefox added it in 158) are under the 95 line; Android 51.3 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_polygon_offset_clamp, fetched 2026-11-24): all 92.59; platforms: Windows 98.88, Mac OS 95.94, Linux 80.93, Android 51.32, iOS 99.3, Chromium OS 99.88; browsers: Chrome/Chromium 93.61, Safari 98.87, Firefox 75.72, Edge 99.33, Samsung Internet 0.8, Opera 96.42, Other 81.06.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_polygon_offset_clamp.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_polygon_offset_clamp): Chrome 122; Edge same as chrome (122); Firefox 158; Safari 17.4; Safari on iOS same as safari (17.4); Chrome Android same as chrome (122); Firefox Android same as firefox (158). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_polygon_offset_clamp/, extension number 50, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).

### EXT_texture_compression_bptc

- Verdict: portable = false. Windows 99.7, Linux 93.4, macOS 85.2 percent, but iOS only 56.0 and Safari 61.3 percent (only Apple GPUs with BC support); Android 23.7 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_texture_compression_bptc, fetched 2026-11-24): all 83.65; platforms: Windows 99.69, Mac OS 85.24, Linux 93.37, Android 23.72, iOS 55.99, Chromium OS 80.57; browsers: Chrome/Chromium 86.41, Safari 61.25, Firefox 81.65, Edge 98.91, Samsung Internet 36.76, Opera 94.55, Other 69.99.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_texture_compression_bptc.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_texture_compression_bptc): Chrome 93 / 92 removed 93 partial note: Only supported on macOS.; Edge same as chrome (93 / 92 removed 93 partial); Firefox 68; Safari 16; Safari on iOS same as safari (16); Chrome Android 92; Firefox Android not supported. WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_texture_compression_bptc/, extension number 38, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- WebKit source (stated): BC formats use `display->supportsBCTextureCompression()` (device dependent on iOS).
- MDN data (stated): Firefox for Android false; Chrome 93 on all desktop platforms (92 was macOS only).

### EXT_texture_compression_rgtc

- Verdict: portable = false. Windows 99.95, Linux 94.1, macOS 89.0 percent, but iOS only 56.0 and Safari 61.6 percent (MDN: Safari on iOS from 18.5, only Apple GPUs with BC support); Android 27.2 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_texture_compression_rgtc, fetched 2026-11-24): all 85; platforms: Windows 99.95, Mac OS 88.96, Linux 94.07, Android 27.2, iOS 55.99, Chromium OS 80.58; browsers: Chrome/Chromium 87.29, Safari 61.55, Firefox 89.79, Edge 99.06, Samsung Internet 36.76, Opera 95.3, Other 70.13.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_texture_compression_rgtc.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_texture_compression_rgtc): Chrome 93 / 83 removed 93 partial note: Only supported on macOS.; Edge same as chrome (93 / 83 removed 93 partial); Firefox 65; Safari 14.1; Safari on iOS 18.5; Chrome Android 83; Firefox Android same as firefox (65). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_texture_compression_rgtc/, extension number 39, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).

### EXT_texture_filter_anisotropic

- Verdict: portable = true. Windows 99.99, macOS 100, Linux 99.2, iOS 99.99 percent; Chrome 99.3, Edge 99.98, Firefox 99.8, Safari 100 percent; Android 95.3 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_texture_filter_anisotropic, fetched 2026-11-24): all 99.48; platforms: Windows 99.99, Mac OS 100, Linux 99.15, Android 95.26, iOS 99.99, Chromium OS 99.98; browsers: Chrome/Chromium 99.27, Safari 100, Firefox 99.76, Edge 99.98, Samsung Internet 97.19, Opera 99.79, Other 99.42.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_texture_filter_anisotropic.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_texture_filter_anisotropic): Chrome 34 / 35; Edge 12 / 79; Firefox 47; Safari 9.1; Safari on iOS same as safari (9.1); Chrome Android same as chrome (34 / 35); Firefox Android same as firefox (47). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_texture_filter_anisotropic/, extension number 11, XML read 2026-11-24): Khronos ratified; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- Khronos (stated): ratified; "In WebGL 2, additionally the getSamplerParameter, samplerParameterf and samplerParameteri entry points" accept the extension parameter.
- WebKit source (stated, https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/DisplayMtl.mm): `mNativeExtensions.textureFilterAnisotropicEXT = true;` with no device condition.
- Firefox source (stated): exposed when the driver has the GL extension.

### EXT_texture_mirror_clamp_to_edge

- Verdict: portable = false. Windows 98.4, macOS 95.9, iOS 98.1 percent, but Linux 74.6 and Firefox 67.5 percent (Firefox added it in 160) are under the 95 line; Android 24.7 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_texture_mirror_clamp_to_edge, fetched 2026-11-24): all 88.01; platforms: Windows 98.4, Mac OS 95.85, Linux 74.64, Android 24.73, iOS 98.06, Chromium OS 78.93; browsers: Chrome/Chromium 88.03, Safari 97.1, Firefox 67.48, Edge 98.97, Samsung Internet 0.8, Opera 95.88, Other 80.31.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_texture_mirror_clamp_to_edge.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_texture_mirror_clamp_to_edge): Chrome 124; Edge same as chrome (124); Firefox 160; Safari 18; Safari on iOS same as safari (18); Chrome Android same as chrome (124); Firefox Android same as firefox (160). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_texture_mirror_clamp_to_edge/, extension number 62, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).

### NV_shader_noperspective_interpolation

- Verdict: portable = false. Chrome desktop, Edge 99.3 and Safari 98.8 percent have it (iOS 99.3), but Firefox does not implement it (survey 2.7 percent, MDN false); Android 34.9 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/NV_shader_noperspective_interpolation, fetched 2026-11-24): all 84.31; platforms: Windows 91.82, Mac OS 92.19, Linux 54.9, Android 34.89, iOS 99.25, Chromium OS 82.72; browsers: Chrome/Chromium 90.72, Safari 98.81, Firefox 2.73, Edge 99.31, Samsung Internet 1.6, Opera 97.34, Other 80.99.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/NV_shader_noperspective_interpolation.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/NV_shader_noperspective_interpolation): Chrome 122; Edge same as chrome (122); Firefox not supported; Safari 17.5; Safari on iOS same as safari (17.5); Chrome Android not supported; Firefox Android same as firefox (False). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/NV_shader_noperspective_interpolation/, extension number 55, XML read 2026-11-24): community approved; depends on `api version="2.0"` (WebGL 2.0 contexts only).
- Firefox source (stated, https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLContextExtensions.cpp): not in the Firefox extension list.

### OES_draw_buffers_indexed

- Verdict: portable = true. Windows 99.94, macOS 99.98, Linux 97.2, iOS 99.97 percent; Chrome 98.4, Edge 99.9, Firefox 99.9, Safari 99.99 percent; Android only 83.5 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/OES_draw_buffers_indexed, fetched 2026-11-24): all 98.14; platforms: Windows 99.94, Mac OS 99.98, Linux 97.18, Android 83.52, iOS 99.97, Chromium OS 99.91; browsers: Chrome/Chromium 98.44, Safari 99.99, Firefox 99.93, Edge 99.91, Samsung Internet 2.41, Opera 99.33, Other 84.06.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/OES_draw_buffers_indexed.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/OES_draw_buffers_indexed): Chrome 100; Edge same as chrome (100); Firefox 108; Safari 16; Safari on iOS same as safari (16); Chrome Android same as chrome (100); Firefox Android same as firefox (108). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/OES_draw_buffers_indexed/, extension number 45, XML read 2026-11-24): community approved; depends on `api version="2.0"` (WebGL 2.0 contexts only).
- Firefox source (stated): for OES_draw_buffers_indexed the code returns false when the context is not WebGL2, and otherwise `gl->IsSupported(gl::GLFeature::draw_buffers_indexed)` plus a second driver check, so it depends on the driver.
- WebKit source (stated, https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/DisplayMtl.mm): `mNativeExtensions.drawBuffersIndexedOES = true;` with no device condition.
- Android is the weak spot: 83.52 percent, Samsung Internet 2.41 percent (measured). It does not decide here.

### OES_sample_variables

- Verdict: portable = false. Chrome 97.4, Edge 99.1, Safari 97.0, iOS 98.0 percent, but Firefox does not implement it (survey 2.7 percent, MDN false); Android 72.1 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/OES_sample_variables, fetched 2026-11-24): all 88.35; platforms: Windows 91.08, Mac OS 90.79, Linux 56.86, Android 72.1, iOS 97.97, Chromium OS 99.85; browsers: Chrome/Chromium 97.38, Safari 97.03, Firefox 2.72, Edge 99.07, Samsung Internet 0.8, Opera 98.67, Other 80.96.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/OES_sample_variables.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/OES_sample_variables): Chrome 126; Edge same as chrome (126); Firefox not supported; Safari 18; Safari on iOS same as safari (18); Chrome Android not supported; Firefox Android same as firefox (False). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/OES_sample_variables/, extension number 56, XML read 2026-11-24): community approved; depends on `api version="2.0"` (WebGL 2.0 contexts only).
- Firefox source (stated, https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLContextExtensions.cpp): not in the Firefox extension list.

### OES_shader_multisample_interpolation

- Verdict: portable = false. Chrome 97.3, Edge 99.1, Safari 97.0, iOS 97.9 percent, but Firefox does not implement it (survey 2.7 percent, MDN false); Android 72.1 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/OES_shader_multisample_interpolation, fetched 2026-11-24): all 88.32; platforms: Windows 91.08, Mac OS 90.75, Linux 56.58, Android 72.1, iOS 97.94, Chromium OS 99.76; browsers: Chrome/Chromium 97.34, Safari 97.01, Firefox 2.72, Edge 99.06, Samsung Internet 0.8, Opera 98.67, Other 80.94.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/OES_shader_multisample_interpolation.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/OES_shader_multisample_interpolation): Chrome 126; Edge same as chrome (126); Firefox not supported; Safari 18; Safari on iOS same as safari (18); Chrome Android not supported; Firefox Android same as firefox (False). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/OES_shader_multisample_interpolation/, extension number 57, XML read 2026-11-24): community approved; depends on `api version="2.0"` (WebGL 2.0 contexts only).
- Firefox source (stated, https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLContextExtensions.cpp): not in the Firefox extension list.

### OES_texture_float_linear

- Verdict: portable = false. Windows 99.99, Linux 97.5, Firefox 96.6 percent, but iOS only 56.1 and Safari 61.6 percent (older Apple GPUs cannot filter 32 bit float textures); macOS 89.0, Android 77.0 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/OES_texture_float_linear, fetched 2026-11-24): all 90.38; platforms: Windows 99.99, Mac OS 88.99, Linux 97.51, Android 77.01, iOS 56.08, Chromium OS 83.88; browsers: Chrome/Chromium 94.03, Safari 61.61, Firefox 96.63, Edge 99.58, Samsung Internet 71.66, Opera 98.46, Other 77.9.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/OES_texture_float_linear.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/OES_texture_float_linear): Chrome 29; Edge 12; Firefox 24; Safari 8; Safari on iOS 8 note: Only supported on iPadOS.; Chrome Android same as chrome (29); Firefox Android same as firefox (24). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/OES_texture_float_linear/, extension number 20, XML read 2026-11-24): Khronos ratified; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- MDN data note for Safari on iOS (stated): "Only supported on iPadOS." The survey disagrees in detail (iOS row 56.08 percent, which includes iPhones), so the WebKit source was read.
- WebKit source (stated): R32Float, RG32Float and RGBA32Float `.filterable = display->supportsMacGPUFamily(1) || (display->supportsAppleGPUFamily(7) && display->supports32BitFloatFiltering())`.
- WebKit bug 252359 (stated, Kimmo Kinnunen, 2023-02-18, https://bugs.webkit.org/show_bug.cgi?id=252359): "the iOS hardware does not support RGBA32Float filterability". Bug 264404 (stated, 2023-11-09): "Float textures are not filterable on iOS ... The bug is fixed on iOS 17", meaning older iOS reported the extension wrongly.
- Which iPhone and iPad models make up the 56 percent that report it: unknown (the survey has no model breakdown; the source ties it to Apple GPU family 7 or newer plus a Metal device flag).

### OVR_multiview2

- Verdict: portable = false. Windows 99.6 percent (ANGLE only), but macOS 0.7, Linux 36.9, iOS 1.1, Safari 0.7 and Firefox 60.7 percent; MDN lists Safari as unsupported; Android 12.6 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/OVR_multiview2, fetched 2026-11-24): all 54.06; platforms: Windows 99.59, Mac OS 0.7, Linux 36.85, Android 12.62, iOS 1.09, Chromium OS 53.99; browsers: Chrome/Chromium 57.69, Safari 0.72, Firefox 60.66, Edge 94.27, Samsung Internet 0.8, Opera 86.06, Other 26.24.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/OVR_multiview2.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/OVR_multiview2): Chrome 93 partial note: Only supported on Windows with ANGLE.; Edge same as chrome (93 partial); Firefox 71 partial note: Only supported on Windows with ANGLE.; Safari not supported; Safari on iOS same as safari (False); Chrome Android 93; Firefox Android same as firefox (71 partial). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/OVR_multiview2/, extension number 36, XML read 2026-11-24): community approved; depends on `api version="2.0"` (WebGL 2.0 contexts only).
- MDN data notes (stated): Chrome and Firefox "Only supported on Windows with ANGLE."

### WEBGL_clip_cull_distance

- Verdict: portable = false. Chrome desktop, Edge 99.3 and Safari 99.3 percent have it (iOS 99.4), but Firefox does not implement it (survey 2.7 percent, absent from Firefox source); Android 31.3 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_clip_cull_distance, fetched 2026-11-24): all 80.53; platforms: Windows 91.88, Mac OS 92.43, Linux 53.54, Android 31.31, iOS 99.35, Chromium OS 25; browsers: Chrome/Chromium 84.66, Safari 99.29, Firefox 2.73, Edge 99.33, Samsung Internet 7.62, Opera 97.25, Other 81.45.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_clip_cull_distance/, extension number 43, XML read 2026-11-24): community approved; depends on `api version="2.0"` (WebGL 2.0 contexts only).
- MDN (stated by absence): no compat data file and no MDN page exist for this extension (both URLs returned 404 on 2026-11-24). Firefox support according to MDN: unknown. Firefox source (stated): not in the Firefox extension list.

### WEBGL_compressed_texture_astc

- Verdict: portable = false. iOS 99.9, Android 99.8, macOS 92.2, Linux 82.2 percent, but Windows only 1.9 percent and Edge 6.2 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_compressed_texture_astc, fetched 2026-11-24): all 50.53; platforms: Windows 1.88, Mac OS 92.21, Linux 82.19, Android 99.82, iOS 99.93, Chromium OS 98.59; browsers: Chrome/Chromium 48.81, Safari 98.08, Firefox 44.4, Edge 6.19, Samsung Internet 99.6, Opera 12.86, Other 77.48.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/WEBGL_compressed_texture_astc.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_compressed_texture_astc): Chrome 47; Edge same as chrome (47); Firefox 53; Safari 12; Safari on iOS same as safari (12); Chrome Android same as chrome (47); Firefox Android same as firefox (53). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_compressed_texture_astc/, extension number 30, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- Windows 1.88 percent, Edge 6.19 percent (measured): desktop Windows GPUs do not report it. iOS 99.93, Android 99.82 percent.

### WEBGL_compressed_texture_etc

- Verdict: portable = false. iOS 99.9, Android 99.9, Linux 91.1, macOS 88.1 percent, but Windows only 1.9 percent and Edge 6.2 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_compressed_texture_etc, fetched 2026-11-24): all 50.17; platforms: Windows 1.88, Mac OS 88.07, Linux 91.09, Android 99.91, iOS 99.93, Chromium OS 99.89; browsers: Chrome/Chromium 49.04, Safari 98.08, Firefox 38.64, Edge 6.19, Samsung Internet 99.6, Opera 12.9, Other 77.51.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/WEBGL_compressed_texture_etc.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_compressed_texture_etc): Chrome 63; Edge same as chrome (63); Firefox 55; Safari 13.1; Safari on iOS same as safari (13.1); Chrome Android same as chrome (63); Firefox Android 51. WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_compressed_texture_etc/, extension number 29, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- Windows 1.88 percent, Edge 6.19 percent (measured). iOS 99.93, Android 99.91 percent.
- WebKit source (stated, https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/DisplayMtl.mm): exposed when `supportsAppleGPUFamily(1)` and the ETC formats are native.

### WEBGL_compressed_texture_etc1

- Verdict: portable = false. iOS 99.9, Android 99.9, macOS 88.1 percent, but Windows only 1.9, Linux 53.5 and Edge 6.2 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_compressed_texture_etc1, fetched 2026-11-24): all 48.12; platforms: Windows 1.86, Mac OS 88.07, Linux 53.53, Android 99.89, iOS 99.93, Chromium OS 99.89; browsers: Chrome/Chromium 49.04, Safari 98.08, Firefox 15.3, Edge 6.19, Samsung Internet 99.6, Opera 12.9, Other 77.51.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/WEBGL_compressed_texture_etc1.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_compressed_texture_etc1): Chrome 49; Edge same as chrome (49); Firefox 55; Safari 13.1; Safari on iOS same as safari (13.1); Chrome Android same as chrome (49); Firefox Android 30. WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_compressed_texture_etc1/, extension number 24, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).

### WEBGL_compressed_texture_s3tc

- Verdict: portable = false. Windows 99.95, Linux 94.6, macOS 89.0 percent, but iOS only 56.0 and Safari 61.6 percent (only Apple GPUs with BC support); Android 31.1 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_compressed_texture_s3tc, fetched 2026-11-24): all 85.42; platforms: Windows 99.95, Mac OS 88.97, Linux 94.62, Android 31.07, iOS 55.99, Chromium OS 80.61; browsers: Chrome/Chromium 87.76, Safari 61.55, Firefox 89.97, Edge 99.07, Samsung Internet 55.35, Opera 95.42, Other 70.64.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/WEBGL_compressed_texture_s3tc.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_compressed_texture_s3tc): Chrome 26 / 26 removed 56; Edge 12; Firefox 22 / 15 removed 58; Safari 8; Safari on iOS same as safari (8); Chrome Android not supported; Firefox Android not supported. WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_compressed_texture_s3tc/, extension number 8, XML read 2026-11-24): Khronos ratified; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- WebKit source (stated): BC formats use `display->supportsBCTextureCompression()`, which in https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/DisplayMtl.mm returns the Metal device flag on iOS 16.4 or newer and "false; // Always false on old iOS" before that.
- iOS 55.99 percent, Safari 61.55 percent, Android 31.07 percent (measured).

### WEBGL_compressed_texture_s3tc_srgb

- Verdict: portable = false. Windows 99.95, Linux 94.5, macOS 89.0 percent, but iOS only 56.0 and Safari 61.6 percent (only Apple GPUs with BC support); Android 31.1 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_compressed_texture_s3tc_srgb, fetched 2026-11-24): all 85.41; platforms: Windows 99.95, Mac OS 88.97, Linux 94.45, Android 31.06, iOS 55.99, Chromium OS 80.61; browsers: Chrome/Chromium 87.75, Safari 61.55, Firefox 89.9, Edge 99.07, Samsung Internet 55.35, Opera 95.42, Other 70.64.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/WEBGL_compressed_texture_s3tc_srgb.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_compressed_texture_s3tc_srgb): Chrome 60; Edge 80; Firefox 55; Safari 14.1; Safari on iOS same as safari (14.1); Chrome Android same as chrome (60); Firefox Android not supported. WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_compressed_texture_s3tc_srgb/, extension number 32, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).

### WEBGL_debug_renderer_info

- Verdict: portable = true. Windows 99.99, macOS 100, Linux 99.9, iOS 100, Firefox 99.9 percent; MDN says Firefox deprecates it and may remove it, and Khronos says the strings may be masked.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_debug_renderer_info, fetched 2026-11-24): all 99.99; platforms: Windows 99.99, Mac OS 100, Linux 99.89, Android 100, iOS 100, Chromium OS 100; browsers: Chrome/Chromium 100, Safari 100, Firefox 99.9, Edge 100, Samsung Internet 100, Opera 100, Other 100.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/WEBGL_debug_renderer_info.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_renderer_info): Chrome 33; Edge 12; Firefox 53 note: Deprecated, and may be removed in a future release (see [bug 1722782](https://bugzil.la/1722782)).; Safari 9.1; Safari on iOS same as safari (9.1); Chrome Android same as chrome (33); Firefox Android same as firefox (53). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_debug_renderer_info/, extension number 6, XML read 2026-11-24): Khronos ratified; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- MDN data note for Firefox (stated): "Deprecated, and may be removed in a future release (see bug 1722782)."
- Khronos (stated): "WebGL implementations might mask the RENDERER and VENDOR strings of the underlying graphics driver for privacy reasons."
- Firefox source (stated): listed under "Always supported".

### WEBGL_debug_shaders

- Verdict: portable = true. Windows 99.7, macOS 99.9, Linux 98.2, iOS 99.99 percent; Chrome 99.7, Edge 99.95, Firefox 99.1, Safari 100 percent; Android 99.5 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_debug_shaders, fetched 2026-11-24): all 99.67; platforms: Windows 99.66, Mac OS 99.9, Linux 98.22, Android 99.53, iOS 99.99, Chromium OS 100; browsers: Chrome/Chromium 99.67, Safari 100, Firefox 99.09, Edge 99.95, Samsung Internet 100, Opera 100, Other 98.73.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/WEBGL_debug_shaders.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_debug_shaders): Chrome 47; Edge same as chrome (47); Firefox 56; Safari 14; Safari on iOS same as safari (14); Chrome Android same as chrome (47); Firefox Android same as firefox (56). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_debug_shaders/, extension number 7, XML read 2026-11-24): Khronos ratified; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- Firefox source (stated): listed under "Always supported".

### WEBGL_lose_context

- Verdict: portable = true. Windows 100, macOS 99.99, Linux 99.5, iOS 100 percent; Chrome 99.96, Edge 100, Firefox 99.97, Safari 100 percent; Android 100 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_lose_context, fetched 2026-11-24): all 99.97; platforms: Windows 100, Mac OS 99.99, Linux 99.51, Android 100, iOS 100, Chromium OS 100; browsers: Chrome/Chromium 99.96, Safari 100, Firefox 99.97, Edge 100, Samsung Internet 100, Opera 100, Other 100.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/WEBGL_lose_context.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_lose_context): Chrome 26 / 18; Edge 17; Firefox 22 / 19 removed 58; Safari 8; Safari on iOS same as safari (8); Chrome Android same as chrome (26 / 18); Firefox Android same as firefox (22 / 19 removed 58). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_lose_context/, extension number 3, XML read 2026-11-24): Khronos ratified; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- Firefox source (stated): listed under "Always supported".

### WEBGL_multi_draw

- Verdict: portable = false. Chrome 99.9, Edge 99.98, Safari 100, iOS 100 percent, but Firefox does not implement it (survey 2.8 percent, MDN false), so Windows 92.0, macOS 92.9, Linux 60.8 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_multi_draw, fetched 2026-11-24): all 91.39; platforms: Windows 92.01, Mac OS 92.85, Linux 60.84, Android 89.27, iOS 100, Chromium OS 100; browsers: Chrome/Chromium 99.94, Safari 100, Firefox 2.75, Edge 99.98, Samsung Internet 100, Opera 100, Other 99.81.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/WEBGL_multi_draw.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_multi_draw): Chrome 86; Edge same as chrome (86); Firefox not supported; Safari 15; Safari on iOS same as safari (15); Chrome Android same as chrome (86); Firefox Android same as firefox (False). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_multi_draw/, extension number 40, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- Firefox source (stated): WEBGL_multi_draw is not in the Firefox extension list. MDN data (stated): Firefox false. Survey Firefox 2.75 percent (measured).
- Chrome 99.94, Edge 99.98, Safari 100, iOS 100, Android 89.27 percent (measured).

### WEBGL_polygon_mode

- Verdict: portable = false. Chrome desktop, Edge 98.4 and Safari 99.1 percent have it (iOS 99.3), but Firefox does not implement it (survey 2.7 percent, MDN false); Android 7.4 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_polygon_mode, fetched 2026-11-24): all 78.49; platforms: Windows 91.86, Mac OS 92.32, Linux 31.8, Android 7.44, iOS 99.3, Chromium OS 51.01; browsers: Chrome/Chromium 81.66, Safari 99.05, Firefox 2.73, Edge 98.42, Samsung Internet 19.12, Opera 94.71, Other 81.04.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/WEBGL_polygon_mode.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_polygon_mode): Chrome 121; Edge same as chrome (121); Firefox not supported; Safari 17.4; Safari on iOS same as safari (17.4); Chrome Android not supported; Firefox Android same as firefox (False). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_polygon_mode/, extension number 53, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- Firefox source (stated, https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLContextExtensions.cpp): not in the Firefox extension list.

### WEBGL_stencil_texturing

- Verdict: portable = false. Chrome 97.6, Edge 99.6, Safari 97.1, iOS 98.1 percent, but Firefox does not implement it (survey 2.7 percent, MDN false); Android 72.2 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/WEBGL_stencil_texturing, fetched 2026-11-24): all 88.54; platforms: Windows 91.44, Mac OS 90.8, Linux 57.05, Android 72.16, iOS 98.06, Chromium OS 99.78; browsers: Chrome/Chromium 97.58, Safari 97.09, Firefox 2.72, Edge 99.58, Samsung Internet 1.2, Opera 99.04, Other 81.09.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/WEBGL_stencil_texturing.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/WEBGL_stencil_texturing): Chrome 124; Edge same as chrome (124); Firefox not supported; Safari 18; Safari on iOS same as safari (18); Chrome Android not supported; Firefox Android same as firefox (False). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/WEBGL_stencil_texturing/, extension number 61, XML read 2026-11-24): community approved; depends on `api version="2.0"` (WebGL 2.0 contexts only).
- Firefox source (stated, https://github.com/mozilla-firefox/firefox/blob/main/dom/canvas/WebGLContextExtensions.cpp): not in the Firefox extension list.

### EXT_texture_norm16

- Verdict: portable = false. Windows 98.1, macOS 98.4, iOS 99.2 percent, but Linux 68.5 and Firefox 76.9 percent (Firefox added it in 159) are under the 95 line; Android 56.9 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/EXT_texture_norm16, fetched 2026-11-24): all 91.47; platforms: Windows 98.09, Mac OS 98.37, Linux 68.47, Android 56.9, iOS 99.15, Chromium OS 80.48; browsers: Chrome/Chromium 90.74, Safari 99.46, Firefox 76.93, Edge 99.4, Samsung Internet 50.67, Opera 97.71, Other 92.7.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/EXT_texture_norm16.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/EXT_texture_norm16): Chrome 87; Edge same as chrome (87); Firefox 159; Safari 16; Safari on iOS same as safari (16); Chrome Android same as chrome (87); Firefox Android same as firefox (159). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/EXT_texture_norm16/, extension number 44, XML read 2026-11-24): community approved; depends on `api version="2.0"` (WebGL 2.0 contexts only).
- Firefox source (stated): `return webgl->IsWebGL2() && gl->IsSupported(gl::GLFeature::texture_norm16);` so it depends on the driver.

### KHR_parallel_shader_compile

- Verdict: portable = false. Chrome desktop, Edge 98.1 and Safari 99.1 percent have it (iOS 99.0), but Firefox does not implement it (survey 2.4 percent, MDN false); Android 0.3 percent.
- Survey (measured, https://web3dsurvey.com/webgl2/extensions/KHR_parallel_shader_compile, fetched 2026-11-24): all 75.99; platforms: Windows 90.16, Mac OS 91.38, Linux 41.67, Android 0.32, iOS 98.95, Chromium OS 29.53; browsers: Chrome/Chromium 78, Safari 99.1, Firefox 2.44, Edge 98.09, Samsung Internet 0.4, Opera 94.42, Other 80.62.
- MDN data (stated, https://github.com/mdn/browser-compat-data/blob/main/api/KHR_parallel_shader_compile.json, repo state 2026-11-23, page https://developer.mozilla.org/en-US/docs/Web/API/KHR_parallel_shader_compile): Chrome 76; Edge same as chrome (76); Firefox not supported; Safari 14.1; Safari on iOS same as safari (14.1); Chrome Android same as chrome (76); Firefox Android same as firefox (False). WebGL1 versus WebGL2 is not separated.
- Khronos (stated, https://registry.khronos.org/webgl/extensions/KHR_parallel_shader_compile/, extension number 37, XML read 2026-11-24): community approved; depends on `api version="1.0"` (written against WebGL 1.0; no mark that removes it from WebGL 2.0).
- WebKit source (stated, https://github.com/WebKit/WebKit/blob/main/Source/ThirdParty/ANGLE/src/libANGLE/renderer/metal/DisplayMtl.mm): `mNativeExtensions.parallelShaderCompileKHR = true;`. Firefox source (stated): not in the Firefox extension list.
