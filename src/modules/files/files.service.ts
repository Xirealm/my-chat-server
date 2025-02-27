import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { writeFile, mkdir, readFile } from 'fs/promises';
import { createWriteStream, createReadStream, statSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs/promises';

@Injectable()
export class FilesService {
  private readonly logger = new Logger(FilesService.name);
  private readonly uploadDir = 'uploads';

  constructor(private prisma: PrismaService) {}

  async saveFile(data: {
    buffer: Buffer;
    filename: string;
    mimetype: string;
    size: number;
    uploaderId: number;
  }) {
    try {
      // 生成唯一文件名
      const ext = this.getFileExtension(data.filename);
      const uniqueFilename = `${uuidv4()}${ext}`;
      const filepath = join(this.uploadDir, uniqueFilename);

      // 保存文件到磁盘
      await writeFile(filepath, data.buffer);

      // 在数据库中创建文件记录
      const file = await this.prisma.file.create({
        data: {
          filename: data.filename,
          path: `/uploads/${uniqueFilename}`,
          mimetype: data.mimetype,
          size: data.size,
          uploaderId: data.uploaderId,
        },
      });

      return file;
    } catch (error) {
      this.logger.error(`Failed to save file: ${error.message}`);
      throw error;
    }
  }

  // 保存文件分片
  async saveFileChunk(data: {
    chunk: Buffer;
    chunkIndex: number;
    totalChunks: number;
    fileId: string;
  }) {
    const chunkDir = join(this.uploadDir, 'chunks', data.fileId);

    // 确保目录存在
    await mkdir(chunkDir, { recursive: true });

    // 保存分片
    const chunkPath = join(chunkDir, `${data.chunkIndex}`);
    await writeFile(chunkPath, data.chunk);

    return {
      chunkIndex: data.chunkIndex,
      success: true,
    };
  }

  // 合并文件分片
  async mergeFileChunks(data: {
    fileId: string;
    filename: string;
    totalChunks: number;
    mimetype: string;
    size: number;
    uploaderId: number;
  }) {
    const chunkDir = join(this.uploadDir, 'chunks', data.fileId);
    const ext = this.getFileExtension(data.filename);
    const uniqueFilename = `${uuidv4()}${ext}`;
    const finalPath = join(this.uploadDir, uniqueFilename);

    const writeStream = createWriteStream(finalPath);

    try {
      // 按顺序合并分片
      for (let i = 0; i < data.totalChunks; i++) {
        const chunkBuffer = await this.readChunkFile(join(chunkDir, `${i}`));
        await new Promise<void>((resolve, reject) => {
          writeStream.write(chunkBuffer, (error) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      // 创建文件记录
      const file = await this.prisma.file.create({
        data: {
          filename: data.filename,
          path: `/uploads/${uniqueFilename}`,
          mimetype: data.mimetype,
          size: data.size,
          uploaderId: data.uploaderId,
        },
      });

      // 合并完成后清理分片
      await this.cleanupChunks(data.fileId);

      return file;
    } finally {
      writeStream.end();
    }
  }

  async cleanupChunks(fileId: string) {
    try {
      const chunkDir = join(this.uploadDir, 'chunks', fileId);
      await fs.rm(chunkDir, { recursive: true, force: true });
      this.logger.log(`Successfully cleaned up chunks for file: ${fileId}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        this.logger.error(
          `Failed to cleanup chunks for file ${fileId}:`,
          error,
        );
      }
    }
  }

  private async readChunkFile(path: string): Promise<Buffer> {
    try {
      return await readFile(path);
    } catch (error) {
      this.logger.error(`Failed to read chunk file: ${error.message}`);
      throw error;
    }
  }

  private getFileExtension(filename: string): string {
    const ext = filename.split('.').pop();
    return ext ? `.${ext}` : '';
  }

  getFileUrl(filename: string): string {
    return `/uploads/${filename}`;
  }

  async downloadFile(fileId: number, range?: string) {
    try {
      const file = await this.prisma.file.findUnique({
        where: { id: fileId },
      });

      if (!file) {
        throw new NotFoundException('File not found');
      }

      const actualPath = join(
        process.cwd(),
        file.path.replace(/^\/uploads/, 'uploads'),
      );

      try {
        await fs.access(actualPath);
      } catch {
        throw new NotFoundException('File not found on disk');
      }

      const stat = statSync(actualPath);
      let stream;

      if (range) {
        // 解析 Range header
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;

        stream = createReadStream(actualPath, { start, end });

        return {
          stream,
          filename: file.filename,
          mimetype: file.mimetype,
          size: stat.size,
          range: {
            start,
            end,
            length: end - start + 1,
          },
        };
      } else {
        stream = createReadStream(actualPath);
        return {
          stream,
          filename: file.filename,
          mimetype: file.mimetype,
          size: stat.size,
        };
      }
    } catch (error) {
      this.logger.error(`Failed to download file: ${error.message}`);
      throw error;
    }
  }
}
