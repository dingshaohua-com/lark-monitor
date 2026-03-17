import { useEffect, useRef, type CSSProperties } from 'react';

// ============ Shader Sources ============

const FX_COMMON_VSH = `
uniform vec3 uResolution;
attribute vec2 aPosition;
varying vec2 texCoord;
varying vec2 screenCoord;
void main(void) {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    texCoord = aPosition.xy * 0.5 + vec2(0.5, 0.5);
    screenCoord = aPosition.xy * vec2(uResolution.z, 1.0);
}`;

const BG_FSH = `
#ifdef GL_ES
precision highp float;
#endif
uniform vec2 uTimes;
varying vec2 texCoord;
varying vec2 screenCoord;
void main(void) {
    vec3 col;
    float c;
    vec2 tmpv = texCoord * vec2(0.8, 1.0) - vec2(0.95, 1.0);
    c = exp(-pow(length(tmpv) * 1.8, 2.0));
    col = mix(vec3(0.02, 0.0, 0.03), vec3(0.96, 0.98, 1.0) * 1.5, c);
    gl_FragColor = vec4(col * 0.5, 1.0);
}`;

const FX_BRIGHTBUF_FSH = `
#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D uSrc;
uniform vec2 uDelta;
varying vec2 texCoord;
varying vec2 screenCoord;
void main(void) {
    vec4 col = texture2D(uSrc, texCoord);
    gl_FragColor = vec4(col.rgb * 2.0 - vec3(0.5), 1.0);
}`;

const FX_DIRBLUR_R4_FSH = `
#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D uSrc;
uniform vec2 uDelta;
uniform vec4 uBlurDir;
varying vec2 texCoord;
varying vec2 screenCoord;
void main(void) {
    vec4 col = texture2D(uSrc, texCoord);
    col = col + texture2D(uSrc, texCoord + uBlurDir.xy * uDelta);
    col = col + texture2D(uSrc, texCoord - uBlurDir.xy * uDelta);
    col = col + texture2D(uSrc, texCoord + (uBlurDir.xy + uBlurDir.zw) * uDelta);
    col = col + texture2D(uSrc, texCoord - (uBlurDir.xy + uBlurDir.zw) * uDelta);
    gl_FragColor = col / 5.0;
}`;

const PP_FINAL_VSH = `
uniform vec3 uResolution;
attribute vec2 aPosition;
varying vec2 texCoord;
varying vec2 screenCoord;
void main(void) {
    gl_Position = vec4(aPosition, 0.0, 1.0);
    texCoord = aPosition.xy * 0.5 + vec2(0.5, 0.5);
    screenCoord = aPosition.xy * vec2(uResolution.z, 1.0);
}`;

const PP_FINAL_FSH = `
#ifdef GL_ES
precision highp float;
#endif
uniform sampler2D uSrc;
uniform sampler2D uBloom;
uniform vec2 uDelta;
varying vec2 texCoord;
varying vec2 screenCoord;
void main(void) {
    vec4 srccol = texture2D(uSrc, texCoord) * 2.0;
    vec4 bloomcol = texture2D(uBloom, texCoord);
    vec4 col;
    col = srccol + bloomcol * (vec4(1.0) + srccol);
    col *= smoothstep(1.0, 0.0, pow(length((texCoord - vec2(0.5)) * 2.0), 1.2) * 0.5);
    col = pow(col, vec4(0.45454545454545));
    gl_FragColor = vec4(col.rgb, 1.0);
    gl_FragColor.a = 1.0;
}`;

