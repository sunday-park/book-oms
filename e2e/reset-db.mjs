import fs from 'node:fs'

fs.rmSync('data/e2e.db', { force: true })
