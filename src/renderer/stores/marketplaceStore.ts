import { create } from 'zustand'
import type { CatalogPlugin, PluginStatus } from '../../shared/types'
import { useNotificationStore } from './notificationStore'

interface MarketplaceDeps {
  fetchMarketplace: (forceRefresh?: boolean) => Promise<{ plugins: CatalogPlugin[]; error: string | null }>
  listInstalledPlugins: () => Promise<string[]>
  installPlugin: (
    repo: string,
    pluginName: string,
    marketplace: string,
    sourcePath?: string,
    isSkillMd?: boolean,
  ) => Promise<{ ok: boolean; error?: string }>
  uninstallPlugin: (pluginName: string) => Promise<{ ok: boolean; error?: string }>
  addToast: (toast: { type: 'success' | 'error' | 'info'; title: string; message: string }) => void
}

export interface MarketplaceStoreState {
  open: boolean
  catalog: CatalogPlugin[]
  loading: boolean
  error: string | null
  installedNames: string[]
  pluginStates: Record<string, PluginStatus>
  search: string
  filter: string
  toggleMarketplace: () => void
  openMarketplace: () => void
  closeMarketplace: () => void
  loadMarketplace: (forceRefresh?: boolean) => Promise<void>
  setMarketplaceSearch: (query: string) => void
  setMarketplaceFilter: (filter: string) => void
  installMarketplacePlugin: (plugin: CatalogPlugin) => Promise<void>
  uninstallMarketplacePlugin: (plugin: CatalogPlugin) => Promise<void>
}

const defaultMarketplaceDeps: MarketplaceDeps = {
  fetchMarketplace: (forceRefresh) => window.clui.fetchMarketplace(forceRefresh),
  listInstalledPlugins: () => window.clui.listInstalledPlugins(),
  installPlugin: (repo, pluginName, marketplace, sourcePath, isSkillMd) =>
    window.clui.installPlugin(repo, pluginName, marketplace, sourcePath, isSkillMd),
  uninstallPlugin: (pluginName) => window.clui.uninstallPlugin(pluginName),
  addToast: (toast) => useNotificationStore.getState().addToast(toast),
}

export function deriveMarketplacePluginStates(
  plugins: CatalogPlugin[],
  installedNames: string[],
): Record<string, PluginStatus> {
  const installedSet = new Set(installedNames.map((name) => name.toLowerCase()))
  const pluginStates: Record<string, PluginStatus> = {}

  for (const plugin of plugins) {
    const candidates = plugin.isSkillMd
      ? [plugin.installName]
      : [plugin.installName, `${plugin.installName}@${plugin.marketplace}`]
    const isInstalled = candidates.some((candidate) => installedSet.has(candidate.toLowerCase()))
    pluginStates[plugin.id] = isInstalled ? 'installed' : 'not_installed'
  }

  return pluginStates
}

export function createMarketplaceStore(deps: MarketplaceDeps = defaultMarketplaceDeps) {
  return create<MarketplaceStoreState>((set) => ({
    open: false,
    catalog: [],
    loading: false,
    error: null,
    installedNames: [],
    pluginStates: {},
    search: '',
    filter: 'All',

    toggleMarketplace: () => set((state) => ({ open: !state.open })),
    openMarketplace: () => set({ open: true }),
    closeMarketplace: () => set({ open: false }),

    loadMarketplace: async (forceRefresh) => {
      set({ loading: true, error: null })
      try {
        const [catalog, installedNames] = await Promise.all([
          deps.fetchMarketplace(forceRefresh),
          deps.listInstalledPlugins(),
        ])

        if (catalog.error && catalog.plugins.length === 0) {
          set({ error: catalog.error, loading: false })
          return
        }

        set({
          catalog: catalog.plugins,
          installedNames,
          pluginStates: deriveMarketplacePluginStates(catalog.plugins, installedNames),
          loading: false,
        })
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : String(error),
          loading: false,
        })
      }
    },

    setMarketplaceSearch: (query) => set({ search: query }),
    setMarketplaceFilter: (filter) => set({ filter }),

    installMarketplacePlugin: async (plugin) => {
      set((state) => ({
        pluginStates: {
          ...state.pluginStates,
          [plugin.id]: 'installing',
        },
      }))

      const result = await deps.installPlugin(
        plugin.repo,
        plugin.installName,
        plugin.marketplace,
        plugin.sourcePath,
        plugin.isSkillMd,
      )

      if (result.ok) {
        set((state) => ({
          pluginStates: {
            ...state.pluginStates,
            [plugin.id]: 'installed',
          },
          installedNames: state.installedNames.includes(plugin.installName)
            ? state.installedNames
            : [...state.installedNames, plugin.installName],
        }))
        deps.addToast({
          type: 'success',
          title: 'Skill installed',
          message: plugin.name,
        })
        return
      }

      set((state) => ({
        pluginStates: {
          ...state.pluginStates,
          [plugin.id]: 'failed',
        },
      }))
      deps.addToast({
        type: 'error',
        title: 'Install failed',
        message: result.error || plugin.name,
      })
    },

    uninstallMarketplacePlugin: async (plugin) => {
      const result = await deps.uninstallPlugin(plugin.installName)
      if (!result.ok) return

      set((state) => ({
        pluginStates: {
          ...state.pluginStates,
          [plugin.id]: 'not_installed',
        },
        installedNames: state.installedNames.filter((name) => name !== plugin.installName),
      }))
      deps.addToast({
        type: 'info',
        title: 'Skill uninstalled',
        message: plugin.name,
      })
    },
  }))
}

export const useMarketplaceStore = createMarketplaceStore()
