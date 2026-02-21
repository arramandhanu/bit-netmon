const nodeExternals = require('webpack-node-externals');
const path = require('path');

/**
 * Custom webpack config for NestJS in a monorepo.
 *
 * - Bundles @netmon/* workspace packages (shared source TS) directly
 * - Externalizes all other node_modules (fixes @nestjs/terminus optional deps)
 */
module.exports = function (options) {
    return {
        ...options,
        externals: [
            nodeExternals({
                modulesDir: path.resolve(__dirname, '../../node_modules'),
                allowlist: [/^@netmon\//],
            }),
            nodeExternals({
                modulesDir: path.resolve(__dirname, 'node_modules'),
                allowlist: [/^@netmon\//],
            }),
        ],
        module: {
            ...options.module,
            rules: [
                {
                    test: /\.ts$/,
                    loader: 'ts-loader',
                    options: {
                        transpileOnly: true,
                        configFile: path.resolve(__dirname, 'tsconfig.json'),
                    },
                    exclude: /node_modules\/(?!@netmon)/,
                },
            ],
        },
        resolve: {
            ...options.resolve,
            extensions: ['.ts', '.js', '.json'],
        },
    };
};
