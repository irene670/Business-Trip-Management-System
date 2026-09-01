import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data')
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(DATA_DIR, 'uploads')
const STORE_FILE = path.join(DATA_DIR, 'store.json')

const initialState = {
  cases: [],
  settings: {
    holidays: [],
    workdays: [],
    mealBasis: 'tripDays'
  }
}

export async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true })
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
  try { await fs.access(STORE_FILE) }
  catch { await writeState(initialState) }
}

export async function readState() {
  await ensureStore()
  try {
    const raw = await fs.readFile(STORE_FILE, 'utf8')
    return { ...initialState, ...JSON.parse(raw) }
  } catch {
    return structuredClone(initialState)
  }
}

export async function writeState(state) {
  await fs.mkdir(DATA_DIR, { recursive: true })
  const tmp = STORE_FILE + '.tmp'
  await fs.writeFile(tmp, JSON.stringify(state, null, 2), 'utf8')
  await fs.rename(tmp, STORE_FILE)
}

export async function updateState(mutator) {
  const state = await readState()
  const result = await mutator(state)
  await writeState(state)
  return result ?? state
}
