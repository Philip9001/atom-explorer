import { COLORMAPS, colormapLookup, type ColormapName } from '../physics/colormaps'

/** Paints a normalized density field (row 0 = bottom) into a canvas through a colormap. */
export function paintSlice(canvas: HTMLCanvasElement, field: Float32Array, size: number, colormap: ColormapName, gamma: number): void {
  canvas.width = canvas.height = size
  const ctx = canvas.getContext('2d')!
  const img = ctx.createImageData(size, size)
  const map = COLORMAPS[colormap]
  const rgb = new Float32Array(3)
  for (let j = 0; j < size; j++) {
    const row = size - 1 - j // canvas rows go top to bottom
    for (let i = 0; i < size; i++) {
      colormapLookup(map, Math.pow(field[j * size + i], gamma), rgb, 0)
      const o = 4 * (row * size + i)
      img.data[o] = rgb[0] * 255
      img.data[o + 1] = rgb[1] * 255
      img.data[o + 2] = rgb[2] * 255
      img.data[o + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
}
