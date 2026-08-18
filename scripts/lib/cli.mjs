// The two lines of argument handling every script in here needs.

/** `--flag value` → { flag: 'value' }; a flag with no value → true. */
export function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i]
    if (!token.startsWith('--')) die(`unexpected argument "${token}" (see --help)`)
    const key = token.slice(2)
    const next = argv[i + 1]
    if (next === undefined || next.startsWith('--')) {
      args[key] = true
    } else {
      args[key] = next
      i++
    }
  }
  return args
}

export function die(message) {
  console.error(`✗ ${message}`)
  process.exit(1)
}
