import { ShaderScene } from '@lovo/matter-react'
import { FilmGrain } from '@matter/registry/film-grain'
import { LinearGradient } from '@matter/registry/linear-gradient'

export default function GradientPlusGrain() {
  return (
    <ShaderScene>
      <LinearGradient stops={[{ color: '#1a0b2e' }, { color: '#3a1e6e' }]} />
      <FilmGrain intensity={0.3} grainBlend="additive" />
    </ShaderScene>
  )
}
