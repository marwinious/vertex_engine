import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
    plugins: [
        
    ],
    build: {
        format: 'es',
        outDir: 'dist',
        lib: {
            entry: resolve(import.meta.dirname, 'main.js'),
            name: "Vertex",
            type: "module",
            filename: "vertex",
            formats: ['es'], // Ensure it is an ES module format
        },
        sourcemap: true,
        target: 'esnext',
        // minify: true,
        minify: 'terser', // Enable minification using Terser (default minifier)
        terserOptions: {
            format: {
                max_line_len: 0,      // Removes line breaks / collapses to a single line
                comments: false,       // Strips comments like //#region and /* @__PURE__ */
            },
            compress: {
                drop_console: true,    // Optional: removes console statements
                passes: 2,             // Extra compression pass
            },
        },
        rollupOptions: {
            output: {
                // You can further customize how the file is named
                // For example, if you want to ensure it's myModule.js:
                entryFileNames: 'vertex_engine.js', // Output filename
                chunkFileNames: '[name].js', // Name for any code-split chunks
                assetFileNames: '[name][extname]', // Asset filenames
                // Ensure that minification is applied
                /* plugins: [
                    // Use Terser plugin for minification
                    terser
                ], */
            }
        }
    }
})