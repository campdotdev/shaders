import { LinearGradient, ShaderScene } from '@camp-dev/shaders'

export default function SingleLinearGradient() {
  return (
    <ShaderScene>
      <LinearGradient stops={[{ color: '#ff00aa' }, { color: '#00ffaa' }]} />
    </ShaderScene>
  )
}
