# plinkit

A minimal WebGL library for Plinko-style games.

## Installation

```bash
npm install plinkit
```

## Quick Start

```ts
import { Plinkit } from 'plinkit'

const canvas = document.querySelector('canvas')
if (!canvas) throw new Error('Canvas not found')

const game = new Plinkit({
  canvas,
  viewport: {
    dprCap: 2,
    heightPolicy: {
      topPaddingPx: 60,
      bottomPaddingPx: 0,
    },
  },
  gravityY: 0.65,
  ballRadius: 10,
  layout: {
    mainPegs: {
      radius: 4,
      topPegCount: 3,
      bottomPegCount: 12,
      verticalStepRatio: 0.86,
      sidePaddingPx: 10,
    },
    edgeGuides: {
      radius: 8,
      spread: 1.1,
      yOffset: -2,
    },
  },
  multipliers: [7, 1.5, 0.5, 0.2, 0.1, 0, 0.1, 0.2, 0.5, 1.5, 7],
  initialBalance: 5000,
  ballCost: 250,
  showGuidePegs: false,
  houseEdge: 0.5,
})

game.spawnBall()
```

## API

- `new Plinkit(options)` — creates a game instance.
- `spawnBall()` — adds a new ball and returns a `SpawnResult`.
- `resize()` — reads the parent width again and recalculates the viewport.
- `destroy()` — stops the loop and releases resources.
- `getState()` — returns `{ balance, ballCost }`.
- `setBallCost(value)` — changes the ball cost at runtime. Updates `getState().ballCost`
  and synchronously calls `onBalanceChange`, so the UI can recalculate the button's
  disabled state. Balls that are already in flight keep their original `wager`: payout
  is calculated from the cost the ball was launched with. Throws `TypeError` if the
  value is not a finite number or is negative.
- `onCollision(collision, state)` in `options` — a ball collision event for `peg`/`guide`.
  Use it to integrate app-side external audio.

### External Audio Integration

Use any audio library, or wire up your own Web Audio/HTMLAudio layer in the host application.

```ts
interface SoundPlayer {
  play(): void | Promise<void>
  setVolume?(value: number): void
}

const pegHit: SoundPlayer = createSoundPlayer("/sounds/peg.mp3")
const bucketHit: SoundPlayer = createSoundPlayer("/sounds/bucket.mp3")
const uiTap: SoundPlayer = createSoundPlayer("/sounds/ui-tap.mp3")

// Optional: one-time audio initialization/unlock on the first user gesture
prepareAudioOnFirstGesture()

const game = new Plinkit({
  // ...other options
  onCollision: ({ speed }) => {
    const hitVolume = Math.max(0.08, Math.min(0.45, speed / 12))
    pegHit.setVolume?.(hitVolume)
    pegHit.play()
  },
  onBallSettled: () => bucketHit.play(),
})

spawnButton.addEventListener("click", () => {
  uiTap.play()
  game.spawnBall()
})
```

### Economy

- Values are passed through `initialBalance`, `ballCost`, and `multipliers`.
- When a ball lands in a bucket, it awards `ballCost * multiplier`.
- The number of buckets = `multipliers.length` = `bottomPegCount - 1`.
- `multipliers` is the RTP table and should not be changed together with `ballCost`:
  scale the wager through `setBallCost`, and keep the multipliers fixed.
- For predictable landing-page UX, keep a single wager within roughly 5% of the balance
  (`initialBalance`). Otherwise, one ball with a peak multiplier (for example, `×7`) can
  pay out an amount comparable to the entire starting balance.

### houseEdge

The `houseEdge` parameter (0..1) controls the probability of landing in edge buckets:

| houseEdge | Effect           | RTP*  |
|-----------|------------------|-------|
| 0         | Natural physics  | ~120% |
| 0.5       | Stable balance   | ~97%  |
| 1.0       | Balance declines | ~73%  |

*RTP (Return to Player) depends on the multipliers. Values are shown for `[7, 1.5, 0.5, 0.2, 0.1, 0, 0.1, 0.2, 0.5, 1.5, 7]`.

Internally, `houseEdge` controls three mechanisms: a centripetal micro-force,
velocity correction on peg bounce, and a Gaussian distribution for the spawn point.

> **Important:** multipliers are calibrated for a specific board geometry (`topPegCount`,
> `bottomPegCount`, `radius`, `verticalStepRatio`, `sidePaddingPx`). Changing any of
> these parameters shifts the ball distribution and requires recalibrating the
> multipliers. Use `scripts/bench-distribution.mjs` for calibration.

## Development

```bash
npm run dev       # dev server with a demo page
npm run verify    # lint + typecheck + smoke test
```

### Multiplier Calibration

```bash
npx vite-node scripts/bench-distribution.mjs
```

The script runs 3000 balls for each `houseEdge` value and prints RTP.
Adjust the multipliers in the script so RTP is approximately 100% at `houseEdge: 0.5`.
