import React, { useEffect, useRef } from 'react'

interface AudioVisualizerProps {
  audioStream: MediaStream | null
  isRecording: boolean
}

const AudioVisualizer: React.FC<AudioVisualizerProps> = ({
  audioStream,
  isRecording,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    if (!audioStream) return

    const AudioContextClass =
      window.AudioContext ||
      (
        window as Window &
          typeof globalThis & { webkitAudioContext?: typeof AudioContext }
      ).webkitAudioContext
    const audioContext = new AudioContextClass()
    const source = audioContext.createMediaStreamSource(audioStream)
    const analyser = audioContext.createAnalyser()

    analyser.fftSize = 1024
    analyser.smoothingTimeConstant = 0.6

    source.connect(analyser)
    analyserRef.current = analyser
    audioContextRef.current = audioContext

    const draw = () => {
      if (!analyserRef.current || !canvasRef.current) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const width = canvas.width
      const height = canvas.height

      const bufferLength = analyserRef.current.frequencyBinCount
      const dataArray = new Uint8Array(bufferLength)
      analyserRef.current.getByteTimeDomainData(dataArray)

      // 背景をクリア
      ctx.fillStyle = isRecording ? '#000000' : '#1A202C'
      ctx.fillRect(0, 0, width, height)

      // 波形を描画
      ctx.lineWidth = 2
      ctx.strokeStyle = isRecording ? '#E53E3E' : '#4299E1' // 録音中は赤、待機中は青
      ctx.beginPath()

      const sliceWidth = width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * height) / 2

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }

        x += sliceWidth
      }

      ctx.stroke()

      // 中央線を描画
      ctx.lineWidth = 1
      ctx.strokeStyle = '#4A5568'
      ctx.beginPath()
      ctx.moveTo(0, height / 2)
      ctx.lineTo(width, height / 2)
      ctx.stroke()

      // 録音中のインジケーター
      if (isRecording) {
        // REC表示
        ctx.fillStyle = '#E53E3E'
        ctx.font = '12px Arial'
        ctx.fillText('REC', 10, 20)

        // 録音中の点滅効果（グローエフェクト）
        const time = Date.now()
        const pulse = Math.sin(time * 0.003) * 0.3 + 0.7
        ctx.shadowColor = '#E53E3E'
        ctx.shadowBlur = pulse * 10
      }

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close()
      }
    }
  }, [audioStream, isRecording])

  return (
    <canvas
      ref={canvasRef}
      width={350}
      height={60}
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '6px',
        background: isRecording ? '#1A1A1A' : '#2D3748',
      }}
    />
  )
}

export default AudioVisualizer
