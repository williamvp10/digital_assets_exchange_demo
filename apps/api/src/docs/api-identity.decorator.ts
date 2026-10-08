import { applyDecorators } from '@nestjs/common';
import { ApiForbiddenResponse, ApiSecurity, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { ApiErrorDto } from './responses.dto';

/** Describe el encabezado simplificado sin presentarlo como autenticación JWT. */
export function ApiIdentity() {
  return applyDecorators(
    ApiSecurity('userIdentity'),
    ApiUnauthorizedResponse({
      description: 'X-User-Id ausente o usuario desconocido.',
      type: ApiErrorDto,
    }),
    ApiForbiddenResponse({ description: 'El rol no permite esta acción.', type: ApiErrorDto }),
  );
}
