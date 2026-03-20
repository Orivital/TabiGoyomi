import { render, screen } from '@testing-library/react'
import { LoadingScreen } from './LoadingScreen'

test('ブランドロゴが表示される', () => {
  render(<LoadingScreen />)

  expect(screen.getByAltText('旅暦')).toBeInTheDocument()
})

test('ローディングドットが3つ表示される', () => {
  const { container } = render(<LoadingScreen />)

  const dots = container.querySelectorAll('.loading-dot')
  expect(dots).toHaveLength(3)
})
