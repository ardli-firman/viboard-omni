import React from 'react'
import type { AgentType } from '@shared/types'
import ohMyPiIcon from '@/assets/providers/oh-my-pi.png'
import geminiCliIcon from '@/assets/providers/gemini-cli.png'
import hermesIcon from '@/assets/providers/hermes.png'
import opencodeIcon from '@/assets/providers/opencode.png'
import claudeIcon from '@/assets/providers/claude.png'
import piAgentIcon from '@/assets/providers/pi-agent.svg'

interface AgentIconProps {
  type: AgentType
  className?: string
}

export function AgentIcon({ type, className = '' }: AgentIconProps): React.ReactElement {
  const iconMap: Partial<Record<AgentType, string>> = {
    'oh-my-pi': ohMyPiIcon,
    'gemini-cli': geminiCliIcon,
    'hermes': hermesIcon,
    'opencode': opencodeIcon,
    'claude': claudeIcon,
    'pi-agent': piAgentIcon,
  }

  const emojiMap: Record<AgentType, string> = {
    'oh-my-pi': '🤖',
    'gemini-cli': '✨',
    'pi-agent': '🥧',
    'hermes': '🪄',
    'opencode': '🖥️',
    'claude': '🧠',
    'custom': '⚙️',
  }

  const imgSrc = iconMap[type]

  if (imgSrc) {
    return (
      <img
        src={imgSrc}
        alt={type}
        className={`object-contain rounded-md inline-block ${className}`}
        style={{
          verticalAlign: 'middle',
        }}
      />
    )
  }

  // Fallback to emoji
  return (
    <span className={`inline-block select-none ${className}`} style={{ verticalAlign: 'middle' }}>
      {emojiMap[type] ?? '🤖'}
    </span>
  )
}
