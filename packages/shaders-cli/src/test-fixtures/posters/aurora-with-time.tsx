import { ShaderScene } from '@camp-dev/shaders-react'
import { Aurora } from '@shaders/registry/aurora'

export default function AuroraWithTime() {
  return (
    <ShaderScene>
      <Aurora horizonColor="#003a4a" skyColor="#0a206e" />
    </ShaderScene>
  )
}
