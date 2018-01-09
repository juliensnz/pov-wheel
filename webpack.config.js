const path = require('path');
const webpack = require('webpack');
const UglifyJSPlugin = require('uglifyjs-webpack-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
var HtmlWebpackInlineSourcePlugin = require('html-webpack-inline-source-plugin');

module.exports = function(env) {
  console.log(env);
  const config = {
    entry: './src/index.js',
    module: {
      rules: [
        {
          test: /\.js$/,
          use: {
            loader: 'babel-loader',
            options: {
              presets: ['babel-preset-env']
            }
          }
        },
        {
          test: /\.html$/,
          loader: 'html-loader'
        }
      ]
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'bundle.js'
    },
    plugins: [
      new HtmlWebpackPlugin({
        inject: 'head',
        template: 'src/index.html',
        minify: {},
        inlineSource: '.(js|css)$'
      })
    ]
  };

  if (env.dev) {
    config.devtool = 'source-map';
  }

  if (env.prod) {
    config.plugins = [new UglifyJSPlugin(), ...config.plugins, new HtmlWebpackInlineSourcePlugin()];
    config.output.path = path.resolve(__dirname, 'arduino/data'),
  }

  return config;
};
