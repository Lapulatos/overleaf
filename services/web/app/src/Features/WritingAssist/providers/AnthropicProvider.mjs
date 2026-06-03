// @ts-check

import { fetchJson } from '@overleaf/fetch-utils'
// ParamsError not available in all envs; throw plain Error below

const DEFAULT_ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1'

async function check(params) {
  const { text, systemPrompt, enabledCategories, userMessage, model, apiKey, endpoint, timeout } = params
  const baseUrl = endpoint || DEFAULT_ANTHROPIC_ENDPOINT
  const url = `${baseUrl}/messages`

  const userContent = userMessage ?? buildUserContent(enabledCategories, text)

  const body = {
    model,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: userContent,
      },
    ],
    max_tokens: 2000,
    temperature: 0.1,
  }

  const response = await fetchJson(url, {
    method: 'POST',
    json: body,
    timeout,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
  })

  const content = response?.content?.[0]?.text
  if (!content) {
    throw Object.assign(new Error('Anthropic response missing content'), { statusCode: 400 })
  }
  return content
}

function buildUserContent(enabledCategories, text) {
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
