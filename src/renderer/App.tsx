import React, { useState, useRef, useEffect } from 'react'
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
  Badge,
  Separator
} from '@chakra-ui/react'
import { FaMicrophone, FaStop, FaThumbtack, FaExclamationTriangle, FaFolder } from 'react-icons/fa'
import AudioVisualizer from '../components/AudioVisualizer'
import VolumeMeters from '../components/VolumeMeters'
import useAudioRecorder from '../hooks/useAudioRecorder'

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState<number>(0)
  const [inputGain, setInputGain] = useState<number>(1)
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(false)
  const [isClipping, setIsClipping] = useState<boolean>(false)

  const {
    startRecording,
    stopRecording,
    audioStream,
    recordingData,
    isInitialized,
    error,
    currentFilePath,
    setInputGain: setRecorderInputGain,
    emergencyStop,
    selectSaveLocation
  } = useAudioRecorder()

  // 録音時間の更新
  useEffect(() => {
    let interval: NodeJS.Timeout
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

  // 保存先選択
  const handleSelectSaveLocation = async () => {
    try {
      await selectSaveLocation()
    } catch (err) {
      console.error('保存先選択エラー:', err)
    }
  }

  // 時間のフォーマット
  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Box
      p={3}
      h="100vh"
      minH="750px"
      w="100vw"
      minW="400px"
      bg="gray.900"
      border={isRecording ? '2px solid' : 'none'}
      borderColor={isRecording ? 'red.500' : 'transparent'}
      transition="border-color 0.3s"
      overflow="hidden"
    >
      <VStack gap={3} h="full" overflow="hidden" justify="flex-start">
        {/* 上部セクション: ヘッダー */}
        <VStack gap={3} w="full">
          <HStack justify="space-between" w="full">
            <Text fontSize="lg" fontWeight="bold" color="white">
              Podcast Recorder
            </Text>
            <HStack gap={2}>
              {isRecording && (
                <Badge colorScheme="red" fontSize="xs" px={2}>
                  REC
                </Badge>
              )}
              <Button
                size="sm"
                onClick={handleAlwaysOnTopToggle}
                colorScheme={isAlwaysOnTop ? 'blue' : 'gray'}
                variant="ghost"
                title="常に最前面表示"
              >
                <FaThumbtack />
              </Button>
            </HStack>
          </HStack>
          <Separator />
        </VStack>

        {/* 中央セクション: 音声監視 */}
        <VStack gap={3} w="full" flex="1">
          <VolumeMeters 
            audioStream={audioStream} 
            onClipping={setIsClipping}
          />

          <Box w="full" h="50px" bg="gray.800" borderRadius="md">
            <AudioVisualizer audioStream={audioStream} isRecording={isRecording} />
          </Box>

          <VStack gap={1} w="full">
            <HStack justify="space-between" w="full">
              <Text fontSize="sm">入力ゲイン</Text>
              <Text fontSize="sm">{Math.round(inputGain * 100)}%</Text>
            </HStack>
            <input
              type="range"
              min={0.1}
              max={2}
              step={0.1}
              value={inputGain}
              onChange={(e) => {
                const value = parseFloat(e.target.value)
                setInputGain(value)
                setRecorderInputGain(value)
              }}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                background: '#4A5568',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </VStack>
        </VStack>

        {/* 下部セクション: 設定とコントロール */}
        <VStack gap={3} w="full">
          <Separator />
          
          <VStack gap={2} w="full">
            <HStack justify="space-between" w="full">
              <Text fontSize="sm" fontWeight="medium">
                保存先
              </Text>
              <Button
                size="sm"
                onClick={handleSelectSaveLocation}
                colorScheme="blue"
                variant="outline"
              >
                <FaFolder /> 選択
              </Button>
            </HStack>
            
            {currentFilePath ? (
              <Text 
                fontSize="xs" 
                color="gray.400" 
                w="full" 
                noOfLines={1}
                title={currentFilePath}
              >
                {currentFilePath.split('/').pop()}
              </Text>
            ) : (
              <Text fontSize="xs" color="red.400" w="full">
                保存先を選択してください
              </Text>
            )}
          </VStack>

          <Separator />

          <VStack gap={2} w="full">
          <Button
            size="lg"
            colorScheme={isRecording ? 'red' : 'green'}
            onClick={handleRecordToggle}
            disabled={!isInitialized || !!error || (!isRecording && !currentFilePath)}
            w="full"
          >
            {isRecording ? <><FaStop /> 録音停止</> : <><FaMicrophone /> 録音開始</>}
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
              w="full"
            >
              <FaExclamationTriangle /> 緊急停止
            </Button>
          )}

          {/* 録音時間とステータス */}
          <HStack justify="space-between" w="full" fontSize="sm" gap={2}>
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

          {/* データサイズ表示 */}
          {recordingData.length > 0 && (
            <Text fontSize="xs" color="gray.500">
              データサイズ: {Math.round(recordingData.reduce((total, chunk) => total + chunk.size, 0) / 1024)} KB
            </Text>
          )}
          </VStack>
        </VStack>
      </VStack>
    </Box>
  )
}

export default App