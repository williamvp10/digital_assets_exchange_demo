import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './database/entities/user.entity';
import { MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { DatabaseModule } from './database/database.module';
import { IdentityMiddleware, RoleMiddleware } from './auth/auth.middleware';
import { QuotesModule } from './quotes/quotes.module';
import { QuotesController } from './quotes/quotes.controller';
import { WalletsModule } from './wallets/wallets.module';
import { WalletsController } from './wallets/wallets.controller';
import { ExchangesModule } from './exchanges/exchanges.module';
import { ExchangesController } from './exchanges/exchanges.controller';
import { ComplianceController } from './compliance/compliance.controller';

@Module({
  imports: [
    DatabaseModule,
    TypeOrmModule.forFeature([User]),
    QuotesModule,
    WalletsModule,
    ExchangesModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // Identificar antes de autorizar. Swagger y sus recursos permanecen públicos.
    consumer
      .apply(IdentityMiddleware, RoleMiddleware)
      .exclude(
        { path: 'docs', method: RequestMethod.ALL },
        { path: 'docs/{*path}', method: RequestMethod.ALL },
        { path: 'docs-json', method: RequestMethod.ALL },
        { path: 'docs-yaml', method: RequestMethod.ALL },
      )
      .forRoutes(WalletsController, QuotesController, ExchangesController, ComplianceController);
  }
}
