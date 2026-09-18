require('dotenv').config();
const express = require('express');
const { UnderstandRequestSchema } = require('./schema');
const { understandText } = require('./groqService');

const app = express();
const PORT = process.env.PORT || 8002;

app.use(express.json({ limit: '100kb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'saathi-nlp',
  });
});

// NLP Understanding endpoint
app.post('/api/nlp/understand', async (req, res) => {
  // 1. Validate request body
  const bodyValidation = UnderstandRequestSchema.safeParse(req.body);
  if (!bodyValidation.success) {
    const errorMessages = bodyValidation.error.issues.map((i) => i.message);
    console.warn(`[NLP-Service] Bad Request (400): ${errorMessages.join(', ')}`);
    return res.status(400).json({
      error: 'Bad Request',
      message: errorMessages.join('; '),
      issues: bodyValidation.error.issues,
    });
  }

  const { text, conversation } = bodyValidation.data;
  const apiKey = process.env.GROQ_API_KEY;
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

  // 2. Check for configured API key
  if (!apiKey || apiKey.trim() === '') {
    console.error('[NLP-Service] GROQ_API_KEY is not configured on the server');
    return res.status(503).json({
      error: 'Service Unavailable',
      message: 'NLP service is not configured with GROQ_API_KEY. Please configure backend environment.',
    });
  }

  // 3. Process with Groq and validate output
  console.log(`[NLP-Service] Processing understand request for message length: ${text.length}`);
  try {
    const result = await understandText({
      text,
      conversation,
      apiKey,
      model,
    });

    console.log(`[NLP-Service] Successfully understood message. Intent: ${result.intent}, Lang: ${result.language}, Confidence: ${result.confidence}`);
    return res.status(200).json(result);
  } catch (err) {
    if (err.code === 'INVALID_JSON') {
      console.error('[NLP-Service] Model output was not valid JSON:', err.message);
      return res.status(502).json({
        error: 'Bad Gateway',
        message: 'The language model returned an invalid JSON response.',
        details: err.message,
      });
    }

    if (err.code === 'SCHEMA_VALIDATION_FAILED') {
      console.error('[NLP-Service] Model output failed schema validation:', err.issues);
      return res.status(422).json({
        error: 'Unprocessable Entity',
        message: 'The language model returned a response that violates the expected schema.',
        issues: err.issues,
      });
    }

    if (err.status) {
      console.error(`[NLP-Service] Upstream Groq error: HTTP ${err.status}`);
      return res.status(502).json({
        error: 'Bad Gateway',
        message: `Upstream AI service error (HTTP ${err.status})`,
      });
    }

    console.error('[NLP-Service] Unexpected error during NLP processing:', err.message);
    return res.status(500).json({
      error: 'Internal Server Error',
      message: 'An unexpected error occurred while processing the request.',
    });
  }
});

let server;
if (require.main === module) {
  server = app.listen(PORT, () => {
    console.log(`saathi-nlp service running on port ${PORT}`);
  });
}

module.exports = { app, server };
