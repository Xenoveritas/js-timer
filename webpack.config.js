const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require('mini-css-extract-plugin')

module.exports = {
    entry: './web/ffxiv_main.ts',
    devServer: {
        contentBase: './build'
    },
    plugins: [
        new MiniCssExtractPlugin(),
        new HtmlWebpackPlugin({
            filename: 'ffxiv_timer.html',
            template: 'web/ffxiv_timer.html'
        })
    ],
    module: {
      rules: [
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
        filename: 'main.js',
        path: path.resolve(__dirname, 'build')
    }
};