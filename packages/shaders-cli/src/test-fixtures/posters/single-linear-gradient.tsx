import { ShaderScene } from '@camp-dev/shaders-react'
import { LinearGradient } from '@shaders/registry/linear-gradient'

export default function SingleLinearGradient() {
  return (
    <ShaderScene>
      <LinearGradient stops={[{ color: '#ff00aa' }, { color: '#00ffaa' }]} />
    </ShaderScene>
  )
}
