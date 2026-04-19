import { Activation, Prisma } from '@prisma/client';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { ActivatePromoCodeDto } from './dto/activate-promo-code.dto';
import { CreatePromoCodeDto } from './dto/create-promo-code.dto';
import { PrismaService } from '../database/prisma.service';
import { UpdatePromoCodeDto } from './dto/update-promo-code.dto';

type LockedPromoCode = {
  id: string;
  code: string;
  discount_percent: number;
  activation_limit: number;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
};

@Injectable()
export class PromoCodesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreatePromoCodeDto) {
    this.ensureValidPromoCodeDates(dto.expiresAt);

    try {
      return await this.prisma.promoCode.create({
        data: {
          code: dto.code,
          discountPercent: dto.discountPercent,
          activationLimit: dto.activationLimit,
          expiresAt: new Date(dto.expiresAt),
        },
        include: {
          _count: {
            select: {
              activations: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleUniqueCodeError(error);
      throw error;
    }
  }

  findAll() {
    return this.prisma.promoCode.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        _count: {
          select: {
            activations: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const promoCode = await this.prisma.promoCode.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            activations: true,
          },
        },
      },
    });

    if (!promoCode) {
      throw new NotFoundException('Promo code not found.');
    }

    return promoCode;
  }

  async update(id: string, dto: UpdatePromoCodeDto) {
    if (dto.expiresAt !== undefined) {
      this.ensureValidPromoCodeDates(dto.expiresAt);
    }

    if (dto.activationLimit !== undefined) {
      const activationsCount = await this.prisma.activation.count({
        where: { promoCodeId: id },
      });

      if (dto.activationLimit < activationsCount) {
        throw new ConflictException(
          'Activation limit cannot be lower than the current number of activations.',
        );
      }
    }

    const data: Prisma.PromoCodeUpdateInput = {};

    if (dto.code !== undefined) {
      data.code = dto.code;
    }

    if (dto.discountPercent !== undefined) {
      data.discountPercent = dto.discountPercent;
    }

    if (dto.activationLimit !== undefined) {
      data.activationLimit = dto.activationLimit;
    }

    if (dto.expiresAt !== undefined) {
      data.expiresAt = new Date(dto.expiresAt);
    }

    try {
      return await this.prisma.promoCode.update({
        where: { id },
        data,
        include: {
          _count: {
            select: {
              activations: true,
            },
          },
        },
      });
    } catch (error) {
      this.handleUniqueCodeError(error);
      throw error;
    }
  }

  async remove(id: string) {
    try {
      await this.prisma.promoCode.delete({
        where: { id },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('Promo code not found.');
      }

      throw error;
    }
  }

  async activate(dto: ActivatePromoCodeDto) {
    return this.executeActivationWithRetry(dto);
  }

  private async executeActivationWithRetry(
    dto: ActivatePromoCodeDto,
    maxRetries = 3,
  ) {
    for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const [promoCode] = await tx.$queryRaw<LockedPromoCode[]>`
              SELECT
                id,
                code,
                discount_percent,
                activation_limit,
                expires_at,
                created_at,
                updated_at
              FROM promo_codes
              WHERE code = ${dto.code}
              FOR UPDATE
            `;

            if (!promoCode) {
              throw new NotFoundException('Promo code not found.');
            }

            if (promoCode.expires_at.getTime() <= Date.now()) {
              throw new ConflictException('Promo code is expired.');
            }

            const existingActivation = await tx.activation.findUnique({
              where: {
                promoCodeId_email: {
                  promoCodeId: promoCode.id,
                  email: dto.email,
                },
              },
            });

            if (existingActivation) {
              throw new ConflictException(
                'Promo code has already been activated by this email.',
              );
            }

            const activationsCount = await tx.activation.count({
              where: {
                promoCodeId: promoCode.id,
              },
            });

            if (activationsCount >= promoCode.activation_limit) {
              throw new ConflictException('Promo code activation limit exceeded.');
            }

            const activation = await tx.activation.create({
              data: {
                promoCodeId: promoCode.id,
                email: dto.email,
              },
            });

            return this.buildActivationResponse(activation, promoCode);
          },
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        if (error instanceof ConflictException || error instanceof NotFoundException) {
          throw error;
        }

        if (this.isDuplicateActivationError(error)) {
          throw new ConflictException(
            'Promo code has already been activated by this email.',
          );
        }

        if (this.isRetryableTransactionError(error) && attempt < maxRetries) {
          continue;
        }

        throw error;
      }
    }
  }

  private buildActivationResponse(
    activation: Activation,
    promoCode: LockedPromoCode,
  ) {
    return {
      id: activation.id,
      promoCodeId: activation.promoCodeId,
      code: promoCode.code,
      email: activation.email,
      activatedAt: activation.activatedAt,
      discountPercent: promoCode.discount_percent,
    };
  }

  private handleUniqueCodeError(error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException('Promo code with this code already exists.');
    }
  }

  private isDuplicateActivationError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  private isRetryableTransactionError(error: unknown) {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    );
  }

  private ensureValidPromoCodeDates(expiresAt: string) {
    const parsedDate = new Date(expiresAt);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new BadRequestException('expiresAt must be a valid ISO date.');
    }

    if (parsedDate.getTime() <= Date.now()) {
      throw new BadRequestException('expiresAt must be a future date.');
    }
  }
}
