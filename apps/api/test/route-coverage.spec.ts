import 'reflect-metadata';

import { Test } from '@nestjs/testing';
import { MODULE_PATH, PATH_METADATA } from '@nestjs/common/constants';
import { ModulesContainer } from '@nestjs/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { TestingModule } from '@nestjs/testing';

import { PERMISSIONS_METADATA } from '../src/authz/decorators/require-permission.decorator';
import { IS_PUBLIC_METADATA } from '../src/common/decorators/public.decorator';
import { AppModule } from '../src/app.module';
import { loadEnv } from '../src/config/load-env';

loadEnv();

/**
 * Every route under an :organizationId path must declare @RequirePermission
 * or be explicitly @Public() — PermissionGuard passes routes without metadata,
 * so this spec is what makes an unguarded tenant route impossible to ship.
 */
describe('tenant route coverage', () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  it('every :organizationId route declares permissions or @Public', () => {
    const container = moduleRef.get(ModulesContainer);
    const offenders: string[] = [];

    for (const module of container.values()) {
      for (const controllerWrapper of module.controllers.values()) {
        const controller = controllerWrapper.metatype;
        if (!controller) continue;
        const controllerPath = String(
          (Reflect.getMetadata(PATH_METADATA, controller) as string | undefined) ??
            (Reflect.getMetadata(MODULE_PATH, controller) as string | undefined) ??
            '',
        );
        const prototype = controller.prototype as Record<string, unknown>;
        for (const name of Object.getOwnPropertyNames(prototype)) {
          if (name === 'constructor') continue;
          const handler = prototype[name];
          if (typeof handler !== 'function') continue;
          const methodPath = (Reflect.getMetadata(PATH_METADATA, handler) as string) ?? undefined;
          if (methodPath === undefined) continue; // not a route handler

          const fullPath = `${controllerPath}/${methodPath}`;
          if (!fullPath.includes(':organizationId')) continue;

          const hasPermission =
            Reflect.getMetadata(PERMISSIONS_METADATA, handler) ??
            Reflect.getMetadata(PERMISSIONS_METADATA, controller);
          const isPublic =
            Reflect.getMetadata(IS_PUBLIC_METADATA, handler) ??
            Reflect.getMetadata(IS_PUBLIC_METADATA, controller);

          if (!hasPermission && !isPublic) {
            offenders.push(`${controller.name}.${name} (${fullPath})`);
          }
        }
      }
    }

    expect(offenders, `tenant routes without @RequirePermission/@Public`).toEqual([]);
  });
});
