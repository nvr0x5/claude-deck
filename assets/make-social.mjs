// Builds assets/social-preview.svg (1280x640, GitHub's social card size) around the banner.
import { readFileSync, writeFileSync } from 'fs'
const banner = readFileSync(new URL('./banner.svg', import.meta.url), 'utf8').replace(/<svg[^>]*>/, '<svg x="0" y="120" width="1280" height="320" viewBox="0 0 1280 320">')
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="640" viewBox="0 0 1280 640"><style>.pk{opacity:1!important;animation:none!important}.walk{animation:none!important;transform:translateX(300px)}</style><rect width="1280" height="640" fill="#14121a"/>${banner}
<text x="640" y="540" text-anchor="middle" style="font:500 28px ui-sans-serif,system-ui,-apple-system,sans-serif;fill:#9a9893">CLI and Desktop · plan bars · usage limits · model routing · a tiny pet</text></svg>`
writeFileSync(new URL('./social-preview.svg', import.meta.url), svg)