const SAKURA_POINT_VSH = `
uniform mat4 uProjection;
uniform mat4 uModelview;
uniform vec3 uResolution;
uniform vec3 uOffset;
uniform vec3 uDOF;
uniform vec3 uFade;

attribute vec3 aPosition;
attribute vec3 aEuler;
attribute vec2 aMisc;

varying vec3 pposition;
varying float psize;
varying float palpha;
varying float pdist;

varying vec3 normX;
varying vec3 normY;
varying vec3 normZ;
varying vec3 normal;

varying float diffuse;
varying float specular;
varying float rstop;
varying float distancefade;

void main(void) {
    vec4 pos = uModelview * vec4(aPosition + uOffset, 1.0);
    gl_Position = uProjection * pos;
    gl_PointSize = aMisc.x * uProjection[1][1] / -pos.z * uResolution.y * 0.5;

    pposition = pos.xyz;
    psize = aMisc.x;
    pdist = length(pos.xyz);
    palpha = smoothstep(0.0, 1.0, (pdist - 0.1) / uFade.z);

    vec3 elrsn = sin(aEuler);
    vec3 elrcs = cos(aEuler);
    mat3 rotx = mat3(
        1.0, 0.0, 0.0,
        0.0, elrcs.x, elrsn.x,
        0.0, -elrsn.x, elrcs.x
    );
    mat3 roty = mat3(
        elrcs.y, 0.0, -elrsn.y,
        0.0, 1.0, 0.0,
        elrsn.y, 0.0, elrcs.y
    );
    mat3 rotz = mat3(
        elrcs.z, elrsn.z, 0.0,
        -elrsn.z, elrcs.z, 0.0,
        0.0, 0.0, 1.0
    );
    mat3 rotmat = rotx * roty * rotz;
    normal = rotmat[2];

    mat3 trrotm = mat3(
        rotmat[0][0], rotmat[1][0], rotmat[2][0],
        rotmat[0][1], rotmat[1][1], rotmat[2][1],
        rotmat[0][2], rotmat[1][2], rotmat[2][2]
    );
    normX = trrotm[0];
    normY = trrotm[1];
    normZ = trrotm[2];

    const vec3 lit = vec3(0.6917144638660746, 0.6917144638660746, -0.20751433915982237);

    float tmpdfs = dot(lit, normal);
    if(tmpdfs < 0.0) {
        normal = -normal;
        tmpdfs = dot(lit, normal);
    }
    diffuse = 0.4 + tmpdfs;

    vec3 eyev = normalize(-pos.xyz);
    if(dot(eyev, normal) > 0.0) {
        vec3 hv = normalize(eyev + lit);
        specular = pow(max(dot(hv, normal), 0.0), 20.0);
    }
    else {
        specular = 0.0;
    }

    rstop = clamp((abs(pdist - uDOF.x) - uDOF.y) / uDOF.z, 0.0, 1.0);
    rstop = pow(rstop, 0.5);
    distancefade = min(1.0, exp((uFade.x - pdist) * 0.69315 / uFade.y));
}`;

const SAKURA_POINT_FSH = `
#ifdef GL_ES
precision highp float;
#endif

uniform vec3 uDOF;
uniform vec3 uFade;

const vec3 fadeCol = vec3(0.08, 0.03, 0.06);

varying vec3 pposition;
varying float psize;
varying float palpha;
varying float pdist;

varying vec3 normX;
varying vec3 normY;
varying vec3 normZ;
varying vec3 normal;

varying float diffuse;
varying float specular;
varying float rstop;
varying float distancefade;

float ellipse(vec2 p, vec2 o, vec2 r) {
    vec2 lp = (p - o) / r;
    return length(lp) - 1.0;
}

void main(void) {
    vec3 p = vec3(gl_PointCoord - vec2(0.5, 0.5), 0.0) * 2.0;
    vec3 d = vec3(0.0, 0.0, -1.0);
    float nd = normZ.z;
    if(abs(nd) < 0.0001) discard;

    float np = dot(normZ, p);
    vec3 tp = p + d * np / nd;
    vec2 coord = vec2(dot(normX, tp), dot(normY, tp));

    const float flwrsn = 0.258819045102521;
    const float flwrcs = 0.965925826289068;
    mat2 flwrm = mat2(flwrcs, -flwrsn, flwrsn, flwrcs);
    vec2 flwrp = vec2(abs(coord.x), coord.y) * flwrm;

    float r;
    if(flwrp.x < 0.0) {
        r = ellipse(flwrp, vec2(0.065, 0.024) * 0.5, vec2(0.36, 0.96) * 0.5);
    }
    else {
        r = ellipse(flwrp, vec2(0.065, 0.024) * 0.5, vec2(0.58, 0.96) * 0.5);
    }

    if(r > rstop) discard;

    vec3 col = mix(vec3(1.0, 0.8, 0.75), vec3(1.0, 0.9, 0.87), r);
    float grady = mix(0.0, 1.0, pow(coord.y * 0.5 + 0.5, 0.35));
    col *= vec3(1.0, grady, grady);
    col *= mix(0.8, 1.0, pow(abs(coord.x), 0.3));
    col = col * diffuse + specular;

    col = mix(fadeCol, col, distancefade);

    float alpha = (rstop > 0.001)? (0.5 - r / (rstop * 2.0)) : 1.0;
    alpha = smoothstep(0.0, 1.0, alpha) * palpha;

    gl_FragColor = vec4(col * 0.5, alpha);
}`;

// ============ Type Definitions ============

interface Vec3 {
  x: number;
  y: number;
  z: number;
  array?: Float32Array;
}

