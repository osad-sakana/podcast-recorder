import React, { useState, useEffect } from 'react'

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface Timeout {}
  }
}
import {
  Box,
  VStack,
  HStack,
  Button,
  Text,
  Badge,
  Separator,
  Input,
} from '@chakra-ui/react'
import { FaMicrophone, FaStop, FaThumbtack, FaFolder } from 'react-icons/fa'
import AudioVisualizer from '../components/AudioVisualizer'
import VolumeMeters from '../components/VolumeMeters'
import useAudioRecorder from '../hooks/useAudioRecorder'

const App: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState<number>(0)
  const [inputGain, setInputGain] = useState<number>(1)
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState<boolean>(false)
  const [isClipping, setIsClipping] = useState<boolean>(false)
  const [title, setTitle] = useState<string>('')
  const [inputSource, setInputSource] = useState<string>('')
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('')
  const [isAppLoading, setIsAppLoading] = useState<boolean>(true)

  const {
    startRecording,
    stopRecording,
    audioStream,
    recordingData,
    isInitialized,
    error,
    currentFilePath,
    setInputGain: setRecorderInputGain,
    selectSaveLocation,
  } = useAudioRecorder(title, inputSource, selectedDeviceId)

  // オーディオデバイス一覧を取得
  useEffect(() => {
    const getAudioDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const audioInputs = devices.filter(
          device => device.kind === 'audioinput'
        )
        setAudioDevices(audioInputs)

        // デフォルトデバイスを設定
        const defaultDevice =
          audioInputs.find(device => device.deviceId === 'default') ||
          audioInputs[0]
        if (defaultDevice) {
          setSelectedDeviceId(defaultDevice.deviceId)
          setInputSource(defaultDevice.label || 'マイク')
        }
      } catch (err) {
        console.error('デバイス一覧取得エラー:', err)
      }
    }

    getAudioDevices()
  }, [])

  // アプリの初期化が完了したらローディング状態を解除
  useEffect(() => {
    const initializationTimer = setTimeout(() => {
      setIsAppLoading(false)
    }, 1500) // オーディオ初期化を待つ

    return () => clearTimeout(initializationTimer)
  }, [isInitialized, audioDevices])

  // デバイス選択時の処理
  const handleDeviceChange = (deviceId: string) => {
    setSelectedDeviceId(deviceId)
    const selectedDevice = audioDevices.find(
      device => device.deviceId === deviceId
    )
    if (selectedDevice) {
      setInputSource(selectedDevice.label || 'マイク')
    }
  }

  // 録音時間の更新
  useEffect(() => {
    // eslint-disable-next-line no-undef
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

  // ローディング画面コンポーネント
  const LoadingOverlay = () => (
    <Box
      position="fixed"
      top={0}
      left={0}
      right={0}
      bottom={0}
      bg="linear-gradient(135deg, #1a1a1a 0%, #2d3748 100%)"
      color="white"
      display="flex"
      flexDirection="column"
      alignItems="center"
      justifyContent="center"
      zIndex={9999}
      opacity={isAppLoading ? 1 : 0}
      visibility={isAppLoading ? 'visible' : 'hidden'}
      transition="all 0.5s ease-in-out"
    >
      <Box
        w="80px"
        h="80px"
        bg="linear-gradient(45deg, #4299E1, #E53E3E)"
        borderRadius="20px"
        display="flex"
        alignItems="center"
        justifyContent="center"
        mb={6}
        animation={`
          @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.05); opacity: 0.8; }
          }
        `}
      >
        <Text fontSize="36px" role="img" aria-label="microphone">
          🎙️
        </Text>
      </Box>
      
      <Text fontSize="24px" fontWeight="600" mb={2}>
        Podcast Recorder
      </Text>
      
      <Text fontSize="14px" opacity={0.7} mb={8}>
        音声録音アプリケーション
      </Text>
      
      <Box
        w="200px"
        h="3px"
        bg="rgba(255, 255, 255, 0.1)"
        borderRadius="2px"
        overflow="hidden"
        mb={5}
      >
        <Box
          h="100%"
          bg="linear-gradient(90deg, #4299E1, #E53E3E)"
          borderRadius="2px"
          animation="loading 2s ease-in-out infinite"
          css={`
            @keyframes loading {
              0% { width: 0%; }
              50% { width: 60%; }
              100% { width: 100%; }
            }
          `}
        />
      </Box>
      
      <Box
        w="40px"
        h="40px"
        border="3px solid rgba(255, 255, 255, 0.1)"
        borderTop="3px solid #4299E1"
        borderRadius="50%"
        animation="spin 1s linear infinite"
        css={`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      />
      
      <Text mt={4} fontSize="14px" opacity={0.8}>
        初期化中...
      </Text>
    </Box>
  )

  return (
    <>
      <LoadingOverlay />
      <Box
        p={3}
        h="100vh"
        minH="750px"
        w="100vw"
        minW="400px"
        bg="black"
        color="gray.100"
        border={isRecording ? '4px solid' : '2px solid'}
        borderColor={isRecording ? 'red.500' : 'gray.700'}
        boxShadow={isRecording ? '0 0 20px rgba(239, 68, 68, 0.6)' : 'none'}
        transition="all 0.3s ease"
        overflow="hidden"
        opacity={isAppLoading ? 0.3 : 1}
        filter={isAppLoading ? 'blur(2px)' : 'none'}
      >
      <VStack gap={3} h="full" overflow="hidden" justify="flex-start">
        {/* 上部セクション: ヘッダー */}
        <VStack gap={3} w="full">
          <HStack justify="space-between" w="full">
            <Text fontSize="lg" fontWeight="bold" color="gray.100">
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
          <VolumeMeters audioStream={audioStream} onClipping={setIsClipping} />

          <Box
            w="full"
            h="50px"
            bg="gray.900"
            borderRadius="md"
            border="1px solid"
            borderColor="gray.700"
          >
            <AudioVisualizer
              audioStream={audioStream}
              isRecording={isRecording}
            />
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
              onChange={e => {
                const value = parseFloat(e.target.value)
                setInputGain(value)
                setRecorderInputGain(value)
              }}
              style={{
                width: '100%',
                height: '8px',
                borderRadius: '4px',
                background: '#2D3748',
                outline: 'none',
                cursor: 'pointer',
                WebkitAppearance: 'none',
                MozAppearance: 'none',
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
                color="blue.300"
                _hover={{ color: 'blue.200' }}
              >
                <>
                  <FaFolder style={{ marginRight: '8px' }} />
                  選択
                </>
              </Button>
            </HStack>

            {currentFilePath ? (
              <Text
                fontSize="xs"
                color="gray.400"
                w="full"
                truncate
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

          <VStack gap={3} w="full">
            <VStack gap={2} w="full">
              <HStack justify="space-between" w="full">
                <Text fontSize="sm" fontWeight="medium">
                  タイトル
                </Text>
              </HStack>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="録音のタイトルを入力"
                size="sm"
                bg="gray.800"
                border="1px solid"
                borderColor="gray.600"
                color="gray.100"
                _placeholder={{ color: 'gray.400' }}
                _focus={{
                  borderColor: 'blue.400',
                  boxShadow: '0 0 0 1px #3182CE',
                }}
              />
            </VStack>

            <VStack gap={2} w="full">
              <HStack justify="space-between" w="full">
                <Text fontSize="sm" fontWeight="medium">
                  入力ソース
                </Text>
              </HStack>
              <select
                value={selectedDeviceId}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                  handleDeviceChange(e.target.value)
                }
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  fontSize: '14px',
                  backgroundColor: '#2D3748',
                  border: '1px solid #4A5568',
                  borderRadius: '6px',
                  color: '#F7FAFC',
                  outline: 'none',
                }}
              >
                {audioDevices.length === 0 ? (
                  <option value="">デバイスを読み込み中...</option>
                ) : (
                  audioDevices.map(device => (
                    <option key={device.deviceId} value={device.deviceId}>
                      {device.label || `マイク ${device.deviceId.slice(0, 8)}`}
                    </option>
                  ))
                )}
              </select>
            </VStack>
          </VStack>

          <Separator />

          <VStack gap={2} w="full">
            <Button
              size="lg"
              colorScheme={isRecording ? 'red' : 'green'}
              onClick={handleRecordToggle}
              disabled={
                !isInitialized || !!error || (!isRecording && !currentFilePath)
              }
              w="full"
            >
              {isRecording ? (
                <>
                  <FaStop style={{ marginRight: '8px' }} />
                  録音停止
                </>
              ) : (
                <>
                  <FaMicrophone style={{ marginRight: '8px' }} />
                  録音開始
                </>
              )}
            </Button>

            {/* 録音時間とステータス */}
            <HStack justify="space-between" w="full" fontSize="sm" gap={2}>
              <Text color={isRecording ? 'red.400' : 'gray.400'}>
                {isRecording ? '録音中' : '待機中'}
              </Text>
              <Text fontFamily="mono">{formatTime(recordingTime)}</Text>
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
                データサイズ:{' '}
                {Math.round(
                  recordingData.reduce(
                    (total, chunk) => total + chunk.size,
                    0
                  ) / 1024
                )}{' '}
                KB
              </Text>
            )}
          </VStack>
        </VStack>
      </VStack>
      </Box>
    </>
  )
}

export default App
