import('probe/message').then(m => {
  window.__LAB_RESULT__ = { ok: m.message === 'rspack-federated-ok', message: m.message }
}).catch(e => { window.__LAB_RESULT__ = { ok: false, error: String(e) } })