interface RenderTarget {
  width: number;
  height: number;
  sizeArray: Float32Array;
  dtxArray: Float32Array;
  frameBuffer: WebGLFramebuffer;
  renderBuffer: WebGLRenderbuffer;
  texture: WebGLTexture;
}

interface ShaderProgram extends WebGLProgram {
  uniforms: Record<string, WebGLUniformLocation | null>;
  attributes: Record<string, number>;
}

interface EffectObject {
  program: ShaderProgram;
  dataArray: Float32Array;
  buffer: WebGLBuffer;
}

interface RenderSpec {
  width: number;
  height: number;
  aspect: number;
  array: Float32Array;
  halfWidth: number;
  halfHeight: number;
  halfArray: Float32Array;
  pointSize?: { min: number; max: number };
  mainRT?: RenderTarget;
  wFullRT0?: RenderTarget;
  wFullRT1?: RenderTarget;
  wHalfRT0?: RenderTarget;
  wHalfRT1?: RenderTarget;
  setSize(w: number, h: number): void;
}

interface PointFlower {
  program?: ShaderProgram;
  offset?: Float32Array;
  fader?: Vec3;
  numFlowers?: number;
  particles?: BlossomParticle[];
  dataArray?: Float32Array;
  positionArrayOffset?: number;
  eulerArrayOffset?: number;
  miscArrayOffset?: number;
  buffer?: WebGLBuffer;
  area?: Vec3;
}

interface EffectLib {
  sceneBg?: EffectObject;
  mkBrightBuf?: EffectObject;
  dirBlur?: EffectObject;
  finalComp?: EffectObject;
}

interface SakuraEngine {
  start(): void;
  stop(): void;
}

// ============ Math Utilities ============

const Vec3Util = {
  create(x: number, y: number, z: number): Vec3 {
    return { x, y, z };
  },
  dot(v0: Vec3, v1: Vec3): number {
    return v0.x * v1.x + v0.y * v1.y + v0.z * v1.z;
  },
  cross(v: Vec3, v0: Vec3, v1: Vec3): void {
    v.x = v0.y * v1.z - v0.z * v1.y;
    v.y = v0.z * v1.x - v0.x * v1.z;
    v.z = v0.x * v1.y - v0.y * v1.x;
  },
  normalize(v: Vec3): void {
    let l = v.x * v.x + v.y * v.y + v.z * v.z;
    if (l > 0.00001) {
      l = 1.0 / Math.sqrt(l);
      v.x *= l;
      v.y *= l;
      v.z *= l;
    }
  },
  arrayForm(v: Vec3): Float32Array {
    if (v.array) {
      v.array[0] = v.x;
      v.array[1] = v.y;
      v.array[2] = v.z;
    } else {
      v.array = new Float32Array([v.x, v.y, v.z]);
    }
    return v.array;
  },
};

const Mat44 = {
  createIdentity(): Float32Array {
    return new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  },
  loadProjection(m: Float32Array, aspect: number, vdeg: number, near: number, far: number): void {
    const h = near * Math.tan((vdeg * Math.PI) / 180.0 * 0.5) * 2.0;
    const w = h * aspect;
    m[0] = (2.0 * near) / w; m[1] = 0; m[2] = 0; m[3] = 0;
    m[4] = 0; m[5] = (2.0 * near) / h; m[6] = 0; m[7] = 0;
    m[8] = 0; m[9] = 0; m[10] = -(far + near) / (far - near); m[11] = -1;
    m[12] = 0; m[13] = 0; m[14] = (-2.0 * far * near) / (far - near); m[15] = 0;
  },
  loadLookAt(m: Float32Array, vpos: Vec3, vlook: Vec3, vup: Vec3): void {
    const frontv = Vec3Util.create(vpos.x - vlook.x, vpos.y - vlook.y, vpos.z - vlook.z);
    Vec3Util.normalize(frontv);
    const sidev = Vec3Util.create(1, 0, 0);
    Vec3Util.cross(sidev, vup, frontv);
    Vec3Util.normalize(sidev);
    const topv = Vec3Util.create(1, 0, 0);
    Vec3Util.cross(topv, frontv, sidev);
    Vec3Util.normalize(topv);
    m[0] = sidev.x; m[1] = topv.x; m[2] = frontv.x; m[3] = 0;
    m[4] = sidev.y; m[5] = topv.y; m[6] = frontv.y; m[7] = 0;
    m[8] = sidev.z; m[9] = topv.z; m[10] = frontv.z; m[11] = 0;
    m[12] = -(vpos.x * m[0] + vpos.y * m[4] + vpos.z * m[8]);
    m[13] = -(vpos.x * m[1] + vpos.y * m[5] + vpos.z * m[9]);
    m[14] = -(vpos.x * m[2] + vpos.y * m[6] + vpos.z * m[10]);
    m[15] = 1;
  },
};

