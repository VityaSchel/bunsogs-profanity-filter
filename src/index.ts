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
  reject_categories: z.array(z.string()).optional(),
  action: z.enum(['drop', 'reject']).default('drop').optional()
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
  if (event.data.ref) {
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
          postMessage({ ok: true, action: shouldPostBool ? 'send' : config.action, ref: event.data.ref })
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
  }
})

const nonLettersCharsRegex = /[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\u0370-\u03FF\u0400-\u04FF\u0530-\u058F\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0E00-\u0E7F\u0E80-\u0EFF\u1000-\u109F\u1100-\u11FF\u1200-\u137F\u13A0-\u13FF\u16A0-\u16FF\u1E00-\u1EFF\u2C00-\u2C5F\u2C60-\u2C7F\u3040-\u309F\u30A0-\u30FF\u31F0-\u31FF\u4E00-\u9FFF\u3400-\u4DBF\uF900-\uFAFF\uA960-\uA97F\uAC00-\uD7AF\uFF00-\uFFEF\uFB50-\uFDFF\uFE70-\uFEFF\-'0-9 ]/g

export async function shouldPost(message: { text: string }): Promise<boolean> {
  let rejected: boolean = false
  if(config.simple === true) {
    rejected = message.text.toLocaleLowerCase()
      .replaceAll('\n', ' ')
      .replaceAll(nonLettersCharsRegex, '')
      .split(' ')
      .filter(Boolean)
      .some(word => profanityWords.has(word))
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