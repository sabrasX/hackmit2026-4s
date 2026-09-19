let preferredVoice = null

function pickVoice() {
  if (preferredVoice) return preferredVoice
  const voices = speechSynthesis.getVoices()
  preferredVoice =
    voices.find((v) => v.lang.startsWith('en') && /female|samantha|zira|google us english/i.test(v.name)) ||
    voices.find((v) => v.lang.startsWith('en')) ||
    voices[0]
  return preferredVoice
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
  speechSynthesis.onvoiceschanged = () => {
    preferredVoice = null
    pickVoice()
  }
}

export function speak(text) {
  if (!text || typeof window === 'undefined' || !window.speechSynthesis) return

  speechSynthesis.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.8
  utterance.pitch = 1.1
  const voice = pickVoice()
  if (voice) utterance.voice = voice
  speechSynthesis.speak(utterance)
}
