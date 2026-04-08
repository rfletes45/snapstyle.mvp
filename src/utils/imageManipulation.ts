import {
  ImageManipulator,
  SaveFormat,
  type ImageManipulatorContext,
  type ImageRef,
  type ImageResult,
  type SaveOptions,
} from "expo-image-manipulator";

export type ImageTransform = (context: ImageManipulatorContext) => void;

export async function manipulateImage(
  source: string,
  transform?: ImageTransform,
  saveOptions: SaveOptions = {},
): Promise<ImageResult> {
  const context = ImageManipulator.manipulate(source);
  let image: ImageRef | null = null;

  try {
    transform?.(context);
    image = await context.renderAsync();
    return await image.saveAsync({
      format: SaveFormat.JPEG,
      ...saveOptions,
    });
  } finally {
    image?.release();
    context.release();
  }
}

export async function getImageDimensions(source: string): Promise<{
  width: number;
  height: number;
}> {
  const context = ImageManipulator.manipulate(source);
  let image: ImageRef | null = null;

  try {
    image = await context.renderAsync();
    return {
      width: image.width,
      height: image.height,
    };
  } finally {
    image?.release();
    context.release();
  }
}
