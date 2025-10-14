import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cart } from './cart.entity';
import { CreateCartDto } from './dto/create-cart.dto';
import { UpdateCartDto } from './dto/update-cart.dto';
import { UserService } from '../user/user.service';
import { ProductService } from '../product/product.service';

@Injectable()
export class CartService {
  constructor(
    @InjectRepository(Cart)
    private cartRepository: Repository<Cart>,
    private userService: UserService,
    private productService: ProductService,
  ) {}

  async addToCart(dto: CreateCartDto): Promise<Cart> {
    const user = await this.userService.findByTelegramId(dto.telegramId);
    const product = await this.productService.findOne(dto.productId);
    if (!user || !product) throw new Error('User or product not found');
    if (product.stock < dto.quantity)
      throw new Error('Not enough product in stock');

    const cartItem = await this.cartRepository.findOne({
      where: { user: { id: user.id }, product: { id: product.id } },
      relations: ['product', 'user'],
    });

    if (cartItem) {
      cartItem.quantity += dto.quantity;
      return this.cartRepository.save(cartItem);
    }

    return this.cartRepository.save({
      user,
      product,
      quantity: dto.quantity,
      addedAt: new Date(),
    });
  }

  async getCartItems(telegramId: string): Promise<Cart[]> {
    const user = await this.userService.findByTelegramId(telegramId);
    return this.cartRepository.find({
      where: { user: { id: user.id } },
      relations: ['product', 'user'],
    });
  }

  async getAllCartItems(): Promise<Cart[]> {
    return this.cartRepository.find({ relations: ['product', 'user'] });
  }

  async clearCart(telegramId: string): Promise<void> {
    const user = await this.userService.findByTelegramId(telegramId);
    await this.cartRepository.delete({ user: { id: user.id } });
  }

  async update(id: number, dto: UpdateCartDto): Promise<Cart> {
    const cartItem = await this.cartRepository.findOne({
      where: { id },
      relations: ['product', 'user'],
    });
    if (!cartItem) throw new NotFoundException(`No cart found by ID : ${id}`);
    Object.assign(cartItem, dto);
    return this.cartRepository.save(cartItem);
  }

  async remove(id: number): Promise<void> {
    const result = await this.cartRepository.delete(id);
    if (result.affected === 0) {
      throw new NotFoundException(`Cart not found by ID : ${id}`);
    }
  }
}
