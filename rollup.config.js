const resolve = require('@rollup/plugin-node-resolve').default;
const commonjs = require('@rollup/plugin-commonjs').default;
const typescript = require('@rollup/plugin-typescript').default;
const terser = require('@rollup/plugin-terser').default;

module.exports = [
  // UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/parallel-file-uploader.js',
      format: 'umd',
      name: 'ParallelFileUploader',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      })
    ]
  },
  // Minified UMD build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/parallel-file-uploader.min.js',
      format: 'umd',
      name: 'ParallelFileUploader',
      sourcemap: true
    },
    plugins: [
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.json',
        declaration: false,
        declarationMap: false
      }),
      terser()
    ]
  },
  // ES module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'es',
      sourcemap: true
    },
    external: ['uuid', 'spark-md5'],
    plugins: [
      typescript({ tsconfig: './tsconfig.json' })
    ]
  }
];