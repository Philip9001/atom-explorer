export interface Element {
  Z: number
  symbol: string
  name: string
  group: number
  period: number
  block: 's' | 'p' | 'd' | 'f'
  /** CPK-style display color (standard Jmol element colors). */
  cpk: string
}

export const MAX_Z = 36

// Hand-typed: [symbol, name, group, period, block, cpk]. Atomic facts only; no third-party data file.
const RAW: [string, string, number, number, Element['block'], string][] = [
  ['H', 'Hydrogen', 1, 1, 's', '#ffffff'], ['He', 'Helium', 18, 1, 's', '#d9ffff'],
  ['Li', 'Lithium', 1, 2, 's', '#cc80ff'], ['Be', 'Beryllium', 2, 2, 's', '#c2ff00'],
  ['B', 'Boron', 13, 2, 'p', '#ffb5b5'], ['C', 'Carbon', 14, 2, 'p', '#909090'],
  ['N', 'Nitrogen', 15, 2, 'p', '#3050f8'], ['O', 'Oxygen', 16, 2, 'p', '#ff0d0d'],
  ['F', 'Fluorine', 17, 2, 'p', '#90e050'], ['Ne', 'Neon', 18, 2, 'p', '#b3e3f5'],
  ['Na', 'Sodium', 1, 3, 's', '#ab5cf2'], ['Mg', 'Magnesium', 2, 3, 's', '#8aff00'],
  ['Al', 'Aluminium', 13, 3, 'p', '#bfa6a6'], ['Si', 'Silicon', 14, 3, 'p', '#f0c8a0'],
  ['P', 'Phosphorus', 15, 3, 'p', '#ff8000'], ['S', 'Sulfur', 16, 3, 'p', '#ffff30'],
  ['Cl', 'Chlorine', 17, 3, 'p', '#1ff01f'], ['Ar', 'Argon', 18, 3, 'p', '#80d1e3'],
  ['K', 'Potassium', 1, 4, 's', '#8f40d4'], ['Ca', 'Calcium', 2, 4, 's', '#3dff00'],
  ['Sc', 'Scandium', 3, 4, 'd', '#e6e6e6'], ['Ti', 'Titanium', 4, 4, 'd', '#bfc2c7'],
  ['V', 'Vanadium', 5, 4, 'd', '#a6a6ab'], ['Cr', 'Chromium', 6, 4, 'd', '#8a99c7'],
  ['Mn', 'Manganese', 7, 4, 'd', '#9c7ac7'], ['Fe', 'Iron', 8, 4, 'd', '#e06633'],
  ['Co', 'Cobalt', 9, 4, 'd', '#f090a0'], ['Ni', 'Nickel', 10, 4, 'd', '#50d050'],
  ['Cu', 'Copper', 11, 4, 'd', '#c88033'], ['Zn', 'Zinc', 12, 4, 'd', '#7d80b0'],
  ['Ga', 'Gallium', 13, 4, 'p', '#c28f8f'], ['Ge', 'Germanium', 14, 4, 'p', '#668f8f'],
  ['As', 'Arsenic', 15, 4, 'p', '#bd80e3'], ['Se', 'Selenium', 16, 4, 'p', '#ffa100'],
  ['Br', 'Bromine', 17, 4, 'p', '#a62929'], ['Kr', 'Krypton', 18, 4, 'p', '#5cb8d1'],
]

export const ELEMENTS: readonly Element[] = RAW.map(([symbol, name, group, period, block, cpk], i) => ({
  Z: i + 1, symbol, name, group, period, block, cpk,
}))

export function elementByZ(Z: number): Element | undefined {
  return ELEMENTS[Z - 1]
}
