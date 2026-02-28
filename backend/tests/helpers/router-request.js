function normalizeHeaders(headers = {}) {
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[String(key).toLowerCase()] = value;
  }
  return normalized;
}

function findRouteLayer(router, method, path) {
  const methodKey = String(method || 'GET').toLowerCase();
  return (router.stack || []).find(layer => (
    layer
    && layer.route
    && layer.route.path === path
    && layer.route.methods
    && layer.route.methods[methodKey]
  ));
}

export async function invokeRoute(router, {
  method = 'GET',
  path,
  body = undefined,
  query = {},
  params = {},
  headers = {}
} = {}) {
  const routeLayer = findRouteLayer(router, method, path);
  if (!routeLayer) {
    throw new Error(`Route not found for ${method} ${path}`);
  }

  const handlers = (routeLayer.route.stack || []).map(layer => layer.handle);
  const requestHeaders = normalizeHeaders(headers);

  const req = {
    method: String(method).toUpperCase(),
    path,
    url: path,
    originalUrl: path,
    body,
    query,
    params,
    headers: requestHeaders,
    get(name) {
      return requestHeaders[String(name).toLowerCase()];
    }
  };

  let statusCode = 200;
  let payload;
  let ended = false;
  const responseHeaders = {};

  const res = {
    locals: {},
    status(code) {
      statusCode = code;
      return this;
    },
    set(name, value) {
      responseHeaders[String(name).toLowerCase()] = value;
      return this;
    },
    get(name) {
      return responseHeaders[String(name).toLowerCase()];
    },
    json(value) {
      payload = value;
      ended = true;
      return this;
    },
    send(value) {
      payload = value;
      ended = true;
      return this;
    },
    end(value) {
      if (value !== undefined) {
        payload = value;
      }
      ended = true;
      return this;
    }
  };

  for (const handler of handlers) {
    await new Promise((resolve, reject) => {
      let nextCalled = false;
      const next = err => {
        nextCalled = true;
        if (err) {
          reject(err);
          return;
        }
        resolve();
      };

      Promise.resolve(handler(req, res, next))
        .then(() => {
          if (!nextCalled) {
            resolve();
          }
        })
        .catch(reject);
    });

    if (ended) {
      break;
    }
  }

  return { status: statusCode, body: payload, headers: responseHeaders };
}
