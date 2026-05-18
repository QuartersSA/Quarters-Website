import { AsyncLocalStorage } from 'node:async_hooks';
import nodeConsole from 'node:console';
import { skipCSRFCheck } from '@auth/core';
import Credentials from '@auth/core/providers/credentials';
import { initAuthConfig, authHandler } from '@hono/auth-js';
import { neonConfig, Pool } from '@neondatabase/serverless';
import { verify, hash } from 'argon2';
import { Hono } from 'hono';
import { contextStorage } from 'hono/context-storage';
import { cors } from 'hono/cors';
import { proxy } from 'hono/proxy';
import { bodyLimit } from 'hono/body-limit';
import { requestId } from 'hono/request-id';
import { createMiddleware } from 'hono/factory';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { logger } from 'hono/logger';
import { createRequestHandler } from 'react-router';
import { serializeError } from 'serialize-error';
import ws from 'ws';

var defaultWebSocket = {
  upgradeWebSocket: (() => {
  }),
  injectWebSocket: (server) => server
};
async function createWebSocket({ app, enabled }) {
  if (!enabled) {
    return defaultWebSocket;
  }
  process.env.NODE_ENV === "development" ? "development" : "production";
  {
    const { createNodeWebSocket } = await import('@hono/node-ws');
    const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });
    return {
      upgradeWebSocket,
      injectWebSocket(server) {
        injectWebSocket(server);
        return server;
      }
    };
  }
}
function cleanUpgradeListeners(httpServer) {
  const upgradeListeners = httpServer.listeners("upgrade").filter((listener) => listener.name !== "hmrServerWsListener");
  for (const listener of upgradeListeners) {
    httpServer.removeListener(
      "upgrade",
      /* @ts-expect-error - we don't care */
      listener
    );
  }
}
function patchUpgradeListener(httpServer) {
  const upgradeListeners = httpServer.listeners("upgrade").filter((listener) => listener.name !== "hmrServerWsListener");
  for (const listener of upgradeListeners) {
    httpServer.removeListener(
      "upgrade",
      /* @ts-expect-error - we don't care */
      listener
    );
    httpServer.on("upgrade", (request, ...rest) => {
      if (request.headers["sec-websocket-protocol"] === "vite-hmr") {
        return;
      }
      return listener(request, ...rest);
    });
  }
}
function bindIncomingRequestSocketInfo() {
  return createMiddleware((c, next) => {
    c.env.server = {
      incoming: {
        socket: {
          remoteAddress: c.req.raw.headers.get("x-remote-address") || void 0,
          remotePort: Number(c.req.raw.headers.get("x-remote-port")) || void 0,
          remoteFamily: c.req.raw.headers.get("x-remote-family") || void 0
        }
      }
    };
    return next();
  });
}
async function importBuild() {
  return await import(
    // @ts-expect-error - Virtual module provided by React Router at build time
    './server-build.js'
  );
}
function getBuildMode() {
  return process.env.NODE_ENV === "development" ? "development" : "production";
}

// src/middleware.ts
function cache(seconds) {
  return createMiddleware(async (c, next) => {
    if (!c.req.path.match(/\.[a-zA-Z0-9]+$/) || c.req.path.endsWith(".data")) {
      return next();
    }
    await next();
    if (!c.res.ok || c.res.headers.has("cache-control")) {
      return;
    }
    c.res.headers.set("cache-control", `public, max-age=${seconds}`);
  });
}

