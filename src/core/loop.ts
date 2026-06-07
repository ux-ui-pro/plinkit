export type FrameStep = (now: number) => void

export class RafLoop {
  private rafId: number | null = null
  private readonly step: FrameStep

  constructor(step: FrameStep) {
    this.step = step
  }

  start(): void {
    if (this.rafId !== null) return
    const tick = (time: number) => {
      this.step(time)
      this.rafId = window.requestAnimationFrame(tick)
    }

    this.rafId = window.requestAnimationFrame(tick)
  }

  stop(): void {
    if (this.rafId === null) return
    window.cancelAnimationFrame(this.rafId)
    this.rafId = null
  }
}
