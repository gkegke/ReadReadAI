/**
 * Shared low-level OPFS utilities.
 * Designed to work in both the Main Thread and Web Workers.
 */

export async function getDirHandle(
    root: FileSystemDirectoryHandle, 
    path: string, 
    create = false
): Promise<FileSystemDirectoryHandle> {
    const parts = path.split('/').filter(p => p.length > 0);
    let currentHandle = root;

    for (const part of parts) {
        currentHandle = await currentHandle.getDirectoryHandle(part, { create });
    }

    return currentHandle;
}

export async function writeToHandle(
    root: FileSystemDirectoryHandle, 
    filepath: string, 
    blob: Blob
): Promise<void> {
    const parts = filepath.split('/').filter(p => p.length > 0);
    const filename = parts.pop();
    if (!filename) throw new Error("Invalid filepath: No filename provided");

    const dirPath = parts.join('/');
    const dirHandle = dirPath.length > 0 
        ? await getDirHandle(root, dirPath, true) 
        : root;

    const fileHandle = await dirHandle.getFileHandle(filename, { create: true });
    
    // @ts-ignore - createWritable is standard in OPFS
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

export async function readFromHandle(
    root: FileSystemDirectoryHandle, 
    filepath: string
): Promise<Blob> {
    const parts = filepath.split('/').filter(p => p.length > 0);
    const filename = parts.pop();
    if (!filename) throw new Error("Invalid filepath");

    const dirPath = parts.join('/');
    const dirHandle = dirPath.length > 0 
        ? await getDirHandle(root, dirPath, false) 
        : root;

    const fileHandle = await dirHandle.getFileHandle(filename);
    return await fileHandle.getFile();
}