import { run } from "./cli.js";
import { PreprodConfig } from "./config.js";

const config = new PreprodConfig();
await run(config);
