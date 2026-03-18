import { describe, expect, it, vi } from 'vitest'
import type { CatalogPlugin } from '../../src/shared/types'
import { createMarketplaceStore, deriveMarketplacePluginStates } from '../../src/renderer/stores/marketplaceStore'

const samplePlugins: CatalogPlugin[] = [
  {
    id: 'skill-a',
    name: 'Skill A',
    description: 'Skill',
    version: '0.0.1',
    author: 'Author',
    marketplace: 'Agent Skills',
    repo: 'anthropics/skills',
    sourcePath: 'skills/a',
    installName: 'skill-a',
    category: 'Agent Skills',
    tags: ['Automation'],
    isSkillMd: true,
  },
  {
    id: 'plugin-b',
    name: 'Plugin B',
    description: 'Plugin',
    version: '0.0.1',
    author: 'Author',
    marketplace: 'Knowledge Work',
    repo: 'anthropics/knowledge-work-plugins',
    sourcePath: 'plugins/b',
    installName: 'plugin-b',
    category: 'Knowledge Work',
    tags: ['Docs'],
    isSkillMd: false,
  },
]

describe('marketplaceStore', () => {
  it('derives installed states for both skill directories and CLI plugin names', () => {
    const states = deriveMarketplacePluginStates(samplePlugins, ['skill-a', 'plugin-b@Knowledge Work'])

    expect(states['skill-a']).toBe('installed')
    expect(states['plugin-b']).toBe('installed')
  })

  it('loads catalog and installed plugin names through injected dependencies', async () => {
    const fetchMarketplace = vi.fn().mockResolvedValue({ plugins: samplePlugins, error: null })
    const listInstalledPlugins = vi.fn().mockResolvedValue(['skill-a'])
    const store = createMarketplaceStore({
      fetchMarketplace,
      listInstalledPlugins,
      installPlugin: vi.fn(),
      uninstallPlugin: vi.fn(),
      addToast: vi.fn(),
    })

    await store.getState().loadMarketplace()

    expect(fetchMarketplace).toHaveBeenCalledWith(undefined)
    expect(listInstalledPlugins).toHaveBeenCalledTimes(1)
    expect(store.getState().catalog).toEqual(samplePlugins)
    expect(store.getState().pluginStates['skill-a']).toBe('installed')
    expect(store.getState().pluginStates['plugin-b']).toBe('not_installed')
  })

  it('marks plugins installed and emits a success toast after install', async () => {
    const addToast = vi.fn()
    const installPlugin = vi.fn().mockResolvedValue({ ok: true })
    const store = createMarketplaceStore({
      fetchMarketplace: vi.fn().mockResolvedValue({ plugins: samplePlugins, error: null }),
      listInstalledPlugins: vi.fn().mockResolvedValue([]),
      installPlugin,
      uninstallPlugin: vi.fn(),
      addToast,
    })

    store.setState({
      catalog: samplePlugins,
      pluginStates: { 'plugin-b': 'not_installed' },
      installedNames: [],
    })

    await store.getState().installMarketplacePlugin(samplePlugins[1])

    expect(installPlugin).toHaveBeenCalledWith(
      'anthropics/knowledge-work-plugins',
      'plugin-b',
      'Knowledge Work',
      'plugins/b',
      false,
    )
    expect(store.getState().pluginStates['plugin-b']).toBe('installed')
    expect(store.getState().installedNames).toContain('plugin-b')
    expect(addToast).toHaveBeenCalledWith(expect.objectContaining({
      type: 'success',
      title: 'Skill installed',
    }))
  })
})
