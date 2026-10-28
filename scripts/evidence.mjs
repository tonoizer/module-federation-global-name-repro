// Keep machine-specific paths out of published browser diagnostics.
export function evidence(value) {
  return JSON.stringify(value, null, 2)
    .replaceAll(process.cwd().replaceAll('\\', '/'), '<workspace>')
    .replaceAll(JSON.stringify(process.cwd()).slice(1, -1), '<workspace>') + '\n'
}
