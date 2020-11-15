import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import IUpdateProductsQuantityDTO from '@modules/products/dtos/IUpdateProductsQuantityDTO';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,

    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,

    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const customer = await this.customersRepository.findById(customer_id);

    if (!customer) {
      throw new AppError('Customer does not exist');
    }

    const dbProducts = await this.productsRepository.findAllById(products);

    if (dbProducts.length !== products.length) {
      throw new AppError('One or more products do not exist in DB');
    }

    const updatedProducts: IUpdateProductsQuantityDTO[] = [];

    const orderProducts = products.map(product => {
      const dbProduct = dbProducts.find(dbProd => dbProd.id === product.id);

      if (!dbProduct) throw new AppError('An error occurred');

      if (!dbProduct.quantity || product.quantity > dbProduct.quantity) {
        throw new AppError("One or more product don't have enough stock.");
      }

      updatedProducts.push({
        id: product.id,
        quantity: dbProduct.quantity - product.quantity,
      });

      return {
        product_id: product.id,
        quantity: product.quantity,
        price: dbProduct.price,
      };
    });

    const order = await this.ordersRepository.create({
      customer,
      products: orderProducts,
    });

    await this.productsRepository.updateQuantity(updatedProducts);

    return order;
  }
}

export default CreateOrderService;
