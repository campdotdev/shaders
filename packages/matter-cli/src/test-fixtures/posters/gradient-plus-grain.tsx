import { ShaderScene } from '@lovo/matter-react'
import { Grain } from '@matter/registry/grain'
import { LinearGradient } from '@matter/registry/linear-gradient'

export default function GradientPlusGrain() {
  return (
    <ShaderScene>
      <LinearGradient stops={[{ color: '#1a0b2e' }, { color: '#3a1e6e' }]} />
      <Grain intensity={0.3} blend="additive" />
    </ShaderScene>
  )
}
