import { describe, expect, it } from 'vitest'
import {
  moveTabOrderItem,
  orderTabsByTabOrder,
  reconcileTabOrder,
  replaceTabOrderId,
} from '../../src/renderer/stores/tabOrder'

describe('tab order helpers', () => {
  it('reconciles stored order with current tabs', () => {
    const tabs = [{ id: 'tab-a' }, { id: 'tab-b' }, { id: 'tab-c' }]
    const result = reconcileTabOrder(['tab-c', 'missing', 'tab-a'], tabs)

    expect(result).toEqual(['tab-c', 'tab-a', 'tab-b'])
  })

  it('orders tabs by the reconciled tab order', () => {
    const tabs = [
      { id: 'tab-a', title: 'A' },
      { id: 'tab-b', title: 'B' },
      { id: 'tab-c', title: 'C' },
    ]

    const ordered = orderTabsByTabOrder(tabs, ['tab-c', 'tab-a'])

    expect(ordered.map((tab) => tab.id)).toEqual(['tab-c', 'tab-a', 'tab-b'])
  })

  it('replaces the initial tab id once the backend tab id is known', () => {
    expect(replaceTabOrderId(['temp-tab'], 'temp-tab', 'real-tab')).toEqual(['real-tab'])
  })

  it('moves a tab left or right within the ordered list', () => {
    expect(moveTabOrderItem(['tab-a', 'tab-b', 'tab-c'], 'tab-b', 'left')).toEqual(['tab-b', 'tab-a', 'tab-c'])
    expect(moveTabOrderItem(['tab-a', 'tab-b', 'tab-c'], 'tab-b', 'right')).toEqual(['tab-a', 'tab-c', 'tab-b'])
  })
})
