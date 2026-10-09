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

const KR = `${CORE_AR} 4s2 3d10 4p6`
const XE = `${KR} 5s2 4d10 5p6`
const RN = `${XE} 6s2 4f14 5d10 6p6`
// Z = 37..118 in Madelung fill order, ground states per the NIST Atomic Spectra Database.
const HEAVY: Record<number, string> = {
  37: `${KR} 5s1`, 38: `${KR} 5s2`, 39: `${KR} 5s2 4d1`, 40: `${KR} 5s2 4d2`, 41: `${KR} 5s1 4d4`, 42: `${KR} 5s1 4d5`,
  43: `${KR} 5s2 4d5`, 44: `${KR} 5s1 4d7`, 45: `${KR} 5s1 4d8`, 46: `${KR} 4d10`, 47: `${KR} 5s1 4d10`, 48: `${KR} 5s2 4d10`,
  49: `${KR} 5s2 4d10 5p1`, 50: `${KR} 5s2 4d10 5p2`, 51: `${KR} 5s2 4d10 5p3`, 52: `${KR} 5s2 4d10 5p4`, 53: `${KR} 5s2 4d10 5p5`, 54: XE,
  55: `${XE} 6s1`, 56: `${XE} 6s2`, 57: `${XE} 6s2 5d1`, 58: `${XE} 6s2 4f1 5d1`, 59: `${XE} 6s2 4f3`, 60: `${XE} 6s2 4f4`,
  61: `${XE} 6s2 4f5`, 62: `${XE} 6s2 4f6`, 63: `${XE} 6s2 4f7`, 64: `${XE} 6s2 4f7 5d1`, 65: `${XE} 6s2 4f9`, 66: `${XE} 6s2 4f10`,
  67: `${XE} 6s2 4f11`, 68: `${XE} 6s2 4f12`, 69: `${XE} 6s2 4f13`, 70: `${XE} 6s2 4f14`, 71: `${XE} 6s2 4f14 5d1`, 72: `${XE} 6s2 4f14 5d2`,
  73: `${XE} 6s2 4f14 5d3`, 74: `${XE} 6s2 4f14 5d4`, 75: `${XE} 6s2 4f14 5d5`, 76: `${XE} 6s2 4f14 5d6`, 77: `${XE} 6s2 4f14 5d7`,
  78: `${XE} 6s1 4f14 5d9`, 79: `${XE} 6s1 4f14 5d10`, 80: `${XE} 6s2 4f14 5d10`, 81: `${XE} 6s2 4f14 5d10 6p1`, 82: `${XE} 6s2 4f14 5d10 6p2`,
  83: `${XE} 6s2 4f14 5d10 6p3`, 84: `${XE} 6s2 4f14 5d10 6p4`, 85: `${XE} 6s2 4f14 5d10 6p5`, 86: RN,
  87: `${RN} 7s1`, 88: `${RN} 7s2`, 89: `${RN} 7s2 6d1`, 90: `${RN} 7s2 6d2`, 91: `${RN} 7s2 5f2 6d1`, 92: `${RN} 7s2 5f3 6d1`,
  93: `${RN} 7s2 5f4 6d1`, 94: `${RN} 7s2 5f6`, 95: `${RN} 7s2 5f7`, 96: `${RN} 7s2 5f7 6d1`, 97: `${RN} 7s2 5f9`, 98: `${RN} 7s2 5f10`,
  99: `${RN} 7s2 5f11`, 100: `${RN} 7s2 5f12`, 101: `${RN} 7s2 5f13`, 102: `${RN} 7s2 5f14`, 103: `${RN} 7s2 5f14 7p1`, 104: `${RN} 7s2 5f14 6d2`,
  105: `${RN} 7s2 5f14 6d3`, 106: `${RN} 7s2 5f14 6d4`, 107: `${RN} 7s2 5f14 6d5`, 108: `${RN} 7s2 5f14 6d6`, 109: `${RN} 7s2 5f14 6d7`,
  110: `${RN} 7s2 5f14 6d8`, 111: `${RN} 7s2 5f14 6d9`, 112: `${RN} 7s2 5f14 6d10`, 113: `${RN} 7s2 5f14 6d10 7p1`, 114: `${RN} 7s2 5f14 6d10 7p2`,
  115: `${RN} 7s2 5f14 6d10 7p3`, 116: `${RN} 7s2 5f14 6d10 7p4`, 117: `${RN} 7s2 5f14 6d10 7p5`, 118: `${RN} 7s2 5f14 6d10 7p6`,
}

const label = (s: { n: number; l: number }) => `${s.n}${'spdf'[s.l]}`

describe('groundStateConfiguration', () => {
  it('matches the expected list for Z=1..36', () => {
    for (let Z = 1; Z <= 36; Z++) expect(configurationString(groundStateConfiguration(Z)), `Z=${Z}`).toBe(EXPECTED[Z])
  })
  it('matches the expected list for Z=37..118', () => {
    for (let Z = 37; Z <= 118; Z++) expect(configurationString(groundStateConfiguration(Z)), `Z=${Z}`).toBe(HEAVY[Z])
  })
  it('electron totals equal Z and no subshell is overfilled', () => {
    for (let Z = 1; Z <= 118; Z++) {
      const cfg = groundStateConfiguration(Z)
      expect(cfg.reduce((s, x) => s + x.electrons, 0)).toBe(Z)
      for (const s of cfg) expect(s.electrons).toBeLessThanOrEqual(2 * (2 * s.l + 1))
    }
  })
  it('shell counts', () => {
    expect(shellCounts(groundStateConfiguration(26))).toEqual([2, 8, 14, 2])
    expect(shellCounts(groundStateConfiguration(36))).toEqual([2, 8, 18, 8])
    expect(shellCounts(groundStateConfiguration(118))).toEqual([2, 8, 18, 32, 32, 18, 8])
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
