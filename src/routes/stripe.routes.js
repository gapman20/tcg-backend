const express = require('express');
const Stripe = require('stripe');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../config/prisma');

const router = express.Router();
const { authMiddleware, optionalAuth } = require('../middleware/auth');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || 'sk_test_your_key');

router.post('/create-payment-intent', optionalAuth, async (req, res) => {
  try {
    const { amount, currency = 'mxn' } = req.body;

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
    });

    res.json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    console.error('Stripe error:', error);
    res.status(500).json({ error: 'Error creating payment intent' });
  }
});

router.post('/process-payment', optionalAuth, async (req, res) => {
  const t = await prisma.$transaction(async (tx) => {
    try {
      const {
        paymentMethodId,
        cardholderName,
        saveCard,
        useSavedCard,
        items,
        customerName,
        customerEmail,
        customerPhone,
        address,
        city,
        state,
        zipCode,
        deliveryOption,
      } = req.body;

      let finalPaymentMethodId = paymentMethodId;

      if (useSavedCard && req.userId) {
        const user = await tx.user.findUnique({
          where: { id: req.userId },
          select: { stripeCustomerId: true, stripePaymentMethodId: true }
        });
        
        if (!user?.stripeCustomerId || !user?.stripePaymentMethodId) {
          throw { status: 400, message: 'No tienes tarjeta guardada. Por favor ingresa los datos de tu tarjeta.' };
        }

        finalPaymentMethodId = user.stripePaymentMethodId;
      }

      let subtotal = 0;
      const orderItems = [];

      for (const item of items) {
        const itemPrice = parseFloat(item.price || 0);
        const itemQuantity = parseInt(item.quantity || 1);
        
        if (item.cardId) {
          const card = await tx.card.findUnique({ where: { id: item.cardId } });
          if (!card) throw { status: 404, message: `Card ${item.cardId} not found` };
          if (card.stock < itemQuantity) {
            throw { status: 400, message: `Insufficient stock for ${card.name}` };
          }
          orderItems.push({
            cardId: card.id,
            name: item.name,
            price: itemPrice,
            quantity: itemQuantity,
            imageUrl: item.imageUrl || card.imageUrl
          });
          subtotal += itemPrice * itemQuantity;

          await tx.card.update({
            where: { id: card.id },
            data: { stock: card.stock - itemQuantity }
          });
        } else if (item.productId) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          if (!product) throw { status: 404, message: `Product ${item.productId} not found` };
          if (product.stock < itemQuantity) {
            throw { status: 400, message: `Insufficient stock for ${product.name}` };
          }
          orderItems.push({
            productId: product.id,
            name: item.name,
            price: itemPrice,
            quantity: itemQuantity,
            imageUrl: item.imageUrl || product.imageUrl
          });
          subtotal += itemPrice * itemQuantity;

          await tx.product.update({
            where: { id: product.id },
            data: { stock: product.stock - itemQuantity }
          });
        } else {
          orderItems.push({
            name: item.name,
            price: itemPrice,
            quantity: itemQuantity,
            imageUrl: item.imageUrl
          });
          subtotal += itemPrice * itemQuantity;
        }
      }

      const shipping = deliveryOption === 'delivery' ? 150 : 0;
      const total = Math.max(subtotal + shipping, 50);

      const orderNumber = `ORD-${Date.now()}-${uuidv4().slice(0, 6).toUpperCase()}`;

      const paymentIntentParams = {
        amount: Math.round(total * 100),
        currency: 'mxn',
        confirm: true,
        automatic_payment_methods: {
          enabled: true,
          allow_redirects: 'never',
        },
      };

      if (finalPaymentMethodId) {
        paymentIntentParams.payment_method = finalPaymentMethodId;
      }

      const paymentIntent = await stripe.paymentIntents.create(paymentIntentParams);

      let cardBrand = null;
      let cardLast4 = null;
      let stripePaymentMethodId = null;
      
      const pmIdToCheck = finalPaymentMethodId || paymentMethodId;
      if (pmIdToCheck) {
        try {
          const paymentMethodDetails = await stripe.paymentMethods.retrieve(paymentMethodId);
          cardBrand = paymentMethodDetails.card?.brand || null;
          cardLast4 = paymentMethodDetails.card?.last4 || null;
          stripePaymentMethodId = paymentMethodId;
        } catch (e) {
          console.log('Could not retrieve payment method details');
        }
      }

      if (req.userId && cardBrand && cardLast4 && saveCard) {
        let stripeCustomerId = null;
        
        const existingUser = await tx.user.findUnique({
          where: { id: req.userId },
          select: { stripeCustomerId: true, email: true, name: true }
        });
        
        if (existingUser?.stripeCustomerId) {
          stripeCustomerId = existingUser.stripeCustomerId;
          try {
            await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
          } catch (e) {
            console.log('Could not attach payment method to existing customer:', e.message);
          }
        } else {
          try {
            const customerEmailToUse = customerEmail || existingUser?.email || 'unknown@customer.com';
            const customerNameToUse = customerName || existingUser?.name || 'Cliente';
            
            const customer = await stripe.customers.create({
              email: customerEmailToUse,
              name: customerNameToUse,
            });
            stripeCustomerId = customer.id;
            
            if (stripeCustomerId && paymentMethodId) {
              try {
                await stripe.paymentMethods.attach(paymentMethodId, { customer: stripeCustomerId });
              } catch (e) {
                console.log('Could not attach payment method to new customer:', e.message);
              }
            }
          } catch (e) {
            console.log('Could not create Stripe customer:', e.message);
            stripeCustomerId = null;
          }
        }
        
        await tx.user.update({
          where: { id: req.userId },
          data: {
            cardBrand,
            cardLast4,
            cardHolderName: cardholderName || null,
            stripeCustomerId: stripeCustomerId,
            stripePaymentMethodId,
          },
        });
      }

      const order = await tx.order.create({
        data: {
          orderNumber,
          userId: req.userId || null,
          customerName,
          customerEmail,
          customerPhone,
          address,
          city,
          state,
          zipCode,
          subtotal,
          shipping,
          total,
          paymentMethod: 'stripe',
          paymentId: paymentIntent.id,
          cardBrand,
          cardLast4,
          cardHolderName: cardholderName || null,
          status: paymentIntent.status === 'succeeded' ? 'PROCESSING' : 'PENDING',
          items: {
            create: orderItems
          }
        },
        include: {
          items: true,
          user: { select: { id: true, email: true, name: true } }
        }
      });

      return order;
    } catch (error) {
      throw error;
    }
  });

  try {
    res.status(201).json(t);
  } catch (error) {
    console.error(error);
    if (error.status) {
      return res.status(error.status).json({ error: error.message });
    }
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;