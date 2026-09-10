import { BadRequestException, Injectable } from '@nestjs/common';
import type { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { z } from 'zod';
import type { ZodType } from 'zod';

/**
 * Global validation pipe. A DTO class opts in by declaring a static
 * `zodSchema` property:
 *
 *   class CreateUserDto {
 *     static readonly zodSchema = createUserSchema;
 *   }
 *
 * Parameters whose metatype carries no schema pass through untouched.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const schema = (metadata.metatype as { zodSchema?: ZodType } | undefined)?.zodSchema;
    if (!schema) {
      return value;
    }
    const result = schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException(z.treeifyError(result.error));
    }
    return result.data;
  }
}
