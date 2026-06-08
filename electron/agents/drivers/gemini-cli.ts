/**
 * Gemini CLI Driver
 *
 * Slot driver for Google Gemini CLI.
 * Configure the binary path in Settings → Agent CLI Settings.
 *
 * Session mode defaults to 'none'. Enable via Settings if Gemini CLI
 * gains a session/resume flag in a future release.
 */

import { makePassiveDriver } from '../types'

const geminiCliDriver = makePassiveDriver(
  'gemini-cli',
  'Gemini CLI',
  'Google Gemini CLI agent. Configure binary path in Settings.',
  'gemini',
)

export default geminiCliDriver
