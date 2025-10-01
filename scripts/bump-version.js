#!/usr/bin/env node

/*
Usage:
  node scripts/bump-version.js [patch|minor]

Behavior:
- Bumps semver in package.json (default: patch)
- Mirrors the new version to app.json -> expo.version
- Increments app.json -> android.versionCode by 1 (creates if missing)
- iOS: Updates Info.plist
    - CFBundleShortVersionString := new semver
    - CFBundleVersion := previous + 1 (numerical, falls back to 1)
- If app.json contains ios.buildNumber (string), increments it numerically by 1 as well
- Best effort for template files (app.json.expo-template, app.json.dev-template): attempts JSON parse and updates expo.version if valid JSON; otherwise skips with a warning.
*/

const fs = require('fs')
const fsp = fs.promises
const path = require('path')

const repoRoot = process.cwd()

async function readJson(jsonPath) {
  const raw = await fsp.readFile(jsonPath, 'utf8')
  return JSON.parse(raw)
}

async function writeJson(jsonPath, obj) {
  const data = JSON.stringify(obj, null, 2) + '\n'
  await fsp.writeFile(jsonPath, data, 'utf8')
}

function bumpSemver(ver, type = 'patch') {
  // Expecting x.y.z
  const m = String(ver)
    .trim()
    .match(/^(\d+)\.(\d+)\.(\d+)(?:.*)?$/)
  if (!m) throw new Error(`Unsupported version format: ${ver}`)
  let [major, minor, patch] = [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
  if (type === 'minor') {
    minor += 1
    patch = 0
  } else if (type === 'patch') {
    patch += 1
  } else {
    throw new Error(`Unsupported bump type: ${type}`)
  }
  return `${major}.${minor}.${patch}`
}

function incIntString(str, by = 1) {
  const n = parseInt(String(str || '0'), 10)
  const next = isFinite(n) ? n + by : by
  return String(next)
}

async function fileExists(p) {
  try {
    await fsp.access(p, fs.constants.F_OK)
    return true
  } catch {
    return false
  }
}

async function findInfoPlist() {
  const iosDir = path.join(repoRoot, 'ios')
  if (!(await fileExists(iosDir))) return null
  const entries = await fsp.readdir(iosDir, { withFileTypes: true })
  for (const e of entries) {
    if (e.isDirectory()) {
      const candidate = path.join(iosDir, e.name, 'Info.plist')
      if (await fileExists(candidate)) return candidate
    }
  }
  // Fallback: common path
  const fallback = path.join(iosDir, 'Info.plist')
  if (await fileExists(fallback)) return fallback
  return null
}

function replacePlistStringValue(content, key, newValue) {
  const re = new RegExp(`(<key>${key}<\\/key>\\s*<string>)([^<]*)(<\\/string>)`)
  if (!re.test(content)) return null
  return content.replace(re, `$1${newValue}$3`)
}

function getPlistStringValue(content, key) {
  const re = new RegExp(`<key>${key}<\\/key>\\s*<string>([^<]*)<\\/string>`)
  const m = content.match(re)
  return m ? m[1] : null
}

async function updateInfoPlist(newSemver) {
  const plistPath = await findInfoPlist()
  if (!plistPath) {
    console.warn('Info.plist not found under ios/. Skipping iOS plist update.')
    return
  }
  let content = await fsp.readFile(plistPath, 'utf8')

  // CFBundleShortVersionString => newSemver
  const replacedShort = replacePlistStringValue(content, 'CFBundleShortVersionString', newSemver)
  if (replacedShort) content = replacedShort
  else console.warn('CFBundleShortVersionString not found in Info.plist, skipping.')

  // CFBundleVersion => +1
  const currentBuild = getPlistStringValue(content, 'CFBundleVersion')
  const nextBuild = incIntString(currentBuild, 1)
  const replacedBuild = replacePlistStringValue(content, 'CFBundleVersion', nextBuild)
  if (replacedBuild) content = replacedBuild
  else console.warn('CFBundleVersion not found in Info.plist, skipping.')

  await fsp.writeFile(plistPath, content, 'utf8')
  console.log(
    `Updated iOS plist at ${path.relative(repoRoot, plistPath)} -> CFBundleShortVersionString=${newSemver}, CFBundleVersion=${nextBuild}`
  )
}

async function tryUpdateTemplate(templatePath, newSemver) {
  if (!(await fileExists(templatePath))) return
  try {
    const obj = await readJson(templatePath)
    if (obj.expo && typeof obj.expo.version === 'string') {
      obj.expo.version = newSemver
      await writeJson(templatePath, obj)
      console.log(`Updated template ${path.basename(templatePath)} expo.version -> ${newSemver}`)
    }
  } catch (e) {
    console.warn(`Skipped updating template ${path.basename(templatePath)} (not valid JSON?): ${e.message}`)
  }
}

async function main() {
  const bumpType = (process.argv[2] || 'patch').toLowerCase()
  if (!['patch', 'minor'].includes(bumpType)) {
    console.error('Usage: node scripts/bump-version.js [patch|minor]')
    process.exit(1)
  }

  // 1) package.json
  const pkgPath = path.join(repoRoot, 'package.json')
  const pkg = await readJson(pkgPath)
  const current = pkg.version || '0.0.0'
  const next = bumpSemver(current, bumpType)
  pkg.version = next
  await writeJson(pkgPath, pkg)
  console.log(`package.json: ${current} -> ${next}`)

  // 2) app.json
  const appJsonPath = path.join(repoRoot, 'app.json')
  if (await fileExists(appJsonPath)) {
    const app = await readJson(appJsonPath)
    if (!app.expo) app.expo = {}
    const prevExpoVer = app.expo.version || '0.0.0'
    app.expo.version = next
    if (!app.expo.android) app.expo.android = {}
    const prevVersionCode = app.expo.android.versionCode || 0
    app.expo.android.versionCode = Number(prevVersionCode) + 1

    // If ios.buildNumber exists, bump it numerically as string
    if (app.expo.ios && typeof app.expo.ios.buildNumber !== 'undefined') {
      app.expo.ios.buildNumber = incIntString(app.expo.ios.buildNumber, 1)
    }

    await writeJson(appJsonPath, app)
    console.log(
      `app.json: expo.version ${prevExpoVer} -> ${next}, android.versionCode ${prevVersionCode} -> ${app.expo.android.versionCode}`
    )
  } else {
    console.warn('app.json not found, skipping.')
  }

  // 3) iOS Info.plist
  await updateInfoPlist(next)

  // 4) Templates (best-effort)
  await tryUpdateTemplate(path.join(repoRoot, 'app.json.expo-template'), next)
  await tryUpdateTemplate(path.join(repoRoot, 'app.json.dev-template'), next)

  console.log('Version bump complete.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
