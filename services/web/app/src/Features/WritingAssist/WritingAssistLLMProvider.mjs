// @ts-check

import OpenAIProvider from './providers/OpenAIProvider.mjs'
import AnthropicProvider from './providers/AnthropicProvider.mjs'
import CustomProvider from './providers/CustomProvider.mjs'
import { InvalidParamsError } from '../../infrastructure/Validation.mjs'

async function check(options, text, systemPrompt, enabledCategories) {
  const { provider, apiKey, model, endpoint, timeout } = options

  let impl
  switch (provider) {
    case 'openai':
      impl = OpenAIProvider.check
      break
    case 'anthropic':
      impl = AnthropicProvider.check
      break
    case 'custom':
      if (!endpoint) {
        throw new InvalidParamsError('Custom provider requires an endpoint URL')
      }
      impl = CustomProvider.check
      break
    default:
      throw new InvalidParamsError(`Unknown provider: ${provider}`)
  }

  return await impl({ text, systemPrompt, enabledCategories, model, apiKey, endpoint, timeout })
}

export default { check }
