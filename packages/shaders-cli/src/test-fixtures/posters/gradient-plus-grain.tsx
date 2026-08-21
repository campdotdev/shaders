import { ShaderScene } from '@camp-dev/shaders-react'
import { Grain } from '@shaders/registry/grain'
import { LinearGradient } from '@shaders/registry/linear-gradient'

export default function GradientPlusGrain() {
  return (
    <ShaderScene>
      <LinearGradient stops={[{ color: '#1a0b2e' }, { color: '#3a1e6e' }]} />
      <Grain intensity={0.3} blend="additive" />
    </ShaderScene>
  )
}
