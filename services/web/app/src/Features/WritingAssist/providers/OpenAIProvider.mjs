// @ts-check

import { fetchJson } from '@overleaf/fetch-utils'
import { InvalidParamsError } from '../../infrastructure/Validation.mjs'

const DEFAULT_OPENAI_ENDPOINT = 'https://api.openai.com/v1'

async function check(params) {
  const { text, systemPrompt, enabledCategories, model, apiKey, endpoint, timeout } = params
  const baseUrl = endpoint || DEFAULT_OPENAI_ENDPOINT
  const url = `${baseUrl}/chat/completions`

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: buildUserMessage(enabledCategories, text) },
    ],
    temperature: 0.1,
    max_tokens: 2000,
    response_format: { type: 'json_object' },
  }

  const response = await fetchJson(url, {
    method: 'POST',
    json: body,
    timeout,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  const content = response?.choices?.[0]?.message?.content
  if (!content) {
    throw new InvalidParamsError('OpenAI response missing content')
  }
  return content
}

function buildUserMessage(enabledCategories, text) {
  return [
    `Enabled categories: ${enabledCategories.join(', ')}`,
    'Return issues for ONLY these categories. Ignore others.',
    '',
    'Text to check:',
    '"""',
    text,
    '"""',
  ].join('\n')
}

export default { check }
