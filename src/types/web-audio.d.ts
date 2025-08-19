declare global {
  interface Window {
    webkitAudioContext: typeof AudioContext
  }
  
  interface MediaRecorderErrorEvent extends Event {
    error: DOMException
  }
}