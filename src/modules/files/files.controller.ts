import {
  Controller,
  Get,
  Param,
  Headers,
  Res,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Response } from 'express';
import { FilesService } from './files.service';

// 添加文件数据接口
interface FileData {
  stream: NodeJS.ReadableStream;
  filename: string;
  mimetype: string;
  size: number;
  range?: {
    start: number;
    end: number;
    length: number;
  };
}

@Controller() // 移除 'files' 前缀，使用完整路径
export class FilesController {
  private readonly logger = new Logger(FilesController.name);

  constructor(private readonly filesService: FilesService) {}

  @Get('/files/download/:fileId') // 修改为完整的API路径
  async downloadFile(
    @Param('fileId') fileId: string,
    @Headers('range') range: string,
    @Res() res: Response,
  ) {
    this.logger.log(`Downloading file with ID: ${fileId}, Range: ${range}`);

    try {
      if (!fileId || isNaN(parseInt(fileId))) {
        throw new NotFoundException('Invalid file ID');
      }

      const fileData = (await this.filesService.downloadFile(
        parseInt(fileId),
        range,
      )) as FileData; // 添加类型断言

      // 设置通用响应头
      res.setHeader('Accept-Ranges', 'bytes');
      const encodedFilename = encodeURIComponent(fileData.filename);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
      );
      res.setHeader('Content-Type', fileData.mimetype);

      if (range && fileData.range) {
        // 添加条件检查
        // 处理范围请求
        res.status(206);
        res.setHeader(
          'Content-Range',
          `bytes ${fileData.range.start}-${fileData.range.end}/${fileData.size}`,
        );
        res.setHeader('Content-Length', fileData.range.length);
      } else {
        // 处理完整下载
        res.status(200);
        res.setHeader('Content-Length', fileData.size);
      }

      // 错误处理
      fileData.stream.on('error', (error) => {
        this.logger.error(`Error streaming file: ${error.message}`);
        if (!res.headersSent) {
          res.status(500).json({ message: 'Error streaming file' });
        }
      });

      // 完成处理
      fileData.stream.on('end', () => {
        this.logger.log(`Completed streaming file ${fileId}`);
      });

      // 流式传输
      fileData.stream.pipe(res);
    } catch (error) {
      this.logger.error(`Download failed: ${error.message}`);
      if (!res.headersSent) {
        if (error instanceof NotFoundException) {
          res.status(404).json({ message: error.message });
        } else {
          res.status(500).json({ message: 'Internal server error' });
        }
      }
    }
  }
}
