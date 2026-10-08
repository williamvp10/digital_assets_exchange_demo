import {
  Injectable,
  NestMiddleware,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../database/entities/user.entity';
/** Identidad obtenida de DB; no confiar en un rol recibido en un encabezado. */
export type ActorRequest = Request & { actor: { id: string; role: string } };
/** Identificación simplificada exigida por el reto; no representa autenticación de producción. */
@Injectable()
export class IdentityMiddleware implements NestMiddleware {
  constructor(@InjectRepository(User) private readonly users: Repository<User>) {}
  async use(req: ActorRequest, _res: Response, next: NextFunction) {
    const id = req.header('X-User-Id');
    if (!id) throw new UnauthorizedException('X-User-Id required');
    const user = await this.users.findOne({ where: { id }, select: { id: true, role: true } });
    if (!user) throw new UnauthorizedException('Unknown user');
    req.actor = user;
    next();
  }
}
/** Se ejecuta después de IdentityMiddleware y limita cada área al rol correspondiente. */
@Injectable()
export class RoleMiddleware implements NestMiddleware {
  use(req: ActorRequest, _res: Response, next: NextFunction) {
    // La propiedad de cada recurso se valida adicionalmente en los servicios.
    const expected = req.originalUrl.split('?')[0].startsWith('/compliance/')
      ? 'COMPLIANCE'
      : 'USER';
    if (req.actor.role !== expected) throw new ForbiddenException('Role not authorized');
    next();
  }
}