async function createHonoServer(options) {
  const startTime = Date.now();
  const build = await importBuild();
  const basename = "/";
  const mergedOptions = {
    ...options,
    listeningListener: options?.listeningListener || ((info) => {
      console.log(`🚀 Server started on port ${info.port}`);
      console.log(`🌍 http://127.0.0.1:${info.port}`);
      console.log(`🏎️ Server started in ${Date.now() - startTime}ms`);
    }),
    port: options?.port || Number(process.env.PORT) || 3e3,
    defaultLogger: options?.defaultLogger ?? true,
    overrideGlobalObjects: options?.overrideGlobalObjects ?? false
  };
  const mode = getBuildMode();
  const PRODUCTION = mode === "production";
  const clientBuildPath = `${"build"}/client`;
  const app = new Hono(mergedOptions.app);
  const { upgradeWebSocket, injectWebSocket } = await createWebSocket({
    app,
    enabled: mergedOptions.useWebSocket ?? false
  });
  if (!PRODUCTION) {
    app.use(bindIncomingRequestSocketInfo());
  }
  await mergedOptions.beforeAll?.(app);
  app.use(
    `/${"assets"}/*`,
    cache(60 * 60 * 24 * 365),
    // 1 year
    serveStatic({ root: clientBuildPath, ...mergedOptions.serveStaticOptions?.clientAssets })
  );
  app.use(
    "*",
    cache(60 * 60),
    // 1 hour
    serveStatic({ root: PRODUCTION ? clientBuildPath : "./public", ...mergedOptions.serveStaticOptions?.publicAssets })
  );
  if (mergedOptions.defaultLogger) {
    app.use("*", logger());
  }
  if (mergedOptions.useWebSocket) {
    await mergedOptions.configure(app, { upgradeWebSocket });
  } else {
    await mergedOptions.configure?.(app);
  }
  const reactRouterApp = new Hono({
    strict: false
  });
  reactRouterApp.use((c, next) => {
    return createMiddleware(async (c2) => {
      const requestHandler = createRequestHandler(build, mode);
      const loadContext = mergedOptions.getLoadContext?.(c2, { build, mode });
      return requestHandler(c2.req.raw, loadContext instanceof Promise ? await loadContext : loadContext);
    })(c, next);
  });
  app.route(`${basename}`, reactRouterApp);
  {
    app.route(`${basename}.data`, reactRouterApp);
  }
  if (PRODUCTION) {
    const server = serve(
      {
        ...app,
        ...mergedOptions.customNodeServer,
        port: mergedOptions.port,
        overrideGlobalObjects: mergedOptions.overrideGlobalObjects,
        hostname: mergedOptions.hostname
      },
      mergedOptions.listeningListener
    );
    mergedOptions.onServe?.(server);
    injectWebSocket(server);
  } else if (globalThis.__viteDevServer?.httpServer) {
    const httpServer = globalThis.__viteDevServer.httpServer;
    cleanUpgradeListeners(httpServer);
    mergedOptions.onServe?.(httpServer);
    injectWebSocket(httpServer);
    patchUpgradeListener(httpServer);
    console.log("🚧 Dev server started");
  }
  return app;
}

