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

const nonLettersCharsRegex = /[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF\u0370-\u03FF\u0400-\u04FF\u0530-\u058F\u0590-\u05FF\u0900-\u097F\u0980-\u09FF\u0A00-\u0A7F\u0A80-\u0AFF\u0B00-\u0B7F\u0C00-\u0C7F\u0C80-\u0CFF\u0D00-\u0D7F\u0D80-\u0DFF\u0E00-\u0E7F\u0E80-\u0EFF\u10A0-\u10FF\u1100-\u11FF\u1200-\u137F\u13A0-\u13FF\u1400-\u167F\u1680-\u169F\u16A0-\u16FF\u1700-\u171F\u1720-\u173F\u1740-\u175F\u1760-\u177F\u1780-\u17FF\u1800-\u18AF\u1B00-\u1B7F\u1B80-\u1BBF\u1C00-\u1C4F\u1C50-\u1C7F\u1CD0-\u1CFF\u1D00-\u1D7F\u1E00-\u1EFF\u1F00-\u1FFF\u2C00-\u2C5F\u2C60-\u2C7F\u2C80-\u2CFF\u2D00-\u2D2F\u2D30-\u2D7F\u2D80-\u2DDF\u2DE0-\u2DFF\uA640-\uA69F\uA720-\uA7FF\uA800-\uA82F\uA830-\uA83F\uA840-\uA87F\uA880-\uA8DF\uA8E0-\uA8FF\uA900-\uA92F\uA930-\uA95F\uA960-\uA97F\uA980-\uA9DF\uA9E0-\uA9FF\uAA00-\uAA5F\uAA60-\uAA7F\uAA80-\uAADF\uAB00-\uAB2F\uAB30-\uAB6F\uAB70-\uABBF\uFB00-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF\uFF00-\uFFEF\u10300-\u1032F\u10400-\u1044F\u10450-\u1047F\u10480-\u104AF\u10800-\u1083F\u10A0-\u10FF\u13A0-\u13FF\u16A0-\u16FF\u1E00-\u1EFF\u2C00-\u2C5F\u2C60-\u2C7F\uA720-\uA7FF\uA840-\uA87F\uA880-\uA8DF\uA960-\uA97F\uA980-\uA9DF\uAA00-\uAA5F\uAA60-\uAA7F\uAB00-\uAB2F\uAB30-\uAB6F\uFF00-\uFFEF0-9]/g

export async function shouldPost(message: { text: string }): Promise<boolean> {
  let rejected: boolean = false
  if(config.simple === true) {
    rejected = message.text.toLocaleLowerCase().replaceAll(nonLettersCharsRegex, '').split(' ')
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