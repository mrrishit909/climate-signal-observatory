/**
 * Raw WebGL2 renderer (ENGINEERING_DECISIONS #19): one keyed cell mesh per grid
 * resolution (one quad per cell, unshared vertices, seam at the antimeridian),
 * integer textures sampled with texelFetch (NEAREST, never interpolated), a
 * coastline line set through the same vertex path, and instanced strata.
 */
import { BINS, hexRgb } from "../model/bins";
import { CELL_FS, CELL_VS, LINE_FS, LINE_VS, STRATA_FS, STRATA_VS } from "./shaders";
import type { Frame, GridKey, MeshKey } from "./frame";

const OFF_MISSING = -32768;
const BIN_RGB = new Float32Array(BINS.flatMap((b) => hexRgb(b.color)));

type Uniforms = Record<string, WebGLUniformLocation | null>;
interface Prog { p: WebGLProgram; u: Uniforms }
interface Mesh { vao: WebGLVertexArrayObject; slots: WebGLBuffer; count: number; nLat: number; nLon: number }
interface Tex { tex: WebGLTexture; w: number; h: number }

function compile(gl: WebGL2RenderingContext, vs: string, fs: string, names: string[]): Prog {
  const p = gl.createProgram()!;
  for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]] as const) {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    gl.attachShader(p, s);
  }
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? "link");
  return { p, u: Object.fromEntries(names.map((n) => [n, gl.getUniformLocation(p, n)])) };
}

const UNWRAP_U = ["u_view", "u_rot", "u_sphere", "u_sheet", "u_s1", "u_s2", "u_s3", "u_strip", "u_core"];
const BIN_U = ["u_bins", "u_lattice", "u_dpr"];

export class Globe {
  readonly gl: WebGL2RenderingContext;
  private cells: Prog;
  private lines: Prog;
  private strata: Prog;
  private meshes = new Map<MeshKey, Mesh>();
  private grids = new Map<GridKey, Tex>();
  private offsets = new Map<string, Tex>();
  private cores = new Map<string, Tex>();
  private coast: { vao: WebGLVertexArrayObject; count: number } | null = null;
  private strataVao: WebGLVertexArrayObject;
  private strataY: WebGLBuffer;
  private nStrata = 0;
  frames = 0;

