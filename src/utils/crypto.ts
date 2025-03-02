import * as crypto from 'crypto';

const SECRET_KEY = '1401443038myj';
const ALGORITHM = 'aes-256-cbc';

export class MessageCrypto {
  private static getKey() {
    // 确保密钥长度为32字节(256位)
    return Buffer.from(SECRET_KEY.padEnd(32, '0'));
  }

  static encrypt(data: any): string {
    try {
      const key = this.getKey();
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

      const jsonStr = JSON.stringify(data);
      const encrypted = Buffer.concat([
        cipher.update(Buffer.from(jsonStr, 'utf8')),
        cipher.final(),
      ]);

      // 将 IV 和加密内容一起编码
      const result = {
        iv: iv.toString('base64'),
        content: encrypted.toString('base64'),
      };

      return JSON.stringify(result);
    } catch (error) {
      console.error('Encryption failed:', error);
      throw error;
    }
  }

  static decrypt(encryptedData: string): any {
    try {
      const { iv, content } = JSON.parse(encryptedData);
      const key = this.getKey();
      const ivBuffer = Buffer.from(iv, 'base64');
      const encryptedBuffer = Buffer.from(content, 'base64');

      const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
      const decrypted = Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final(),
      ]);

      return JSON.parse(decrypted.toString('utf8'));
    } catch (error) {
      console.error('Decryption failed:', error);
      throw error;
    }
  }

  static decryptFileChunk(encryptedData: string): Buffer {
    try {
      const { iv, content } = JSON.parse(encryptedData);
      const key = this.getKey();
      const ivBuffer = Buffer.from(iv, 'base64');
      const encryptedBuffer = Buffer.from(content, 'base64');

      const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer);
      return Buffer.concat([
        decipher.update(encryptedBuffer),
        decipher.final(),
      ]);
    } catch (error) {
      console.error('File chunk decryption failed:', error);
      throw error;
    }
  }
}
