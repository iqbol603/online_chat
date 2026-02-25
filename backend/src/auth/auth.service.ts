import { Injectable, UnauthorizedException, InternalServerErrorException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OperatorsService } from '../operators/operators.service';

@Injectable()
export class AuthService {
  constructor(
    private operatorsService: OperatorsService,
    private jwtService: JwtService,
  ) {}

  async validateOperator(email: string, password: string): Promise<any> {
    try {
      const operator = await this.operatorsService.findByEmail(email);
      if (!operator) return null;
      if (!operator.password_hash) {
        console.error('[Auth] Operator has no password_hash:', operator.email);
        return null;
      }
      const ok = await this.operatorsService.validatePassword(operator, password);
      if (!ok) return null;
      const { password_hash, ...result } = operator;
      return result;
    } catch (err) {
      console.error('[Auth] validateOperator error:', err);
      throw err;
    }
  }

  async login(operator: any) {
    try {
      if (!operator || !operator.operator_id) {
        console.error('[Auth] login called with invalid operator:', !!operator);
        throw new InternalServerErrorException('Invalid auth state');
      }
      const payload = { email: operator.email, sub: operator.operator_id, role: operator.role };
      return {
        access_token: this.jwtService.sign(payload),
        operator: {
          operator_id: operator.operator_id,
          name: operator.name,
          email: operator.email,
          role: operator.role,
        },
      };
    } catch (err) {
      console.error('[Auth] login error:', err);
      throw new InternalServerErrorException('Login failed');
    }
  }

  async validateToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

