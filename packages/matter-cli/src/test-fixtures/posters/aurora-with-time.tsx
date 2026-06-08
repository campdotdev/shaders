import { ShaderScene } from '@lovo/matter-react'
import { Aurora } from '@matter/registry/aurora'

export default function AuroraWithTime() {
  return (
    <ShaderScene>
      <Aurora horizonColor="#003a4a" skyColor="#0a206e" />
    </ShaderScene>
  )
}
