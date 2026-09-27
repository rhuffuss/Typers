const { resolve } = require('node:path');
const nodeExternals = require('webpack-node-externals');
const { RunScriptWebpackPlugin } = require('run-script-webpack-plugin');

// The official module.hot recipe is an explicitly CommonJS-only workspace.
module.exports = (defaults, webpack) => ({
  ...defaults,
  entry: ['webpack/hot/poll?100', defaults.entry],
  externals: [nodeExternals({ allowlist: ['webpack/hot/poll?100'] })],
  output: { ...defaults.output, path: resolve(process.cwd(), 'dist-hmr') },
  resolve: {
    ...defaults.resolve,
    extensionAlias: { '.js': ['.ts', '.js'] },
  },
  plugins: [
    ...defaults.plugins,
    new webpack.HotModuleReplacementPlugin(),
    new webpack.WatchIgnorePlugin({ paths: [/\.js$/, /\.d\.ts$/] }),
    new RunScriptWebpackPlugin({
      name: defaults.output.filename,
      autoRestart: false,
    }),
  ],
});
