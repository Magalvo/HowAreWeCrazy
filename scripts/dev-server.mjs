import { resolve } from "node:path";
import { createAppServer } from "../server/app-server.js";

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 4173);

createAppServer({ root }).listen(port, "0.0.0.0", () => {
  console.log(`Open Thread is running at http://localhost:${port}`);
});
