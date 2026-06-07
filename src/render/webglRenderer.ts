import type { PlinkitAppearanceOptions, RectBody, WorldSnapshot } from "../types"

interface Color {
  r: number
  g: number
  b: number
  a: number
}

export interface WebglRendererOptions {
  appearance?: PlinkitAppearanceOptions
}

const VERTEX_SHADER = `
precision highp float;
in vec2 a_position;
uniform vec2 u_resolution;
uniform vec2 u_center;
uniform vec2 u_size;
out vec2 v_local;
out vec2 v_uv;

void main() {
  vec2 world = u_center + a_position * u_size;
  vec2 clip = (world / u_resolution) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);
  v_local = a_position;
  v_uv = a_position * 0.5 + 0.5;
}
`

const FRAGMENT_SHADER = `
precision highp float;
uniform vec4 u_color;
uniform float u_shapeMode;
uniform float u_useTexture;
uniform vec2 u_size;
uniform sampler2D u_texture;
in vec2 v_local;
in vec2 v_uv;
out vec4 outColor;

void main() {
  if (u_shapeMode < 0.5) {
    outColor = u_color;
    return;
  }
  float radiusPx = max(min(u_size.x, u_size.y), 1.0);
  float edgePx = (length(v_local) - 1.0) * radiusPx;
  float a = 1.0 - smoothstep(-1.0, 1.0, edgePx);
  if (a < 0.001) discard;
  if (u_useTexture > 0.5) {
    vec4 texel = texture(u_texture, v_uv);
    outColor = vec4(texel.rgb, texel.a * a * u_color.a);
  } else {
    outColor = vec4(u_color.rgb, u_color.a * a);
  }
}
`

export class WebglRenderer {
  private readonly canvas: HTMLCanvasElement
  private readonly gl: WebGL2RenderingContext
  private readonly program: WebGLProgram
  private readonly positionBuffer: WebGLBuffer
  private readonly positionLocation: number
  private readonly resolutionLocation: WebGLUniformLocation
  private readonly centerLocation: WebGLUniformLocation
  private readonly sizeLocation: WebGLUniformLocation
  private readonly colorLocation: WebGLUniformLocation
  private readonly shapeModeLocation: WebGLUniformLocation
  private readonly useTextureLocation: WebGLUniformLocation
  private readonly textureLocation: WebGLUniformLocation
  private scale = 1
  private destroyed = false

  private pegTexture: WebGLTexture | null = null
  private ballTexture: WebGLTexture | null = null
  private pegTextureReady = false
  private ballTextureReady = false

  constructor(canvas: HTMLCanvasElement, options?: WebglRendererOptions) {
    this.canvas = canvas
    const gl = canvas.getContext("webgl2", { antialias: true, alpha: true })
    if (!gl) throw new Error("WebGL2 is not supported by this browser")

    this.gl = gl
    const vertexShader = createShader(this.gl, this.gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragmentShader = createShader(this.gl, this.gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    this.program = createProgram(this.gl, vertexShader, fragmentShader)

    const positionLocation = this.gl.getAttribLocation(this.program, "a_position")
    const resolutionLocation = this.gl.getUniformLocation(this.program, "u_resolution")
    const centerLocation = this.gl.getUniformLocation(this.program, "u_center")
    const sizeLocation = this.gl.getUniformLocation(this.program, "u_size")
    const colorLocation = this.gl.getUniformLocation(this.program, "u_color")
    const shapeModeLocation = this.gl.getUniformLocation(this.program, "u_shapeMode")
    const useTextureLocation = this.gl.getUniformLocation(this.program, "u_useTexture")
    const textureLocation = this.gl.getUniformLocation(this.program, "u_texture")

    if (
      positionLocation < 0 ||
      !resolutionLocation ||
      !centerLocation ||
      !sizeLocation ||
      !colorLocation ||
      !shapeModeLocation ||
      !useTextureLocation ||
      !textureLocation
    ) {
      throw new Error("Unable to initialize WebGL program locations")
    }

    this.positionLocation = positionLocation
    this.resolutionLocation = resolutionLocation
    this.centerLocation = centerLocation
    this.sizeLocation = sizeLocation
    this.colorLocation = colorLocation
    this.shapeModeLocation = shapeModeLocation
    this.useTextureLocation = useTextureLocation
    this.textureLocation = textureLocation

    this.gl.useProgram(this.program)
    this.gl.uniform1i(this.textureLocation, 0)

    const positionBuffer = this.gl.createBuffer()
    if (!positionBuffer) throw new Error("Unable to create WebGL buffer")
    this.positionBuffer = positionBuffer

    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      this.gl.STATIC_DRAW,
    )

    this.gl.enable(this.gl.BLEND)
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA)

    const a = options?.appearance
    if (a?.pegTextureUrl) {
      this.startTextureLoad(a.pegTextureUrl, a.textureCrossOrigin, "peg")
    }
    if (a?.ballTextureUrl) {
      this.startTextureLoad(a.ballTextureUrl, a.textureCrossOrigin, "ball")
    }
  }

  resize(width: number, height: number, dpr: number, worldScale = 1): void {
    this.scale = dpr * worldScale
    this.canvas.width = Math.floor(width * dpr)
    this.canvas.height = Math.floor(height * dpr)
    this.gl.viewport(0, 0, this.canvas.width, this.canvas.height)
  }

