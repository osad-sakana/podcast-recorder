import React, { useState, useRef, useEffect } from 'react'
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
  Progress,
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
  IconButton,
  Badge,
  Divider,
  Flex,
} from '@chakra-ui/react'
import { FaMicrophone, FaStop, FaThumbTack, FaThumbtack, FaExclamationTriangle } from 'react-icons/fa'
import AudioVisualizer from '../components/AudioVisualizer'
import VolumeMeters from '../components/VolumeMeters'
import useAudioRecorder from '../hooks/useAudioRecorder'

const App = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [inputGain, setInputGain] = useState(1)
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)
  const [audioLevel, setAudioLevel] = useState(0)
  const [isClipping, setIsClipping] = useState(false)

  const {
    startRecording,
    stopRecording,
    audioStream,
    mediaRecorder,
    recordingData,
    isInitialized,
    error,
    setInputGain: setRecorderInputGain,
    emergencyStop
  } = useAudioRecorder()

  // 録音時間の更新
  useEffect(() => {
    let interval
    if (isRecording) {
      interval = setInterval(() => {
        setRecordingTime(prev => prev + 1)
      }, 1000)
    } else {
      setRecordingTime(0)
    }
    return () => clearInterval(interval)
  }, [isRecording])

  // 録音の開始/停止
  const handleRecordToggle = async () => {
    if (!isRecording) {
      try {
        await startRecording()
        setIsRecording(true)
      } catch (err) {
        console.error('録音開始エラー:', err)
      }
    } else {
      stopRecording()
      setIsRecording(false)
    }
  }

  // 常に最前面表示の切り替え
  const handleAlwaysOnTopToggle = async () => {
    if (window.electronAPI) {
      const newState = await window.electronAPI.toggleAlwaysOnTop()
      setIsAlwaysOnTop(newState)
    }
  }

  // 時間のフォーマット
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Box
      p={3}
      h="100vh"
      bg="gray.900"
      border={isRecording ? '2px solid' : 'none'}
      borderColor={isRecording ? 'red.500' : 'transparent'}
      transition="border-color 0.3s"
    >
      <VStack spacing={3} h="full">
        {/* ヘッダー */}
        <HStack justify="space-between" w="full">
          <Text fontSize="lg" fontWeight="bold" color="white">
            Podcast Recorder
          </Text>
          <HStack>
            {isRecording && (
              <Badge colorScheme="red" fontSize="xs" px={2}>
                REC
              </Badge>
            )}
            <IconButton
              size="sm"
              icon={isAlwaysOnTop ? <FaThumbtack /> : <FaThumbTack />}
              onClick={handleAlwaysOnTopToggle}
              colorScheme={isAlwaysOnTop ? 'blue' : 'gray'}
              variant="ghost"
              title="常に最前面表示"
            />
          </HStack>
        </HStack>

        <Divider />

        {/* 音量メーター */}
        <VolumeMeters 
          audioStream={audioStream} 
          onLevelUpdate={setAudioLevel}
          onClipping={setIsClipping}
        />

        {/* 波形表示 */}
        <Box w="full" h="60px" bg="gray.800" borderRadius="md">
          <AudioVisualizer audioStream={audioStream} isRecording={isRecording} />
        </Box>

        {/* 入力ゲイン調整 */}
        <VStack spacing={1} w="full">
          <HStack justify="space-between" w="full">
            <Text fontSize="sm">入力ゲイン</Text>
            <Text fontSize="sm">{Math.round(inputGain * 100)}%</Text>
          </HStack>
          <Slider
            value={inputGain}
            onChange={(value) => {
              setInputGain(value)
              setRecorderInputGain(value)
            }}
            min={0.1}
            max={2}
            step={0.1}
            colorScheme="blue"
          >
            <SliderTrack bg="gray.700">
              <SliderFilledTrack />
            </SliderTrack>
            <SliderThumb />
          </Slider>
        </VStack>

        <Divider />

        {/* 録音コントロール */}
        <VStack spacing={2} w="full">
          <Button
            size="lg"
            colorScheme={isRecording ? 'red' : 'green'}
            onClick={handleRecordToggle}
            leftIcon={isRecording ? <FaStop /> : <FaMicrophone />}
            isDisabled={!isInitialized || !!error}
            w="full"
          >
            {isRecording ? '録音停止' : '録音開始'}
          </Button>
          
          {/* 緊急停止ボタン */}
          {isRecording && (
            <Button
              size="sm"
              colorScheme="orange"
              variant="outline"
              onClick={() => {
                emergencyStop()
                setIsRecording(false)
              }}
              leftIcon={<FaExclamationTriangle />}
              w="full"
            >
              緊急停止
            </Button>
          )}

          {/* 録音時間とステータス */}
          <HStack justify="space-between" w="full" fontSize="sm">
            <Text color={isRecording ? 'red.400' : 'gray.400'}>
              {isRecording ? '録音中' : '待機中'}
            </Text>
            <Text fontFamily="mono">
              {formatTime(recordingTime)}
            </Text>
          </HStack>

          {/* クリッピング警告 */}
          {isClipping && (
            <Text color="red.400" fontSize="sm" fontWeight="bold">
              ⚠ クリッピング検出
            </Text>
          )}

          {/* エラー表示 */}
          {error && (
            <Text color="red.400" fontSize="sm">
              エラー: {error.message}
            </Text>
          )}
        </VStack>

        {/* データサイズ表示 */}
        {recordingData.length > 0 && (
          <Text fontSize="xs" color="gray.500">
            データサイズ: {Math.round(recordingData.reduce((total, chunk) => total + chunk.size, 0) / 1024)} KB
          </Text>
        )}
      </VStack>
    </Box>
  )
}

export default App