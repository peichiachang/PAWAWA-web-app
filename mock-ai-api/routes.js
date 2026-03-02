function createRequestListener({ parseJsonBody, sendJson, checkAiHealth, runWithProvider }) {
  return async function onRequest(req, res) {
    if (!req.url || !req.method) {
      sendJson(res, 400, { error: 'Bad request' });
      return;
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      });
      res.end();
      return;
    }

    if (req.method === 'GET' && req.url === '/health') {
      sendJson(res, 200, { ok: true, service: 'carecat-mock-ai-api' });
      return;
    }

    if (req.method === 'GET' && req.url === '/health/ai') {
      const payload = await checkAiHealth();
      sendJson(res, payload.ready ? 200 : 503, payload);
      return;
    }

    if (req.method !== 'POST') {
      sendJson(res, 404, { error: 'Not found' });
      return;
    }

    const routeMap = {
      '/ai/feeding': 'feeding',
      '/ai/nutrition-ocr': 'nutrition',
      '/ai/hydration': 'hydration',
      '/ai/elimination': 'elimination',
      '/ai/blood-ocr': 'bloodOcr',
    };

    const handlerName = routeMap[req.url];
    if (!handlerName) {
      sendJson(res, 404, { error: 'Endpoint not found' });
      return;
    }

    try {
      const body = await parseJsonBody(req);
      const result = await runWithProvider(handlerName, body);
      sendJson(res, 200, result);
    } catch (error) {
      console.error(`[api] ${req.method} ${req.url} failed: ${error.message || error}`);
      sendJson(res, 400, { error: error.message || 'Request failed' });
    }
  };
}

module.exports = { createRequestListener };