  /** null when WebGL2 is missing or too limited (MOTION_SYSTEM 9.2: NO-WEBGL tier). */
  static create(canvas: HTMLCanvasElement): Globe | null {
    const gl = canvas.getContext("webgl2", { antialias: true, premultipliedAlpha: true, alpha: true, depth: true, powerPreference: "high-performance" });
    if (!gl || gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS) < 180) return null;
    try {
      return new Globe(gl);
    } catch (e) {
      console.warn("WebGL2 init failed", e);
      return null;
    }
  }

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    this.cells = compile(gl, CELL_VS, CELL_FS, [...UNWRAP_U, ...BIN_U, "u_grid", "u_offA", "u_offB", "u_coreTex", "u_layerA", "u_layerB",
      "u_coreYear", "u_hasCore", "u_mix", "u_baseMix", "u_uniform", "u_alpha", "u_dim", "u_gap", "u_uniformColor"]);
    this.lines = compile(gl, LINE_VS, LINE_FS, [...UNWRAP_U, "u_alpha"]);
    this.strata = compile(gl, STRATA_VS, STRATA_FS, ["u_view", "u_rect", "u_coreTex", "u_nLat", "u_spine", "u_step", "u_alpha", "u_dim", ...BIN_U]);
    for (const m of [["2", 90, 180], ["5", 36, 72]] as const) this.meshes.set(m[0], this.buildMesh(m[1], m[2]));
    // strata: one unit quad, instanced per year, with a dynamic per-instance top y
    this.strataVao = gl.createVertexArray()!;
    gl.bindVertexArray(this.strataVao);
    this.attr(this.strata.p, "a_corner", new Float32Array([0, 0, 1, 0, 0, 1, 1, 1]), 2);
    this.strataY = gl.createBuffer()!;
    gl.bindVertexArray(null);
  }

  private attr(p: WebGLProgram, name: string, data: Float32Array, size: number, divisor = 0, usage: number = this.gl.STATIC_DRAW) {
    const gl = this.gl, loc = gl.getAttribLocation(p, name);
    const b = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferData(gl.ARRAY_BUFFER, data, usage);
    if (loc < 0) return b;
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0);
    if (divisor) gl.vertexAttribDivisor(loc, divisor);
    return b;
  }

  private buildMesh(nLat: number, nLon: number): Mesh {
    const gl = this.gl, n = nLat * nLon, step = 180 / nLat;
    const ll = new Float32Array(n * 8), uv = new Float32Array(n * 8), cell = new Float32Array(n * 8), slot = new Float32Array(n * 8);
    const idx = new Uint16Array(n * 6);
    for (let r = 0; r < nLat; r++) for (let c = 0; c < nLon; c++) {
      const i = r * nLon + c, latN = 90 - r * step, latS = latN - step, lonW = -180 + c * step, lonE = lonW + step;
      ll.set([lonW, latN, lonE, latN, lonE, latS, lonW, latS], i * 8);
      uv.set([0, 0, 1, 0, 1, 1, 0, 1], i * 8);
      cell.set([r, c, r, c, r, c, r, c], i * 8);
      const f0 = c / nLon, f1 = (c + 1) / nLon;
      slot.set([f0, f1, f0, f1, f0, f1, f0, f1], i * 8);
      const v = i * 4;
      idx.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6);
    }
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    const p = this.cells.p;
    this.attr(p, "a_ll", ll, 2);
    this.attr(p, "a_uv", uv, 2);
    this.attr(p, "a_cell", cell, 2);
    const slots = this.attr(p, "a_slot", slot, 2, 0, gl.DYNAMIC_DRAW);
    const ib = gl.createBuffer()!;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
    gl.bindVertexArray(null);
    return { vao, slots, count: idx.length, nLat, nLon };
  }

  private intTex(w: number, h: number, layers: number, fmt: number, type: number, data: ArrayBufferView) {
    const gl = this.gl, tex = gl.createTexture()!;
    const target = layers ? gl.TEXTURE_2D_ARRAY : gl.TEXTURE_2D;
    gl.bindTexture(target, tex);
    // integer and float data textures: NEAREST only (an integer texture with a mipmap min filter is incomplete)
    gl.texParameteri(target, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(target, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(target, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(target, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const fmtOf = fmt === gl.R32F ? gl.RED : gl.RED_INTEGER;
    if (layers) gl.texImage3D(target, 0, fmt, w, h, layers, 0, fmtOf, type, data);
    else gl.texImage2D(target, 0, fmt, w, h, 0, fmtOf, type, data);
    return { tex, w, h };
  }

  setGrid(key: GridKey, data: Int8Array, nLon: number, nLat: number) {
    if (this.grids.has(key)) return;
    this.grids.set(key, this.intTex(nLon, nLat, data.length / (nLon * nLat), this.gl.R8I, this.gl.BYTE, data));
  }
  hasGrid = (key: GridKey) => this.grids.has(key);

  setOffsets(key: string, values: readonly (number | null)[], nLon: number, nLat: number) {
    if (this.offsets.has(key)) return;
    const a = Int16Array.from(values, (v) => (v === null ? OFF_MISSING : v));
    this.offsets.set(key, this.intTex(nLon, nLat, 0, this.gl.R16I, this.gl.SHORT, a));
  }

  setCore(key: string, data: Float32Array, width: number) {
    const old = this.cores.get(key);
    if (old) this.gl.deleteTexture(old.tex);
    this.cores.set(key, this.intTex(width, data.length / width, 0, this.gl.R32F, this.gl.FLOAT, data));
  }
  hasCore = (key: string) => this.cores.has(key);

  /** Per-cell [x0, x1] strip fractions for the collapse (model/zonal collapseSlots), expanded to the 4 corners. */
  setSlots(mesh: MeshKey, perCell: Float32Array) {
    const m = this.meshes.get(mesh)!, gl = this.gl;
    const v = new Float32Array(perCell.length * 4);
    for (let i = 0; i < perCell.length / 2; i++) for (let k = 0; k < 4; k++) { v[i * 8 + k * 2] = perCell[i * 2]!; v[i * 8 + k * 2 + 1] = perCell[i * 2 + 1]!; }
    gl.bindBuffer(gl.ARRAY_BUFFER, m.slots);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, v);
  }

  setCoast(coords: readonly number[], starts: readonly number[]) {
    const gl = this.gl, segs: number[] = [];
    const n = coords.length / 2;
    for (let i = 0; i < starts.length; i++) {
      const a = starts[i]!, b = (starts[i + 1] ?? n) - 1;
      for (let k = a; k < b; k++) segs.push(coords[k * 2]!, coords[k * 2 + 1]!, coords[k * 2 + 2]!, coords[k * 2 + 3]!);
    }
    const vao = gl.createVertexArray()!;
    gl.bindVertexArray(vao);
    this.attr(this.lines.p, "a_ll", new Float32Array(segs), 2);
    gl.bindVertexArray(null);
    this.coast = { vao, count: segs.length / 2 };
  }

  private unwrapUniforms(u: Uniforms, f: Frame) {
    const gl = this.gl, w = f.u;
    gl.uniform2f(u.u_view!, f.w, f.h);
    gl.uniformMatrix3fv(u.u_rot!, false, w.rot);
    gl.uniform3fv(u.u_sphere!, w.sphere);
    gl.uniform3fv(u.u_sheet!, w.sheet);
    gl.uniform1f(u.u_s1!, w.s1);
    gl.uniform1f(u.u_s2!, w.s2);
    gl.uniform1f(u.u_s3!, w.s3);
    gl.uniform2fv(u.u_strip!, w.strip);
    gl.uniform4fv(u.u_core!, w.core);
  }
  private binUniforms(u: Uniforms, f: Frame) {
    const gl = this.gl;
    gl.uniform3fv(u.u_bins!, BIN_RGB);
    gl.uniform1f(u.u_lattice!, f.lattice);
    gl.uniform1f(u.u_dpr!, f.dpr);
  }
  private bindTex(unit: number, target: number, tex: WebGLTexture, loc: WebGLUniformLocation | null) {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(target, tex);
    gl.uniform1i(loc, unit);
  }

  draw(f: Frame) {
    const gl = this.gl;
    this.frames++;
    gl.viewport(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);

    const c = this.cells, u = c.u;
    gl.useProgram(c.p);
    this.unwrapUniforms(u, f);
    this.binUniforms(u, f);
    const collapse = f.collapseKey ? this.cores.get(f.collapseKey) : undefined;
    gl.uniform1i(u.u_hasCore!, collapse ? 1 : 0);
    gl.uniform1i(u.u_coreYear!, f.core?.cur ?? 0);
    gl.uniform1f(u.u_uniform!, f.uniform);
    gl.uniform3fv(u.u_uniformColor!, f.uniformColor);
    gl.uniform1f(u.u_dim!, f.dim);
    gl.uniform1f(u.u_gap!, f.gap);
    for (const L of f.cells) {
      const grid = this.grids.get(L.grid);
      const src = L.grid === "hadcrut5" ? "hadcrut5" : L.grid === "intro" ? "intro" : "gistemp";
      const oA = this.offsets.get(`${src}:${L.baseA}`), oB = this.offsets.get(`${src}:${L.baseB}`);
      if (!grid || !oA || !oB || L.alpha <= 0) continue;
      const mesh = this.meshes.get(L.grid === "hadcrut5" ? "5" : "2")!;
      this.bindTex(0, gl.TEXTURE_2D_ARRAY, grid.tex, u.u_grid!);
      this.bindTex(1, gl.TEXTURE_2D, oA.tex, u.u_offA!);
      this.bindTex(2, gl.TEXTURE_2D, oB.tex, u.u_offB!);
      // always point the float sampler at its own unit: two sampler types on one unit is INVALID_OPERATION
      gl.uniform1i(u.u_coreTex!, 3);
      if (collapse) { gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, collapse.tex); }
      gl.uniform1i(u.u_layerA!, L.layerA);
      gl.uniform1i(u.u_layerB!, L.layerB);
      gl.uniform1f(u.u_mix!, L.mix);
      gl.uniform1f(u.u_baseMix!, L.baseMix);
      gl.uniform1f(u.u_alpha!, L.alpha * f.cellAlpha);
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.count, gl.UNSIGNED_SHORT, 0);
    }

    if (this.coast && f.coast > 0) {
      gl.useProgram(this.lines.p);
      this.unwrapUniforms(this.lines.u, f);
      gl.uniform1f(this.lines.u.u_alpha!, f.coast);
      gl.bindVertexArray(this.coast.vao);
      gl.drawArrays(gl.LINES, 0, this.coast.count);
    }

    gl.disable(gl.DEPTH_TEST);
    const k = f.core, core = k ? this.cores.get(k.key) : undefined;
    if (k && core) {
      const s = this.strata, su = s.u;
      gl.useProgram(s.p);
      this.binUniforms(su, f);
      gl.uniform2f(su.u_view!, f.w, f.h);
      gl.uniform1i(su.u_nLat!, k.nLat);
      gl.uniform1f(su.u_step!, k.step);
      gl.uniform1f(su.u_alpha!, k.alpha);
      gl.uniform1f(su.u_dim!, f.dim);
      this.bindTex(0, gl.TEXTURE_2D, core.tex, su.u_coreTex!);
      gl.bindVertexArray(this.strataVao);
      for (const [spine, ys, x0, x1] of [[0, k.ys, k.rect[0], k.rect[1]], [1, k.spineYs, k.spine[0], k.spine[1]]] as const) {
        this.instance(ys);
        gl.uniform1i(su.u_spine!, spine);
        gl.uniform4f(su.u_rect!, x0, x1, 0, k.rect[3]);
        gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, ys.length);
      }
    }
    gl.bindVertexArray(null);
  }

  /** Per-instance year index + top y (a_year, a_y). */
  private instance(ys: Float32Array) {
    const gl = this.gl, p = this.strata.p;
    if (this.nStrata !== ys.length) {
      this.nStrata = ys.length;
      this.attr(p, "a_year", Float32Array.from({ length: ys.length }, (_, i) => i), 1, 1);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.strataY);
      gl.bufferData(gl.ARRAY_BUFFER, ys.byteLength, gl.DYNAMIC_DRAW);
      const loc = gl.getAttribLocation(p, "a_y");
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 1, gl.FLOAT, false, 0, 0);
      gl.vertexAttribDivisor(loc, 1);
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, this.strataY);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, ys);
  }

  resize(canvas: HTMLCanvasElement, w: number, h: number, dpr: number) {
    const W = Math.round(w * dpr), H = Math.round(h * dpr);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
  }
}
