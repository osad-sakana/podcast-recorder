import { useState, useRef, useCallback, useEffect } from 'react'
import { Mp3Encoder } from 'lamejs'

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

const useAudioRecorder = (): AudioRecorderReturn => {
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

  // WebMからMP3への変換関数
  const convertWebMToMp3 = useCallback(async (webmBlob: Blob): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const fileReader = new FileReader()
      
      fileReader.onload = async () => {
        try {
          const arrayBuffer = fileReader.result as ArrayBuffer
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer)
          
          const mp3Encoder = new Mp3Encoder(1, audioBuffer.sampleRate, 128)
          const samples = audioBuffer.getChannelData(0)
          
          // Float32ArrayからInt16Arrayに変換
          const int16Array = new Int16Array(samples.length)
          for (let i = 0; i < samples.length; i++) {
            int16Array[i] = samples[i] * 0x7FFF
          }
          
          // MP3エンコード
          const mp3Data = []
          const chunkSize = 1152
          
          for (let i = 0; i < int16Array.length; i += chunkSize) {
            const chunk = int16Array.subarray(i, i + chunkSize)
            const mp3buf = mp3Encoder.encodeBuffer(chunk)
            if (mp3buf.length > 0) {
              mp3Data.push(mp3buf)
            }
          }
          
          // 最終フラッシュ
          const mp3buf = mp3Encoder.flush()
          if (mp3buf.length > 0) {
            mp3Data.push(mp3buf)
          }
          
          const mp3Blob = new Blob(mp3Data, { type: 'audio/mp3' })
          resolve(mp3Blob)
        } catch (error) {
          reject(error)
        }
      }
      
      fileReader.onerror = () => reject(fileReader.error)
      fileReader.readAsArrayBuffer(webmBlob)
    })
  }, [])

  // マイクの初期化
  const initializeAudio = useCallback(async () => {
    try {
      setError(null)
      
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          sampleRate: 44100,
          channelCount: 1
        }
      })

      // AudioContextの設定
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext
      const audioContext = new AudioContextClass({
        sampleRate: 44100
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
        audioBitsPerSecond: 128000
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
  }, [])

  // デフォルトの保存先を設定
  const setDefaultSavePath = useCallback(async () => {
    if (window.electronAPI) {
      try {
        const defaultPath = await window.electronAPI.getDefaultSavePath()
        setCurrentFilePath(defaultPath)
      } catch (err) {
        console.error('デフォルト保存先設定エラー:', err)
      }
    }
  }, [])

  // コンポーネント初期化時にオーディオを設定
  useEffect(() => {
    initializeAudio()
    setDefaultSavePath() // デフォルトの保存先を設定
    
    return () => {
      // クリーンアップ
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
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

  // 保存先選択
  const selectSaveLocation = useCallback(async (): Promise<boolean> => {
    if (window.electronAPI) {
      const saveDialog = await window.electronAPI.showSaveDialog()
      if (saveDialog.canceled) {
        return false
      }
      setCurrentFilePath(saveDialog.filePath || null)
      return true
    }
    return false
  }, [])

  // 録音開始
  const startRecording = useCallback(async () => {
    if (!mediaRecorder || mediaRecorder.state !== 'inactive') {
      throw new Error('MediaRecorder is not ready')
    }

    // 保存先が設定されていない場合はエラー
    if (!currentFilePath) {
      throw new Error('保存先が設定されていません。先に保存先を選択してください。')
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

      console.log('保存開始 - データサイズ:', latestRecordingData.length, 'ファイルパス:', latestFilePath)

      const webmBlob = new Blob(latestRecordingData, { type: 'audio/webm' })
      
      if (latestFilePath && window.electronAPI) {
        try {
          // WebMからMP3に変換
          console.log('MP3変換開始...')
          const mp3Blob = await convertWebMToMp3(webmBlob)
          console.log('MP3変換完了')
          
          // Electronを使用してファイル保存
          const arrayBuffer = await mp3Blob.arrayBuffer()
          const result = await window.electronAPI.writeFile(latestFilePath, arrayBuffer)
          
          if (result.success) {
            console.log('ファイル保存成功:', latestFilePath)
          } else {
            console.error('ファイル保存エラー:', result.error)
            setError(new Error(`ファイル保存エラー: ${result.error}`))
          }
        } catch (err) {
          console.error('ファイル保存エラー:', err)
          setError(err instanceof Error ? err : new Error('ファイル保存に失敗しました'))
        }
      } else {
        // フォールバック: ブラウザのダウンロード
        try {
          console.log('フォールバック保存でMP3変換開始...')
          const mp3Blob = await convertWebMToMp3(webmBlob)
          console.log('フォールバック保存でMP3変換完了')
          
          const url = URL.createObjectURL(mp3Blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.mp3`
          document.body.appendChild(a)
          a.click()
          document.body.removeChild(a)
          URL.revokeObjectURL(url)
        } catch (err) {
          console.error('MP3変換エラー:', err)
          setError(err instanceof Error ? err : new Error('MP3変換に失敗しました'))
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
    autoSaveIntervalRef.current = setInterval(() => {
      saveChunkData()
    }, 5 * 60 * 1000) // 5分

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
        const webmBlob = new Blob(recordingData, { type: 'audio/webm' })
        console.log('緊急保存でMP3変換開始...')
        const mp3Blob = await convertWebMToMp3(webmBlob)
        console.log('緊急保存でMP3変換完了')
        
        const url = URL.createObjectURL(mp3Blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `emergency-save-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.mp3`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      } catch (err) {
        console.error('緊急保存MP3変換エラー:', err)
        // フォールバック: WebMで保存
        const webmBlob = new Blob(recordingData, { type: 'audio/webm' })
        const url = URL.createObjectURL(webmBlob)
        const a = document.createElement('a')
        a.href = url
        a.download = `emergency-save-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`
        document.body.appendChild(a)
        a.click()
        document.body.removeChild(a)
        URL.revokeObjectURL(url)
      }
    }
  }, [recordingData, convertWebMToMp3])

  // 最終的な録音データの保存
  const saveRecording = useCallback(async () => {
    if (recordingData.length === 0) return

    const blob = new Blob(recordingData, { type: 'audio/webm' })
    
    if (currentFilePath && window.electronAPI) {
      try {
        // Electronを使用してファイル保存
        const arrayBuffer = await blob.arrayBuffer()
        const result = await window.electronAPI.writeFile(currentFilePath, arrayBuffer)
        
        if (result.success) {
          console.log('ファイル保存成功:', currentFilePath)
        } else {
          console.error('ファイル保存エラー:', result.error)
          setError(new Error(`ファイル保存エラー: ${result.error}`))
        }
      } catch (err) {
        console.error('ファイル保存エラー:', err)
        setError(err instanceof Error ? err : new Error('ファイル保存に失敗しました'))
      }
    } else {
      // フォールバック: ブラウザのダウンロード
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `recording-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }, [recordingData, currentFilePath])

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
    selectSaveLocation
  }
}

export default useAudioRecorder