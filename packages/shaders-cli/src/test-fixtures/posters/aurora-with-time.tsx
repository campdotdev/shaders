import { Aurora, ShaderScene } from '@camp-dev/shaders'

export default function AuroraWithTime() {
  return (
    <ShaderScene>
      <Aurora horizonColor="#003a4a" skyColor="#0a206e" />
    </ShaderScene>
  )
}