// ============ Blossom Particle ============

class BlossomParticle {
  velocity: number[] = [0, 0, 0];
  rotation: number[] = [0, 0, 0];
  position: number[] = [0, 0, 0];
  euler: number[] = [0, 0, 0];
  size = 1.0;
  alpha = 1.0;
  zkey = 0.0;

  setVelocity(vx: number, vy: number, vz: number): void {
    this.velocity[0] = vx; this.velocity[1] = vy; this.velocity[2] = vz;
  }
  setRotation(rx: number, ry: number, rz: number): void {
    this.rotation[0] = rx; this.rotation[1] = ry; this.rotation[2] = rz;
  }
  setPosition(nx: number, ny: number, nz: number): void {
    this.position[0] = nx; this.position[1] = ny; this.position[2] = nz;
  }
  setEulerAngles(rx: number, ry: number, rz: number): void {
    this.euler[0] = rx; this.euler[1] = ry; this.euler[2] = rz;
  }
  setSize(s: number): void {
    this.size = s;
  }
  update(dt: number): void {
    this.position[0] += this.velocity[0] * dt;
    this.position[1] += this.velocity[1] * dt;
    this.position[2] += this.velocity[2] * dt;
    this.euler[0] += this.rotation[0] * dt;
    this.euler[1] += this.rotation[1] * dt;
    this.euler[2] += this.rotation[2] * dt;
  }
}

// ============ WebGL Engine (encapsulated) ============

