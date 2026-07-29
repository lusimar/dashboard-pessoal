import { computed, onMounted, onUnmounted, ref } from 'vue'

const LOCAL_QUOTES = [
  'A única maneira de fazer um ótimo trabalho é amar o que você faz.',
  'Código limpo sempre parece que foi escrito por alguém que se importa.',
  'Primeiro resolva o problema. Depois escreva o código.',
  'A disciplina é a ponte entre metas e conquistas.',
  'Pequenos progressos diários levam a grandes resultados.',
  'Foque no progresso, não na perfeição.',
  'Simplicidade é a sofisticação máxima.',
]

function weatherIcon(code: number): string {
  if (code === 0) return '☀️'
  if (code <= 3) return '⛅'
  if (code <= 48) return '🌫️'
  if (code <= 67) return '🌧️'
  if (code <= 77) return '❄️'
  if (code <= 82) return '🌧️'
  if (code >= 95) return '⛈️'
  return '⛅'
}

export function useDashboardContext(displayName: () => string) {
  const now = ref(new Date())
  const weatherTemp = ref<number | null>(null)
  const weatherCode = ref(0)
  const quote = ref('')

  let clockTimer: ReturnType<typeof setInterval> | null = null

  const greeting = computed(() => {
    const h = now.value.getHours()
    const name = displayName()
    if (h < 12) return `Bom dia, ${name}!`
    if (h < 18) return `Boa tarde, ${name}!`
    return `Boa noite, ${name}!`
  })

  const clockText = computed(() =>
    now.value.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }),
  )

  const dateText = computed(() => {
    const raw = now.value.toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    })
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  })

  const weatherText = computed(() => {
    if (weatherTemp.value === null) return 'São Paulo —'
    return `${weatherIcon(weatherCode.value)} São Paulo ${Math.round(weatherTemp.value)}°C`
  })

  async function fetchWeather() {
    try {
      const res = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=-23.5505&longitude=-46.6333&current_weather=true',
      )
      if (!res.ok) return
      const data = await res.json()
      weatherTemp.value = data.current_weather?.temperature ?? null
      weatherCode.value = data.current_weather?.weathercode ?? 0
    } catch {
      weatherTemp.value = null
    }
  }

  async function fetchQuote() {
    try {
      const res = await fetch('https://api.adviceslip.com/advice', { cache: 'no-store' })
      if (res.ok) {
        const data = await res.json()
        if (data?.slip?.advice) {
          quote.value = data.slip.advice
          return
        }
      }
    } catch {
      /* fallback local */
    }
    quote.value = LOCAL_QUOTES[Math.floor(Math.random() * LOCAL_QUOTES.length)]
  }

  onMounted(() => {
    clockTimer = setInterval(() => {
      now.value = new Date()
    }, 1000)
    void fetchWeather()
    void fetchQuote()
  })

  onUnmounted(() => {
    if (clockTimer) clearInterval(clockTimer)
  })

  return { greeting, clockText, dateText, weatherText, quote }
}
