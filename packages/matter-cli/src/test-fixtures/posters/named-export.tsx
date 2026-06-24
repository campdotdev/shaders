import { ShaderScene } from '@lovo/matter-react'
import { LinearGradient } from '@matter/registry/linear-gradient'

export function NamedExport() {
  return (
    <ShaderScene>
      <LinearGradient stops={[{ color: '#110022' }, { color: '#220044' }]} />
    </ShaderScene>
  )
}
