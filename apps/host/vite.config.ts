import { fileURLToPath } from 'node:url'
import { startConfig } from '../../config/start.ts'
export default startConfig(fileURLToPath(new URL('.', import.meta.url)), 'host')
