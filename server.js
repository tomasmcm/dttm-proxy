import express from 'express';
import axios from 'axios';
import bodyParser from 'body-parser';
import cors from 'cors';

const app = express();
const port = 3000;

app.use(cors());
app.use(bodyParser.json());

app.post('/proxy/*', async (req, res) => {
  const {
    max_thinking_chars,
    ...bodyParams
  } = req.body;

  const protocol = req.protocol;
  const targetUrl = protocol + '://' + req.path.split('/proxy/')[1];

  const headers = {
    ...req.headers,
    'host': targetUrl.split('/')[2]
  };

  // Remove unnecessary headers
  delete headers['content-length'];
  delete headers['connection'];

  let isThinking = false;
  let charCount = 0;
  let currentChunk = '';
  const controller = new AbortController();

  try {
    const response = await axios({
      method: 'post',
      url: targetUrl,
      headers: headers,
      data: bodyParams,
      responseType: 'stream',
      signal: controller.signal
    });

    response.data.on('data', async chunk => {
      const chunkStr = chunk.toString();
      currentChunk += chunkStr;

      // Check for complete data chunks
      while (currentChunk.includes('\n')) {
        const parts = currentChunk.split('\n');
        const completeParts = parts.slice(0, -1);
        currentChunk = parts[parts.length - 1];

        for (const part of completeParts) {
          if (part.trim() === '') continue;
          if (!part.startsWith('data: ')) continue;

          const data = part.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content || '';

            if (content.includes('<think>')) {
              isThinking = true;
              charCount = 0;
            }

            if (isThinking) {
              charCount += content.length;
              if (charCount >= (parseInt(max_thinking_chars) || Infinity)) {
                controller.abort();
                res.write(`data: ${JSON.stringify({
                  ...parsed,
                  choices: [{
                    ...parsed.choices[0],
                    delta: { content: '\n</think>\n\n' }
                  }]
                })}\n\n`);
                
                // Make a new request with prefilled message
                const newBodyParams = {
                  ...bodyParams,
                  messages: [
                    ...bodyParams.messages,
                    {
                      role: 'assistant',
                      content: parsed.choices[0].delta.content + '\n</think>\n\n'
                    }
                  ]
                };
                
                const newResponse = await axios({
                  method: 'post',
                  url: targetUrl,
                  headers: headers,
                  data: newBodyParams,
                  responseType: 'stream'
                });
                
                newResponse.data.pipe(res);
                return;
              }
            }

            if (content.includes('</think>')) {
              isThinking = false;
              charCount = 0;
            }

            res.write(`data: ${JSON.stringify(parsed)}\n\n`);
          } catch (e) {
            console.error('Error parsing JSON:', e);
          }
        }
      }
    });

    response.data.on('end', () => {
      res.end();
    });

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Proxy request failed' });
  }
});

app.listen(port, () => {
  console.log(`Proxy server running on port ${port}`);
});