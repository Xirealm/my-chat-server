import { IsString, Length, IsPhoneNumber } from 'class-validator';

export class LoginDto {
  @IsPhoneNumber('CN')
  phone: string;

  @IsString()
  @Length(6, 20)
  password: string;
}

export class RegisterDto {
  @IsString()
  @Length(2, 20)
  username: string;

  @IsPhoneNumber('CN')
  phone: string;

  @IsString()
  @Length(6, 20)
  password: string;
}
