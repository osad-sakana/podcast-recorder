import { useState, useRef, useCallback, useEffect } from 'react'

interface AudioRecorderReturn {
  audioStream: MediaStream | null
  mediaRecorder: MediaRecorder | null
  recordingData: Blob[]
  isInitialized: boolean
  error: Error | null
  analyser: AnalyserNode | null
  audioContext: AudioContext | null
  currentFilePath: string | null
  startRecording: () => Promise<void>
  stopRecording: () => void
  setInputGain: (gain: number) => void
  saveChunkData: () => void
  initializeAudio: () => Promise<void>
  selectSaveLocation: () => Promise<boolean>
}

const useAudioRecorder = (
  title: string = '',
  inputSource: string = '',
  deviceId: string = ''
): AudioRecorderReturn => {
  const [audioStream, setAudioStream] = useState<MediaStream | null>(null)
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null)
  const [recordingData, setRecordingData] = useState<Blob[]>([])
  const [isInitialized, setIsInitialized] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)
  const [currentFilePath, setCurrentFilePath] = useState<string | null>(null)

  // refの更新
  useEffect(() => {
    recordingDataRef.current = recordingData
  }, [recordingData])

  useEffect(() => {
    currentFilePathRef.current = currentFilePath
  }, [currentFilePath])

  const audioContextRef = useRef<AudioContext | null>(null)
  const gainNodeRef = useRef<GainNode | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const autoSaveIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const recordingDataRef = useRef<Blob[]>([])
  const currentFilePathRef = useRef<string | null>(null)

  // ファイル名生成関数
  const generateFileName = useCallback(
    (customTitle?: string, customInputSource?: string): string => {
      const now = new Date()
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const day = String(now.getDate()).padStart(2, '0')
      const hour = String(now.getHours()).padStart(2, '0')
      const minute = String(now.getMinutes()).padStart(2, '0')
      const second = String(now.getSeconds()).padStart(2, '0')

      const dateTime = `${year}${month}${day}_${hour}${minute}${second}`
      const titlePart = (customTitle || title).trim() || 'recording'
      const hostName = 'macOS' // 簡易的な端末名

      // ファイル名に使用できない文字を除去
      const sanitizedTitle = titlePart.replace(/[<>:"/\\|?*]/g, '_')

      return `${dateTime}_${sanitizedTitle}_${hostName}.wav`
    },
    [title]
  )

  // WebMからWAVへの変換関数
  const convertWebMToWav = useCallback(
    async (webmBlob: Blob): Promise<Blob> => {
      return new Promise((resolve, reject) => {
        const audioContext = new (window.AudioContext ||
          (window as any).webkitAudioContext)()
        const fileReader = new FileReader()

        fileReader.onload = async () => {
          try {
            const arrayBuffer = fileReader.result as ArrayBuffer
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)

            // WAVファイルを作成
            const wavBlob = audioBufferToWav(audioBuffer)
            resolve(wavBlob)
          } catch (error) {
            reject(error)
          }
        }

        fileReader.onerror = () => reject(fileReader.error)
        fileReader.readAsArrayBuffer(webmBlob)
      })
    },
    []
  )

  // AudioBufferをWAVファイルに変換
  const audioBufferToWav = useCallback((audioBuffer: AudioBuffer): Blob => {
    const numberOfChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const format = 1 // PCM
    const bitDepth = 16

    const bytesPerSample = bitDepth / 8
    const blockAlign = numberOfChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign
    const dataSize = audioBuffer.length * blockAlign
    const bufferSize = 44 + dataSize

    const buffer = new ArrayBuffer(bufferSize)
    const view = new DataView(buffer)

    // WAVヘッダーの書き込み
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
      }
    }

    // RIFF識別子
    writeString(0, 'RIFF')
    view.setUint32(4, bufferSize - 8, true)
    writeString(8, 'WAVE')
    writeString(12, 'fmt ')
    view.setUint32(16, 16, true) // フォーマットチャンクサイズ
    view.setUint16(20, format, true)
    view.setUint16(22, numberOfChannels, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, byteRate, true)
    view.setUint16(32, blockAlign, true)
    view.setUint16(34, bitDepth, true)
    writeString(36, 'data')
    view.setUint32(40, dataSize, true)

    // PCMデータの書き込み
    let offset = 44
    for (let i = 0; i < audioBuffer.length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = Math.max(
          -1,
          Math.min(1, audioBuffer.getChannelData(channel)[i])
        )
        view.setInt16(offset, sample * 0x7fff, true)
        offset += 2
      }
    }

    return new Blob([buffer], { type: 'audio/wav' })
  }, [])

  // マイクの初期化
  const initializeAudio = useCallback(async () => {
    try {
      setError(null)

      const audioConstraints: MediaTrackConstraints = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        sampleRate: 44100,
        channelCount: 1,
      }

      // デバイスIDが指定されている場合は使用
      if (deviceId && deviceId !== 'default') {
        audioConstraints.deviceId = { exact: deviceId }
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
      })

      // AudioContextの設定
      const AudioContextClass =
        window.AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContextClass({
        sampleRate: 44100,
      })

      const source = audioContext.createMediaStreamSource(stream)
      const gainNode = audioContext.createGain()
      const analyser = audioContext.createAnalyser()

      analyser.fftSize = 2048
      analyser.smoothingTimeConstant = 0.8

      source.connect(gainNode)
      gainNode.connect(analyser)

      // MediaRecorderの設定
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus',
        audioBitsPerSecond: 128000,
      })

      audioContextRef.current = audioContext
      gainNodeRef.current = gainNode
      analyserRef.current = analyser

      setAudioStream(stream)
      setMediaRecorder(recorder)
      setIsInitialized(true)
    } catch (err) {
      console.error('Audio initialization error:', err)
      setError(err instanceof Error ? err : new Error('Unknown error'))
    }
  }, [deviceId])

  // デフォルトの保存先を設定
  const setDefaultSavePath = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const defaultPath = await window.electronAPI.getDefaultSavePath(
          title,
          inputSource
        )
        setCurrentFilePath(defaultPath)
      } catch (err) {
        console.error('デフォルト保存先設定エラー:', err)
      }
    }
  }, [title, inputSource])

  // コンポーネント初期化時にオーディオを設定
  useEffect(() => {
    initializeAudio()
    setDefaultSavePath() // デフォルトの保存先を設定

    return () => {
      // クリーンアップ
      if (
        audioContextRef.current &&
        audioContextRef.current.state !== 'closed'
      ) {
        audioContextRef.current.close()
      }
      if (audioStream) {
        audioStream.getTracks().forEach(track => track.stop())
      }
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
      }
    }
  }, [initializeAudio, setDefaultSavePath])

  // デバイス変更時にオーディオを再初期化
  useEffect(() => {
    if (deviceId) {
      initializeAudio()
    }
  }, [deviceId, initializeAudio])

  // 保存先選択
  const selectSaveLocation = useCallback(async (): Promise<boolean> => {
    if (window.electronAPI) {
      const saveDialog = await window.electronAPI.showSaveDialog(
        title,
        inputSource
      )
      if (saveDialog.canceled) {
        return false
      }
      setCurrentFilePath(saveDialog.filePath || null)
      return true
    }
    return false
  }, [title, inputSource])

  // 録音開始
  const startRecording = useCallback(async () => {
    if (!mediaRecorder || mediaRecorder.state !== 'inactive') {
      throw new Error('MediaRecorder is not ready')
    }

    // 保存先が設定されていない場合はエラー
    if (!currentFilePath) {
      throw new Error(
        '保存先が設定されていません。先に保存先を選択してください。'
      )
    }

    setRecordingData([])
    setError(null)

    // データが利用可能になったときの処理
    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        setRecordingData(prev => [...prev, event.data])
      }
    }

    // 録音終了時の処理
    mediaRecorder.onstop = async () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
      }

      // 最新のrecordingDataを使用して保存
      const latestRecordingData = recordingDataRef.current
      const latestFilePath = currentFilePathRef.current

      if (latestRecordingData.length === 0) {
        console.log('保存するデータがありません')
        return
      }

      console.log(
        '保存開始 - データサイズ:',
        latestRecordingData.length,
        'ファイルパス:',
        latestFilePath
      )

      const webmBlob = new Blob(latestRecordingData, { type: 'audio/webm' })

      if (latestFilePath && window.electronAPI) {
        try {
          // WebMからWAVに変換
          console.log('WAV変換開始...')
          const wavBlob = await convertWebMToWav(webmBlob)
          console.log('WAV変換完了')

          // WAVファイルを保存
          const arrayBuffer = await wavBlob.arrayBuffer()
          const result = await window.electronAPI.writeFile(
            latestFilePath,
            arrayBuffer
          )

          if (result.success) {
            console.log('ファイル保存成功:', latestFilePath)
          } else {
            console.error('ファイル保存エラー:', result.error)
            setError(new Error(`ファイル保存エラー: ${result.error}`))
          }
        } catch (err) {
          console.error('ファイル保存エラー:', err)
          setError(
            err instanceof Error ? err : new Error('ファイル保存に失敗しました')
          )
        }
      } else {
        // フォールバック: WAVでブラウザダウンロード
        try {
          console.log('フォールバック保存でWAV変換開始...')
          const wavBlob = await convertWebMToWav(webmBlob)
          console.log('フォールバック保存でWAV変換完了')

          const url = URL.createObjectURL(wavBlob)
          const a = document.createElement('a')
          a.href = url
          a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.wav`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        } catch (err) {
          console.error('WAV変換エラー:', err)
          // 最終フォールバック: WebM形式
          console.log('最終フォールバック保存（WebM形式）')
          const url = URL.createObjectURL(webmBlob)
          const a = document.createElement('a')
          a.href = url
          a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        }
      }
    }

    // エラーハンドリング
    mediaRecorder.onerror = (event: Event) => {
      console.error('MediaRecorder error:', event)
      setError(new Error('MediaRecorder error'))
    }

    // 録音開始（1秒ごとにデータを取得）
    mediaRecorder.start(1000)

    // 5分ごとの自動保存を設定
    autoSaveIntervalRef.current = setInterval(
      () => {
        saveChunkData()
      },
      5 * 60 * 1000
    ) // 5分
  }, [mediaRecorder, currentFilePath])

  // 録音停止
  const stopRecording = useCallback(() => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop()
    }
    if (autoSaveIntervalRef.current) {
      clearInterval(autoSaveIntervalRef.current)
    }
  }, [mediaRecorder])

  // チャンクデータの保存（緊急時用）
  const saveChunkData = useCallback(async () => {
    if (recordingData.length > 0) {
      try {
        // WAV変換を試行
        const webmBlob = new Blob(recordingData, { type: 'audio/webm' })
        console.log('緊急保存でWAV変換開始...')
        const wavBlob = await convertWebMToWav(webmBlob)
        console.log('緊急保存でWAV変換完了')

        const url = URL.createObjectURL(wavBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `emergency-save-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.wav`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        console.log('緊急保存完了（WAV形式）')
      } catch (err) {
        console.error('緊急保存WAV変換エラー:', err)
        // フォールバック: WebM形式で保存
        const webmBlob = new Blob(recordingData, { type: 'audio/webm' })
        const url = URL.createObjectURL(webmBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `emergency-save-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
        console.log('緊急保存完了（WebM形式）')
      }
    }
  }, [recordingData, convertWebMToWav])

  // 入力ゲインの調整
  const setInputGain = useCallback((gain: number) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = gain
    }
  }, [])

  return {
    audioStream,
    mediaRecorder,
    recordingData,
    isInitialized,
    error,
    analyser: analyserRef.current,
    audioContext: audioContextRef.current,
    currentFilePath,
    startRecording,
    stopRecording,
    setInputGain,
    saveChunkData,
    initializeAudio,
    selectSaveLocation,
  }
}

export default useAudioRecorder
