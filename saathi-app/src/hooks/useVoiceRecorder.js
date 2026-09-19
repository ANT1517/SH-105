import { useCallback, useState } from 'react';
import { AudioModule, RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from 'expo-audio';

/**
 * Microphone recording for the Chat mic button (expo-audio). HIGH_QUALITY records .m4a on iOS/Android and webm on web.
 *
 * start() resolves true once recording, false if permission was denied or recording could not start (then `error`
 * says why). stop() resolves the recording's file uri.
 */
export function useVoiceRecorder() {
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const [error, setError] = useState(null);

  const start = useCallback(async () => {
    setError(null);
    try {
      const permission = await AudioModule.requestRecordingPermissionsAsync();
      if (!permission.granted) {
        setError('Microphone permission was denied. Please allow it to speak to Saathi.');
        return false;
      }
      await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      return true;
    } catch (e) {
      setError(e && e.message ? e.message : 'Could not start recording.');
      return false;
    }
  }, [recorder]);

  const stop = useCallback(async () => {
    await recorder.stop();
    await setAudioModeAsync({ allowsRecording: false });
    return recorder.uri;
  }, [recorder]);

  return { isRecording: recorderState.isRecording, start, stop, error };
}
