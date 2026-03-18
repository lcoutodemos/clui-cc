export const TAB_ORDER_STORAGE_KEY = 'clui-tab-order'

type TabLike = { id: string }

export function loadStoredTabOrder(): string[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const raw = localStorage.getItem(TAB_ORDER_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((value): value is string => typeof value === 'string')
  } catch {
    return []
  }
}

export function saveStoredTabOrder(tabOrder: string[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(TAB_ORDER_STORAGE_KEY, JSON.stringify(tabOrder))
  } catch {}
}

export function reconcileTabOrder<T extends TabLike>(tabOrder: string[], tabs: T[]): string[] {
  const knownIds = new Set(tabs.map((tab) => tab.id))
  const nextOrder = tabOrder.filter((tabId) => knownIds.has(tabId))
  const nextOrderSet = new Set(nextOrder)

  for (const tab of tabs) {
    if (!nextOrderSet.has(tab.id)) {
      nextOrder.push(tab.id)
      nextOrderSet.add(tab.id)
    }
  }

  return nextOrder
}

export function orderTabsByTabOrder<T extends TabLike>(tabs: T[], tabOrder: string[]): T[] {
  const nextOrder = reconcileTabOrder(tabOrder, tabs)
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]))
  return nextOrder
    .map((tabId) => tabsById.get(tabId))
    .filter((tab): tab is T => Boolean(tab))
}

export function replaceTabOrderId(tabOrder: string[], previousId: string, nextId: string): string[] {
  return tabOrder.map((tabId) => tabId === previousId ? nextId : tabId)
}

export function moveTabOrderItem(tabOrder: string[], tabId: string, direction: 'left' | 'right'): string[] {
  const currentIndex = tabOrder.indexOf(tabId)
  if (currentIndex === -1) return tabOrder

  const nextIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1
  if (nextIndex < 0 || nextIndex >= tabOrder.length) return tabOrder

  const nextOrder = [...tabOrder]
  const [item] = nextOrder.splice(currentIndex, 1)
  nextOrder.splice(nextIndex, 0, item)
  return nextOrder
}
