# bunsogs-profanity-filter

Profanity filter plugin for Session Open Group Server implementation [Bunsogs](https://github.com/VityaSchel/bunsogs).

## Installation 

1. Go to your bunsogs directory
2. Open plugins subdirectory
3. Clone this repository there or download as zip and unpack to plugins directory
4. Go into this plugin's directory, run `bun install` and optionally configure plugin
5. Restart your bunsogs

Simple mode is 100x less efficient than GPT moderation mode and will give you a lot of false negatives and a bunch of false positives. GPT is usually good at 80% of cases and pretty fast.

AI mode on the other hand only moderates the content, not words. Most likely it will allow profanity and curse words, but won't allow certain topics.

## Configuration

Profanity filter plugins supports two modes:

1. Simple common words and phrases detection (default)
    The plugin will use embedded dictionary in supported languages and reject any messages with found words.
    To use this, set "mode" in config.json to "simple"
2. AI mode with GPT moderation endpoint
    The plugin will send request to GPT moderation endpoint for each message and reject. Please be aware that this mode **sends all new incoming messages to OpenAI** API which may pose a security risk for you. First mode works 100% locally.
    To use this, follow the guide below.

## How to setup AI mode?

1. Go to https://platform.openai.com/api-keys
2. Create new secret key with any name, for example `"my-bunsogs-profanity-filter"`
3. Copy the key and paste it to the config.json's "openai_api_key" property
4. Set "mode" in config.json to "gpt"
5. Restart your bunsogs

This will reject message if "flagged" property is set to true by GPT moderation API. Example config:

```json
{
  "mode": "gpt",
  "openai_api_key": "sk-proj-uCzxhufCtrTNXHVYwsyUrLsnEGAMdbuHb0GmjhXqh_fvWHwEIg9RBLtHpdvTOjBxJrC9EJmnYoZ5DNbsXdGY_zSYSsEwo66urAAF1Xcg_YZbenwT2DDqb7DwN1Wi"
}
```

Optionally, you can configure to reject message only if one of categories is set to true. Set categories name to "reject_categories" array in config.json. Here is a list of all possible categories at time of writing this documentation:

- `sexual`
- `hate`
- `harassment`
- `self-harm`
- `sexual/minors`
- `hate/threatening`
- `violence/graphic`
- `self-harm/intent`
- `self-harm/instructions`
- `harassment/threatening`
- `violence`

For example, if you want to allow sexual content, but reject messages about sexually assulting minors and all other categories, here is your config:

```json
{
  "mode": "gpt",
  "openai_api_key": "sk-proj-uCzxhufCtrTNXHVYwsyUrLsnEGAMdbuHb0GmjhXqh_fvWHwEIg9RBLtHpdvTOjBxJrC9EJmnYoZ5DNbsXdGY_zSYSsEwo66urAAF1Xcg_YZbenwT2DDqb7DwN1Wi",
  "reject_categories": [
    "hate",
    "harassment",
    "self-harm",
    "sexual/minors",
    "hate/threatening",
    "violence/graphic",
    "self-harm/intent",
    "self-harm/instructions",
    "harassment/threatening",
    "violence"
  ]
}
```