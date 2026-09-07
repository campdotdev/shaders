import { LinearGradient, ShaderScene } from '@camp-dev/shaders'

export function NamedExport() {
  return (
    <ShaderScene>
      <LinearGradient stops={[{ color: '#110022' }, { color: '#220044' }]} />
    </ShaderScene>
  )
}
