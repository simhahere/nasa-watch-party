// Upload a video file to Cloudinary using unsigned upload preset
// Uses XMLHttpRequest so we can track upload progress

export interface CloudinaryUploadResult {
  url: string;       // CDN URL (https://res.cloudinary.com/...)
  publicId: string;  // Cloudinary public ID
  duration: number;  // Video duration in seconds
  bytes: number;     // File size in bytes
  format: string;    // File format (mp4, webm, etc.)
  width: number;
  height: number;
}

export interface UploadOptions {
  onProgress?: (percent: number) => void;
  onStart?: () => void;
}

/**
 * Upload a video file to Cloudinary using an unsigned upload preset.
 * Progress is reported via `options.onProgress` (0–100).
 */
export async function uploadVideoToCloudinary(
  file: File,
  options: UploadOptions = {}
): Promise<CloudinaryUploadResult> {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = process.env.NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

  if (!cloudName) {
    throw new Error(
      'Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME environment variable.'
    );
  }
  if (!uploadPreset) {
    throw new Error(
      'Missing NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET environment variable.'
    );
  }

  const uploadUrl = `https://api.cloudinary.com/v1_1/${cloudName}/video/upload`;

  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', uploadPreset);
  formData.append('resource_type', 'video');

  return new Promise<CloudinaryUploadResult>((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Report upload progress
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && options.onProgress) {
        const percent = Math.round((event.loaded / event.total) * 100);
        options.onProgress(percent);
      }
    };

    // Notify caller that the upload has started
    xhr.upload.onloadstart = () => {
      options.onStart?.();
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const data = JSON.parse(xhr.responseText);
          resolve({
            url: data.secure_url as string,
            publicId: data.public_id as string,
            duration: (data.duration as number) ?? 0,
            bytes: data.bytes as number,
            format: data.format as string,
            width: (data.width as number) ?? 0,
            height: (data.height as number) ?? 0,
          });
        } catch {
          reject(new Error('Failed to parse Cloudinary response JSON.'));
        }
      } else {
        let message = `Cloudinary upload failed with status ${xhr.status}.`;
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData?.error?.message) {
            message = `Cloudinary error: ${errData.error.message}`;
          }
        } catch {
          // Ignore JSON parse error for error response
        }
        reject(new Error(message));
      }
    };

    xhr.onerror = () => {
      reject(new Error('Network error during Cloudinary upload.'));
    };

    xhr.ontimeout = () => {
      reject(new Error('Cloudinary upload timed out.'));
    };

    xhr.open('POST', uploadUrl);
    xhr.send(formData);
  });
}

/**
 * Returns an optimized Cloudinary video URL for a given public ID.
 * Applies automatic quality and format selection by default.
 */
export function getOptimizedUrl(
  publicId: string,
  options: { width?: number; quality?: string } = {}
): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!cloudName) {
    throw new Error(
      'Missing NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME environment variable.'
    );
  }

  const transformations: string[] = [
    `q_${options.quality ?? 'auto'}`,
    'f_auto',
  ];

  if (options.width) {
    transformations.push(`w_${options.width}`);
  }

  const transformStr = transformations.join(',');
  return `https://res.cloudinary.com/${cloudName}/video/upload/${transformStr}/${publicId}`;
}
