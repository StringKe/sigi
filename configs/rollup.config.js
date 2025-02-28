import { readdirSync, statSync } from 'fs'
import { join } from 'path'

import sourcemaps from 'rollup-plugin-sourcemaps'

const pkgs = readdirSync(join(__dirname, '..', 'packages')).filter(
  (dir) =>
    statSync(join(__dirname, '..', 'packages', dir)).isDirectory() &&
    !require(join(__dirname, '..', 'packages', dir, 'package.json')).private,
)

const external = [
  'rxjs',
  '@stringke/sigi-core',
  '@stringke/sigi-di',
  '@stringke/sigi-react',
  '@stringke/sigi-ssr',
  'rxjs/operators',
  'immer',
  'react',
  'tslib',
  'serialize-javascript',
  'through',
  'html-tokenize',
  'multipipe',
  'typescript',
]

export default pkgs.map((dir) => ({
  input: `./packages/${dir}/next/index.js`,
  external,
  plugins: [sourcemaps()],
  output: [
    {
      file: `./packages/${dir}/dist/index.js`,
      format: 'cjs',
      sourcemap: true,
    },
  ],
}))
