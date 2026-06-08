/**
 * Pi Agent CLI Driver
 *
 * Slot driver for Pi Agent CLI.
 * Configure the binary path in Settings → Agent CLI Settings.
 */

import { makePassiveDriver } from '../types'

const piAgentDriver = makePassiveDriver(
  'pi-agent',
  'Pi Agent CLI',
  'Pi Agent CLI. Configure binary path in Settings.',
  'pi-agent',
)

export default piAgentDriver
