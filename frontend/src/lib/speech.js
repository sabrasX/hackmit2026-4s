// TODO: speechSynthesis.cancel(), then speak the text at rate 0.8, pitch 1.1 with a friendly English voice
export function speak(text) {
  const synth = window.speechSynthesis
  synth.cancel() // Stop any currently playing speech

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 0.8 // Slightly slower, clearer for young learners
  utterance.pitch = 1.1 // Slightly higher pitch
  utterance.lang = 'en-US'

  synth.speak(utterance)
}
