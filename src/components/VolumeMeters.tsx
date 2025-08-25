import React, { useEffect, useRef, useState } from 'react'
import { Box, HStack, Text, VStack } from '@chakra-ui/react'

interface VolumeMetersProps {
  audioStream: MediaStream | null
  onLevelUpdate?: (level: number) => void
  onClipping?: (isClipping: boolean) => void
}

const VolumeMeters: React.FC<VolumeMetersProps> = ({
  audioStream,
  onLevelUpdate,
  onClipping,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animationRef = useRef<number | null>(null)
  const [currentLevel, setCurrentLevel] = useState<number>(0)
  const [peakLevel, setPeakLevel] = useState<number>(0)
  const [isClipping, setIsClipping] = useState<boolean>(false)

  useEffect(() => {
    if (!audioStream) return

    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext
    const audioContext = new AudioContextClass()
    const source = audioContext.createMediaStreamSource(audioStream)
    const analyser = audioContext.createAnalyser()

    analyser.fftSize = 256
    analyser.smoothingTimeConstant = 0.3

    source.connect(analyser)
    analyserRef.current = analyser

    const draw = () => {
      if (!analyserRef.current || !canvasRef.current) return

      const canvas = canvasRef.current
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const width = canvas.width
      const height = canvas.height

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(dataArray)

      // 平均音量レベルの計算
      const sum = dataArray.reduce((acc, val) => acc + val, 0)
      const average = sum / dataArray.length
      const normalizedLevel = average / 255

      // dB変換 (-60dB to 0dB range)
      const dBLevel =
        normalizedLevel > 0 ? 20 * Math.log10(normalizedLevel) : -60
      const displayLevel = Math.max(-60, Math.min(0, dBLevel))

      setCurrentLevel(displayLevel)
      if (onLevelUpdate) onLevelUpdate(displayLevel)

      // ピークレベルの更新
      if (displayLevel > peakLevel) {
        setPeakLevel(displayLevel)
        setTimeout(() => setPeakLevel(prev => prev * 0.95), 100)
      }

      // クリッピング検出 (-3dB以上でクリッピング)
      const clipping = displayLevel > -3
      setIsClipping(clipping)
      if (onClipping) onClipping(clipping)

      // キャンバスのクリア
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, width, height)

      // メーターの描画
      const meterWidth = width - 40
      const meterHeight = 20
      const meterX = 20
      const meterY = (height - meterHeight) / 2

      // 背景の描画
      ctx.fillStyle = '#1A202C'
      ctx.fillRect(meterX, meterY, meterWidth, meterHeight)

      // レベルバーの描画
      const levelWidth = ((displayLevel + 60) / 60) * meterWidth

      // グラデーション作成
      const gradient = ctx.createLinearGradient(
        meterX,
        0,
        meterX + meterWidth,
        0
      )
      gradient.addColorStop(0, '#38A169') // 緑
      gradient.addColorStop(0.7, '#D69E2E') // 黄色
      gradient.addColorStop(0.9, '#E53E3E') // 赤

      ctx.fillStyle = clipping ? '#E53E3E' : gradient
      ctx.fillRect(meterX, meterY, Math.max(0, levelWidth), meterHeight)

      // ピークマーカーの描画
      if (peakLevel > -60) {
        const peakX = meterX + ((peakLevel + 60) / 60) * meterWidth
        ctx.fillStyle = '#F7FAFC'
        ctx.fillRect(peakX - 1, meterY, 2, meterHeight)
      }

      // スケールの描画
      ctx.fillStyle = '#A0AEC0'
      ctx.font = '10px monospace'
      ctx.textAlign = 'center'

      // dBスケール
      const scalePoints = [-60, -40, -20, -10, -6, -3, 0]
      scalePoints.forEach(dB => {
        const x = meterX + ((dB + 60) / 60) * meterWidth
        ctx.fillText(dB.toString(), x, meterY + meterHeight + 15)

        // スケールライン
        ctx.fillStyle = '#4A5568'
        ctx.fillRect(x, meterY - 5, 1, 5)
        ctx.fillStyle = '#A0AEC0'
      })

      animationRef.current = requestAnimationFrame(draw)
    }

    draw()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      if (audioContext.state !== 'closed') {
        audioContext.close()
      }
    }
  }, [audioStream, peakLevel, onLevelUpdate, onClipping])

  return (
    <VStack gap={2} w="full">
      <HStack justify="space-between" w="full">
        <Text fontSize="sm" fontWeight="medium">
          音量レベル
        </Text>
        <HStack gap={4} fontSize="xs" fontFamily="mono">
          <Text color={isClipping ? 'red.400' : 'green.400'}>
            {currentLevel.toFixed(1)}dB
          </Text>
          <Text color="gray.400">Peak: {peakLevel.toFixed(1)}dB</Text>
        </HStack>
      </HStack>

      <Box
        w="full"
        h="50px"
        bg="gray.800"
        borderRadius="md"
        position="relative"
      >
        <canvas
          ref={canvasRef}
          width={350}
          height={50}
          style={{ width: '100%', height: '100%' }}
        />
        {isClipping && (
          <Box
            position="absolute"
            top={0}
            right={0}
            bg="red.500"
            color="white"
            px={2}
            py={1}
            fontSize="xs"
            fontWeight="bold"
            borderRadius="md"
            m={1}
          >
            CLIP
          </Box>
        )}
      </Box>
    </VStack>
  )
}

export default VolumeMeters
