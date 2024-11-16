declare module "super-dee-duper" {
  export interface FileSize {
    raw: number;
    formatted: string;
  }

  export interface FileInfo {
    path: string;
    name: string;
    size: number;
    formattedSize: string;
    created: Date;
    modified: Date;
    quickHash: string;
    hash: string | null;
  }

  /**
   * Find duplicate files in a directory
   * @param dir - Directory path to scan
   * @param recursive - Whether to scan subdirectories
   * @returns Array of file groups, where each group contains duplicate files
   */
  export function findDuplicates(
    dir: string,
    recursive: boolean
  ): Promise<FileInfo[][]>;
}
