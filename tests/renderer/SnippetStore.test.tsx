// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from 'vitest'
import { useSnippetStore } from '../../src/renderer/stores/snippetStore'

describe('SnippetStore', () => {
  beforeEach(() => {
    useSnippetStore.setState({
      snippets: [],
      managerOpen: false,
      editingId: null,
    })
  })

  it('starts with no snippets', () => {
    expect(useSnippetStore.getState().snippets).toHaveLength(0)
  })

  it('starts with manager closed', () => {
    expect(useSnippetStore.getState().managerOpen).toBe(false)
  })

  it('openManager() sets managerOpen to true', () => {
    useSnippetStore.getState().openManager()
    expect(useSnippetStore.getState().managerOpen).toBe(true)
  })

  it('closeManager() sets managerOpen to false', () => {
    useSnippetStore.getState().openManager()
    useSnippetStore.getState().closeManager()
    expect(useSnippetStore.getState().managerOpen).toBe(false)
  })

  it('addSnippet() creates snippet with id', () => {
    const result = useSnippetStore.getState().addSnippet('Test Snippet', '/mytest', 'Do the test thing')
    expect(result).not.toBeNull()
    const snippets = useSnippetStore.getState().snippets
    expect(snippets.length).toBeGreaterThanOrEqual(1)
    const added = snippets.find((s) => s.command === '/mytest')
    expect(added).toBeDefined()
    expect(added!.name).toBe('Test Snippet')
  })

  it('deleteSnippet() removes by id', () => {
    const added = useSnippetStore.getState().addSnippet('Deletable', '/deleteme', 'Content here')
    expect(added).not.toBeNull()
    useSnippetStore.getState().deleteSnippet(added!.id)
    const remaining = useSnippetStore.getState().snippets.find((s) => s.id === added!.id)
    expect(remaining).toBeUndefined()
  })

  it('updateSnippet() modifies existing snippet', () => {
    const added = useSnippetStore.getState().addSnippet('Original', '/origcmd', 'Original content')
    expect(added).not.toBeNull()
    useSnippetStore.getState().updateSnippet(added!.id, { name: 'Updated' })
    const updated = useSnippetStore.getState().snippets.find((s) => s.id === added!.id)
    expect(updated?.name).toBe('Updated')
  })
})
