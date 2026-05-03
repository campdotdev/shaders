import type { Preview } from '@storybook/react-vite'

const preview: Preview = {
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#0e0e1a' },
        { name: 'light', value: '#ffffff' },
        { name: 'gray', value: '#888888' },
      ],
    },
    layout: 'fullscreen',
  },
}

export default preview
