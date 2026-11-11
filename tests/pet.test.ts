import { expect, test } from 'claude-code/testing'
import { PET_ACTS, petFrame, petSvgBody, petLaneSvg, createPet, stepPet, PET_RASTER } from '../hooks/pet.js'

test('every pose draws on the desktop and in the terminal from the same scene', async () => {
  for (const act of PET_ACTS) {
    const svg = petSvgBody(act, 1234, { minis: ['haiku'] })
    expect(svg).toMatch(/<rect /)
    const px = petFrame(act, 1234, 1, { minis: ['haiku'] })
    expect(px.length).toBe(PET_RASTER.width * PET_RASTER.height * 4)
    let opaque = 0
    for (let i = 3; i < px.length; i += 4) if (px[i] > 200) opaque++
    expect(opaque).toBeGreaterThan(400)
  }
})

test('a redraw keeps every loop in phase instead of restarting it', async () => {
  const a = petSvgBody('walk', 0)
  const b = petSvgBody('walk', 170)
  expect(a).not.toBe(b)
  expect(b).toMatch(/infinite/)
  expect(b).toMatch(/-0\.17s/)
})

test('turning around squashes through the middle', async () => {
  const pet = createPet(0)
  let r = 0.2
  const rand = () => r
  stepPet(pet, 'calm', 5000, rand)
  pet.dir = 1
  r = 0.9 // calm picks a run, to the left of where it stands
  pet.x0 = pet.x1 = 0.9
  stepPet(pet, 'calm', 20_000, () => 0.6)
  expect(pet.act === 'walk' || pet.act === 'run').toBe(true)
  if (pet.dir < 0) expect(petLaneSvg(pet, pet.turnAt + 50, 400, 44)).toMatch(/@keyframes tn\d+/)
})
