import { Grain, LinearGradient, ShaderScene } from '@camp-dev/shaders'

export default function GradientPlusGrain() {
  return (
    <ShaderScene>
      <LinearGradient stops={[{ color: '#1a0b2e' }, { color: '#3a1e6e' }]} />
      <Grain intensity={0.3} blend="additive" />
    </ShaderScene>
  )
}
