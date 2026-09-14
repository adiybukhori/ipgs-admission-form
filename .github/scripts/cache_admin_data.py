from pathlib import Path

p = Path('api/admin-data.js')
s = p.read_text(encoding='utf-8')

cache_marker = """const ADMIN_DATA_CACHE = globalThis.__IPGS_ADMIN_DATA_CACHE__ || (globalThis.__IPGS_ADMIN_DATA_CACHE__ = {\n  v2: null,\n  v2At: 0,\n  v1: null,\n  v1At: 0,\n  v1Source: ''\n});\nconst V2_DATA_CACHE_MS = 30 * 1000;\nconst V1_DATA_CACHE_MS = 5 * 60 * 1000;\n\nfunction cloneCached(value) {\n  return JSON.parse(JSON.stringify(value));\n}\n\n"""

if 'const ADMIN_DATA_CACHE =' not in s:
    marker = "];\n\nfunction parseCsv(text) {"
    if marker not in s:
        raise SystemExit('SHEETS/parseCsv marker not found')
    s = s.replace(marker, "];\n\n" + cache_marker + "function parseCsv(text) {", 1)

start_marker = "  const settled = await Promise.allSettled(SHEETS.map(async sheet => [sheet, await fetchSheet(sheet)]));"
end_marker = "  if (Array.isArray(data.V2_SAC_SESSIONS)) {"
start = s.find(start_marker)
end = s.find(end_marker, start)
if start < 0 or end < 0:
    raise SystemExit('admin-data fetch block markers not found')

replacement = """  const force = body.force === true;\n  const nowMs = Date.now();\n  let data = {};\n  const warnings = [];\n  let v2CacheHit = false;\n  let v1CacheHit = false;\n\n  if (!force && ADMIN_DATA_CACHE.v2 && (nowMs - ADMIN_DATA_CACHE.v2At) < V2_DATA_CACHE_MS) {\n    data = cloneCached(ADMIN_DATA_CACHE.v2);\n    v2CacheHit = true;\n  } else {\n    const settled = await Promise.allSettled(SHEETS.map(async sheet => [sheet, await fetchSheet(sheet)]));\n    settled.forEach((result, index) => {\n      const sheet = SHEETS[index];\n      if (result.status === 'fulfilled') {\n        const [name, rows] = result.value;\n        data[name] = rows;\n      } else {\n        data[sheet] = [];\n        warnings.push(`${sheet}: ${result.reason?.message || 'Unable to load'}`);\n      }\n    });\n    ADMIN_DATA_CACHE.v2 = cloneCached(data);\n    ADMIN_DATA_CACHE.v2At = nowMs;\n  }\n\n  let legacyRows = [];\n  let legacySource = '';\n  if (!force && ADMIN_DATA_CACHE.v1 && (nowMs - ADMIN_DATA_CACHE.v1At) < V1_DATA_CACHE_MS) {\n    legacyRows = cloneCached(ADMIN_DATA_CACHE.v1);\n    legacySource = ADMIN_DATA_CACHE.v1Source || 'CACHE';\n    v1CacheHit = true;\n  } else {\n    legacyRows = extractLegacyRows(auth.payload);\n    legacySource = legacyRows.length ? 'V1_AUTH_WEB_APP' : '';\n    if (!legacyRows.length) {\n      try {\n        legacyRows = await fetchLegacyMasterSheet();\n        legacySource = 'V1_MASTER_DATABASE';\n      } catch (error) {\n        warnings.push(`V1 Legacy: ${error?.message || 'Unable to load legacy data'}`);\n      }\n    }\n    ADMIN_DATA_CACHE.v1 = cloneCached(legacyRows);\n    ADMIN_DATA_CACHE.v1At = nowMs;\n    ADMIN_DATA_CACHE.v1Source = legacySource;\n  }\n  data.V1_MASTER_DATABASE = legacyRows;\n  data.V1_LEGACY_META = [{ source: legacySource || 'UNAVAILABLE', count: legacyRows.length, readOnly: true, cacheHit: v1CacheHit }];\n\n"""

s = s[:start] + replacement + s[end:]

old_return = "return res.status(200).json({ ok: true, build: 'ADMIN_DATA_V2_V1_LEGACY_20260914', loadedAt: new Date().toISOString(), warnings, data });"
new_return = "return res.status(200).json({ ok: true, build: 'ADMIN_DATA_V2_V1_CACHE_20260915', loadedAt: new Date().toISOString(), warnings, cache: { v2Hit: v2CacheHit, v1Hit: v1CacheHit, v2TtlSeconds: 30, v1TtlSeconds: 300, forced: force }, data });"
if old_return not in s and new_return not in s:
    raise SystemExit('admin-data return marker not found')
s = s.replace(old_return, new_return, 1)

s = s.replace("build: 'ADMIN_DATA_V2_V1_LEGACY_20260914'", "build: 'ADMIN_DATA_V2_V1_CACHE_20260915'", 1)

p.write_text(s, encoding='utf-8')
print('api/admin-data.js cache patch applied')
