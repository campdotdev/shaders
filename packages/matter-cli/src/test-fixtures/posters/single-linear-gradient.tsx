import { ShaderScene } from '@lovo/matter-react'
import { LinearGradient } from '@matter/registry/linear-gradient'

export default function SingleLinearGradient() {
  return (
    <ShaderScene>
      <LinearGradient colors={['#ff00aa', '#00ffaa']} stops={[0, 1]} />
    </ShaderScene>
  )
}
