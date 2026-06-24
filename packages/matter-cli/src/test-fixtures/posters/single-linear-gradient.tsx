import { ShaderScene } from '@lovo/matter-react'
import { LinearGradient } from '@matter/registry/linear-gradient'

export default function SingleLinearGradient() {
  return (
    <ShaderScene>
      <LinearGradient stops={[{ color: '#ff00aa' }, { color: '#00ffaa' }]} />
    </ShaderScene>
  )
}
