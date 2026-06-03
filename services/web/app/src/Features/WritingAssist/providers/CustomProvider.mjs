// @ts-check

import { fetchJson } from '@overleaf/fetch-utils'
// ParamsError not available in all envs; throw plain Error below

async function check(params) {
  const { text, systemPrompt, enabledCategories, userMessage, model, apiKey, endpoint, timeout } = params
  const url = `${endpoint}/chat/completions`

  const userContent = userMessage ?? buildUserMessage(enabledCategories, text)

  const body = {
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userContent },
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
    throw Object.assign(new Error('Custom provider response missing content'), { statusCode: 400 })
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
