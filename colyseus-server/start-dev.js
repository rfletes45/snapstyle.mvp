// Simple launcher that ensures cwd and ts-node are correct
process.chdir(__dirname);
require("ts-node").register();
require("./src/app.config.ts");
