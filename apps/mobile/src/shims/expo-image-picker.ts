// Web replacement for `expo-image-picker`. Uses a hidden <input type="file">
// and returns the same shape the app consumes (`{ canceled, assets: [{ uri }] }`).

export const MediaTypeOptions = {
  Images: 'Images',
  Videos: 'Videos',
  All: 'All',
} as const;

export interface PermissionResponse {
  granted: boolean;
  status: 'granted' | 'denied' | 'undetermined';
  canAskAgain: boolean;
  expires: 'never';
}

export interface ImagePickerAsset {
  uri: string;
  width: number;
  height: number;
  fileName?: string;
  mimeType?: string;
}

export type ImagePickerResult =
  | { canceled: true; assets: null }
  | { canceled: false; assets: ImagePickerAsset[] };

export interface ImagePickerOptions {
  mediaTypes?: unknown;
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;
}

export async function requestMediaLibraryPermissionsAsync(): Promise<PermissionResponse> {
  // The browser file picker is the permission prompt.
  return { granted: true, status: 'granted', canAskAgain: true, expires: 'never' };
}

export async function requestCameraPermissionsAsync(): Promise<PermissionResponse> {
  return { granted: true, status: 'granted', canAskAgain: true, expires: 'never' };
}

export async function launchImageLibraryAsync(_options: ImagePickerOptions = {}): Promise<ImagePickerResult> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.style.display = 'none';
    document.body.appendChild(input);

    const cleanup = () => {
      window.setTimeout(() => input.remove(), 0);
    };

    input.addEventListener('change', () => {
      const file = input.files?.[0];
      cleanup();
      if (!file) {
        resolve({ canceled: true, assets: null });
        return;
      }
      resolve({
        canceled: false,
        assets: [
          {
            uri: URL.createObjectURL(file),
            width: 0,
            height: 0,
            fileName: file.name,
            mimeType: file.type,
          },
        ],
      });
    });

    input.addEventListener('cancel', () => {
      cleanup();
      resolve({ canceled: true, assets: null });
    });

    input.click();
  });
}

export const launchCameraAsync = launchImageLibraryAsync;
