const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');

// Check if this is in dev mode or not
const devMode = process.env.WEBPACK_ENV !== 'production';

module.exports = {
    mode: devMode ? 'development' : 'production',
    entry: `./web/ffxiv_main${devMode ? '_debug' : ''}.ts`,
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
                { loader: './build-plugins/plugins/timer-loader' },
                {
                    loader: './build-plugins/plugins/scrape-lodestone-loader',
                    options: {
                        // TODO: Is this a safe place to store the cache?
                        cacheFile: './build/timer-cache.json'
                    }
                }
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
        path: path.resolve(__dirname, 'build'),
        hashFunction: "sha256"
    }
};