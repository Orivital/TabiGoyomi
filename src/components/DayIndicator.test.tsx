import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DayIndicator } from './DayIndicator'

// jsdom は scrollTo を未実装のためモックする
window.HTMLElement.prototype.scrollTo = vi.fn()

const days = [
  { dayDate: '2024-01-01', label: 'Day 1' },
  { dayDate: '2024-01-02', label: 'Day 2' },
  { dayDate: '2024-01-03', label: 'Day 3' },
]

test('各日程のボタンが表示される', () => {
  render(<DayIndicator days={days} activeIndex={0} onSelect={() => {}} />)

  expect(screen.getByText('Day 1')).toBeInTheDocument()
  expect(screen.getByText('Day 2')).toBeInTheDocument()
  expect(screen.getByText('Day 3')).toBeInTheDocument()
})

test('activeIndex のボタンに aria-current="true" が付く', () => {
  render(<DayIndicator days={days} activeIndex={1} onSelect={() => {}} />)

  expect(screen.getByRole('button', { name: 'Day 2' })).toHaveAttribute('aria-current', 'true')
  expect(screen.getByRole('button', { name: 'Day 1' })).not.toHaveAttribute('aria-current')
  expect(screen.getByRole('button', { name: 'Day 3' })).not.toHaveAttribute('aria-current')
})

test('ボタンをクリックするとそのインデックスで onSelect が呼ばれる', async () => {
  const onSelect = vi.fn()
  render(<DayIndicator days={days} activeIndex={0} onSelect={onSelect} />)

  await userEvent.click(screen.getByText('Day 3'))

  expect(onSelect).toHaveBeenCalledWith(2)
})
