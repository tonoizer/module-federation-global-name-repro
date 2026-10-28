import('./bootstrap').catch(error => {
  document.getElementById('root').textContent = String(error)
  window.__RSBUILD_ERROR__ = String(error)
})
