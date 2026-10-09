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

export const MAX_Z = 118

// Hand-typed: [symbol, name, group, period, block, cpk]. Atomic facts only; no third-party data file.
// Lanthanides and actinides (La-Lu, Ac-Lr) are tagged block 'f' and group 3; CPK colors are the
// standard Jmol element colors (undefined for Z >= 110, shown grey).
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
  ['Rb', 'Rubidium', 1, 5, 's', '#702eb0'], ['Sr', 'Strontium', 2, 5, 's', '#00ff00'],
  ['Y', 'Yttrium', 3, 5, 'd', '#94ffff'], ['Zr', 'Zirconium', 4, 5, 'd', '#94e0e0'],
  ['Nb', 'Niobium', 5, 5, 'd', '#73c2c9'], ['Mo', 'Molybdenum', 6, 5, 'd', '#54b5b5'],
  ['Tc', 'Technetium', 7, 5, 'd', '#3b9e9e'], ['Ru', 'Ruthenium', 8, 5, 'd', '#248f8f'],
  ['Rh', 'Rhodium', 9, 5, 'd', '#0a7d8c'], ['Pd', 'Palladium', 10, 5, 'd', '#006985'],
  ['Ag', 'Silver', 11, 5, 'd', '#c0c0c0'], ['Cd', 'Cadmium', 12, 5, 'd', '#ffd98f'],
  ['In', 'Indium', 13, 5, 'p', '#a67573'], ['Sn', 'Tin', 14, 5, 'p', '#668080'],
  ['Sb', 'Antimony', 15, 5, 'p', '#9e63b5'], ['Te', 'Tellurium', 16, 5, 'p', '#d47a00'],
  ['I', 'Iodine', 17, 5, 'p', '#940094'], ['Xe', 'Xenon', 18, 5, 'p', '#429eb0'],
  ['Cs', 'Caesium', 1, 6, 's', '#57178f'], ['Ba', 'Barium', 2, 6, 's', '#00c900'],
  ['La', 'Lanthanum', 3, 6, 'f', '#70d4ff'], ['Ce', 'Cerium', 3, 6, 'f', '#ffffc7'],
  ['Pr', 'Praseodymium', 3, 6, 'f', '#d9ffc7'], ['Nd', 'Neodymium', 3, 6, 'f', '#c7ffc7'],
  ['Pm', 'Promethium', 3, 6, 'f', '#a3ffc7'], ['Sm', 'Samarium', 3, 6, 'f', '#8fffc7'],
  ['Eu', 'Europium', 3, 6, 'f', '#61ffc7'], ['Gd', 'Gadolinium', 3, 6, 'f', '#45ffc7'],
  ['Tb', 'Terbium', 3, 6, 'f', '#30ffc7'], ['Dy', 'Dysprosium', 3, 6, 'f', '#1fffc7'],
  ['Ho', 'Holmium', 3, 6, 'f', '#00ff9c'], ['Er', 'Erbium', 3, 6, 'f', '#00e675'],
  ['Tm', 'Thulium', 3, 6, 'f', '#00d452'], ['Yb', 'Ytterbium', 3, 6, 'f', '#00bf38'],
  ['Lu', 'Lutetium', 3, 6, 'f', '#00ab24'], ['Hf', 'Hafnium', 4, 6, 'd', '#4dc2ff'],
  ['Ta', 'Tantalum', 5, 6, 'd', '#4da6ff'], ['W', 'Tungsten', 6, 6, 'd', '#2194d6'],
  ['Re', 'Rhenium', 7, 6, 'd', '#267dab'], ['Os', 'Osmium', 8, 6, 'd', '#266696'],
  ['Ir', 'Iridium', 9, 6, 'd', '#175487'], ['Pt', 'Platinum', 10, 6, 'd', '#d0d0e0'],
  ['Au', 'Gold', 11, 6, 'd', '#ffd123'], ['Hg', 'Mercury', 12, 6, 'd', '#b8b8d0'],
  ['Tl', 'Thallium', 13, 6, 'p', '#a6544d'], ['Pb', 'Lead', 14, 6, 'p', '#575961'],
  ['Bi', 'Bismuth', 15, 6, 'p', '#9e4fb5'], ['Po', 'Polonium', 16, 6, 'p', '#ab5c00'],
  ['At', 'Astatine', 17, 6, 'p', '#754f45'], ['Rn', 'Radon', 18, 6, 'p', '#428296'],
  ['Fr', 'Francium', 1, 7, 's', '#420066'], ['Ra', 'Radium', 2, 7, 's', '#007d00'],
  ['Ac', 'Actinium', 3, 7, 'f', '#70abfa'], ['Th', 'Thorium', 3, 7, 'f', '#00baff'],
  ['Pa', 'Protactinium', 3, 7, 'f', '#00a1ff'], ['U', 'Uranium', 3, 7, 'f', '#008fff'],
  ['Np', 'Neptunium', 3, 7, 'f', '#0080ff'], ['Pu', 'Plutonium', 3, 7, 'f', '#006bff'],
  ['Am', 'Americium', 3, 7, 'f', '#545cf2'], ['Cm', 'Curium', 3, 7, 'f', '#785ce3'],
  ['Bk', 'Berkelium', 3, 7, 'f', '#8a4fe3'], ['Cf', 'Californium', 3, 7, 'f', '#a136d4'],
  ['Es', 'Einsteinium', 3, 7, 'f', '#b31fd4'], ['Fm', 'Fermium', 3, 7, 'f', '#b31fba'],
  ['Md', 'Mendelevium', 3, 7, 'f', '#b30da6'], ['No', 'Nobelium', 3, 7, 'f', '#bd0d87'],
  ['Lr', 'Lawrencium', 3, 7, 'f', '#c70066'], ['Rf', 'Rutherfordium', 4, 7, 'd', '#cc0059'],
  ['Db', 'Dubnium', 5, 7, 'd', '#d1004f'], ['Sg', 'Seaborgium', 6, 7, 'd', '#d90045'],
  ['Bh', 'Bohrium', 7, 7, 'd', '#e00038'], ['Hs', 'Hassium', 8, 7, 'd', '#e6002e'],
  ['Mt', 'Meitnerium', 9, 7, 'd', '#eb0026'], ['Ds', 'Darmstadtium', 10, 7, 'd', '#e8e8e8'],
  ['Rg', 'Roentgenium', 11, 7, 'd', '#e8e8e8'], ['Cn', 'Copernicium', 12, 7, 'd', '#e8e8e8'],
  ['Nh', 'Nihonium', 13, 7, 'p', '#e8e8e8'], ['Fl', 'Flerovium', 14, 7, 'p', '#e8e8e8'],
  ['Mc', 'Moscovium', 15, 7, 'p', '#e8e8e8'], ['Lv', 'Livermorium', 16, 7, 'p', '#e8e8e8'],
  ['Ts', 'Tennessine', 17, 7, 'p', '#e8e8e8'], ['Og', 'Oganesson', 18, 7, 'p', '#e8e8e8'],
]

export const ELEMENTS: readonly Element[] = RAW.map(([symbol, name, group, period, block, cpk], i) => ({
  Z: i + 1, symbol, name, group, period, block, cpk,
}))

export function elementByZ(Z: number): Element | undefined {
  return ELEMENTS[Z - 1]
}

/** Grid placement in an 18-column periodic table: f-block rows sit below the main table. */
export function periodicTableCell(e: Element): { row: number; col: number } {
  if (e.block === 'f') {
    const start = e.period === 6 ? 57 : 89
    return { row: e.period === 6 ? 9 : 10, col: 3 + (e.Z - start) }
  }
  return { row: e.period, col: e.group }
}
