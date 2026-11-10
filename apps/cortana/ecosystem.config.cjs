// PM2: `pm2 start ecosystem.config.cjs` from apps/cortana.
// No `watch` — the bot must not restart every time a file changes.
// Exit code 0 = "shut down" (stays stopped). Anything else = restart.
module.exports = {
  apps: [
    {
      name: "Cortana_V2",
      // Finds tsx whether npm put it in apps/cortana/node_modules or the repo root (workspaces).
      script: require.resolve("tsx/cli", { paths: [__dirname] }),
      args: "--env-file=.env.local src/index.ts",
      cwd: __dirname,
      autorestart: true,
      stop_exit_codes: [0],
      max_restarts: 20,
      restart_delay: 5000,
      time: true,
    },
  ],
};
