import { ShaderScene } from '@lovo/matter-react'
import { LinearGradient } from '@matter/registry/linear-gradient'

export function NamedExport() {
  return (
    <ShaderScene>
      <LinearGradient colors={['#102', '#204']} />
    </ShaderScene>
  )
}
