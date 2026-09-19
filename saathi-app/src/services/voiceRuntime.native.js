/**
 * Native (iOS / Android) upload adapter for the mic recording. Metro picks this file over voiceRuntime.js on device.
 *
 * In Expo SDK 57 the global fetch is Expo's standards-based one. Its FormData accepts strings and Blob-like
 * objects backed by a real file, and it REJECTS the classic React Native `{ uri, name, type }` part as well as a Blob
 * obtained from fetch(uri) ("Unsupported FormDataPart implementation"). expo-file-system's File is the supported
 * way to upload a local file: it is Blob-compatible and streams from disk.
 */
import { File } from 'expo-file-system';

export async function appendAudio(form, field, { uri }) {
  form.append(field, new File(uri)); // the filename (voice recording .m4a) comes from the File itself
}
