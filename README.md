# Don't Think Too Much (DTTM) Proxy

<p align="center">
  <img src="/assets/logo.png" alt="DTTM Logo" width="250" height="250">
</p>

Qwen/QwQ-32B is a great model, but it tends to think for a long time. OpenAI models have a `reasoning_effort` parameter, Anthropic models have a `thinking.budget_tokens` option, however, with open-source llms there isn't a built-in system to decide for how long and for how many tokens the llm thinks. Until now! This proxy adds a `max_thinking_chars` parameter that allows configuring the max number of characters that the LLM is allowed to think for.

## Quickstart

Clone the repo, run `yarn install` and then `yarn start`.

Open LM Studio, configure Qwen/QwQ-32B to use this [template](https://gist.github.com/tomasmcm/6fd3397eb44e3fbef4cf876451098a92) and start the Dev Server.

```sh
curl http://localhost:3000/proxy/localhost:1234/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "qwq-32b@4bit",
    "messages": [
      { "role": "user", "content": "What day is it today?" }
    ],
    "temperature": 0.5,
    "stream": true,
    "max_thinking_chars": 200
}'
```

## How this works

The proxy only cares about the `max_thinking_chars` parameter. If it is defined, the proxy starts counting the characters after `<think>` until a `</think>`. If the model continues thinking past the max number of chars, the proxy aborts the request and creates a new using using the existing `<think>...</think>` process as a prefilled assistant message.

In order for this to work, you need to update the LLM chat template. The default template does not allow prefilled messages because it wraps every message in `'<|im_start|>' + message.role + '\n'` and `'<|im_end|>' + '\n'`, and adds `'<|im_start|>assistant\n<think>\n'` at the end of all the messages.
This template (https://gist.github.com/tomasmcm/6fd3397eb44e3fbef4cf876451098a92) checks if there is an assistant message as the last message and allows the LLM to continue the generation as if it was the same message.
This method only works with streaming as it allows halting the generation in the middle. It should also work with DeepSeek R1 and Distilled version (might just need some adjusting of the `<think>` tags and new lines).

## Can I use this with other providers?

Currently this only works with LLM servers that allow prefilling assistant messages. Some providers like Groq support this with some models (doesn't seem Qwen/QwQ-32B is support yet). When using local servers you can configure the chat template to allow prefilling.

<br/>
<br/>

Logo was generated with prithivMLmods/Ton618-Only-Stickers-Flux-LoRA using the prompt "Only Sticker, An robot queen with questions logo with the words "Don't Think Too Much" written on it".
