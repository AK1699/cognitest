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
      // flat human-readable messages up top (what clients display), full tree below
      const message = result.error.issues.map((issue) =>
        issue.path.length > 0 ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
      );
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        message,
        errors: z.treeifyError(result.error),
      });
    }
    return result.data;
  }
}
