import lodestoneTool from "./lodestone-tool-cli.mjs";

// TODO: Parse arguments

try {
  await lodestoneTool("web/custom-timers.json", "web/public/timers.json", {
    lodestone: {
      cache: './lodestone-cache.json'
    }
  });
} catch (e) {
  console.error('Failed to run tool:');
  console.error(e);
}