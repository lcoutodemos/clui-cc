import { net } from 'electron'
import { execFile } from 'child_process'
import { readFile, readdir, mkdir, writeFile, rm } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'
import type { CatalogPlugin } from '../../shared/types'
import { log as _log } from '../logger'
import { getCliEnv } from '../cli-env'

function log(msg: string): void {
  _log('marketplace', msg)
}

// ─── Sources ───

const SOURCES = [
  { repo: 'anthropics/skills', category: 'Agent Skills' },
  { repo: 'anthropics/knowledge-work-plugins', category: 'Knowledge Work' },
  { repo: 'anthropics/financial-services-plugins', category: 'Financial Services' },
] as const

// ─── TTL Cache ───

let cachedPlugins: CatalogPlugin[] | null = null
let cacheTimestamp = 0
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

// Cache raw SKILL.md content keyed by skill name for direct installation
const skillContentCache = new Map<string, string>()

// ─── fetchCatalog ───

export async function fetchCatalog(forceRefresh?: boolean): Promise<{ plugins: CatalogPlugin[]; error: string | null }> {
  if (!forceRefresh && cachedPlugins && Date.now() - cacheTimestamp < CACHE_TTL) {
    return { plugins: cachedPlugins, error: null }
  }

  const allPlugins: CatalogPlugin[] = []
  const errors: string[] = []

  const results = await Promise.allSettled(
    SOURCES.map(async (source) => {
      const marketplaceUrl = `https://raw.githubusercontent.com/${source.repo}/main/.claude-plugin/marketplace.json`
      log(`Fetching marketplace: ${marketplaceUrl}`)

      const marketplaceRes = await netFetch(marketplaceUrl)
      if (!marketplaceRes.ok) {
        throw new Error(`Failed to fetch marketplace for ${source.repo}: ${marketplaceRes.status}`)
      }

      const marketplaceData = JSON.parse(marketplaceRes.body) as {
        name: string
        plugins: Array<{
          name: string
          source: string
          description?: string
          author?: { name: string } | string
          skills?: string[]
        }>
      }

      const safeMarketplaceName = typeof marketplaceData.name === 'string' && marketplaceData.name.trim().length > 0
        ? marketplaceData.name.trim()
        : source.repo

      // Flatten: for entries with a skills[] array, expand each skill as its own catalog item.
      // For entries without skills[] (knowledge-work, financial-services), use plugin.json as before.
      type FetchJob = { installName: string; skillPath: string; entryDescription: string; entryAuthor: string; useSkillMd: boolean }
      const jobs: FetchJob[] = []

      for (const entry of marketplaceData.plugins) {
        let entryAuthor = ''
        if (entry.author) {
          entryAuthor = typeof entry.author === 'string' ? entry.author : entry.author.name || ''
        }

        if (entry.skills && entry.skills.length > 0) {
          // Skills repo: each skill path (e.g. "./skills/xlsx") becomes its own entry
          for (const skillRef of entry.skills) {
            const skillPath = skillRef.replace(/^\.\//, '').replace(/\/$/, '')
            // Use the individual skill directory name as installName (not the bundle name)
            const individualName = skillPath.split('/').pop() || entry.name
            jobs.push({
              installName: individualName,
              skillPath,
              entryDescription: entry.description || '',
              entryAuthor,
              useSkillMd: true,
            })
          }
        } else {
          // Standard plugin: source points to a directory with .claude-plugin/plugin.json
          const normalizedSource = entry.source.replace(/^\.\//, '').replace(/\/$/, '')
          jobs.push({
            installName: entry.name,
            skillPath: normalizedSource || entry.name,
            entryDescription: entry.description || '',
            entryAuthor,
            useSkillMd: false,
          })
        }
      }

      const jobResults = await Promise.allSettled(
        jobs.map(async (job) => {
          let name = ''
          let description = ''
          let version = '0.0.0'
          let author = job.entryAuthor || 'Anthropic'

          if (job.useSkillMd) {
            // Fetch SKILL.md and parse frontmatter for name/description
            const skillUrl = `https://raw.githubusercontent.com/${source.repo}/main/${job.skillPath}/SKILL.md`
            try {
              const res = await netFetch(skillUrl)
              if (res.ok) {
                const parsed = parseSkillFrontmatter(res.body)
                name = parsed.name
                description = parsed.description
                // Cache raw content for direct installation
                skillContentCache.set(job.installName, res.body)
              }
            } catch (e) {
              log(`SKILL.md fetch failed for ${job.skillPath}`)
            }
          } else {
            // Fetch plugin.json
            const pluginUrl = `https://raw.githubusercontent.com/${source.repo}/main/${job.skillPath}/.claude-plugin/plugin.json`
            try {
              const res = await netFetch(pluginUrl)
              if (res.ok) {
                const data = JSON.parse(res.body) as { name?: string; version?: string; description?: string; author?: string }
                name = data.name?.trim() || ''
                description = data.description || ''
                version = data.version?.trim() || '0.0.0'
                author = data.author?.trim() || author
              }
            } catch (e) {
              log(`plugin.json fetch failed for ${job.skillPath}`)
            }
          }

          // Fallbacks
          const dirName = job.skillPath.split('/').pop() || job.installName
          if (!name) name = dirName
          if (!description) description = job.entryDescription

          const plugin: CatalogPlugin = {
            id: `${source.repo}/${job.skillPath}`,
            name,
            description,
            version,
            author,
            marketplace: safeMarketplaceName,
            repo: source.repo,
            sourcePath: job.skillPath,
            installName: job.installName,
            category: source.category,
            tags: deriveSemanticTags(name, description, job.skillPath),
            isSkillMd: job.useSkillMd,
          }
          return plugin
        })
      )

      for (const r of jobResults) {
        if (r.status === 'fulfilled') {
          allPlugins.push(r.value)
        } else {
          log(`Plugin fetch warning: ${r.reason}`)
        }
      }
    })
  )

  for (const r of results) {
    if (r.status === 'rejected') {
      log(`Source fetch error: ${r.reason}`)
      errors.push(String(r.reason))
    }
  }

  // Only error if ALL sources failed and we got no plugins
  if (allPlugins.length === 0 && errors.length > 0) {
    return { plugins: [], error: errors.join('; ') }
  }

  // Sort by name
  allPlugins.sort((a, b) => a.name.localeCompare(b.name))

  // Update cache
  cachedPlugins = allPlugins
  cacheTimestamp = Date.now()

  return { plugins: allPlugins, error: null }
}

// ─── listInstalled ───
// Reads directly from ~/.claude filesystem for reliable detection:
// - Plugins: ~/.claude/plugins/installed_plugins.json (keys are "name@marketplace")
// - Skills: ~/.claude/skills/ (each subdirectory is an installed skill)

export async function listInstalled(): Promise<string[]> {
  const claudeDir = join(homedir(), '.claude')
  const names: string[] = []

  // 1. Installed plugins from JSON registry
  try {
    const raw = await readFile(join(claudeDir, 'plugins', 'installed_plugins.json'), 'utf-8')
    const data = JSON.parse(raw) as { plugins?: Record<string, unknown> }
    if (data.plugins) {
      for (const key of Object.keys(data.plugins)) {
        // Keys are "name@marketplace" e.g. "design@knowledge-work-plugins"
        const pluginName = key.split('@')[0]
        if (pluginName) names.push(pluginName)
        // Also push the full key for exact matching
        names.push(key)
      }
    }
  } catch (e) {
    log(`listInstalled: no installed_plugins.json or parse error: ${e}`)
  }

  // 2. Installed skills from ~/.claude/skills/
  try {
    const entries = await readdir(join(claudeDir, 'skills'), { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        names.push(entry.name)
      }
    }
  } catch (e) {
    log(`listInstalled: no skills dir or read error: ${e}`)
  }

  return [...new Set(names)]
}

// ─── installPlugin ───
// For SKILL.md skills: writes directly to ~/.claude/skills/<name>/
// For CLI plugins: falls back to `claude plugin install`

export async function installPlugin(
  repo: string,
  pluginName: string,
  marketplace: string,
  sourcePath?: string,
  isSkillMd?: boolean
): Promise<{ ok: boolean; error?: string }> {
  try {
    if (isSkillMd !== false) {
      // Direct SKILL.md install
      const skillsDir = join(homedir(), '.claude', 'skills', pluginName)

      // Check if we have cached content from the catalog fetch
      let content = skillContentCache.get(pluginName)

      if (!content) {
        const path = sourcePath || `skills/${pluginName}`
        const url = `https://raw.githubusercontent.com/${repo}/main/${path}/SKILL.md`
        log(`installPlugin: fetching ${url}`)
        const res = await netFetch(url)
        if (!res.ok) {
          return { ok: false, error: `Failed to fetch SKILL.md (${res.status})` }
        }
        content = res.body
      }

      await mkdir(skillsDir, { recursive: true })
      await writeFile(join(skillsDir, 'SKILL.md'), content, 'utf-8')
      log(`installPlugin: wrote ${skillsDir}/SKILL.md`)
    } else {
      // CLI plugin install (knowledge-work, financial-services bundles)
      const addResult = await execAsync('claude', ['plugin', 'marketplace', 'add', repo], 15000)
      if (addResult.exitCode !== 0 && !addResult.stdout.includes('already added') && !addResult.stderr.includes('already added')) {
        return { ok: false, error: addResult.stderr || 'Failed to add marketplace' }
      }
      const installResult = await execAsync('claude', ['plugin', 'install', `${pluginName}@${marketplace}`], 15000)
      if (installResult.exitCode !== 0) {
        return { ok: false, error: installResult.stderr || 'Failed to install plugin' }
      }
    }

    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`installPlugin error: ${msg}`)
    return { ok: false, error: msg }
  }
}

// ─── uninstallPlugin ───

export async function uninstallPlugin(
  pluginName: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const skillsDir = join(homedir(), '.claude', 'skills', pluginName)
    await rm(skillsDir, { recursive: true, force: true })
    log(`uninstallPlugin: removed ${skillsDir}`)
    return { ok: true }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`uninstallPlugin error: ${msg}`)
    return { ok: false, error: msg }
  }
}

