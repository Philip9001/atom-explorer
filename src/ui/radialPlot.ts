import { radialCurve } from '../physics/radialCurve'

export interface RadialSeries { n: number; l: number; Z: number; scale: number; color: string; label: string }

/** Plot r^2 R^2 (times `scale`, e.g. electron count) against r in Bohr radii. */
export function drawRadialPlot(canvas: HTMLCanvasElement, series: RadialSeries[], rMax: number, dark: boolean): void {
  const W = canvas.clientWidth || 300, H = 150
  const dpr = Math.min(2, window.devicePixelRatio || 1)
  canvas.width = W * dpr
  canvas.height = H * dpr
  const ctx = canvas.getContext('2d')!
  ctx.scale(dpr, dpr)
  const fg = dark ? '#ececf1' : '#1c1c22', grid = dark ? '#2a2a33' : '#e2e2e8'
  ctx.clearRect(0, 0, W, H)
  const pad = { l: 28, r: 8, t: 8, b: 22 }
  const curves = series.map((s) => ({ s, c: radialCurve(s.n, s.l, s.Z, rMax, 400) }))
  let yMax = 0
  for (const { s, c } of curves) for (const v of c.y) yMax = Math.max(yMax, v * s.scale)
  if (yMax === 0) yMax = 1
  const x = (r: number) => pad.l + (r / rMax) * (W - pad.l - pad.r)
  const y = (v: number) => H - pad.b - (v / yMax) * (H - pad.t - pad.b)
  ctx.strokeStyle = grid
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, H - pad.b); ctx.lineTo(W - pad.r, H - pad.b)
  ctx.stroke()
  ctx.fillStyle = fg
  ctx.font = '10px system-ui, sans-serif'
  ctx.textAlign = 'center'
  const ticks = niceTicks(rMax)
  for (const t of ticks) {
    ctx.fillText(String(t), x(t), H - pad.b + 12)
    ctx.strokeStyle = grid
    ctx.beginPath(); ctx.moveTo(x(t), H - pad.b); ctx.lineTo(x(t), H - pad.b + 3); ctx.stroke()
  }
  ctx.fillText('r (a₀)', (pad.l + W - pad.r) / 2, H - 2)
  ctx.save()
  ctx.translate(9, (pad.t + H - pad.b) / 2)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('r²R²', 0, 0)
  ctx.restore()
  for (const { s, c } of curves) {
    ctx.strokeStyle = s.color
    ctx.lineWidth = 1.6
    ctx.beginPath()
    for (let i = 0; i < c.r.length; i++) {
      const px = x(c.r[i]), py = y(c.y[i] * s.scale)
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py)
    }
    ctx.stroke()
  }
  // legend
  ctx.textAlign = 'left'
  let ly = pad.t + 10
  for (const { s } of curves.slice(0, 8)) {
    ctx.fillStyle = s.color
    ctx.fillRect(W - pad.r - 60, ly - 7, 10, 3)
    ctx.fillStyle = fg
    ctx.fillText(s.label, W - pad.r - 46, ly - 2)
    ly += 12
  }
}

function niceTicks(max: number): number[] {
  const raw = max / 4
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag
  const out: number[] = []
  for (let t = 0; t <= max + 1e-9; t += step) out.push(Number(t.toFixed(6)))
  return out
}
