import fs from 'fs/promises'
import path from 'path'
import { z } from 'zod'
import profanityList from './profanity-list.json'

const profanityWords = new Set(Object.values(profanityList).flatMap(l => Array.isArray(l) ? l : []))

const configSerialized = await fs.readFile(path.join(__dirname, '../config.json'), 'utf-8')
const config = z.object({
  simple: z.boolean().optional(),
  gpt: z.boolean().optional(),
  check_mods: z.boolean().optional(),
  openai_api_key: z.string().optional(),
  reject_categories: z.array(z.string()).optional()
}).parse(JSON.parse(configSerialized))

if(config.gpt === true && !config.openai_api_key) {
  throw new Error('Error while reading config.json: openai_api_key is required when gpt mode is enabled')
}

if (config.simple === true && config.reject_categories) {
  throw new Error('Error while reading config.json: reject_categories can only be used when gpt mode is enabled')
}

if(config.simple !== true && config.gpt !== true) {
  throw new Error('Error while reading config.json: at least one of simple or gpt must be enabled')
}

self.addEventListener('message', async event => {
  switch (event.data.type) {
    case 'onBeforePost': {
      const author = event.data.payload.message.author
      if (author.admin || author.moderator || author.roomPermissions.admin || author.roomPermissions.moderator) {
        if(config.check_mods === false) {
          postMessage({ ok: true, action: 'send', ref: event.data.ref })
        }
      }
      try {
        const shouldPostBool = await shouldPost(event.data.payload.message)
        postMessage({ ok: true, action: shouldPostBool ? 'send' : 'reject', ref: event.data.ref })
      } catch(e) {
        console.error(e)
        postMessage({ ok: false, ref: event.data.ref, error: e instanceof Error && e.message })
      }
      break
    }
    default:
      postMessage({ ok: false, ref: event.data.ref })
      break
  }
})

export async function shouldPost(message: { text: string }): Promise<boolean> {
  let rejected: boolean = false
  if(config.simple === true) {
    rejected = message.text.split(' ').some(word => profanityWords.has(word.toLowerCase()))
    if (rejected) return false
  }
  if (config.gpt === true) {
    const request = await fetch('https://api.openai.com/v1/moderations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.openai_api_key}`
      },
      body: JSON.stringify({
        input: message.text
      })
    })
    if (request.status !== 200) {
      throw new Error('Error while checking message with OpenAI API: ' + await request.text())
    }
    const requestParsed = await request.json()
    const response = await z.object({
      results: z.array(z.object({
        flagged: z.boolean(),
        categories: z.record(z.string(), z.boolean())
      })).min(1)
    }).safeParseAsync(requestParsed)
    if (!response.success) {
      throw new Error('Error while parsing response from OpenAI API: ' + JSON.stringify(response))
    }
    const result = response.data.results[0]
    if(Array.isArray(config.reject_categories)) {
      rejected = config.reject_categories.some(category => result.categories[category] === true)
    } else {
      rejected = result.flagged
    }
  }
  return !rejected
}