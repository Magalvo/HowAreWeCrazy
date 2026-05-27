import { resolve } from "node:path";
import { createAppServer } from "../server/app-server.js";

const production = process.argv.includes("--production");
const root = resolve(process.cwd(), production ? "dist" : ".");
const port = Number(process.env.PORT || 4173);

createAppServer({ root }).listen(port, "0.0.0.0", () => {
  const role = production ? "production app" : "room API";
  console.log(`How Are We Crazy ${role} is running at http://localhost:${port}`);
});
