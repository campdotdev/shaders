import { ShaderScene } from '@lovo/matter-react'
import { FilmGrain } from '@matter/registry/film-grain'
import { LinearGradient } from '@matter/registry/linear-gradient'

export default function GradientPlusGrain() {
  return (
    <ShaderScene>
      <LinearGradient colors={['#1a0b2e', '#3a1e6e']} stops={[0, 1]} />
      <FilmGrain intensity={0.3} mode="additive" />
    </ShaderScene>
  )
}
