/**
 * GLSL for the two programs (MOTION_SYSTEM 10): `cells` (projection-blend
 * vertex shader, R8I grid array, R16I offsets, bins + lattice in the fragment
 * shader) and `strata` (instanced quads over the R32F core texture). The
 * unwrap function mirrors gl/projection.ts unwrapVertex line for line.
 */
const UNWRAP = /* glsl */ `
uniform vec2 u_view;
uniform mat3 u_rot;
uniform vec3 u_sphere;
uniform vec3 u_sheet;
uniform float u_s1, u_s2, u_s3;
uniform vec2 u_strip;
uniform vec4 u_core;
const float A1 = 1.340264, A2 = -0.081106, A3 = 0.000893, A4 = 0.003796, M = 0.8660254037844386;
const float RAD = 0.017453292519943295;
vec2 equalEarth(float lam, float phi) {
  float l = asin(M * sin(phi)), l2 = l * l, l6 = l2 * l2 * l2;
  return vec2(lam * cos(l) / (M * (A1 + 3.0 * A2 * l2 + l6 * (7.0 * A3 + 9.0 * A4 * l2))), l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)));
}
vec3 unwrap(vec2 ll, float slot) {
  float lon = ll.x * RAD, lat = ll.y * RAD;
  vec3 p = u_rot * vec3(cos(lat) * sin(lon), sin(lat), cos(lat) * cos(lon));
  vec2 e = equalEarth(lon, lat);
  vec2 q = vec2(u_sphere.x + u_sphere.z * p.x, u_sphere.y - u_sphere.z * p.y);
  q = mix(q, vec2(u_sheet.x + u_sheet.z * e.x, u_sheet.y - u_sheet.z * e.y), u_s1);
  float z = p.z * (1.0 - u_s1);
  q.x = mix(q.x, u_strip.x + (slot - 0.5) * u_strip.y, u_s2);
  if (u_s3 > 0.0) {
    float half_ = (u_core.y - u_core.x) * 0.5;
    float uu0 = q.x - u_strip.x, vv0 = u_sheet.y - q.y;
    float uu = mix(uu0, uu0 / u_strip.y * u_core.w, u_s3);
    float vv = mix(vv0, half_ * sin(lat), u_s3);
    vec2 c = vec2(mix(u_strip.x, u_core.x + half_, u_s3), mix(u_sheet.y, u_core.z, u_s3));
    float th = u_s3 * 1.5707963267948966, cs = cos(th), sn = sin(th);
    q = vec2(c.x + uu * cs + vv * sn, c.y - (-uu * sn + vv * cs));
  }
  return vec3(q, z);
}
vec4 toClip(vec3 q) { return vec4(q.x / u_view.x * 2.0 - 1.0, 1.0 - q.y / u_view.y * 2.0, -q.z * 0.5, 1.0); }
`;

const BINNING = /* glsl */ `
uniform vec3 u_bins[11];
uniform float u_lattice;
uniform float u_dpr;
int binOf(float v) {
  if (v <= -300.0) return 0;
  if (v <= -200.0) return 1;
  if (v <= -100.0) return 2;
  if (v <= -50.0) return 3;
  if (v <= -20.0) return 4;
  if (v < 20.0) return 5;
  if (v < 50.0) return 6;
  if (v < 100.0) return 7;
  if (v < 200.0) return 8;
  if (v < 300.0) return 9;
  return 10;
}
// "missing stays missing": 1px dots at a 4px screen pitch on black, never a colour
vec3 lattice() {
  vec2 q = mod(gl_FragCoord.xy, 4.0 * u_dpr);
  return (q.x < u_dpr && q.y < u_dpr) ? vec3(u_lattice) : vec3(0.0);
}
`;

