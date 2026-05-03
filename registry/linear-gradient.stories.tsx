import type { Meta, StoryObj } from '@storybook/react-vite'
import { LinearGradient } from './linear-gradient.js'

const meta: Meta<typeof LinearGradient> = {
  title: 'Components/LinearGradient',
  component: LinearGradient,
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof LinearGradient>

export const Default: Story = {
  args: {
    colors: ['#ff7b72', '#7b9cff'],
    angle: 0,
  },
}

export const Animated: Story = {
  args: {
    colors: ['#ff7b72', '#7b9cff', '#7bffd0'],
    angle: 45,
    speed: 0.3,
  },
}

export const Interactive: Story = {
  args: {
    colors: ['#ff7b72', '#7b9cff'],
    angle: 0,
    interactive: true,
  },
}

export const Radial: Story = {
  args: {
    colors: ['#7b9cff', '#0a0a23'],
    variant: 'radial',
    focalPoint: [0.5, 0.5],
  },
}

export const Fallback: Story = {
  args: {
    colors: ['#ff7b72', '#7b9cff'],
    angle: 90,
    // Force fallback by providing one — overrides the auto CSS gradient.
    fallback: (
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(90deg, #ff7b72, #7b9cff)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#fff',
          fontSize: '2rem',
          fontFamily: 'system-ui',
        }}
      >
        Custom fallback
      </div>
    ),
  },
}
