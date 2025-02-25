export const jwtConfig = {
  global: true,
  // 硬编码的默认密钥（不安全）
  secret: process.env.JWT_SECRET || 'your-secret-key',
  signOptions: { expiresIn: '3d' }, // token 有效期
};
