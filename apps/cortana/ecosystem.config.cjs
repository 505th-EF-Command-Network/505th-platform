// PM2: `pm2 start ecosystem.config.cjs` from apps/cortana.
// No `watch` — the bot must not restart every time a file changes.
// Exit code 0 = "shut down" (stays stopped). Anything else = restart.
module.exports = {
  apps: [
    {
      name: "Cortana_V2",
      // Runs node directly with tsx loaded inside it (no extra child process), so Windows doesn't
      // open empty "node.exe" console windows. windowsHide hides PM2's own window too.
      script: "src/index.ts",
      interpreter: "node",
      node_args: "--import tsx --env-file=.env.local",
      windowsHide: true,
      cwd: __dirname,
      autorestart: true,
      stop_exit_codes: [0],
      max_restarts: 20,
      restart_delay: 5000,
      time: true,
    },
  ],
};