function createSakuraEngine(canvas: HTMLCanvasElement): SakuraEngine | null {
  let gl: WebGLRenderingContext;
  try {
    const ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    if (!ctx) return null;
    gl = ctx as WebGLRenderingContext;
  } catch {
    console.error('WebGL not supported');
    return null;
  }

  let animating = true;
  let rafId: number | null = null;
  let sceneStandBy = false;

  const timeInfo = { start: 0 as number | Date, prev: 0 as number | Date, delta: 0, elapsed: 0 };

  const renderSpec: RenderSpec = {
    width: 0, height: 0, aspect: 1,
    array: new Float32Array(3),
    halfWidth: 0, halfHeight: 0,
    halfArray: new Float32Array(3),
    setSize(w: number, h: number) {
      this.width = w; this.height = h;
      this.aspect = w / h;
      this.array[0] = w; this.array[1] = h; this.array[2] = this.aspect;
      this.halfWidth = Math.floor(w / 2);
      this.halfHeight = Math.floor(h / 2);
      this.halfArray[0] = this.halfWidth;
      this.halfArray[1] = this.halfHeight;
      this.halfArray[2] = this.halfWidth / this.halfHeight;
    },
  };

  const projection = {
    angle: 60,
    nearfar: new Float32Array([0.1, 100.0]),
    matrix: Mat44.createIdentity(),
  };
  const camera = {
    position: Vec3Util.create(0, 0, 100),
    lookat: Vec3Util.create(0, 0, 0),
    up: Vec3Util.create(0, 1, 0),
    dof: Vec3Util.create(10.0, 4.0, 8.0),
    matrix: Mat44.createIdentity(),
  };

  const pointFlower: PointFlower = {};
  const effectLib: EffectLib = {};

  // ---- GL helpers ----

  function deleteRenderTarget(rt: RenderTarget): void {
    gl.deleteFramebuffer(rt.frameBuffer);
    gl.deleteRenderbuffer(rt.renderBuffer);
    gl.deleteTexture(rt.texture);
  }

  function createRenderTarget(w: number, h: number): RenderTarget {
    const ret: RenderTarget = {
      width: w, height: h,
      sizeArray: new Float32Array([w, h, w / h]),
      dtxArray: new Float32Array([1.0 / w, 1.0 / h]),
      frameBuffer: gl.createFramebuffer()!,
      renderBuffer: gl.createRenderbuffer()!,
      texture: gl.createTexture()!,
    };

    gl.bindTexture(gl.TEXTURE_2D, ret.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    gl.bindFramebuffer(gl.FRAMEBUFFER, ret.frameBuffer);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, ret.texture, 0);

    gl.bindRenderbuffer(gl.RENDERBUFFER, ret.renderBuffer);
    gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, w, h);
    gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, ret.renderBuffer);

    gl.bindTexture(gl.TEXTURE_2D, null);
    gl.bindRenderbuffer(gl.RENDERBUFFER, null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ret;
  }

  function compileShader(shtype: number, shsrc: string): WebGLShader | null {
    const sh = gl.createShader(shtype);
    if (!sh) return null;
    gl.shaderSource(sh, shsrc);
    gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(sh));
      gl.deleteShader(sh);
      return null;
    }
    return sh;
  }

  function createShaderProgram(
    vtxsrc: string,
    frgsrc: string,
    uniformlist: string[] | null,
    attrlist: string[] | null
  ): ShaderProgram | null {
    const vsh = compileShader(gl.VERTEX_SHADER, vtxsrc);
    const fsh = compileShader(gl.FRAGMENT_SHADER, frgsrc);
    if (!vsh || !fsh) return null;

    const prog = gl.createProgram() as ShaderProgram;
    if (!prog) return null;
    gl.attachShader(prog, vsh);
    gl.attachShader(prog, fsh);
    gl.deleteShader(vsh);
    gl.deleteShader(fsh);
    gl.linkProgram(prog);

    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error(gl.getProgramInfoLog(prog));
      return null;
    }

    prog.uniforms = {};
    prog.attributes = {};
    if (uniformlist) {
      for (const name of uniformlist) {
        prog.uniforms[name] = gl.getUniformLocation(prog, name);
      }
    }
    if (attrlist) {
      for (const name of attrlist) {
        prog.attributes[name] = gl.getAttribLocation(prog, name);
      }
    }
    return prog;
  }

  function bindShader(prog: ShaderProgram): void {
    gl.useProgram(prog);
    for (const attr in prog.attributes) {
      gl.enableVertexAttribArray(prog.attributes[attr]);
    }
  }

  function unbindShader(prog: ShaderProgram): void {
    for (const attr in prog.attributes) {
      gl.disableVertexAttribArray(prog.attributes[attr]);
    }
    gl.useProgram(null);
  }

  // ---- Point Flowers ----

  function createPointFlowers(): void {
    const prm = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE);
    renderSpec.pointSize = { min: prm[0], max: prm[1] };

    pointFlower.program = createShaderProgram(
      SAKURA_POINT_VSH, SAKURA_POINT_FSH,
      ['uProjection', 'uModelview', 'uResolution', 'uOffset', 'uDOF', 'uFade'],
      ['aPosition', 'aEuler', 'aMisc']
    )!;

    bindShader(pointFlower.program);
    pointFlower.offset = new Float32Array([0, 0, 0]);
    pointFlower.fader = Vec3Util.create(0, 10, 0);
    pointFlower.numFlowers = 1600;
    pointFlower.particles = new Array(pointFlower.numFlowers);
    pointFlower.dataArray = new Float32Array(pointFlower.numFlowers * (3 + 3 + 2));
    pointFlower.positionArrayOffset = 0;
    pointFlower.eulerArrayOffset = pointFlower.numFlowers * 3;
    pointFlower.miscArrayOffset = pointFlower.numFlowers * 6;

    pointFlower.buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, pointFlower.buffer);
    gl.bufferData(gl.ARRAY_BUFFER, pointFlower.dataArray, gl.DYNAMIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    unbindShader(pointFlower.program);

    for (let i = 0; i < pointFlower.numFlowers; i++) {
      pointFlower.particles[i] = new BlossomParticle();
    }
  }

  function initPointFlowers(): void {
    pointFlower.area = Vec3Util.create(20, 20, 20);
    pointFlower.area.x = pointFlower.area.y * renderSpec.aspect;
    pointFlower.fader!.x = 10;
    pointFlower.fader!.y = pointFlower.area.z;
    pointFlower.fader!.z = 0.1;

    const PI2 = Math.PI * 2.0;
    const tmpv3 = Vec3Util.create(0, 0, 0);
    const symmetryrand = (): number => Math.random() * 2.0 - 1.0;

    for (let i = 0; i < pointFlower.numFlowers!; i++) {
      const p = pointFlower.particles![i];
      tmpv3.x = symmetryrand() * 0.3 + 0.8;
      tmpv3.y = symmetryrand() * 0.2 - 1.0;
      tmpv3.z = symmetryrand() * 0.3 + 0.5;
      Vec3Util.normalize(tmpv3);
      const tmpv = 2.0 + Math.random();
      p.setVelocity(tmpv3.x * tmpv, tmpv3.y * tmpv, tmpv3.z * tmpv);
      p.setRotation(symmetryrand() * PI2 * 0.5, symmetryrand() * PI2 * 0.5, symmetryrand() * PI2 * 0.5);
      p.setPosition(symmetryrand() * pointFlower.area.x, symmetryrand() * pointFlower.area.y, symmetryrand() * pointFlower.area.z);
      p.setEulerAngles(Math.random() * PI2, Math.random() * PI2, Math.random() * PI2);
      p.setSize(0.9 + Math.random() * 0.1);
    }
  }

  function renderPointFlowers(): void {
    const PI2 = Math.PI * 2.0;

    const repeatPos = (prt: BlossomParticle, cmp: number, lim: number): void => {
      if (Math.abs(prt.position[cmp]) - prt.size * 0.5 > lim) {
        prt.position[cmp] += (prt.position[cmp] > 0 ? -1 : 1) * lim * 2.0;
      }
    };
    const repeatEuler = (prt: BlossomParticle, cmp: number): void => {
      prt.euler[cmp] = prt.euler[cmp] % PI2;
      if (prt.euler[cmp] < 0) prt.euler[cmp] += PI2;
    };

    for (let i = 0; i < pointFlower.numFlowers!; i++) {
      const prtcl = pointFlower.particles![i];
      prtcl.update(timeInfo.delta);
      repeatPos(prtcl, 0, pointFlower.area!.x);
      repeatPos(prtcl, 1, pointFlower.area!.y);
      repeatPos(prtcl, 2, pointFlower.area!.z);
      repeatEuler(prtcl, 0);
      repeatEuler(prtcl, 1);
      repeatEuler(prtcl, 2);
      prtcl.alpha = 1.0;
      prtcl.zkey =
        camera.matrix[2] * prtcl.position[0] +
        camera.matrix[6] * prtcl.position[1] +
        camera.matrix[10] * prtcl.position[2] +
        camera.matrix[14];
    }

    pointFlower.particles!.sort((a, b) => a.zkey - b.zkey);

    let ipos = pointFlower.positionArrayOffset!;
    let ieuler = pointFlower.eulerArrayOffset!;
    let imisc = pointFlower.miscArrayOffset!;
    for (let i = 0; i < pointFlower.numFlowers!; i++) {
      const prtcl = pointFlower.particles![i];
      pointFlower.dataArray![ipos] = prtcl.position[0];
      pointFlower.dataArray![ipos + 1] = prtcl.position[1];
      pointFlower.dataArray![ipos + 2] = prtcl.position[2];
      ipos += 3;
      pointFlower.dataArray![ieuler] = prtcl.euler[0];
      pointFlower.dataArray![ieuler + 1] = prtcl.euler[1];
      pointFlower.dataArray![ieuler + 2] = prtcl.euler[2];
      ieuler += 3;
      pointFlower.dataArray![imisc] = prtcl.size;
      pointFlower.dataArray![imisc + 1] = prtcl.alpha;
      imisc += 2;
    }

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const prog = pointFlower.program!;
    bindShader(prog);
    gl.uniformMatrix4fv(prog.uniforms.uProjection, false, projection.matrix);
    gl.uniformMatrix4fv(prog.uniforms.uModelview, false, camera.matrix);
    gl.uniform3fv(prog.uniforms.uResolution, renderSpec.array);
    gl.uniform3fv(prog.uniforms.uDOF, Vec3Util.arrayForm(camera.dof));
    gl.uniform3fv(prog.uniforms.uFade, Vec3Util.arrayForm(pointFlower.fader!));

    gl.bindBuffer(gl.ARRAY_BUFFER, pointFlower.buffer!);
    gl.bufferData(gl.ARRAY_BUFFER, pointFlower.dataArray!, gl.DYNAMIC_DRAW);

    gl.vertexAttribPointer(prog.attributes.aPosition, 3, gl.FLOAT, false, 0, pointFlower.positionArrayOffset! * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribPointer(prog.attributes.aEuler, 3, gl.FLOAT, false, 0, pointFlower.eulerArrayOffset! * Float32Array.BYTES_PER_ELEMENT);
    gl.vertexAttribPointer(prog.attributes.aMisc, 2, gl.FLOAT, false, 0, pointFlower.miscArrayOffset! * Float32Array.BYTES_PER_ELEMENT);

    for (let i = 1; i < 2; i++) {
      const zpos = i * -2.0;
      const offsets: [number, number][] = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [ox, oy] of offsets) {
        pointFlower.offset![0] = pointFlower.area!.x * ox;
        pointFlower.offset![1] = pointFlower.area!.y * oy;
        pointFlower.offset![2] = pointFlower.area!.z * zpos;
        gl.uniform3fv(prog.uniforms.uOffset, pointFlower.offset!);
        gl.drawArrays(gl.POINT, 0, pointFlower.numFlowers!);
      }
    }

    pointFlower.offset![0] = 0;
    pointFlower.offset![1] = 0;
    pointFlower.offset![2] = 0;
    gl.uniform3fv(prog.uniforms.uOffset, pointFlower.offset!);
    gl.drawArrays(gl.POINT, 0, pointFlower.numFlowers!);

    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    unbindShader(prog);
    gl.enable(gl.DEPTH_TEST);
    gl.disable(gl.BLEND);
  }

  // ---- Effects ----

  function createEffectProgram(
    vtxsrc: string,
    frgsrc: string,
    exunifs: string[] | null,
    exattrs: string[] | null
  ): EffectObject {
    let unifs = ['uResolution', 'uSrc', 'uDelta'];
    if (exunifs) unifs = unifs.concat(exunifs);
    let attrs = ['aPosition'];
    if (exattrs) attrs = attrs.concat(exattrs);

    const program = createShaderProgram(vtxsrc, frgsrc, unifs, attrs)!;
    bindShader(program);

    const dataArray = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]);
    const buffer = gl.createBuffer()!;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, dataArray, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    unbindShader(program);

    return { program, dataArray, buffer };
  }

  function applyEffectObj(fxobj: EffectObject, srctex: RenderTarget | null): void {
    const prog = fxobj.program;
    bindShader(prog);
    gl.uniform3fv(prog.uniforms.uResolution, renderSpec.array);
    if (srctex) {
      gl.uniform2fv(prog.uniforms.uDelta, srctex.dtxArray);
      gl.uniform1i(prog.uniforms.uSrc, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, srctex.texture);
    }
  }

  function drawEffect(fxobj: EffectObject): void {
    gl.bindBuffer(gl.ARRAY_BUFFER, fxobj.buffer);
    gl.vertexAttribPointer(fxobj.program.attributes.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  function releaseEffect(fxobj: EffectObject): void {
    unbindShader(fxobj.program);
  }

  function createEffectLib(): void {
    effectLib.sceneBg = createEffectProgram(FX_COMMON_VSH, BG_FSH, ['uTimes'], null);
    effectLib.mkBrightBuf = createEffectProgram(FX_COMMON_VSH, FX_BRIGHTBUF_FSH, null, null);
    effectLib.dirBlur = createEffectProgram(FX_COMMON_VSH, FX_DIRBLUR_R4_FSH, ['uBlurDir'], null);
    effectLib.finalComp = createEffectProgram(PP_FINAL_VSH, PP_FINAL_FSH, ['uBloom'], null);
  }

  // ---- Background ----

  function renderBackground(): void {
    gl.disable(gl.DEPTH_TEST);
    applyEffectObj(effectLib.sceneBg!, null);
    gl.uniform2f(effectLib.sceneBg!.program.uniforms.uTimes as WebGLUniformLocation, timeInfo.elapsed, timeInfo.delta);
    drawEffect(effectLib.sceneBg!);
    releaseEffect(effectLib.sceneBg!);
    gl.enable(gl.DEPTH_TEST);
  }

  // ---- Post Process ----

  function renderPostProcess(): void {
    gl.enable(gl.TEXTURE_2D);
    gl.disable(gl.DEPTH_TEST);

    const bindRT = (rt: RenderTarget, isclear: boolean): void => {
      gl.bindFramebuffer(gl.FRAMEBUFFER, rt.frameBuffer);
      gl.viewport(0, 0, rt.width, rt.height);
      if (isclear) {
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      }
    };

    bindRT(renderSpec.wHalfRT0!, true);
    applyEffectObj(effectLib.mkBrightBuf!, renderSpec.mainRT!);
    drawEffect(effectLib.mkBrightBuf!);
    releaseEffect(effectLib.mkBrightBuf!);

    for (let i = 0; i < 2; i++) {
      const p = 1.5 + i;
      const s = 2.0 + i;
      bindRT(renderSpec.wHalfRT1!, true);
      applyEffectObj(effectLib.dirBlur!, renderSpec.wHalfRT0!);
      gl.uniform4f(effectLib.dirBlur!.program.uniforms.uBlurDir as WebGLUniformLocation, p, 0, s, 0);
      drawEffect(effectLib.dirBlur!);
      releaseEffect(effectLib.dirBlur!);

      bindRT(renderSpec.wHalfRT0!, true);
      applyEffectObj(effectLib.dirBlur!, renderSpec.wHalfRT1!);
      gl.uniform4f(effectLib.dirBlur!.program.uniforms.uBlurDir as WebGLUniformLocation, 0, p, 0, s);
      drawEffect(effectLib.dirBlur!);
      releaseEffect(effectLib.dirBlur!);
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, renderSpec.width, renderSpec.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    applyEffectObj(effectLib.finalComp!, renderSpec.mainRT!);
    gl.uniform1i(effectLib.finalComp!.program.uniforms.uBloom as WebGLUniformLocation, 1);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, renderSpec.wHalfRT0!.texture);
    drawEffect(effectLib.finalComp!);
    releaseEffect(effectLib.finalComp!);

    gl.enable(gl.DEPTH_TEST);
  }

  // ---- Scene ----

  function createScene(): void {
    createEffectLib();
    createPointFlowers();
    sceneStandBy = true;
  }

  function initScene(): void {
    initPointFlowers();
    camera.position.z = pointFlower.area!.z + projection.nearfar[0];
    projection.angle =
      Math.atan2(pointFlower.area!.y, camera.position.z + pointFlower.area!.z) * (180.0 / Math.PI) * 2.0;
    Mat44.loadProjection(projection.matrix, renderSpec.aspect, projection.angle, projection.nearfar[0], projection.nearfar[1]);
  }

  function renderScene(): void {
    Mat44.loadLookAt(camera.matrix, camera.position, camera.lookat, camera.up);
    gl.enable(gl.DEPTH_TEST);
    gl.bindFramebuffer(gl.FRAMEBUFFER, renderSpec.mainRT!.frameBuffer);
    gl.viewport(0, 0, renderSpec.mainRT!.width, renderSpec.mainRT!.height);
    gl.clearColor(0.005, 0, 0.05, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    renderBackground();
    renderPointFlowers();
    renderPostProcess();
  }

  // ---- Viewport ----

  function setViewports(): void {
    renderSpec.setSize(gl.canvas.width, gl.canvas.height);
    gl.clearColor(0.2, 0.2, 0.5, 1.0);
    gl.viewport(0, 0, renderSpec.width, renderSpec.height);

    const rtfunc = (rtname: keyof RenderSpec, rtw: number, rth: number): void => {
      const existing = renderSpec[rtname] as RenderTarget | undefined;
      if (existing) deleteRenderTarget(existing);
      (renderSpec as Record<string, unknown>)[rtname as string] = createRenderTarget(rtw, rth);
    };
    rtfunc('mainRT', renderSpec.width, renderSpec.height);
    rtfunc('wFullRT0', renderSpec.width, renderSpec.height);
    rtfunc('wFullRT1', renderSpec.width, renderSpec.height);
    rtfunc('wHalfRT0', renderSpec.halfWidth, renderSpec.halfHeight);
    rtfunc('wHalfRT1', renderSpec.halfWidth, renderSpec.halfHeight);
  }

  // ---- Animation ----

  function animate(): void {
    const curdate = new Date();
    timeInfo.elapsed = (curdate.getTime() - (timeInfo.start as Date).getTime()) / 1000.0;
    timeInfo.delta = (curdate.getTime() - (timeInfo.prev as Date).getTime()) / 1000.0;
    timeInfo.prev = curdate;
    if (animating) rafId = requestAnimationFrame(animate);
    renderScene();
  }

  function resizeCanvas(): void {
    const parent = canvas.parentElement || document.body;
    canvas.width = parent.clientWidth || window.innerWidth;
    canvas.height = parent.clientHeight || window.innerHeight;
  }

  function onResize(): void {
    resizeCanvas();
    setViewports();
    if (sceneStandBy) initScene();
  }

  // ---- Public API ----

  function start(): void {
    resizeCanvas();
    setViewports();
    createScene();
    initScene();
    timeInfo.start = new Date();
    timeInfo.prev = timeInfo.start;
    animating = true;
    animate();
    window.addEventListener('resize', onResize);
  }

  function stop(): void {
    animating = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    window.removeEventListener('resize', onResize);
  }

  return { start, stop };
}

// ============ React Component ============

interface SakuraEffectProps {
  style?: CSSProperties;
  className?: string;
}

export default function SakuraEffect({ style, className }: SakuraEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SakuraEngine | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = createSakuraEngine(canvas);
    if (!engine) return;

    engineRef.current = engine;
    engine.start();

    return () => {
      engine.stop();
      engineRef.current = null;
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
