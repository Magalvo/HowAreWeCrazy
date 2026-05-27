import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";
import { createRoomStore } from "./room-store.js";

const types = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".webmanifest": "application/manifest+json; charset=utf-8"
};

function sendJson(response, statusCode, body) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(body));
}

async function readJson(request) {
  let body = "";
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 100_000) {
      throw new Error("Request is too large");
    }
  }
  return body ? JSON.parse(body) : {};
}

export function createAppServer({ root = resolve(process.cwd()), store = createRoomStore() } = {}) {
  return createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(url.pathname);
    const roomMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)$/i);
    const eventsMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/events$/i);
    const actionsMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/actions$/i);
    const joinMatch = pathname.match(/^\/api\/rooms\/([A-Z0-9]+)\/join$/i);

    try {
      if (request.method === "GET" && pathname === "/health") {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (request.method === "POST" && pathname === "/api/rooms") {
        sendJson(response, 201, store.createRoom(await readJson(request)));
        return;
      }

      if (request.method === "POST" && joinMatch) {
        sendJson(response, 200, store.joinRoom(joinMatch[1], (await readJson(request)).name));
        return;
      }

      if (request.method === "POST" && actionsMatch) {
        const payload = await readJson(request);
        const credential = payload.participantToken || payload.hostToken;
        sendJson(response, 200, store.act(actionsMatch[1], credential, payload.action, payload));
        return;
      }

      if (request.method === "GET" && roomMatch) {
        sendJson(response, 200, store.getRoom(roomMatch[1], url.searchParams.get("participantToken")));
        return;
      }

      if (request.method === "GET" && eventsMatch) {
        const participantToken = url.searchParams.get("participantToken");
        store.getRoom(eventsMatch[1], participantToken);
        response.writeHead(200, {
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
          "X-Accel-Buffering": "no"
        });
        const unsubscribe = store.subscribe(eventsMatch[1], participantToken, (room) => {
          response.write(`event: room\ndata: ${JSON.stringify(room)}\n\n`);
        });
        const heartbeat = setInterval(() => response.write(": keep-alive\n\n"), 25_000);
        heartbeat.unref?.();
        request.on("close", () => {
          clearInterval(heartbeat);
          unsubscribe();
        });
        return;
      }

      if (pathname.startsWith("/api/")) {
        sendJson(response, 404, { error: "Not found" });
        return;
      }
    } catch (error) {
      sendJson(response, error.statusCode || 400, { error: error.message });
      return;
    }

    const requestedPath = pathname === "/" ? "/index.html" : pathname;
    const relativePath = requestedPath.replace(/^[/\\]+/, "");
    const filePath = resolve(root, relativePath);
    const insideRoot = filePath === root || filePath.startsWith(`${root}${sep}`);

    if (!insideRoot || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }

    response.writeHead(200, { "Content-Type": types[extname(filePath)] || "application/octet-stream" });
    createReadStream(filePath).pipe(response);
  });
}