function NeonAdapter(client) {
  return {
    async createVerificationToken(verificationToken) {
      const { identifier, expires, token } = verificationToken;
      const sql = `
        INSERT INTO auth_verification_token ( identifier, expires, token )
        VALUES ($1, $2, $3)
        `;
      await client.query(sql, [identifier, expires, token]);
      return verificationToken;
    },
    async useVerificationToken({
      identifier,
      token
    }) {
      const sql = `delete from auth_verification_token
      where identifier = $1 and token = $2
      RETURNING identifier, expires, token `;
      const result = await client.query(sql, [identifier, token]);
      return result.rowCount !== 0 ? result.rows[0] : null;
    },
    async createUser(user) {
      const { name, email, emailVerified, image } = user;
      const sql = `
        INSERT INTO auth_users (name, email, "emailVerified", image)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name, email, "emailVerified", image`;
      const result = await client.query(sql, [
        name,
        email,
        emailVerified,
        image
      ]);
      return result.rows[0];
    },
    async getUser(id) {
      const sql = "select * from auth_users where id = $1";
      try {
        const result = await client.query(sql, [id]);
        return result.rowCount === 0 ? null : result.rows[0];
      } catch {
        return null;
      }
    },
    async getUserByEmail(email) {
      const sql = "select * from auth_users where email = $1";
      const result = await client.query(sql, [email]);
      if (result.rowCount === 0) {
        return null;
      }
      const userData = result.rows[0];
      const accountsData = await client.query(
        'select * from auth_accounts where "userId" = $1',
        [userData.id]
      );
      return {
        ...userData,
        accounts: accountsData.rows
      };
    },
    async getUserByAccount({
      providerAccountId,
      provider
    }) {
      const sql = `
          select u.* from auth_users u join auth_accounts a on u.id = a."userId"
          where
          a.provider = $1
          and
          a."providerAccountId" = $2`;
      const result = await client.query(sql, [provider, providerAccountId]);
      return result.rowCount !== 0 ? result.rows[0] : null;
    },
    async updateUser(user) {
      const fetchSql = "select * from auth_users where id = $1";
      const query1 = await client.query(fetchSql, [user.id]);
      const oldUser = query1.rows[0];
      const newUser = {
        ...oldUser,
        ...user
      };
      const { id, name, email, emailVerified, image } = newUser;
      const updateSql = `
        UPDATE auth_users set
        name = $2, email = $3, "emailVerified" = $4, image = $5
        where id = $1
        RETURNING name, id, email, "emailVerified", image
      `;
      const query2 = await client.query(updateSql, [
        id,
        name,
        email,
        emailVerified,
        image
      ]);
      return query2.rows[0];
    },
    async linkAccount(account) {
      const sql = `
      insert into auth_accounts
      (
        "userId",
        provider,
        type,
        "providerAccountId",
        access_token,
        expires_at,
        refresh_token,
        id_token,
        scope,
        session_state,
        token_type,
        password
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning
        id,
        "userId",
        provider,
        type,
        "providerAccountId",
        access_token,
        expires_at,
        refresh_token,
        id_token,
        scope,
        session_state,
        token_type,
        password
      `;
      const params = [
        account.userId,
        account.provider,
        account.type,
        account.providerAccountId,
        account.access_token,
        account.expires_at,
        account.refresh_token,
        account.id_token,
        account.scope,
        account.session_state,
        account.token_type,
        account.extraData?.password
      ];
      const result = await client.query(sql, params);
      return result.rows[0];
    },
    async createSession({ sessionToken, userId, expires }) {
      if (userId === void 0) {
        throw Error("userId is undef in createSession");
      }
      const sql = `insert into auth_sessions ("userId", expires, "sessionToken")
      values ($1, $2, $3)
      RETURNING id, "sessionToken", "userId", expires`;
      const result = await client.query(sql, [userId, expires, sessionToken]);
      return result.rows[0];
    },
    async getSessionAndUser(sessionToken) {
      if (sessionToken === void 0) {
        return null;
      }
      const result1 = await client.query(
        `select * from auth_sessions where "sessionToken" = $1`,
        [sessionToken]
      );
      if (result1.rowCount === 0) {
        return null;
      }
      const session = result1.rows[0];
      const result2 = await client.query(
        "select * from auth_users where id = $1",
        [session.userId]
      );
      if (result2.rowCount === 0) {
        return null;
      }
      const user = result2.rows[0];
      return {
        session,
        user
      };
    },
    async updateSession(session) {
      const { sessionToken } = session;
      const result1 = await client.query(
        `select * from auth_sessions where "sessionToken" = $1`,
        [sessionToken]
      );
      if (result1.rowCount === 0) {
        return null;
      }
      const originalSession = result1.rows[0];
      const newSession = {
        ...originalSession,
        ...session
      };
      const sql = `
        UPDATE auth_sessions set
        expires = $2
        where "sessionToken" = $1
        `;
      const result = await client.query(sql, [
        newSession.sessionToken,
        newSession.expires
      ]);
      return result.rows[0];
    },
    async deleteSession(sessionToken) {
      const sql = `delete from auth_sessions where "sessionToken" = $1`;
      await client.query(sql, [sessionToken]);
    },
    async unlinkAccount(partialAccount) {
      const { provider, providerAccountId } = partialAccount;
      const sql = `delete from auth_accounts where "providerAccountId" = $1 and provider = $2`;
      await client.query(sql, [providerAccountId, provider]);
    },
    async deleteUser(userId) {
      await client.query("delete from auth_users where id = $1", [userId]);
      await client.query('delete from auth_sessions where "userId" = $1', [
        userId
      ]);
      await client.query('delete from auth_accounts where "userId" = $1', [
        userId
      ]);
    }
  };
}

