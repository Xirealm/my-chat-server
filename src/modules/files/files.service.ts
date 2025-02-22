import { Injectable, Logger } from '@nestjs/common';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../prisma/prisma.service';

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

  private getFileExtension(filename: string): string {
    const ext = filename.split('.').pop();
    return ext ? `.${ext}` : '';
  }

  getFileUrl(filename: string): string {
    return `/uploads/${filename}`;
  }
}
