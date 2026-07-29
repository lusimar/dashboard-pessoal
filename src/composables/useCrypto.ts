/**
 * Criptografia AES-GCM no cliente para campos sensíveis (ex.: senha da conta do projeto).
 * A chave é derivada do userId — o dado fica ilegível no banco sem a sessão do usuário.
 */

const APP_SALT = 'management-os-v1'
const ITERATIONS = 100_000
const PREFIX = 'enc:v1:'

function toBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let binary = ''
  for (const b of arr) binary += String.fromCharCode(b)
  return btoa(binary)
}

function fromBase64(value: string): Uint8Array<ArrayBuffer> {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function deriveKey(userId: string): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const material = await crypto.subtle.importKey('raw', enc.encode(userId), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode(APP_SALT),
      iterations: ITERATIONS,
      hash: 'SHA-256',
    },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptSecret(plain: string, userId: string): Promise<string> {
  if (!plain) return ''
  const key = await deriveKey(userId)
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain))
  return `${PREFIX}${toBase64(iv.buffer)}:${toBase64(cipher)}`
}

export async function decryptSecret(stored: string, userId: string): Promise<string> {
  if (!stored) return ''
  if (!stored.startsWith(PREFIX)) return stored
  try {
    const payload = stored.slice(PREFIX.length)
    const sep = payload.indexOf(':')
    if (sep < 0) return stored
    const iv = fromBase64(payload.slice(0, sep))
    const data = fromBase64(payload.slice(sep + 1))
    const key = await deriveKey(userId)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    return new TextDecoder().decode(plain)
  } catch {
    return ''
  }
}
