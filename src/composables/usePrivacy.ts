import { ref } from 'vue'

const STORAGE_KEY = 'control-desk-hide-values'

function readInitial(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

/** Estado compartilhado: valores monetários ocultos em todo o app */
export const valuesHidden = ref(readInitial())

export function usePrivacy() {
  function toggleValuesHidden() {
    valuesHidden.value = !valuesHidden.value
    try {
      localStorage.setItem(STORAGE_KEY, valuesHidden.value ? '1' : '0')
    } catch {
      /* storage indisponível */
    }
  }

  return { valuesHidden, toggleValuesHidden }
}
