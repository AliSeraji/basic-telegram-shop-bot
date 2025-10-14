import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Promocode } from './promocode.entity';
import { CreatePromocodeDto } from './dto/create-promocode.dto';
import { UpdatePromocodeDto } from './dto/update-promocode.dto';

@Injectable()
export class PromocodeService {
  constructor(
    @InjectRepository(Promocode)
    private promocodeRepository: Repository<Promocode>,
  ) {}

  async create(dto: CreatePromocodeDto): Promise<Promocode> {
    return this.promocodeRepository.save({
      ...dto,
      isActive: true,
    });
  }

  async applyPromocode(code: string): Promise<Promocode> {
    const promocode = await this.promocodeRepository.findOne({
      where: { code, isActive: true },
    });
    if (!promocode) {
      throw new NotFoundException(`Promocode not found with code ${code}`);
    }
    if (promocode.validTill < new Date()) {
      throw new NotFoundException(`Promocode ${code} has expired`);
    }
    return promocode;
  }

  async findAll(): Promise<Promocode[]> {
    return this.promocodeRepository.find();
  }

  async findOne(id: number): Promise<Promocode> {
    const promocode = await this.promocodeRepository.findOneBy({ id });
    if (!promocode) {
      throw new NotFoundException(`Promocode not found with ID ${id}`);
    }
    return promocode;
  }

  async update(id: number, dto: UpdatePromocodeDto): Promise<Promocode> {
    const result = await this.promocodeRepository.update(id, dto);
    if (result.affected === 0) {
      throw new NotFoundException(`Promocode not found with ID ${id}`);
    }
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    const result = await this.promocodeRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Promocode not found with ID ${id}`);
    }
  }
}
