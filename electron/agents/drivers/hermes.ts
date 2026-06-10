/**
 * Hermes Agent Driver
 *
 * Slot driver for Hermes Agent CLI.
 * Configure the binary path in Settings → Agent CLI Settings.
 */

import { makePassiveDriver } from '../types'

const hermesDriver = makePassiveDriver(
  'hermes',
  'Hermes Agent',
  'Hermes Agent CLI. Configure binary path in Settings.',
  'hermes',
)

export default hermesDriver
