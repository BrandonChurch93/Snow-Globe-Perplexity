// node out/work/p6s/serve.mjs <tree> <port>: that tree's dist served by its own static server, until killed.
const [, , tree, port] = process.argv
const { serve } = await import(`${tree}/tools/lib/server.mjs`)
const s = await serve({ dist: `${tree}/dist`, port: Number(port) })
console.log(s.url)
setInterval(() => {}, 1 << 30)
