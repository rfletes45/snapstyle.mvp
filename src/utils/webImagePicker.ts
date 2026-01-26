/**
 * Web Image Picker Utility
 * Provides fallback image selection for web platform since expo-image-picker
 * has limited functionality on web.
 */

export async function pickImageFromWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      let resolved = false;

      input.onchange = (e: any) => {
        try {
          resolved = true;
          const file = e.target.files?.[0];
          if (!file) {
            resolve(null);
            return;
          }

          // Read file as data URL
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            resolve(dataUrl);
          };
          reader.onerror = () => {
            resolve(null);
          };
          reader.readAsDataURL(file);
        } catch (error) {
          resolved = true;
          resolve(null);
        }
      };

      // Handle cancellation - when user closes the picker without selecting
      const handleCancel = () => {
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            resolve(null);
          }
        }, 300);
      };

      window.addEventListener("focus", handleCancel, { once: true });

      // Fallback timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(null);
        }
      }, 60000);

      input.click();
    } catch (error) {
      resolve(null);
    }
  });
}

export async function captureImageFromWebcam(): Promise<string | null> {
  try {
    // Check if getUserMedia is available
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices || !mediaDevices.getUserMedia) {
      // Fall back to file picker
      return pickImageFromWeb();
    }

    // Request camera access
    const stream = await mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });

    // Create video element to capture from
    const video = document.createElement("video");
    video.srcObject = stream;
    video.play();

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        try {
          // Create canvas and capture frame
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            resolve(null);
            return;
          }

          ctx.drawImage(video, 0, 0);
          const imageUrl = canvas.toDataURL("image/jpeg", 0.8);

          // Stop the stream
          stream.getTracks().forEach((track) => track.stop());

          resolve(imageUrl);
        } catch (error) {
          stream.getTracks().forEach((track) => track.stop());
          resolve(null);
        }
      };

      // Timeout in case video doesn't load
      setTimeout(() => {
        stream.getTracks().forEach((track) => track.stop());
        resolve(null);
      }, 5000);
    });
  } catch (error) {
    // Fall back to file picker
    return pickImageFromWeb();
  }
}