  render(snapshot: WorldSnapshot): void {
    this.gl.clearColor(0, 0, 0, 0)
    this.gl.clear(this.gl.COLOR_BUFFER_BIT)

    this.gl.useProgram(this.program)
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer)
    this.gl.enableVertexAttribArray(this.positionLocation)
    this.gl.vertexAttribPointer(this.positionLocation, 2, this.gl.FLOAT, false, 0, 0)
    this.gl.uniform2f(this.resolutionLocation, this.canvas.width, this.canvas.height)
    this.gl.uniform1i(this.textureLocation, 0)

    for (const wall of snapshot.walls) {
      this.drawRect(wall, toColor(54, 68, 102))
    }

    for (const peg of snapshot.pegs) {
      this.drawCircle(peg.x, peg.y, peg.radius, toColor(141, 226, 255), "peg")
    }

    for (const gp of snapshot.guidePegs) {
      this.drawCircle(gp.x, gp.y, gp.radius, toColor(255, 90, 120), "peg")
    }

    for (const ball of snapshot.balls) {
      this.drawCircle(ball.x, ball.y, ball.radius, toColor(250, 201, 95), "ball")
    }
  }

  destroy(): void {
    this.destroyed = true
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, null)
    if (this.pegTexture) {
      this.gl.deleteTexture(this.pegTexture)
      this.pegTexture = null
    }
    if (this.ballTexture) {
      this.gl.deleteTexture(this.ballTexture)
      this.ballTexture = null
    }
    this.pegTextureReady = false
    this.ballTextureReady = false
    this.gl.deleteBuffer(this.positionBuffer)
    this.gl.deleteProgram(this.program)
  }

  private startTextureLoad(
    url: string,
    crossOrigin: string | null | undefined,
    which: "peg" | "ball",
  ): void {
    void loadImage(url, crossOrigin)
      .then((image) => {
        if (this.destroyed) return
        const tex = createTextureFromImage(this.gl, image)
        if (this.destroyed) {
          this.gl.deleteTexture(tex)
          return
        }
        if (which === "peg") {
          if (this.pegTexture) this.gl.deleteTexture(this.pegTexture)
          this.pegTexture = tex
          this.pegTextureReady = true
        } else {
          if (this.ballTexture) this.gl.deleteTexture(this.ballTexture)
          this.ballTexture = tex
          this.ballTextureReady = true
        }
      })
      .catch(() => {
        /* остаёмся на fallback-цвете */
      })
  }

  private drawRect(rect: RectBody, color: Color): void {
    this.gl.uniform2f(this.centerLocation, rect.x * this.scale, rect.y * this.scale)
    this.gl.uniform2f(
      this.sizeLocation,
      rect.width * this.scale * 0.5,
      rect.height * this.scale * 0.5,
    )
    this.gl.uniform4f(this.colorLocation, color.r, color.g, color.b, color.a)
    this.gl.uniform1f(this.shapeModeLocation, 0)
    this.gl.uniform1f(this.useTextureLocation, 0)
    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
  }

  private drawCircle(
    x: number,
    y: number,
    radius: number,
    color: Color,
    which: "peg" | "ball",
  ): void {
    this.gl.uniform2f(this.centerLocation, x * this.scale, y * this.scale)
    this.gl.uniform2f(this.sizeLocation, radius * this.scale, radius * this.scale)
    this.gl.uniform4f(this.colorLocation, color.r, color.g, color.b, color.a)
    this.gl.uniform1f(this.shapeModeLocation, 1)

    const tex = which === "peg" ? this.pegTexture : this.ballTexture
    const ready = which === "peg" ? this.pegTextureReady : this.ballTextureReady
    if (tex && ready) {
      this.gl.activeTexture(this.gl.TEXTURE0)
      this.gl.bindTexture(this.gl.TEXTURE_2D, tex)
      this.gl.uniform1f(this.useTextureLocation, 1)
    } else {
      this.gl.uniform1f(this.useTextureLocation, 0)
    }

    this.gl.drawArrays(this.gl.TRIANGLES, 0, 6)
  }
}

function toColor(r: number, g: number, b: number, a = 1): Color {
  return {
    r: r / 255,
    g: g / 255,
    b: b / 255,
    a,
  }
}

function createTextureFromImage(gl: WebGL2RenderingContext, image: TexImageSource): WebGLTexture {
  const texture = gl.createTexture()
  if (!texture) throw new Error("Unable to create WebGL texture")
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.bindTexture(gl.TEXTURE_2D, null)
  return texture
}

function loadImage(url: string, crossOrigin: string | null | undefined): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    if (typeof crossOrigin === "string" && crossOrigin.length > 0) {
      img.crossOrigin = crossOrigin
    }
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`))
    img.src = url
  })
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type)
  if (!shader) throw new Error("Unable to create shader")
  gl.shaderSource(shader, `#version 300 es\n${source}`)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error(`Shader compile error: ${info ?? "unknown"}`)
  }

  return shader
}

function createProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram {
  const program = gl.createProgram()
  if (!program) throw new Error("Unable to create program")

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program)
    gl.deleteProgram(program)
    throw new Error(`Program link error: ${info ?? "unknown"}`)
  }

  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)
  return program
}
