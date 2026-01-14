import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Patch,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import * as fs from 'fs';
import { MessagesService } from './messages.service';

interface CreateMessageDto {
  conversation_id: number;
  sender_type: 'client' | 'bot' | 'operator' | 'system';
  sender_id?: number;
  text: string;
  attachments?: any[];
}

@Controller('api/messages')
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  async create(@Body() dto: CreateMessageDto) {
    return await this.messagesService.create(dto);
  }

  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: (req, file, cb) => {
          const uploadPath = './uploads';
          if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
          }
          cb(null, uploadPath);
        },
        filename: (req, file, cb) => {
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const ext = extname(file.originalname);
          cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10MB
      },
      fileFilter: (req, file, cb) => {
        // Разрешаем изображения и некоторые типы файлов
        const allowedMimes = [
          'image/jpeg',
          'image/jpg',
          'image/png',
          'image/gif',
          'image/webp',
          'application/pdf',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        
        if (allowedMimes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Неподдерживаемый тип файла'), false);
        }
      },
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Файл не был загружен');
    }

    const fileUrl = `/uploads/${file.filename}`;
    
    return {
      url: fileUrl,
      filename: file.originalname,
      size: file.size,
      mimetype: file.mimetype,
      type: file.mimetype.startsWith('image/') ? 'image' : 'file',
    };
  }

  @Get('conversation/:conversationId')
  async findByConversation(@Param('conversationId', ParseIntPipe) conversationId: number) {
    return await this.messagesService.findByConversation(conversationId);
  }

  @Patch('conversation/:conversationId/read-operator')
  async markAsReadByOperator(@Param('conversationId', ParseIntPipe) conversationId: number) {
    await this.messagesService.markConversationAsReadByOperator(conversationId);
    return { success: true };
  }

  @Patch('conversation/:conversationId/read-client')
  async markAsReadByClient(@Param('conversationId', ParseIntPipe) conversationId: number) {
    await this.messagesService.markConversationAsReadByClient(conversationId);
    return { success: true };
  }

  @Patch(':messageId/read-client')
  async markMessageAsReadByClient(@Param('messageId', ParseIntPipe) messageId: number) {
    const message = await this.messagesService.markAsReadByClient(messageId);
    return { success: true, message };
  }

  @Patch(':messageId/read-operator')
  async markMessageAsReadByOperator(@Param('messageId', ParseIntPipe) messageId: number) {
    const message = await this.messagesService.markAsReadByOperator(messageId);
    return { success: true, message };
  }
}
