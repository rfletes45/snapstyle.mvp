/**
 * Web Image Picker Utility
 * Provides fallback image selection for web platform since expo-image-picker
 * has limited functionality on web.
 */

export async function pickImageFromWeb(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      console.log("🔵 [webImagePicker] Creating file input element");

      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*";

      let resolved = false;

      input.onchange = (e: any) => {
        try {
          resolved = true;
          const file = e.target.files?.[0];
          if (!file) {
            console.log("ℹ️  [webImagePicker] No file selected");
            resolve(null);
            return;
          }

          console.log("✅ [webImagePicker] File selected:", {
            name: file.name,
            type: file.type,
            size: file.size,
          });

          // Read file as data URL
          const reader = new FileReader();
          reader.onload = (event) => {
            const dataUrl = event.target?.result as string;
            console.log("✅ [webImagePicker] File converted to data URL");
            resolve(dataUrl);
          };
          reader.onerror = (error) => {
            console.error("❌ [webImagePicker] FileReader error:", error);
            resolve(null);
          };
          reader.readAsDataURL(file);
        } catch (error) {
          console.error("❌ [webImagePicker] Error processing file:", error);
          resolved = true;
          resolve(null);
        }
      };

      input.onclick = () => {
        console.log("🔵 [webImagePicker] File input clicked");
      };

      // Handle cancellation - when user closes the picker without selecting
      const handleCancel = () => {
        if (!resolved) {
          console.log("ℹ️  [webImagePicker] File picker cancelled");
          resolved = true;
          resolve(null);
        }
      };

      // Listen for window focus to detect cancellation
      // When the file picker dialog is closed, the window regains focus
      window.addEventListener("focus", handleCancel, { once: true });

      // Fallback timeout in case focus event doesn't fire
      setTimeout(() => {
        if (!resolved) {
          console.log("⚠️  [webImagePicker] File picker timeout");
          resolved = true;
          resolve(null);
        }
      }, 60000); // 60 second timeout

      console.log("🔵 [webImagePicker] Triggering file input click");
      input.click();
    } catch (error) {
      console.error("❌ [webImagePicker] Fatal error:", error);
      resolve(null);
    }
  });
}

export async function captureImageFromWebcam(): Promise<string | null> {
  try {
    console.log("🔵 [webImagePicker] Attempting webcam capture");

    // Check if getUserMedia is available
    const mediaDevices = navigator.mediaDevices;
    if (!mediaDevices || !mediaDevices.getUserMedia) {
      console.warn("⚠️  [webImagePicker] getUserMedia not available");
      // Fall back to file picker
      return pickImageFromWeb();
    }

    // Request camera access
    console.log("🔵 [webImagePicker] Requesting camera permission");
    const stream = await mediaDevices.getUserMedia({
      video: true,
      audio: false,
    });
    console.log("✅ [webImagePicker] Camera stream obtained");

    // Create video element to capture from
    const video = document.createElement("video");
    video.srcObject = stream;
    video.play();

    return new Promise((resolve) => {
      video.onloadedmetadata = () => {
        try {
          console.log(
            "🔵 [webImagePicker] Video metadata loaded, creating canvas",
          );

          // Create canvas and capture frame
          const canvas = document.createElement("canvas");
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d");
          if (!ctx) {
            console.error("❌ [webImagePicker] Could not get canvas context");
            resolve(null);
            return;
          }

          ctx.drawImage(video, 0, 0);
          const imageUrl = canvas.toDataURL("image/jpeg", 0.8);

          console.log("✅ [webImagePicker] Captured image from webcam");

          // Stop the stream
          stream.getTracks().forEach((track) => track.stop());
          console.log("✅ [webImagePicker] Camera stream stopped");

          resolve(imageUrl);
        } catch (error) {
          console.error("❌ [webImagePicker] Error capturing frame:", error);
          stream.getTracks().forEach((track) => track.stop());
          resolve(null);
        }
      };

      // Timeout in case video doesn't load
      setTimeout(() => {
        console.warn("⚠️  [webImagePicker] Video capture timeout");
        stream.getTracks().forEach((track) => track.stop());
        resolve(null);
      }, 5000);
    });
  } catch (error) {
    console.error("❌ [webImagePicker] Camera error:", error);
    // Fall back to file picker
    return pickImageFromWeb();
  }
}
