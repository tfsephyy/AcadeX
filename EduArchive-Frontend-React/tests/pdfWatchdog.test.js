import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

function setup() {
  let now = 0, index = 0, next = 0
  const slots = [], effects = [], timers = new Map()
  const same = (a, b) => a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i]))
  const memo = (fn, deps) => {
    const i = index++
    if (!slots[i] || !same(slots[i].deps, deps)) slots[i] = { deps, value: fn() }
    return slots[i].value
  }
  const hooks = {
    useState(initial) {
      const i = index++
      if (!(i in slots)) slots[i] = initial
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value }]
    },
    useRef: value => memo(() => ({ current: value }), []),
    useMemo: memo,
    useCallback: (fn, deps) => memo(() => fn, deps),
    useEffect(fn, deps) {
      const i = index++
      if (!slots[i] || !same(slots[i].deps, deps)) effects.push(() => {
        slots[i]?.cleanup?.()
        slots[i] = { deps, cleanup: fn() }
      })
    },
  }
  const setTimeout = (fn, delay) => { const id = ++next; timers.set(id, { at: now + delay, fn }); return id }
  const clearTimeout = id => timers.delete(id)
  const source = fs.readFileSync(new URL('../src/components/usePdfBlob.js', import.meta.url), 'utf8').split(/\r?\n/).filter(line => !line.trim().startsWith('import ')).join('\n').replace(/export /g, '')
  const invokePdfHook = new Function(...Object.keys(hooks), 'api', 'window', 'clearTimeout', 'Date', `${source}; return usePdfBlob`)(
    ...Object.values(hooks), { getUri: ({ url, params }) => url + (params ? '?pdf_retry=' + params.pdf_retry : '') }, { setTimeout }, clearTimeout, { now: () => now },
  )
  const render = () => { index = 0; const value = invokePdfHook('/pdf'); while (effects.length) effects.shift()(); return value }
  const tick = ms => { now += ms; for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn() } }
  return { render, tick, timers }
}
test('byte activity keeps the viewer alive even when rounded percentage does not change', () => {
  const f = setup(); let view = f.render()
  for (let i = 0; i < 5; i++) { f.tick(50000); view.file.onActivity(1); f.tick(1); view = f.render(); assert.equal(view.status, 'loading') }
  f.tick(60001); view = f.render(); assert.equal(view.status, 'error')
})
test('ready document never receives a later timeout and retry resets the request', () => {
  const f = setup(); let view = f.render()
  view.onLoadSuccess(); view = f.render()
  assert.equal(view.status, 'ready'); assert.equal(f.timers.size, 0)
  view.onLoadProgress({ loaded: 500, total: 1000 }); view = f.render()
  assert.equal(view.status, 'ready')
  f.tick(240000); assert.equal(f.render().status, 'ready')
  view.retry(); view = f.render(); assert.equal(view.status, 'loading'); assert.match(view.url, /pdf_retry=1/)
  f.tick(60001); view = f.render(); assert.equal(view.status, 'error')
  view = f.render(); assert.equal(f.timers.size, 0)
})