const getHTMLForErrorPage = (err) => {
  return `
<html>
  <head>
    <script>
    window.onload = () => {
      const error = ${JSON.stringify(serializeError(err))};
      window.parent.postMessage({ type: 'sandbox:web:ready' }, '*');
      window.parent.postMessage({ type: 'sandbox:error:detected', error: error }, '*');

      const healthyResponse = {
        type: 'sandbox:web:healthcheck:response',
        healthy: true,
        hasError: true,
        supportsErrorDetected: true,
      };
      window.addEventListener('message', (event) => {
        if (event.data.type === 'sandbox:navigation') {
          window.location.pathname = event.data.pathname;
        }
        if (event.data.type === 'sandbox:web:healthcheck') {
          window.parent.postMessage(healthyResponse, '*');
        }
      });
      console.error(error);
    }
    <\/script>
  </head>
  <body></body>
</html>
    `;
};

const authActions = [
  "providers",
  "session",
  "csrf",
  "signin",
  "signout",
  "callback",
  "verify-request",
  "error",
  "webauthn-options"
];
function isAuthAction(pathname) {
  const base = "/api/auth";
  const a = pathname.match(new RegExp(`^${base}(.+)`));
  if (a === null) {
    return false;
  }
  const actionAndProviderId = a.at(-1);
  if (!actionAndProviderId) {
    return false;
  }
  const b = actionAndProviderId.replace(/^\//, "").split("/").filter(Boolean);
  if (b.length !== 1 && b.length !== 2) {
    return false;
  }
  const [action] = b;
  if (!authActions.includes(action)) {
    return false;
  }
  return true;
}

const originalFetch = fetch;
const isBackend = () => typeof window === "undefined";
const safeStringify = (value) => JSON.stringify(value, (_k, v) => {
  if (v instanceof Date) return { __t: "Date", v: v.toISOString() };
  if (v instanceof Error)
    return { __t: "Error", v: { name: v.name, message: v.message, stack: v.stack } };
  return v;
});
const postToParent = (level, text, extra) => {
  try {
    if (isBackend() || !window.parent || window.parent === window) {
      ("level" in console ? console[level] : console.log)(text, extra);
      return;
    }
    window.parent.postMessage(
      {
        type: "sandbox:web:console-write",
        __viteConsole: true,
        level,
        text,
        args: [safeStringify(extra)]
      },
      "*"
    );
  } catch {
  }
};
const getUrlFromArgs = (...args) => {
  const [input] = args;
  if (typeof input === "string") return input;
  if (input instanceof Request) return input.url;
  return `${input.protocol}//${input.host}${input.pathname}`;
};
const isFirstPartyURL = (url) => {
  return url.startsWith("/integrations") || url.startsWith("/_create");
};
const isSecondPartyUrl = (url) => {
  return process.env.NEXT_PUBLIC_CREATE_API_BASE_URL && url.startsWith(process.env.NEXT_PUBLIC_CREATE_API_BASE_URL) || process.env.NEXT_PUBLIC_CREATE_BASE_URL && url.startsWith(process.env.NEXT_PUBLIC_CREATE_BASE_URL) || url.startsWith("https://www.create.xyz") || url.startsWith("https://api.create.xyz/") || url.startsWith("https://www.createanything.com") || url.startsWith("https://api.createanything.com");
};
const fetchWithHeaders = async (input, init) => {
  const url = getUrlFromArgs(input, init);
  const additionalHeaders = {
    "x-createxyz-project-group-id": process.env.NEXT_PUBLIC_PROJECT_GROUP_ID
  };
  const isExternalFetch = !isFirstPartyURL(url) && !isSecondPartyUrl(url);
  if (isExternalFetch || url.startsWith("/api")) {
    return originalFetch(input, init);
  }
  let finalInit;
  if (input instanceof Request) {
    const hasBody = !!input.body;
    finalInit = {
      method: input.method,
      headers: new Headers(input.headers),
      body: input.body,
      mode: input.mode,
      credentials: input.credentials,
      cache: input.cache,
      redirect: input.redirect,
      referrer: input.referrer,
      referrerPolicy: input.referrerPolicy,
      integrity: input.integrity,
      keepalive: input.keepalive,
      signal: input.signal,
      ...hasBody ? { duplex: "half" } : {},
      ...init
    };
  } else {
    finalInit = { ...init, headers: new Headers(init?.headers ?? {}) };
  }
  const finalHeaders = new Headers(finalInit.headers);
  for (const [key, value] of Object.entries(additionalHeaders)) {
    if (value) finalHeaders.set(key, value);
  }
  finalInit.headers = finalHeaders;
  const prefix = !isSecondPartyUrl(url) ? isBackend() ? process.env.NEXT_PUBLIC_CREATE_BASE_URL ?? "https://www.create.xyz" : "" : "";
  try {
    const result = await originalFetch(`${prefix}${url}`, finalInit);
    if (!result.ok) {
      postToParent(
        "error",
        `Failed to load resource: the server responded with a status of ${result.status} (${result.statusText ?? ""})`,
        {
          url,
          status: result.status,
          statusText: result.statusText
        }
      );
    }
    return result;
  } catch (error) {
    postToParent("error", "Fetch error", {
      url,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error
    });
    throw error;
  }
};

const API_BASENAME = "/api";
const api = new Hono();
if (globalThis.fetch) {
  globalThis.fetch = fetchWithHeaders;
}
const routeModules = /* #__PURE__ */ Object.assign({"../src/app/api/__create/ssr-test/route.js": () => import('./route-CkSr1pmn.js'),"../src/app/api/accounting/cash-counts/route.js": () => import('./route-g65-_D4p.js'),"../src/app/api/accounting/expense-types/route.js": () => import('./route-BVDpLlwy.js'),"../src/app/api/accounting/expenses/[id]/route.js": () => import('./route-DyIFscuy.js'),"../src/app/api/accounting/expenses/route.js": () => import('./route-DT2k-2-s.js'),"../src/app/api/accounting/fixed-expenses/[id]/confirm/route.js": () => import('./route-DpdcYlgO.js'),"../src/app/api/accounting/fixed-expenses/[id]/route.js": () => import('./route-BIQcxfbm.js'),"../src/app/api/accounting/fixed-expenses/route.js": () => import('./route-BIT7rw-J.js'),"../src/app/api/accounting/green-bean-order-items/[id]/route.js": () => import('./route-D3vY_oho.js'),"../src/app/api/accounting/green-bean-orders/[id]/deposit/route.js": () => import('./route-olXXIYEt.js'),"../src/app/api/accounting/green-bean-orders/[id]/route.js": () => import('./route-CZETEUxq.js'),"../src/app/api/accounting/green-bean-orders/route.js": () => import('./route-O4x6Icuf.js'),"../src/app/api/accounting/green-beans/[id]/route.js": () => import('./route-C1i2QuSC.js'),"../src/app/api/accounting/green-beans/route.js": () => import('./route-B11jv-3n.js'),"../src/app/api/accounting/payroll/close/route.js": () => import('./route-srbCIo_h.js'),"../src/app/api/accounting/payroll/payment/route.js": () => import('./route-sNZcIKkf.js'),"../src/app/api/accounting/payroll/route.js": () => import('./route-C9hWGK6v.js'),"../src/app/api/accounting/shift-closings/route.js": () => import('./route-CXyXM924.js'),"../src/app/api/auth/expo-web-success/route.js": () => import('./route-Ds7wDXew.js'),"../src/app/api/auth/token/route.js": () => import('./route-CnUs8NfG.js'),"../src/app/api/branch-stock-at/route.js": () => import('./route-DGeOM8CZ.js'),"../src/app/api/branches/route.js": () => import('./route-BZcu4jUK.js'),"../src/app/api/dashboard/analytics/route.js": () => import('./route-CV9n14_2.js'),"../src/app/api/employees/[id]/route.js": () => import('./route-Ck8WAPQi.js'),"../src/app/api/employees/login/route.js": () => import('./route-BPaO-5bY.js'),"../src/app/api/employees/route.js": () => import('./route-Cgu25ZCl.js'),"../src/app/api/hr/bonuses/[id]/route.js": () => import('./route-plBiS9Z1.js'),"../src/app/api/hr/bonuses/employees/route.js": () => import('./route-LO7_OA1t.js'),"../src/app/api/hr/bonuses/route.js": () => import('./route-CxFda5ZP.js'),"../src/app/api/hr/deductions/[id]/route.js": () => import('./route-FGBhjpAP.js'),"../src/app/api/hr/deductions/employees/route.js": () => import('./route-Cqf-XlPT.js'),"../src/app/api/hr/deductions/route.js": () => import('./route-XpPstMVH.js'),"../src/app/api/hr/employees/[id]/logs/route.js": () => import('./route-DLEvooKq.js'),"../src/app/api/hr/employees/[id]/route.js": () => import('./route-CVQXxa9l.js'),"../src/app/api/hr/employees/route.js": () => import('./route-BmjAS4Ve.js'),"../src/app/api/inventory-operations/route.js": () => import('./route-n4ZtOKNu.js'),"../src/app/api/inventory-transfers/route.js": () => import('./route-CKr2fPWr.js'),"../src/app/api/item-categories/route.js": () => import('./route-8jhCWifU.js'),"../src/app/api/items/[id]/analysis/route.js": () => import('./route-Bcr_SxWb.js'),"../src/app/api/items/[id]/branch-visibility/route.js": () => import('./route-6CKgfwSe.js'),"../src/app/api/items/[id]/history/route.js": () => import('./route--LqE6vhn.js'),"../src/app/api/items/[id]/stock-debug/route.js": () => import('./route-Cf7FexUW.js'),"../src/app/api/items/[id]/timeline/route.js": () => import('./route-CxkPNHdn.js'),"../src/app/api/items/batch-inventory/route.js": () => import('./route-CCcBFQLP.js'),"../src/app/api/items/low-stock/route.js": () => import('./route-ttSxD60n.js'),"../src/app/api/items/over-stock/route.js": () => import('./route-Cnmd4CVl.js'),"../src/app/api/items/route.js": () => import('./route-BMxz6jeP.js'),"../src/app/api/items/stock-value/route.js": () => import('./route-D7Z3UoXh.js'),"../src/app/api/items/summary/route.js": () => import('./route-DkvNR0Fb.js'),"../src/app/api/marketing/activate/route.js": () => import('./route-D842uisS.js'),"../src/app/api/marketing/bloggers/route.js": () => import('./route-CPtPrb3T.js'),"../src/app/api/marketing/menu/route.js": () => import('./route-DHEf60yz.js'),"../src/app/api/marketing/settings/route.js": () => import('./route-YXMXrtwr.js'),"../src/app/api/marketing/welcome/[slug]/route.js": () => import('./route-BQHaCDPD.js'),"../src/app/api/opening-sessions/route.js": () => import('./route-CW_l9OD3.js'),"../src/app/api/purchase-receipts/route.js": () => import('./route-UQi-BZYd.js'),"../src/app/api/setup/route.js": () => import('./route-CXQCYDm7.js'),"../src/app/api/uploadcare/config/route.js": () => import('./route-CqirtLEk.js'),"../src/app/api/uploads/[sessionId]/chunk/route.js": () => import('./route-rH_j3Jbu.js'),"../src/app/api/uploads/[sessionId]/complete/route.js": () => import('./route-Dwnf-VGY.js'),"../src/app/api/uploads/[sessionId]/file/route.js": () => import('./route-Dao7K_zU.js'),"../src/app/api/uploads/[sessionId]/route.js": () => import('./route-D-IDPMw7.js'),"../src/app/api/uploads/init/route.js": () => import('./route-BsT_26Nu.js'),"../src/app/api/variance/route.js": () => import('./route-BV-Wu6XI.js'),"../src/app/api/wasender/test/route.js": () => import('./route-DP-Gs_zT.js'),"../src/app/api/workspace/cron/route.js": () => import('./route-FrvGeuIR.js'),"../src/app/api/workspace/overdue/route.js": () => import('./route-CQyewYzO.js'),"../src/app/api/workspace/reminders/route.js": () => import('./route-_BaXYhQJ.js'),"../src/app/api/workspace/spaces/route.js": () => import('./route-DIVVER4U.js'),"../src/app/api/workspace/summary/route.js": () => import('./route-PIlTKF9x.js'),"../src/app/api/workspace/tasks/[id]/attachments/route.js": () => import('./route-lN9eR2U5.js'),"../src/app/api/workspace/tasks/[id]/checklist/route.js": () => import('./route-CJZbnTbi.js'),"../src/app/api/workspace/tasks/[id]/history/route.js": () => import('./route-B4TFUK2Y.js'),"../src/app/api/workspace/tasks/[id]/route.js": () => import('./route-4_bu9lFq.js'),"../src/app/api/workspace/tasks/[id]/subtasks/route.js": () => import('./route-D2uVrHln.js'),"../src/app/api/workspace/tasks/[id]/updates/route.js": () => import('./route-DPW0O6R2.js'),"../src/app/api/workspace/tasks/quick-status/route.js": () => import('./route-BcxH3Lg6.js'),"../src/app/api/workspace/tasks/route.js": () => import('./route-Ce7USjEb.js'),"../src/app/api/workspace/templates/route.js": () => import('./route-DwoWpxuU.js'),"../src/app/api/workspace/threads/[threadId]/messages/route.js": () => import('./route-g-3ozY9o.js'),"../src/app/api/workspace/threads/route.js": () => import('./route-DRXXJk-U.js'),"../src/app/api/workspace/users/route.js": () => import('./route-C-5ErZnJ.js')

});
function getHonoPath(filePath) {
  const withoutPrefix = filePath.replace("../src/app/api", "").replace("/route.js", "");
  if (!withoutPrefix) return "/";
  return withoutPrefix.split("/").map((segment) => {
    const match = segment.match(/^\[(\.{3})?([^\]]+)\]$/);
    if (match) {
      const [_, dots, param] = match;
      return dots === "..." ? `:${param}{.+}` : `:${param}`;
    }
    return segment;
  }).join("/");
}
async function registerRoutes() {
  api.routes = [];
  const entries = Object.entries(routeModules).sort(
    (a, b) => b[0].length - a[0].length
  );
  for (const [filePath, importer] of entries) {
    try {
      const route = await importer();
      const honoPath = getHonoPath(filePath) || "/";
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
      for (const method of methods) {
        if (route[method]) {
          const handler = async (c) => {
            const params = c.req.param();
            return await route[method](c.req.raw, { params });
          };
          switch (method) {
            case "GET":
              api.get(honoPath, handler);
              break;
            case "POST":
              api.post(honoPath, handler);
              break;
            case "PUT":
              api.put(honoPath, handler);
              break;
            case "DELETE":
              api.delete(honoPath, handler);
              break;
            case "PATCH":
              api.patch(honoPath, handler);
              break;
          }
        }
      }
    } catch (error) {
      console.error(`Error registering route ${filePath}:`, error);
    }
  }
}
await registerRoutes();