// ─── Helpers ───

function netFetch(url: string): Promise<{ ok: boolean; status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const request = net.request(url)
    request.on('response', (response) => {
      let body = ''
      response.on('data', (chunk) => { body += chunk.toString() })
      response.on('end', () => {
        resolve({
          ok: response.statusCode >= 200 && response.statusCode < 300,
          status: response.statusCode,
          body,
        })
      })
    })
    request.on('error', (err) => reject(err))
    request.end()
  })
}

/** Parse YAML-like frontmatter from SKILL.md (name: ..., description: "...") */
function parseSkillFrontmatter(content: string): { name: string; description: string } {
  let name = ''
  let description = ''
  // Frontmatter is at the top, no --- delimiters — just key: value lines
  const lines = content.split('\n')
  for (const line of lines) {
    const nameMatch = line.match(/^name:\s*(.+)/)
    if (nameMatch && !name) {
      name = nameMatch[1].replace(/^["']|["']$/g, '').trim()
    }
    const descMatch = line.match(/^description:\s*(.+)/)
    if (descMatch && !description) {
      // Description may be quoted and span conceptually one line
      description = descMatch[1].replace(/^["']|["']$/g, '').trim()
      // Truncate long descriptions for display
      if (description.length > 200) {
        description = description.substring(0, 197) + '...'
      }
    }
    // Stop after we have both, or after hitting a markdown heading (end of frontmatter)
    if (name && description) break
    if (line.startsWith('# ')) break
  }
  return { name, description }
}

// ─── Semantic tag derivation ───
// Maps plugin meaning (name, description, path) to discoverable use-case tags.
// Provenance (repo, author, marketplace) stays in metadata, not tags.

const TAG_RULES: Array<{ tag: string; patterns: RegExp }> = [
  { tag: 'Design',       patterns: /\b(figma|ui|ux|design|sketch|prototype|wireframe|layout|css|style|visual)\b/i },
  { tag: 'Product',      patterns: /\b(prd|roadmap|strategy|product|backlog|prioriti[sz]|feature\s*request|user\s*stor)\b/i },
  { tag: 'Research',     patterns: /\b(research|interview|insights?|survey|user\s*study|ethnograph|discover)\b/i },
  { tag: 'Docs',         patterns: /\b(doc(ument)?s?|writing|spec(ification)?|readme|markdown|technical\s*writ|content)\b/i },
  { tag: 'Spreadsheet',  patterns: /\b(sheet|spreadsheet|xlsx?|csv|tabular|pivot|formula)\b/i },
  { tag: 'Slides',       patterns: /\b(slides?|presentation|deck|pptx?|keynote|pitch)\b/i },
  { tag: 'Analysis',     patterns: /\b(analy[sz](is|e|ing)|insight|metric|dashboard|report(ing)?|data\s*viz|statistic)\b/i },
  { tag: 'Finance',      patterns: /\b(financ|accounting|budget|revenue|forecast|valuation|portfolio|investment)\b/i },
  { tag: 'Compliance',   patterns: /\b(risk|audit|policy|compliance|regulat|governance|sox|gdpr|hipaa)\b/i },
  { tag: 'Management',   patterns: /\b(manag|planning|meeting|ops|operations|team|workflow|project\s*plan)\b/i },
  { tag: 'Automation',   patterns: /\b(automat|workflow|pipeline|ci\s*cd|deploy|integrat|orchestrat|script)\b/i },
  { tag: 'Code',         patterns: /\b(code|coding|program|develop|engineer|debug|refactor|test(ing)?|linter?)\b/i },
  { tag: 'Creative',     patterns: /\b(creative|brainstorm|ideation|copywriting|storytelling|narrative)\b/i },
  { tag: 'Sales',        patterns: /\b(sales|crm|prospect|lead|deal|pipeline|outreach|cold\s*(call|email))\b/i },
  { tag: 'Support',      patterns: /\b(support|customer|helpdesk|ticket|troubleshoot|faq|knowledge\s*base)\b/i },
  { tag: 'Security',     patterns: /\b(secur|vulnerabilit|pentest|threat|encrypt|auth(enticat|ori[sz]))\b/i },
  { tag: 'Data',         patterns: /\b(data|database|sql|etl|warehouse|lake|ingest|transform|schema)\b/i },
  { tag: 'AI/ML',        patterns: /\b(ai|ml|machine\s*learn|model|train|inference|llm|prompt|embed)\b/i },
]

function deriveSemanticTags(name: string, description: string, skillPath: string): string[] {
  const text = `${name} ${description} ${skillPath}`.toLowerCase()
  const matched: string[] = []
  for (const rule of TAG_RULES) {
    if (rule.patterns.test(text)) {
      matched.push(rule.tag)
    }
    if (matched.length >= 2) break // Cap at 2 semantic tags
  }
  return matched
}

function execAsync(cmd: string, args: string[], timeout: number): Promise<{ exitCode: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout, env: getCliEnv() }, (err, stdout, stderr) => {
      resolve({
        exitCode: err ? 1 : 0,
        stdout: stdout || '',
        stderr: stderr || '',
      })
    })
  })
}
