import {defineConfig} from 'vite';
import path from 'node:path';

export default defineConfig({
  build: {rollupOptions: {input: {game: path.resolve('index.html')}}},
});
