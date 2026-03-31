import {
  Directory,
  type DirectoryCreateOptions,
  File,
  type FileCreateOptions,
  type FileInfo,
  Paths,
  type DownloadOptions,
  type InfoOptions,
} from "expo-file-system";

export const EncodingType = {
  UTF8: "utf8",
  Base64: "base64",
} as const;

type FileEncoding = (typeof EncodingType)[keyof typeof EncodingType];

export const cacheDirectory = Paths.cache.uri;
export const documentDirectory = Paths.document.uri;

interface GetInfoResult extends FileInfo {
  isDirectory: boolean;
  files?: string[];
}

interface DeleteOptions {
  idempotent?: boolean;
}

interface RelocatingOptions {
  from: string;
  to: string;
}

interface ReadingOptions {
  encoding?: FileEncoding;
}

interface WritingOptions extends ReadingOptions {}

interface DownloadResult {
  uri: string;
}

interface DownloadProgressData {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
}

type DownloadProgressCallback = (data: DownloadProgressData) => void;

function getPathKind(uri: string) {
  const info = Paths.info(uri);
  return {
    exists: info.exists,
    isDirectory: info.isDirectory === true,
  };
}

function ensureParentDirectory(uri: string): void {
  new Directory(Paths.dirname(uri)).create({
    idempotent: true,
    intermediates: true,
  });
}

export async function getInfoAsync(
  uri: string,
  options: InfoOptions = {},
): Promise<GetInfoResult> {
  const pathInfo = getPathKind(uri);
  if (!pathInfo.exists) {
    return {
      exists: false,
      isDirectory: false,
      uri,
    };
  }

  if (pathInfo.isDirectory) {
    const info = new Directory(uri).info();
    return {
      ...info,
      isDirectory: true,
    };
  }

  const info = new File(uri).info(options);
  return {
    ...info,
    isDirectory: false,
  };
}

export async function deleteAsync(
  uri: string,
  options: DeleteOptions = {},
): Promise<void> {
  const pathInfo = getPathKind(uri);
  if (!pathInfo.exists) {
    if (options.idempotent) return;
    throw new Error(`Path does not exist: ${uri}`);
  }

  if (pathInfo.isDirectory) {
    new Directory(uri).delete();
    return;
  }

  new File(uri).delete();
}

export async function makeDirectoryAsync(
  uri: string,
  options: DirectoryCreateOptions = {},
): Promise<void> {
  new Directory(uri).create(options);
}

export async function copyAsync(options: RelocatingOptions): Promise<void> {
  const source = getPathKind(options.from);
  ensureParentDirectory(options.to);

  if (source.isDirectory) {
    new Directory(options.from).copy(new Directory(options.to));
    return;
  }

  new File(options.from).copy(new File(options.to));
}

export async function moveAsync(options: RelocatingOptions): Promise<void> {
  const source = getPathKind(options.from);
  ensureParentDirectory(options.to);

  if (source.isDirectory) {
    new Directory(options.from).move(new Directory(options.to));
    return;
  }

  new File(options.from).move(new File(options.to));
}

export async function readAsStringAsync(
  uri: string,
  options: ReadingOptions = {},
): Promise<string> {
  const file = new File(uri);
  if (options.encoding === EncodingType.Base64) {
    return file.base64();
  }
  return file.text();
}

export async function writeAsStringAsync(
  uri: string,
  contents: string,
  options: WritingOptions = {},
): Promise<void> {
  const file = new File(uri);
  if (!file.exists) {
    file.create({
      intermediates: true,
      overwrite: true,
    } satisfies FileCreateOptions);
  }
  file.write(contents, options);
}

export async function readDirectoryAsync(uri: string): Promise<string[]> {
  return new Directory(uri).list().map((entry) => entry.name);
}

export async function downloadAsync(
  uri: string,
  fileUri: string,
  options: DownloadOptions = {},
): Promise<DownloadResult> {
  ensureParentDirectory(fileUri);
  const file = await File.downloadFileAsync(uri, new File(fileUri), options);
  return { uri: file.uri };
}

export function createDownloadResumable(
  uri: string,
  fileUri: string,
  options: DownloadOptions = {},
  callback?: DownloadProgressCallback,
) {
  return {
    async downloadAsync(): Promise<DownloadResult> {
      const result = await downloadAsync(uri, fileUri, options);
      if (callback) {
        const info = await getInfoAsync(result.uri);
        const totalBytes = info.size ?? 0;
        callback({
          totalBytesWritten: totalBytes,
          totalBytesExpectedToWrite: totalBytes,
        });
      }
      return result;
    },
  };
}

export async function getFreeDiskStorageAsync(): Promise<number> {
  return Paths.availableDiskSpace;
}
