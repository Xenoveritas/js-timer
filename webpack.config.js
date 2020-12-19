const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// Check if this is in dev mode or not
const devMode = process.env.NODE_ENV !== 'production';

module.exports = {
    entry: './web/ffxiv_main.ts',
    devServer: {
        contentBase: './build'
    },
    devtool: devMode ? 'inline-source-map' : false,
    plugins: [
        new MiniCssExtractPlugin({
            filename: devMode ? '[name].css' : '[name].[contenthash].css'
        }),
        new HtmlWebpackPlugin({
            filename: 'ffxiv_timer.html',
            template: 'web/ffxiv_timer.html'
        })
    ],
    module: {
      rules: [
        {
            test: /timers.json$/,
            use: [
                './build-plugins/plugins/timer-loader',
                './build-plugins/plugins/scrape-lodestone-loader'
            ],
            type: 'asset/resource',
            generator: {
                filename: '[name][ext]'
            }
        },
        {
            test: /\.ts$/,
            use: 'ts-loader',
            exclude: /node_modules/,
        },
        {
            test: /\.s[ac]ss$/i,
            use: [
                // Extract to a CSS file
                MiniCssExtractPlugin.loader,
                // Translates CSS into CommonJS
                "css-loader",
                // Compiles Sass to CSS
                "sass-loader",
            ],
          },
      ],
    },
    resolve: {
      extensions: [ '.ts', '.js' ],
    },
    output: {
        filename: devMode ? '[name].js' : '[name].[hash].js',
        path: path.resolve(__dirname, 'build')
    }
};