neonConfig.webSocketConstructor = ws;
const als = new AsyncLocalStorage();
for (const method of ["log", "info", "warn", "error", "debug"]) {
  const original = nodeConsole[method].bind(console);
  console[method] = (...args) => {
    const requestId2 = als.getStore()?.requestId;
    if (requestId2) {
      original(`[traceId:${requestId2}]`, ...args);
    } else {
      original(...args);
    }
  };
}
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
const adapter = NeonAdapter(pool);
const app = new Hono();
app.use("*", requestId());
app.use("*", (c, next) => {
  const requestId2 = c.get("requestId");
  return als.run({ requestId: requestId2 }, () => next());
});
app.use(contextStorage());
app.onError((err, c) => {
  if (c.req.method !== "GET") {
    return c.json(
      {
        error: "An error occurred in your app",
        details: serializeError(err)
      },
      500
    );
  }
  return c.html(getHTMLForErrorPage(err), 200);
});
if (process.env.CORS_ORIGINS) {
  app.use(
    "/*",
    cors({
      origin: process.env.CORS_ORIGINS.split(",").map(
        (origin) => origin.trim()
      )
    })
  );
}
for (const method of ["post", "put", "patch"]) {
  app[method](
    "*",
    bodyLimit({
      maxSize: 4.5 * 1024 * 1024,
      // 4.5mb to match vercel limit
      onError: (c) => {
        return c.json({ error: "Body size limit exceeded" }, 413);
      }
    })
  );
}
if (process.env.AUTH_SECRET) {
  app.use(
    "*",
    initAuthConfig((c) => ({
      secret: c.env.AUTH_SECRET,
      basePath: "/api/auth",
      pages: {
        signIn: "/account/signin",
        signOut: "/account/logout"
      },
      skipCSRFCheck,
      session: {
        strategy: "jwt"
      },
      callbacks: {
        session({ session, token }) {
          if (token.sub) {
            session.user.id = token.sub;
          }
          return session;
        }
      },
      cookies: {
        csrfToken: {
          options: {
            secure: true,
            sameSite: "none"
          }
        },
        sessionToken: {
          options: {
            secure: true,
            sameSite: "none"
          }
        },
        callbackUrl: {
          options: {
            secure: true,
            sameSite: "none"
          }
        }
      },
      providers: [
        Credentials({
          id: "credentials-signin",
          name: "Credentials Sign in",
          credentials: {
            email: {
              label: "Email",
              type: "email"
            },
            password: {
              label: "Password",
              type: "password"
            }
          },
          authorize: async (credentials) => {
            const { email, password } = credentials;
            if (!email || !password) {
              return null;
            }
            if (typeof email !== "string" || typeof password !== "string") {
              return null;
            }
            const user = await adapter.getUserByEmail(email);
            if (!user) {
              return null;
            }
            const matchingAccount = user.accounts.find(
              (account) => account.provider === "credentials"
            );
            const accountPassword = matchingAccount?.password;
            if (!accountPassword) {
              return null;
            }
            const isValid = await verify(accountPassword, password);
            if (!isValid) {
              return null;
            }
            return user;
          }
        }),
        Credentials({
          id: "credentials-signup",
          name: "Credentials Sign up",
          credentials: {
            email: {
              label: "Email",
              type: "email"
            },
            password: {
              label: "Password",
              type: "password"
            },
            name: { label: "Name", type: "text" },
            image: { label: "Image", type: "text", required: false }
          },
          authorize: async (credentials) => {
            const { email, password, name, image } = credentials;
            if (!email || !password) {
              return null;
            }
            if (typeof email !== "string" || typeof password !== "string") {
              return null;
            }
            const user = await adapter.getUserByEmail(email);
            if (!user) {
              const newUser = await adapter.createUser({
                emailVerified: null,
                email,
                name: typeof name === "string" && name.length > 0 ? name : void 0,
                image: typeof image === "string" && image.length > 0 ? image : void 0
              });
              await adapter.linkAccount({
                extraData: {
                  password: await hash(password)
                },
                type: "credentials",
                userId: newUser.id,
                providerAccountId: newUser.id,
                provider: "credentials"
              });
              return newUser;
            }
            return null;
          }
        })
      ]
    }))
  );
}
app.all("/integrations/:path{.+}", async (c, next) => {
  const queryParams = c.req.query();
  const url = `${process.env.NEXT_PUBLIC_CREATE_BASE_URL ?? "https://www.create.xyz"}/integrations/${c.req.param("path")}${Object.keys(queryParams).length > 0 ? `?${new URLSearchParams(queryParams).toString()}` : ""}`;
  return proxy(url, {
    method: c.req.method,
    body: c.req.raw.body ?? null,
    // @ts-ignore - this key is accepted even if types not aware and is
    // required for streaming integrations
    duplex: "half",
    redirect: "manual",
    headers: {
      ...c.req.header(),
      "X-Forwarded-For": process.env.NEXT_PUBLIC_CREATE_HOST,
      "x-createxyz-host": process.env.NEXT_PUBLIC_CREATE_HOST,
      Host: process.env.NEXT_PUBLIC_CREATE_HOST,
      "x-createxyz-project-group-id": process.env.NEXT_PUBLIC_PROJECT_GROUP_ID
    }
  });
});
app.all(
  "/_create/api/upload",
  (c) => c.json(
    {
      error: "هذا المسار قديم ولم يعد مدعوماً. حدّث المتصفح (Ctrl+Shift+R) لتحميل النسخة الجديدة.",
      legacy: true
    },
    410
  )
);
app.all(
  "/_create/api/upload/",
  (c) => c.json(
    {
      error: "هذا المسار قديم ولم يعد مدعوماً. حدّث المتصفح (Ctrl+Shift+R) لتحميل النسخة الجديدة.",
      legacy: true
    },
    410
  )
);
app.use("/api/auth/*", async (c, next) => {
  if (isAuthAction(c.req.path)) {
    return authHandler()(c, next);
  }
  return next();
});
app.route(API_BASENAME, api);
const index = createHonoServer({
  app,
  defaultLogger: false,
  port: process.env.PORT ? parseInt(process.env.PORT) : 3e3
});

export { fetchWithHeaders as f, index as i };
