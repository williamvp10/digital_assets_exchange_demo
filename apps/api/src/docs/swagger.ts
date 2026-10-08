import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Instala la documentación pública; las rutas de negocio mantienen sus middlewares. */
export function configureSwagger(app: INestApplication) {
  const configuration = new DocumentBuilder()
    .setTitle('Plataforma de activos digitales — Sandbox')
    .setDescription(
      'API de wallets e intercambios USDT-SBX → XAUT-SBX. ' +
        'En Authorize ingresa user-001 (Usuario) o compliance-001 (Cumplimiento). ' +
        'Los importes son cadenas decimales. La identificación por encabezado es solo para esta prueba.',
    )
    .setVersion('0.1.0')
    .addApiKey({ type: 'apiKey', in: 'header', name: 'X-User-Id' }, 'userIdentity')
    .build();

  const document = SwaggerModule.createDocument(app, configuration);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs-json',
    swaggerOptions: { persistAuthorization: true },
  });
  return document;
}
