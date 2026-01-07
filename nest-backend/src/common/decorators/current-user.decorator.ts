import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user as { userId?: string; _id?: string; role?: string } | undefined;
    if (!user) return undefined;
    return { userId: user.userId || user._id, role: user.role };
  },
);
