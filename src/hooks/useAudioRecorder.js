import { useState, useRef, useCallback, useEffect } from 'react'

const useAudioRecorder = () => {
  const [audioStream, setAudioStream] = useState(null)
  const [mediaRecorder, setMediaRecorder] = useState(null)
  const [recordingData, setRecordingData] = useState([])
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState(null)
  const [currentFilePath, setCurrentFilePath] = useState(null)
  
  const audioContextRef = useRef(null)
  const gainNodeRef = useRef(null)
  const analyserRef = useRef(null)
  const autoSaveIntervalRef = useRef(null)

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
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
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
      setError(err)
    }
  }, [])

  // コンポーネント初期化時にオーディオを設定
  useEffect(() => {
    initializeAudio()
    
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
  }, [initializeAudio])

  // 録音開始
  const startRecording = useCallback(async () => {
    if (!mediaRecorder || mediaRecorder.state !== 'inactive') {
      throw new Error('MediaRecorder is not ready')
    }

    // 保存先を選択
    if (window.electronAPI) {
      const saveDialog = await window.electronAPI.showSaveDialog()
      if (saveDialog.canceled) {
        throw new Error('保存先が選択されていません')
      }
      setCurrentFilePath(saveDialog.filePath)
    }

    setRecordingData([])
    setError(null)

    // データが利用可能になったときの処理
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        setRecordingData(prev => [...prev, event.data])
      }
    }

    // 録音終了時の処理
    mediaRecorder.onstop = async () => {
      if (autoSaveIntervalRef.current) {
        clearInterval(autoSaveIntervalRef.current)
      }
      await saveRecording()
    }

    // エラーハンドリング
    mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event.error)
      setError(event.error)
    }

    // 録音開始（1秒ごとにデータを取得）
    mediaRecorder.start(1000)

    // 5分ごとの自動保存を設定
    autoSaveIntervalRef.current = setInterval(() => {
      saveChunkData()
    }, 5 * 60 * 1000) // 5分

  }, [mediaRecorder])

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
  const saveChunkData = useCallback(() => {
    if (recordingData.length > 0) {
      const blob = new Blob(recordingData, { type: 'audio/webm' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `emergency-save-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.webm`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }, [recordingData])

  // 最終的な録音データの保存
  const saveRecording = useCallback(async () => {
    if (recordingData.length === 0) return

    const blob = new Blob(recordingData, { type: 'audio/webm' })
    
    if (currentFilePath) {
      // Electronを使用してファイル保存
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = currentFilePath.split('/').pop() || 'recording.webm'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
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
  const setInputGain = useCallback((gain) => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = gain
    }
  }, [])

  // 緊急停止
  const emergencyStop = useCallback(() => {
    try {
      stopRecording()
      saveChunkData()
    } catch (err) {
      console.error('Emergency stop error:', err)
    }
  }, [stopRecording, saveChunkData])

  return {
    audioStream,
    mediaRecorder,
    recordingData,
    isInitialized,
    error,
    analyser: analyserRef.current,
    audioContext: audioContextRef.current,
    startRecording,
    stopRecording,
    setInputGain,
    saveChunkData,
    emergencyStop,
    initializeAudio
  }
}

export default useAudioRecorder