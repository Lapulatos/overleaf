// @ts-check

import settings from '@overleaf/settings'
import { createAgentProvider } from './providers/AgentProvider.mjs'

import OpenAIProvider from './providers/OpenAIProvider.mjs'
import AnthropicProvider from './providers/AnthropicProvider.mjs'
import CustomProvider from './providers/CustomProvider.mjs'
const AgentProvider = createAgentProvider(() => settings.writingAssist)

// ParamsError not available in all envs; throw plain Error below

async function check(options, text, systemPrompt, enabledCategories, userMessage) {
  const { provider, apiKey, model, endpoint, timeout, signal } = options

  let impl
  switch (provider) {
    case 'agent':
      impl = AgentProvider.check
      break
    case 'openai':
      impl = OpenAIProvider.check
      break
    case 'anthropic':
      impl = AnthropicProvider.check
      break
    case 'custom':
      if (!endpoint) {
        throw Object.assign(new Error('Custom provider requires an endpoint URL'), { statusCode: 400 })
      }
      impl = CustomProvider.check
      break
    default:
      throw Object.assign(new Error(`Unknown provider: ${provider}`), { statusCode: 400 })
  }

  return await impl({ text, systemPrompt, enabledCategories, userMessage, model, apiKey, endpoint, timeout, signal })
}

export default { check }
