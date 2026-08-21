import { ShaderScene } from '@camp-dev/shaders-react'
import { LinearGradient } from '@shaders/registry/linear-gradient'

export function NamedExport() {
  return (
    <ShaderScene>
      <LinearGradient stops={[{ color: '#110022' }, { color: '#220044' }]} />
    </ShaderScene>
  )
}
