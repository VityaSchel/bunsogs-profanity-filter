# bunsogs-profanity-filter

Profanity filter plugin for Session Open Group Server implementation [Bunsogs](https://github.com/VityaSchel/bunsogs).

The following 54 languages are supported:
- Беларуская (Belarusian)
- Български (Bulgarian)
- Català (Catalan)
- Čeština (Czech)
- Cymraeg (Welsh)
- Dansk (Danish)
- Deutsch (German)
- Ελληνικά (Greek)
- English (English) \[curated\]
- Español (Spanish)
- Eesti (Estonian)
- Euskara (Basque)
- فارسی (Persian)
- Suomi (Finnish)
- Français (French)
- Gàidhlig (Scottish Gaelic)
- Galego (Galician)
- हिंदी (Hindi)
- Hrvatski (Croatian)
- Magyar (Hungarian)
- Հայերեն (Armenian)
- Bahasa Indonesia (Indonesian)
- Íslenska (Icelandic)
- Italiano (Italian)
- 日本語 (Japanese)
- ಕನ್ನಡ (Kannada)
- 한국어 (Korean)
- Latina (Latin)
- Lietuvių (Lithuanian)
- Latviešu (Latvian)
- Македонски (Macedonian)
- മലയാളം (Malayalam)
- Монгол (Mongolian)
- मराठी (Marathi)
- Bahasa Melayu (Malay)
- Malti (Maltese)
- မြန်မာစာ (Burmese)
- Nederlands (Dutch)
- Polski (Polish)
- Português (Portuguese)
- Română (Romanian)
- Русский (Russian) \[curated\]
- Slovenčina (Slovak)
- Slovenščina (Slovenian)
- Shqip (Albanian)
- Српски (Serbian)
- Svenska (Swedish)
- తెలుగు (Telugu)
- ไทย (Thai)
- Türkçe (Turkish)
- Українська (Ukrainian)
- Oʻzbek (Uzbek)
- Tiếng Việt (Vietnamese)
- isiZulu (Zulu)

## Profanity

Profanity list for english and russian languages is curated carefully by me, author of this plugin — hloth. The principle there is to allow generally accepted words such as 'anal', 'anus', 'abortion', but reject any slurs, swearing and words commonly used for adult topics. Mild profanity like words 'idiot', 'crap', 'bloody' are not censored. Other languages might be stricter and censor regular words, as the data was taken from Google's profanity list.


To change dictionary, open [src/profanity-list.json](./src/profanity-list.json) file and edit arrays. Language keys are purely for convinience, you do not have to worry in which language section to add new words.

## Installation 

Prerequisite: Install Bun for this plugin. Go to [bun.sh](https://bun.sh), run one line script in your terminal and test it with `bun -v` If it shows version number, you've just installed the best js runtime and ready to install this plugin.

1. Go to your bunsogs directory
2. Open plugins subdirectory
3. Clone this repository there or download as zip and unpack to plugins directory
4. Go into this plugin's directory, run `bun install` and optionally configure plugin
5. Restart your bunsogs

Simple mode is useful to detect profanity and bad words. It won't filter out mangled words.

GPT mode on the other hand only moderates the content, not words. Most likely it will allow profanity and curse words, but won't allow certain topics.

## Configuration

bunsogs-profanity-filter plugins supports two modes which can be enabled simultaniously:

- Simple common words and abbrevations detection (enabled by default)
  The plugin will use embedded dictionary in supported languages and reject any messages with found words.
  To use this, set `"simple"` in config.json to `true` 
- GPT mode with GPT moderation endpoint
  The plugin will send request to GPT moderation endpoint for each message and reject if GPT flagged input. Please be aware that this mode **sends all new incoming messages to OpenAI** API which may pose a security risk for you. Simple mode works 100% locally.
  To use this, follow the guide below.

By default bunsogs-profanity-filter plugin will only check messages from users who don't have admin or moderator permissions neither globally nor in the current room. You can configure this via `"check_mods"` property, by setting it to true in config.json, the plugin will check messages from everybody.

By default this plugin **drops** any matching messages, which means the user who sent it will be able to see it, but no one else will see that message in the current room. It may be misleading as some messages with false positives might not show up causing confusion. You can change this behaviour to **reject** meaning bunsogs will explicitly return http error code and instruct Session clients to show error. 

Any changes in configuration require restarting bunsogs instance.

## How to setup GPT mode?

1. Go to https://platform.openai.com/api-keys
2. Create new secret key with any name, it does not matter and won't be visible to anyone
3. Copy the secret key and paste it to the config.json's "openai_api_key" property
4. Set `"gpt"` in config.json to `true`
5. Restart your bunsogs

This will reject message if "flagged" property is set to true by GPT moderation API. Example config:

```json
{
  "simple": true,
  "gpt": true,
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

For example, if you want to allow sexual content, but reject messages about sex with minors and all other categories, here is your config:

```json
{
  "simple": true,
  "gpt": true,
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