export const CELL_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 a_ll;
in vec2 a_uv;
in vec2 a_cell;
in vec2 a_slot;
${UNWRAP}
out vec2 v_uv;
flat out ivec2 v_cell;
out float v_z;
void main() {
  vec3 q = unwrap(a_ll, mix(a_slot.x, a_slot.y, a_uv.x));
  v_uv = a_uv;
  v_cell = ivec2(a_cell);
  v_z = q.z;
  gl_Position = toClip(q);
}`;

export const CELL_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
precision highp isampler2DArray;
precision highp isampler2D;
in vec2 v_uv;
flat in ivec2 v_cell;
in float v_z;
uniform isampler2DArray u_grid;
uniform isampler2D u_offA;
uniform isampler2D u_offB;
uniform highp sampler2D u_coreTex;
uniform int u_layerA, u_layerB, u_coreYear, u_hasCore;
uniform float u_mix, u_baseMix, u_uniform, u_alpha, u_dim, u_gap, u_s1, u_s2;
uniform vec3 u_uniformColor;
${BINNING}
out vec4 o;
vec3 cell(int layer, int off) {
  int b = texelFetch(u_grid, ivec3(v_cell.y, v_cell.x, layer), 0).r;
  if (b == -128 || off == -32768) return lattice();
  return u_bins[binOf(float(b * 10 - off))];
}
void main() {
  if (u_s1 <= 0.0 && v_z < 0.0) discard; // back hemisphere of the sphere
  ivec2 t = ivec2(v_cell.y, v_cell.x);
  int oA = texelFetch(u_offA, t, 0).r, oB = texelFetch(u_offB, t, 0).r;
  vec3 a = mix(cell(u_layerA, oA), cell(u_layerA, oB), u_baseMix);
  vec3 c = a;
  if (u_mix > 0.0) c = mix(a, mix(cell(u_layerB, oA), cell(u_layerB, oB), u_baseMix), u_mix);
  if (u_hasCore == 1 && u_s2 > 0.0) {
    float m = texelFetch(u_coreTex, ivec2(v_cell.x, u_coreYear), 0).r;
    c = mix(c, m < -1.0e8 ? lattice() : u_bins[binOf(m)], u_s2);
  }
  c = mix(u_uniformColor, c, u_uniform);
  // hairline gap between cells: the grid reads as measurements, not a painting
  if (any(lessThan(v_uv, vec2(u_gap))) || any(greaterThan(v_uv, vec2(1.0 - u_gap)))) c = vec3(0.0);
  o = vec4(c * u_dim * u_alpha, u_alpha);
}`;

export const LINE_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 a_ll;
${UNWRAP}
out float v_z;
void main() {
  vec3 q = unwrap(a_ll, 0.5);
  v_z = q.z;
  gl_Position = toClip(q);
}`;

export const LINE_FS = /* glsl */ `#version 300 es
precision highp float;
in float v_z;
uniform float u_alpha, u_s1;
out vec4 o;
void main() {
  if (u_s1 <= 0.0 && v_z < 0.0) discard;
  o = vec4(vec3(u_alpha), u_alpha);
}`;

export const STRATA_VS = /* glsl */ `#version 300 es
precision highp float;
in vec2 a_corner;
in float a_year;
in float a_y;
uniform vec2 u_view;
uniform vec4 u_rect; // x0, x1, unused, stratum height
out float v_x;
flat out int v_year;
void main() {
  if (a_y < -1.0e8) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec2 p = vec2(mix(u_rect.x, u_rect.y, a_corner.x), a_y + a_corner.y * u_rect.w);
  v_x = p.x;
  v_year = int(a_year);
  gl_Position = vec4(p.x / u_view.x * 2.0 - 1.0, 1.0 - p.y / u_view.y * 2.0, 0.0, 1.0);
}`;

export const STRATA_FS = /* glsl */ `#version 300 es
precision highp float;
precision highp int;
in float v_x;
flat in int v_year;
uniform highp sampler2D u_coreTex;
uniform int u_nLat, u_spine;
uniform float u_step, u_alpha, u_dim;
uniform vec4 u_rect;
${BINNING}
out vec4 o;
void main() {
  float m;
  if (u_spine == 1) {
    m = texelFetch(u_coreTex, ivec2(u_nLat, v_year), 0).r;
  } else {
    float half_ = (u_rect.y - u_rect.x) * 0.5;
    float s = clamp((v_x - u_rect.x - half_) / half_, -1.0, 1.0);
    int row = clamp(int(floor((90.0 - degrees(asin(s))) / u_step)), 0, u_nLat - 1);
    m = texelFetch(u_coreTex, ivec2(row, v_year), 0).r;
  }
  vec3 c = m < -1.0e8 ? lattice() : u_bins[binOf(m)];
  o = vec4(c * u_dim * u_alpha, u_alpha);
}`;
