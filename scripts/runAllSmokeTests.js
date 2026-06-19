const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const repoRoot = path.resolve(__dirname, '..')
const logsDir = path.join(repoRoot, 'logs')
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true })

const ts = new Date().toISOString().replace(/[:.]/g, '-')
const outFile = path.join(logsDir, `smoke-${ts}.log`)
const scripts = ['fetchLogs.js','postEvent.js','scanInTest.js','scanOutTest.js','attendanceFlowTest.js']

function writeLine(s) {
  fs.appendFileSync(outFile, s + '\n')
}

writeLine('Smoke test run: ' + new Date().toISOString())
for (const s of scripts) {
  const p = path.join(repoRoot, 'scripts', s)
  writeLine('\n==== START: ' + s + ' ====' )
  try {
    const out = execSync(`node "${p}"`, { encoding: 'utf8', maxBuffer: 10 * 1024 * 1024 })
    writeLine(out)
  } catch (e) {
    writeLine('ERROR running ' + s + ': ' + (e && e.message ? e.message : String(e)))
    if (e.stdout) writeLine('\n--- STDOUT ---\n' + e.stdout)
    if (e.stderr) writeLine('\n--- STDERR ---\n' + e.stderr)
  }
  writeLine('==== END: ' + s + ' ====\n')
}

console.log('Wrote smoke log to', outFile)
