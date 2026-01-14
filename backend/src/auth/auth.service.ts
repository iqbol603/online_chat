import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OperatorsService } from '../operators/operators.service';

@Injectable()
export class AuthService {
  constructor(
    private operatorsService: OperatorsService,
    private jwtService: JwtService,
  ) {}

  async validateOperator(email: string, password: string): Promise<any> {
    const operator = await this.operatorsService.findByEmail(email);
    if (operator && await this.operatorsService.validatePassword(operator, password)) {
      const { password_hash, ...result } = operator;
      return result;
    }
    return null;
  }

  async login(operator: any) {
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
  }

  async validateToken(token: string): Promise<any> {
    try {
      return this.jwtService.verify(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

