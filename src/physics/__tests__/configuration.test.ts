import { describe, it, expect } from 'vitest'
import { groundStateConfiguration, configurationString, shellCounts, isValenceSubshell, occupiedOrbitals } from '../configuration'

const CORE_AR = '1s2 2s2 2p6 3s2 3p6'
const EXPECTED: Record<number, string> = {
  1: '1s1', 2: '1s2', 3: '1s2 2s1', 4: '1s2 2s2', 5: '1s2 2s2 2p1', 6: '1s2 2s2 2p2', 7: '1s2 2s2 2p3',
  8: '1s2 2s2 2p4', 9: '1s2 2s2 2p5', 10: '1s2 2s2 2p6',
  11: '1s2 2s2 2p6 3s1', 12: '1s2 2s2 2p6 3s2', 13: '1s2 2s2 2p6 3s2 3p1', 14: '1s2 2s2 2p6 3s2 3p2',
  15: '1s2 2s2 2p6 3s2 3p3', 16: '1s2 2s2 2p6 3s2 3p4', 17: '1s2 2s2 2p6 3s2 3p5', 18: '1s2 2s2 2p6 3s2 3p6',
  19: `${CORE_AR} 4s1`, 20: `${CORE_AR} 4s2`,
  21: `${CORE_AR} 4s2 3d1`, 22: `${CORE_AR} 4s2 3d2`, 23: `${CORE_AR} 4s2 3d3`,
  24: `${CORE_AR} 4s1 3d5`, 25: `${CORE_AR} 4s2 3d5`, 26: `${CORE_AR} 4s2 3d6`,
  27: `${CORE_AR} 4s2 3d7`, 28: `${CORE_AR} 4s2 3d8`, 29: `${CORE_AR} 4s1 3d10`,
  30: `${CORE_AR} 4s2 3d10`, 31: `${CORE_AR} 4s2 3d10 4p1`, 32: `${CORE_AR} 4s2 3d10 4p2`,
  33: `${CORE_AR} 4s2 3d10 4p3`, 34: `${CORE_AR} 4s2 3d10 4p4`, 35: `${CORE_AR} 4s2 3d10 4p5`,
  36: `${CORE_AR} 4s2 3d10 4p6`,
}

const label = (s: { n: number; l: number }) => `${s.n}${'spdf'[s.l]}`

describe('groundStateConfiguration', () => {
  it('matches the expected list for Z=1..36', () => {
    for (let Z = 1; Z <= 36; Z++) expect(configurationString(groundStateConfiguration(Z)), `Z=${Z}`).toBe(EXPECTED[Z])
  })
  it('electron totals equal Z', () => {
    for (let Z = 1; Z <= 36; Z++) expect(groundStateConfiguration(Z).reduce((s, x) => s + x.electrons, 0)).toBe(Z)
  })
  it('shell counts', () => {
    expect(shellCounts(groundStateConfiguration(26))).toEqual([2, 8, 14, 2])
    expect(shellCounts(groundStateConfiguration(36))).toEqual([2, 8, 18, 8])
  })
  it('valence subshells', () => {
    const fe = groundStateConfiguration(26)
    expect(fe.filter((s) => isValenceSubshell(fe, s)).map(label)).toEqual(['4s', '3d'])
    const kr = groundStateConfiguration(36)
    expect(kr.filter((s) => isValenceSubshell(kr, s)).map(label)).toEqual(['4s', '4p'])
    const na = groundStateConfiguration(11)
    expect(na.filter((s) => isValenceSubshell(na, s)).map(label)).toEqual(['3s'])
  })
  it('fills orbitals Hund-style', () => {
    expect(occupiedOrbitals({ n: 2, l: 1, electrons: 2 })).toEqual([{ m: 0, electrons: 1 }, { m: 1, electrons: 1 }])
    expect(occupiedOrbitals({ n: 2, l: 1, electrons: 4 })).toEqual([
      { m: 0, electrons: 2 }, { m: 1, electrons: 1 }, { m: -1, electrons: 1 },
    ])
    expect(occupiedOrbitals({ n: 3, l: 2, electrons: 10 }).length).toBe(5)
  })
})
