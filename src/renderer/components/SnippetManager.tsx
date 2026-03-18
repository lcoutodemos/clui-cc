import React, { useMemo, useState } from 'react'
import { Lightning, NotePencil, Plus, Trash, X } from '@phosphor-icons/react'
import { useColors } from '../theme'
import { useSnippetStore } from '../stores/snippetStore'

interface DraftState {
  name: string
  command: string
  content: string
}

const EMPTY_DRAFT: DraftState = {
  name: '',
  command: '',
  content: '',
}

export function SnippetManager() {
  const colors = useColors()
  const snippets = useSnippetStore((s) => s.snippets)
  const closeManager = useSnippetStore((s) => s.closeManager)
  const addSnippet = useSnippetStore((s) => s.addSnippet)
  const updateSnippet = useSnippetStore((s) => s.updateSnippet)
  const deleteSnippet = useSnippetStore((s) => s.deleteSnippet)

  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingDraft, setEditingDraft] = useState<DraftState>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return snippets
    return snippets.filter((snippet) =>
      snippet.name.toLowerCase().includes(query)
      || snippet.command.toLowerCase().includes(query)
      || snippet.content.toLowerCase().includes(query)
    )
  }, [search, snippets])

  const handleCreate = () => {
    const created = addSnippet(draft.name, draft.command, draft.content)
    if (!created) {
      setError('Invalid snippet. Command must be unique, start with /, and content cannot be empty.')
      return
    }
    setDraft(EMPTY_DRAFT)
    setError(null)
  }

  const startEditing = (id: string, name: string, command: string, content: string) => {
    setEditingId(id)
    setEditingDraft({ name, command, content })
    setError(null)
  }

  const handleSaveEdit = () => {
    if (!editingId) return
    const ok = updateSnippet(editingId, editingDraft)
    if (!ok) {
      setError('Invalid snippet update. Command must stay unique and content cannot be empty.')
      return
    }
    setEditingId(null)
    setEditingDraft(EMPTY_DRAFT)
    setError(null)
  }

  return (
    <div
      data-clui-ui
      style={{
        height: 470,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 18px 10px',
        borderBottom: `1px solid ${colors.containerBorder}`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Lightning size={20} style={{ color: colors.accent }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: colors.textPrimary }}>
              Manage Snippets
            </div>
            <div style={{ fontSize: 11, color: colors.textTertiary, marginTop: 2 }}>
              Reusable prompt templates for slash commands
            </div>
          </div>
        </div>
        <button
          onClick={closeManager}
          aria-label="Close snippets"
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ color: colors.textTertiary }}
          title="Close snippets"
        >
          <X size={15} />
        </button>
      </div>

      <div style={{ padding: 16, borderBottom: `1px solid ${colors.containerBorder}` }}>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search snippets..."
          className="w-full rounded-xl px-3 py-2 text-[12px]"
          style={{
            background: colors.surfacePrimary,
            color: colors.textPrimary,
            border: `1px solid ${colors.containerBorder}`,
          }}
        />
      </div>

      <div style={{ padding: 16, borderBottom: `1px solid ${colors.containerBorder}` }}>
        <div className="text-[11px] font-medium mb-2" style={{ color: colors.textPrimary }}>
          Add New Snippet
        </div>
        <div className="grid gap-2">
          <input
            value={draft.name}
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
            placeholder="Name"
            className="rounded-xl px-3 py-2 text-[12px]"
            style={{ background: colors.surfacePrimary, color: colors.textPrimary, border: `1px solid ${colors.containerBorder}` }}
          />
          <input
            value={draft.command}
            onChange={(event) => setDraft((current) => ({ ...current, command: event.target.value }))}
            placeholder="/review"
            className="rounded-xl px-3 py-2 text-[12px] font-mono"
            style={{ background: colors.surfacePrimary, color: colors.textPrimary, border: `1px solid ${colors.containerBorder}` }}
          />
          <textarea
            value={draft.content}
            onChange={(event) => setDraft((current) => ({ ...current, content: event.target.value }))}
            placeholder="Snippet content..."
            className="rounded-xl px-3 py-2 text-[12px] resize-none"
            rows={3}
            style={{ background: colors.surfacePrimary, color: colors.textPrimary, border: `1px solid ${colors.containerBorder}` }}
          />
          <button
            onClick={handleCreate}
            className="rounded-xl px-3 py-2 text-[12px] font-medium flex items-center gap-2 justify-center"
            style={{ background: colors.accent, color: colors.textOnAccent }}
          >
            <Plus size={14} />
            Add Snippet
          </button>
          {error && (
            <div className="text-[11px]" style={{ color: colors.statusError }}>
              {error}
            </div>
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {filtered.length === 0 ? (
          <div
            className="rounded-2xl px-4 py-6 text-center"
            style={{ background: colors.surfacePrimary, color: colors.textTertiary, border: `1px solid ${colors.containerBorder}` }}
          >
            No snippets yet. Create your first template.
          </div>
        ) : (
          <div className="grid gap-3" role="listbox" aria-label="Saved snippets">
            {filtered.map((snippet) => {
              const isEditing = editingId === snippet.id
              return (
                <div
                  key={snippet.id}
                  className="rounded-2xl p-3"
                  style={{ background: colors.surfacePrimary, border: `1px solid ${colors.containerBorder}` }}
                >
                  {isEditing ? (
                    <div className="grid gap-2">
                      <input
                        value={editingDraft.name}
                        onChange={(event) => setEditingDraft((current) => ({ ...current, name: event.target.value }))}
                        className="rounded-xl px-3 py-2 text-[12px]"
                        style={{ background: colors.inputPillBg, color: colors.textPrimary, border: `1px solid ${colors.containerBorder}` }}
                      />
                      <input
                        value={editingDraft.command}
                        onChange={(event) => setEditingDraft((current) => ({ ...current, command: event.target.value }))}
                        className="rounded-xl px-3 py-2 text-[12px] font-mono"
                        style={{ background: colors.inputPillBg, color: colors.textPrimary, border: `1px solid ${colors.containerBorder}` }}
                      />
                      <textarea
                        value={editingDraft.content}
                        onChange={(event) => setEditingDraft((current) => ({ ...current, content: event.target.value }))}
                        className="rounded-xl px-3 py-2 text-[12px] resize-none"
                        rows={4}
                        style={{ background: colors.inputPillBg, color: colors.textPrimary, border: `1px solid ${colors.containerBorder}` }}
                      />
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          onClick={() => {
                            setEditingId(null)
                            setEditingDraft(EMPTY_DRAFT)
                            setError(null)
                          }}
                          className="rounded-xl px-3 py-2 text-[12px]"
                          style={{ color: colors.textSecondary, background: colors.surfaceSecondary }}
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleSaveEdit}
                          className="rounded-xl px-3 py-2 text-[12px] font-medium"
                          style={{ background: colors.accent, color: colors.textOnAccent }}
                        >
                          Save
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
                            {snippet.name}
                          </div>
                          <div className="text-[11px] font-mono mt-1" style={{ color: colors.accent }}>
                            {snippet.command}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => startEditing(snippet.id, snippet.name, snippet.command, snippet.content)}
                            aria-label={`Edit snippet ${snippet.name}`}
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ color: colors.textTertiary, background: colors.surfaceSecondary }}
                            title="Edit snippet"
                          >
                            <NotePencil size={14} />
                          </button>
                          <button
                            onClick={() => deleteSnippet(snippet.id)}
                            aria-label={`Delete snippet ${snippet.name}`}
                            className="w-8 h-8 rounded-full flex items-center justify-center"
                            style={{ color: colors.statusError, background: colors.surfaceSecondary }}
                            title="Delete snippet"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] mt-2 whitespace-pre-wrap" style={{ color: colors.textSecondary }}>
                        {snippet.content}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
